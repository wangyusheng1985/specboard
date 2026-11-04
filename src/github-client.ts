import {Octokit} from '@octokit/rest';

export interface GitHubPullRequest {
 id: number;
 number: number;
 title: string;
 body?: string;
 html_url: string;
 head: {ref: string};
 base: {ref: string};
 state: string;
}

export interface GitHubWorkflowRun {
 id: number;
 name: string;
 status: 'queued'|'in_progress'|'completed'|string;
 conclusion: 'success'|'failure'|'neutral'|'cancelled'|'timed_out'|'action_required'|'stale'|null|string;
 html_url: string;
 head_branch: string;
 head_sha: string;
}

export interface GitHubJob {
 id: number;
 name: string;
 status: string;
 conclusion: string | null;
 html_url?: string;
 labels?: string[];
 runner_name?: string | null;
 runner_group_name?: string | null;
}

export class GitHubClient {
 public origin: string;
 public owner: string;
 public repo: string;
 public token: string;
 public octokit: Octokit;

 constructor(origin: string, projectPath: string, token: string) {
  this.origin = origin;
  const cleanPath = projectPath.replace(/^\/+/, '').replace(/\.git$/, '');
  const parts = cleanPath.split('/');
  this.owner = parts[0] || '';
  this.repo = parts[1] || '';
  this.token = token;

  const cleanOrigin = origin.replace(/\/+$/, '');
  let baseUrl: string | undefined;
  if (!cleanOrigin.includes('github.com')) {
   baseUrl = cleanOrigin.includes('/api/v3') ? cleanOrigin : `${cleanOrigin}`;
  }

  this.octokit = new Octokit({
   auth: token,
   baseUrl,
   userAgent: 'Specboard',
   request: {
    timeout: 15000
   }
  });
 }

 async validateBranch(branch: string): Promise<boolean> {
  try {
   const res = await this.octokit.rest.repos.getBranch({
    owner: this.owner,
    repo: this.repo,
    branch
   });
   return Boolean(res?.data?.name);
  } catch (error: any) {
   if (error.status === 404) return false;
   throw error;
  }
 }

 async getPRByBranch(branch: string): Promise<GitHubPullRequest | null> {
  try {
   const res = await this.octokit.rest.pulls.list({
    owner: this.owner,
    repo: this.repo,
    head: `${this.owner}:${branch}`,
    state: 'open'
   });
   if (Array.isArray(res.data) && res.data.length > 0) {
    const pr = res.data[0];
    return {
     id: pr.id,
     number: pr.number,
     title: pr.title,
     body: pr.body || '',
     html_url: pr.html_url,
     head: {ref: pr.head.ref},
     base: {ref: pr.base.ref},
     state: pr.state
    };
   }
   // Fallback with bare branch name
   const fallback = await this.octokit.rest.pulls.list({
    owner: this.owner,
    repo: this.repo,
    head: branch,
    state: 'open'
   });
   if (Array.isArray(fallback.data) && fallback.data.length > 0) {
    const pr = fallback.data[0];
    return {
     id: pr.id,
     number: pr.number,
     title: pr.title,
     body: pr.body || '',
     html_url: pr.html_url,
     head: {ref: pr.head.ref},
     base: {ref: pr.base.ref},
     state: pr.state
    };
   }
   return null;
  } catch {
   return null;
  }
 }

 async createPR(input: {sourceBranch: string; targetBranch: string; title: string; description?: string}): Promise<GitHubPullRequest> {
  const existing = await this.getPRByBranch(input.sourceBranch);
  if (existing) {
   if (input.description || input.title) {
    try {
     return await this.updatePR(existing.number, {title: input.title, description: input.description});
    } catch {
     return existing;
    }
   }
   return existing;
  }
  const res = await this.octokit.rest.pulls.create({
   owner: this.owner,
   repo: this.repo,
   head: input.sourceBranch,
   base: input.targetBranch,
   title: input.title,
   body: input.description || ''
  });
  const pr = res.data;
  return {
   id: pr.id,
   number: pr.number,
   title: pr.title,
   body: pr.body || '',
   html_url: pr.html_url,
   head: {ref: pr.head.ref},
   base: {ref: pr.base.ref},
   state: pr.state
  };
 }

 async updatePR(pullNumber: number, input: {title?: string; description?: string; targetBranch?: string}): Promise<GitHubPullRequest> {
  const res = await this.octokit.rest.pulls.update({
   owner: this.owner,
   repo: this.repo,
   pull_number: pullNumber,
   ...(input.title ? {title: input.title} : {}),
   ...(input.description ? {body: input.description} : {}),
   ...(input.targetBranch ? {base: input.targetBranch} : {})
  });
  const pr = res.data;
  return {
   id: pr.id,
   number: pr.number,
   title: pr.title,
   body: pr.body || '',
   html_url: pr.html_url,
   head: {ref: pr.head.ref},
   base: {ref: pr.base.ref},
   state: pr.state
  };
 }

 async getLatestWorkflowRun(branch: string): Promise<GitHubWorkflowRun | null> {
  try {
   const res = await this.octokit.rest.actions.listWorkflowRunsForRepo({
    owner: this.owner,
    repo: this.repo,
    branch,
    per_page: 1
   });
   const run = res.data.workflow_runs?.[0];
   if (!run) return null;
   return {
    id: run.id,
    name: run.name || '',
    status: run.status || '',
    conclusion: run.conclusion,
    html_url: run.html_url,
    head_branch: run.head_branch || branch,
    head_sha: run.head_sha
   };
  } catch {
   return null;
  }
 }

 async getFailedJobLogs(runId: number): Promise<{name: string; trace: string} | null> {
  try {
   const res = await this.octokit.rest.actions.listJobsForWorkflowRun({
    owner: this.owner,
    repo: this.repo,
    run_id: runId,
    per_page: 50
   });
   const abnormalConclusions = ['failure', 'cancelled', 'timed_out', 'action_required', 'neutral'];
   const abnormalJob = res.data.jobs.find(j =>
    (j.conclusion && abnormalConclusions.includes(j.conclusion)) ||
    (j.status === 'completed' && j.conclusion !== 'success' && j.conclusion !== 'skipped')
   );
   if (!abnormalJob) return null;

   const synthesizeFallbackTrace = (job: any): string => {
    const details = [
     `Job "${job.name}" did not succeed.`,
     `Status: ${job.status || 'unknown'}`,
     `Conclusion: ${job.conclusion || 'unknown'}`
    ];
    if (job.labels && Array.isArray(job.labels) && job.labels.length > 0) {
     details.push(`Runner labels: ${job.labels.join(', ')}`);
    }
    if (job.runner_name) {
     details.push(`Runner name: ${job.runner_name}`);
    }
    if (job.html_url) {
     details.push(`Job URL: ${job.html_url}`);
    }
    return details.join('\n');
   };

   try {
    const logRes = await this.octokit.rest.actions.downloadJobLogsForWorkflowRun({
     owner: this.owner,
     repo: this.repo,
     job_id: abnormalJob.id
    });
    const trace = typeof logRes.data === 'string' ? logRes.data : '';
    if (trace.trim()) {
     return {name: abnormalJob.name, trace};
    }
    return {name: abnormalJob.name, trace: synthesizeFallbackTrace(abnormalJob)};
   } catch {
    return {name: abnormalJob.name, trace: synthesizeFallbackTrace(abnormalJob)};
   }
  } catch {
   return null;
  }
 }
}
