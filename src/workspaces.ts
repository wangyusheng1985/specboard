import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, realpath, stat } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { decrypt, encrypt } from './security.ts';
import type { Store, Project, Task } from './store.ts';

const exec = promisify(execFile);
export class Workspaces {
  private locks = new Map<string, Promise<unknown>>();
  constructor(private store: Store, private key: string, private root: string, private allowedHosts: string[]) {}
  project(id: string): Project {
    const row = this.store.db.prepare('SELECT id,name,repository_url AS repositoryUrl,encrypted_token AS encryptedToken,default_branch AS defaultBranch,workspace_root AS workspaceRoot FROM projects WHERE id=?').get(id);
    if (!row) throw new Error('Project not found');
    return row as unknown as Project;
  }
  list() { return this.store.db.prepare('SELECT id,name,repository_url AS repositoryUrl,default_branch AS defaultBranch,workspace_root AS workspaceRoot FROM projects ORDER BY name').all(); }
  async validate(input: {name:string; repositoryUrl:string; apiToken:string; defaultBranch:string}) {
    if (![input.name,input.repositoryUrl,input.apiToken,input.defaultBranch].every(x => typeof x === 'string' && x.trim() && x.length < 2048)) throw new Error('Project fields are required');
    const url = new URL(input.repositoryUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !this.allowedHosts.includes(url.host)) throw new Error('Repository host must be configured in GITLAB_ALLOWED_HOSTS');
    const repo = url.pathname.replace(/^\//,'').replace(/\.git$/,'');
    if (!repo.includes('/') || repo.split('/').some(p => !p || p === '..')) throw new Error('Invalid repository path');
    const base = `${url.origin}/api/v4/projects/${encodeURIComponent(repo)}`;
    for (const path of ['',`/repository/branches/${encodeURIComponent(input.defaultBranch)}`]) {
      const response = await fetch(base + path, {headers:{'PRIVATE-TOKEN':input.apiToken},redirect:'error',signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error(`GitLab validation failed (${response.status})`);
      await response.body?.cancel();
    }
    return url.toString();
  }
  async save(input: {name:string; repositoryUrl:string; apiToken:string; defaultBranch:string}) {
    const repository = await this.validate(input);
    const id = randomUUID();
    this.store.db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run(id,input.name,repository,encrypt(input.apiToken,this.key),input.defaultBranch,resolve(this.root,id));
    return this.list().find(p=>p.id===id)!;
  }
  private async git(project: Project, args: string[], cwd?: string) {
    const env = {...process.env};
    // Only this short-lived Git process receives the credential; never persist it in a remote URL.
    const token=decrypt(project.encryptedToken,this.key);
    this.store.addSecrets([token]);
    env.SPECBOARD_GIT_TOKEN = token;
    env.GIT_TERMINAL_PROMPT = '0';
    env.GIT_CONFIG_COUNT = '2'; env.GIT_CONFIG_KEY_0='credential.helper'; env.GIT_CONFIG_VALUE_0='';
    env.GIT_CONFIG_KEY_1='credential.helper'; env.GIT_CONFIG_VALUE_1='!f() { printf "username=oauth2\\npassword=%s\\n" "$SPECBOARD_GIT_TOKEN"; }; f';
    try { return (await exec('git',args,{cwd,env,timeout:120000,maxBuffer:2*1024*1024})).stdout; }
    catch { throw new Error(`Git ${args[0]} failed; check repository access and workspace state`); }
  }
  async prepare(task: Task) {
    const prior = this.locks.get(task.projectId) || Promise.resolve();
    const operation = prior.catch(()=>{}).then(()=>this.prepareLocked(task));
    this.locks.set(task.projectId,operation);
    try { return await operation; } finally { if(this.locks.get(task.projectId)===operation)this.locks.delete(task.projectId); }
  }
  private async prepareLocked(task: Task) {
    const project=this.project(task.projectId), repo=resolve(project.workspaceRoot,'repository'), path=resolve(project.workspaceRoot,'tasks',task.id);
    await mkdir(project.workspaceRoot,{recursive:true});
    const trustedRoot=await realpath(this.root), actualRoot=await realpath(project.workspaceRoot);
    if(relative(trustedRoot,actualRoot).startsWith('..') || isAbsolute(relative(trustedRoot,actualRoot))) throw new Error('Unsafe workspace root');
    const existing=this.store.db.prepare('SELECT * FROM workspaces WHERE task_id=?').get(task.id);
    if(existing) {
      if(existing.path!==path)throw new Error('Workspace ownership mismatch');
      await stat(path); return path;
    }
    this.store.event(task.id,task.stage,'workspace',{operation:'prepare',status:'running'});
    try {
      if(!await stat(repo).catch(()=>null)) await this.git(project,['clone','--no-checkout','--',project.repositoryUrl,repo]);
      await this.git(project,['fetch','origin',project.defaultBranch],repo);
      await mkdir(resolve(path,'..'),{recursive:true});
      const branch=`specboard/${task.id}`;
      // Recover a worktree created just before a process interruption.
      const listing=await this.git(project,['worktree','list','--porcelain'],repo);
      if(!listing.includes(`worktree ${path}\n`)) {
        const exists=await this.git(project,['branch','--list',branch],repo);
        await this.git(project,exists.trim()?['worktree','add',path,branch]:['worktree','add','-b',branch,path,'FETCH_HEAD'],repo);
      }
      this.store.db.prepare('INSERT INTO workspaces VALUES(?,?,?,?,?)').run(task.id,project.id,branch,path,'retained');
      this.store.event(task.id,task.stage,'workspace',{operation:'prepare',status:'completed',branch,path});
      return path;
    } catch(error) { this.store.event(task.id,task.stage,'workspace',{operation:'prepare',status:'failed',error:String(error)}); throw error; }
  }
  async cleanup(task: Task) {
    if(task.status==='running' || task.status==='queued') throw new Error('Stop task before cleanup');
    const project=this.project(task.projectId), expected=join(project.workspaceRoot,'tasks',task.id);
    const row=this.store.db.prepare('SELECT * FROM workspaces WHERE task_id=?').get(task.id);
    if(!row || row.path!==expected || row.project_id!==project.id) throw new Error('Workspace ownership mismatch');
    try {
      const removed=await stat(expected).catch(()=>null);
      if(!removed && row.cleanup_status==='removed')return;
      const changes=await this.git(project,['status','--porcelain'],expected);
      if(changes.trim())throw new Error('Workspace has uncommitted changes; retain or commit them before cleanup');
      await this.git(project,['worktree','remove',expected],join(project.workspaceRoot,'repository'));
      this.store.db.prepare("UPDATE workspaces SET cleanup_status='removed' WHERE task_id=?").run(task.id);
      this.store.event(task.id,task.stage,'workspace',{operation:'cleanup',status:'completed'});
    } catch(error) {
      this.store.db.prepare("UPDATE workspaces SET cleanup_status='failed' WHERE task_id=?").run(task.id);
      this.store.event(task.id,task.stage,'workspace',{operation:'cleanup',status:'failed',error:String(error)}); throw error;
    }
  }
}
