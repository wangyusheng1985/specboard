import {Gitlab} from '@gitbeaker/rest';

export interface GitLabMergeRequest {
 id: number;
 iid: number;
 title: string;
 description?: string;
 web_url: string;
 source_branch: string;
 target_branch: string;
 state: string;
 merge_status?: string;
 has_conflicts?: boolean;
}

export interface GitLabPipeline {
 id: number;
 iid: number;
 status: 'created'|'waiting_for_resource'|'preparing'|'pending'|'running'|'success'|'failed'|'canceled'|'skipped'|'manual'|'scheduled'|string;
 ref: string;
 sha: string;
 web_url: string;
 created_at?: string;
 updated_at?: string;
}

export interface GitLabJob {
 id: number;
 name: string;
 stage: string;
 status: string;
 web_url?: string;
}

export class GitLabClient {
 public origin: string;
 public projectPath: string;
 public token: string;
 public gitlab: InstanceType<typeof Gitlab>;

 constructor(origin: string, projectPath: string, token: string) {
  this.origin = origin.replace(/\/+$/, '');
  this.projectPath = projectPath.replace(/^\/+/, '').replace(/\.git$/, '');
  this.token = token;

  this.gitlab = new Gitlab({
   host: this.origin,
   token: this.token
  });
 }

 async validateBranch(branch: string): Promise<boolean> {
  try {
   const res = await this.gitlab.Branches.show(this.projectPath, branch);
   return Boolean((res as any)?.name);
  } catch {
   return false;
  }
 }

 async getMRByBranch(branch: string): Promise<GitLabMergeRequest | null> {
  try {
   const mrs = await this.gitlab.MergeRequests.all({
    projectId: this.projectPath,
    sourceBranch: branch,
    state: 'opened'
   });
   return Array.isArray(mrs) && mrs.length > 0 ? (mrs[0] as unknown as GitLabMergeRequest) : null;
  } catch {
   return null;
  }
 }

 async createMR(input: {sourceBranch: string; targetBranch: string; title: string; description?: string}): Promise<GitLabMergeRequest> {
  const existing = await this.getMRByBranch(input.sourceBranch);
  if (existing) {
   if (input.description || input.title) {
    try {
     return await this.updateMR(existing.iid, {title: input.title, description: input.description});
    } catch {
     return existing;
    }
   }
   return existing;
  }
  const created = await this.gitlab.MergeRequests.create(
   this.projectPath,
   input.sourceBranch,
   input.targetBranch,
   input.title,
   {
    description: input.description || '',
    removeSourceBranch: false
   }
  );
  return created as unknown as GitLabMergeRequest;
 }

 async updateMR(mrIid: number, input: {title?: string; description?: string; targetBranch?: string}): Promise<GitLabMergeRequest> {
  const updated = await this.gitlab.MergeRequests.edit(
   this.projectPath,
   mrIid,
   {
    ...(input.title ? {title: input.title} : {}),
    ...(input.description ? {description: input.description} : {}),
    ...(input.targetBranch ? {targetBranch: input.targetBranch} : {})
   }
  );
  return updated as unknown as GitLabMergeRequest;
 }

 async getLatestPipeline(branch: string): Promise<GitLabPipeline | null> {
  try {
   const pipelines = await this.gitlab.Pipelines.all(this.projectPath, {
    ref: branch,
    perPage: 1
   });
   return Array.isArray(pipelines) && pipelines.length > 0 ? (pipelines[0] as unknown as GitLabPipeline) : null;
  } catch {
   return null;
  }
 }

 async getPipelineJobs(pipelineId: number): Promise<GitLabJob[]> {
  try {
   const jobs = await this.gitlab.Jobs.all(this.projectPath, {
    pipelineId
   });
   return (Array.isArray(jobs) ? jobs : []) as unknown as GitLabJob[];
  } catch {
   return [];
  }
 }

 async getJobTrace(jobId: number): Promise<string> {
  try {
   const trace = await this.gitlab.Jobs.showLog(this.projectPath, jobId);
   return typeof trace === 'string' ? trace : String(trace || '');
  } catch {
   return '';
  }
 }
}
