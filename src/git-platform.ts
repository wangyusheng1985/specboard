import {GitLabClient} from './gitlab-client.ts';
import {GitHubClient} from './github-client.ts';

export interface UnifiedMergeRequest {
 iid: number;
 title: string;
 description?: string;
 web_url: string;
 source_branch: string;
 target_branch: string;
 is_pr: boolean;
}

export interface UnifiedPipeline {
 id: number;
 status: 'pending'|'running'|'success'|'failed'|string;
 web_url: string;
 is_actions: boolean;
 sha?: string;
}

export interface GitPlatformClient {
 isGitHub: boolean;
 createOrUpdateMR(input: {sourceBranch: string; targetBranch: string; title: string; description?: string}): Promise<UnifiedMergeRequest>;
 getLatestPipeline(branch: string): Promise<UnifiedPipeline | null>;
 getFailedJobTrace(pipelineId: number): Promise<{name: string; trace: string} | null>;
}

export function isGitHubUrl(urlStr: string): boolean {
 try {
  const url = new URL(urlStr);
  if (process.env.TEST_GITHUB_HOST && url.host === process.env.TEST_GITHUB_HOST) return true;
  return url.host === 'github.com' || url.host.endsWith('.github.com');
 } catch {
  return false;
 }
}

export function createGitPlatformClient(repositoryUrl: string, token: string): GitPlatformClient {
 const projectUrl = new URL(repositoryUrl);
 const repoPath = projectUrl.pathname.replace(/^\//, '').replace(/\.git$/, '');

 if (isGitHubUrl(repositoryUrl)) {
  const client = new GitHubClient(projectUrl.origin, repoPath, token);
  return {
   isGitHub: true,
   async createOrUpdateMR(input) {
    const pr = await client.createPR(input);
    return {
     iid: pr.number,
     title: pr.title,
     description: pr.body,
     web_url: pr.html_url,
     source_branch: pr.head?.ref || input.sourceBranch,
     target_branch: pr.base?.ref || input.targetBranch,
     is_pr: true
    };
   },
   async getLatestPipeline(branch: string) {
    const run = await client.getLatestWorkflowRun(branch);
    if (!run) return null;
    let status = 'running';
    if (run.conclusion === 'success') {
     status = 'success';
    } else if (run.conclusion === 'failure' || run.conclusion === 'timed_out' || run.conclusion === 'cancelled') {
     status = 'failed';
    } else {
     // Fail-fast: check if any individual job in the workflow has already failed
     const failedJob = await client.getFailedJobLogs(run.id).catch(() => null);
     if (failedJob) {
      status = 'failed';
     } else if (run.status === 'queued') {
      status = 'pending';
     } else if (run.status === 'in_progress') {
      status = 'running';
     } else {
      status = run.conclusion || run.status;
     }
    }
    return {
     id: run.id,
     status,
     web_url: run.html_url,
     is_actions: true,
     sha: run.head_sha
    };
   },
   async getFailedJobTrace(pipelineId: number) {
    return client.getFailedJobLogs(pipelineId);
   }
  };
 }

 const gitlab = new GitLabClient(projectUrl.origin, repoPath, token);
 return {
  isGitHub: false,
  async createOrUpdateMR(input) {
   const mr = await gitlab.createMR(input);
   return {
    iid: mr.iid,
    title: mr.title,
    description: mr.description,
    web_url: mr.web_url,
    source_branch: mr.source_branch,
    target_branch: mr.target_branch,
    is_pr: false
   };
  },
  async getLatestPipeline(branch: string) {
   const p = await gitlab.getLatestPipeline(branch);
   if (!p) return null;
   return {
    id: p.id,
    status: p.status,
    web_url: p.web_url,
    is_actions: false,
    sha: p.sha
   };
  },
  async getFailedJobTrace(pipelineId: number) {
   const jobs = await gitlab.getPipelineJobs(pipelineId);
   const abnormalStatuses = ['failed', 'canceled', 'canceling', 'skipped', 'manual'];
   const failed = jobs.find(j => abnormalStatuses.includes(j.status)) || jobs.find(j => j.status !== 'success');
   if (!failed) return null;
   const trace = await gitlab.getJobTrace(failed.id).catch(() => '');
   return {name: failed.name, trace: trace || `Job "${failed.name}" status: ${failed.status}`};
  }
 };
}
