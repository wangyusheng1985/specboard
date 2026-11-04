import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createAgentSession, createBashToolDefinition, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager, type AgentSession, type ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { Store, Task, Stage } from './store.ts';
import { stages } from './store.ts';
import type { Workspaces } from './workspaces.ts';

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec=promisify(execFile);
function toolEnvironment(){
 const env:NodeJS.ProcessEnv={};
 for(const name of ['PATH','LANG','LC_ALL','TMPDIR','TEMP','TMP'])if(process.env[name])env[name]=process.env[name];
 env.PATH=join(process.cwd(),'node_modules/.bin')+':'+(env.PATH||'/usr/bin:/bin');
 return env;
}

export interface AgentHandle { prompt(text:string):Promise<void>; steer(text:string):Promise<unknown>; abort():Promise<void>; dispose():void; text():string; }
export type AgentFactory = (task: Task, emit:(type:string,payload:unknown)=>void, requestTransition:(target:Stage)=>void) => Promise<AgentHandle>;
const require=createRequire(import.meta.url);
const skillFiles: Record<Stage,string>={Explore:'explore',Propose:'propose',Apply:'apply-change',MR:'apply-change',Archive:'archive-change'};
const skillFunctions: Record<Stage,string>={Explore:'getExploreSkillTemplate',Propose:'getOpsxProposeSkillTemplate',Apply:'getApplyChangeSkillTemplate',MR:'getApplyChangeSkillTemplate',Archive:'getArchiveChangeSkillTemplate'};

export function piFactory(store:Store, workspaces:Workspaces, sessionsRoot:string, agentDir:string): AgentFactory {
 return async(task,emit,requestTransition)=>{
  const cwd=await workspaces.prepare(task);
  await mkdir(sessionsRoot,{recursive:true}); await mkdir(agentDir,{recursive:true});
  if(!await stat(join(cwd,'openspec')).catch(()=>null)) {
   await mkdir(join(cwd,'openspec'),{recursive:true});
   await writeFile(join(cwd,'openspec','config.yaml'),'schema: spec-driven\n');
  }
  const packageRoot=dirname(dirname(require.resolve('@fission-ai/openspec')));
  const module=await import(join(packageRoot,'dist/core/templates/workflows',skillFiles[task.stage]+'.js'));
  const skill=module[skillFunctions[task.stage]]();
  const content=skill.body || skill.instructions || skill.content;
  if(typeof content!=='string')throw new Error('OpenSpec skill template is unavailable');
  const skillVersion=createHash('sha256').update(content).digest('hex');
  const previous=store.db.prepare('SELECT * FROM conversations WHERE task_id=? AND stage=?').get(task.id,task.stage);
  const sessionManager=previous?.session_path && await stat(previous.session_path as string).catch(()=>null)
   ? SessionManager.open(previous.session_path as string,undefined,cwd)
   : SessionManager.create(cwd,join(sessionsRoot,task.id,task.stage));
  const runtime=await ModelRuntime.create({authPath:join(agentDir,'auth.json'),modelsPath:join(agentDir,'models.json')});
  const provider=process.env.PI_PROVIDER, modelId=process.env.PI_MODEL;
  if(provider && process.env.PI_API_KEY)await runtime.setRuntimeApiKey(provider,process.env.PI_API_KEY);
  const model=provider && modelId ? runtime.getModel(provider,modelId) : (await runtime.getAvailable())[0];
  if(!model)throw new Error('No Pi model available; configure PI_PROVIDER, PI_MODEL and PI_API_KEY');
  const settings=SettingsManager.inMemory();
  const project=task.projectId ? workspaces.project(task.projectId) : { name: 'General Chat', repositoryUrl: '', defaultBranch: 'main' };
  const resourceLoader=new DefaultResourceLoader({cwd,agentDir,settingsManager:settings,noExtensions:true,noSkills:true,noPromptTemplates:true,
   appendSystemPromptOverride:()=>[content,`You are executing stage ${task.stage} for task ${task.id}. Change name: task-${task.id}. Project: ${project.name}. Stay in this stage. Never advance automatically. Call request_stage_transition only for an explicit user transition request; the host will ask for confirmation. Do not push, merge, deploy, or change remote resources without an explicit user instruction. End with results, validation evidence and blockers.`,
    'The host stage transition is authorization to perform this stage within the task worktree. Ask substantive questions in the conversation and stop to await input. Explore can generate prototype, html mockup, demo or summary artifacts directly in the workspace when requested without asking for permission. Propose writes planning artifacts only. Apply implements the selected change. Archive checks completion then archives that change.']});
  await resourceLoader.reload();
  const {session}=await createAgentSession({cwd,agentDir,modelRuntime:runtime,model,resourceLoader,settingsManager:settings,sessionManager,
   tools:task.stage==='Explore'?['read','grep','find','ls','edit','write','openspec','request_stage_transition']:['read','grep','find','ls','bash','edit','write','request_stage_transition'],
   customTools:[createBashToolDefinition(cwd,{spawnHook:context=>({...context,env:toolEnvironment()})}) as unknown as ToolDefinition,{name:'openspec',label:'OpenSpec read-only CLI',description:'Read OpenSpec changes, specs, status and instructions without mutating files.',parameters:Type.Object({command:Type.Union(['list','status','show','instructions','validate','context'].map(s=>Type.Literal(s))),args:Type.Array(Type.String())}),execute:async(_id,params)=>{
    const input=params as {command:string;args:string[]};
    if(!['list','status','show','instructions','validate','context'].includes(input.command)||input.args.some(a=>a.includes('\0')))throw new Error('Invalid OpenSpec command');
    const result=await exec(process.execPath,[join(packageRoot,'bin/openspec.js'),input.command,...input.args],{cwd,env:toolEnvironment(),timeout:30000,maxBuffer:1024*1024});
    return {content:[{type:'text' as const,text:result.stdout}],details:{}};
   }},{name:'request_stage_transition',label:'Request next stage',description:'Request user confirmation for the next stage. Only use when the user explicitly requests moving stages.',parameters:Type.Object({target:Type.Union(stages.map(s=>Type.Literal(s)))}),
    execute:async(_id,params)=>{requestTransition((params as {target:Stage}).target);return {content:[{type:'text' as const,text:'Transition proposal displayed; waiting for user confirmation.'}],details:{}};}}]});
  store.db.prepare('INSERT INTO conversations VALUES(?,?,?,?,?,?) ON CONFLICT(task_id,stage) DO UPDATE SET session_path=excluded.session_path,skill_version=excluded.skill_version').run(previous?.id as string || randomUUID(),task.id,task.stage,session.sessionFile || null,cwd,skillVersion);
  const unsubscribe=session.subscribe(event=>{
   if(event.type==='message_update' && event.assistantMessageEvent.type==='text_delta')emit('text_delta',{text:event.assistantMessageEvent.delta});
   else if(['message_end','tool_execution_start','tool_execution_end','agent_settled','auto_retry_start','auto_retry_end','auto_compaction_start','auto_compaction_end'].includes(event.type))emit(event.type,event);
  });
  try { await session.bindExtensions({}); } catch(error) {unsubscribe();session.dispose();throw error;}
  return {prompt:async(text)=>{await session.prompt(text);const last=session.messages.at(-1);if(last && 'stopReason' in last && last.stopReason==='error')throw new Error('Model request failed; inspect provider configuration');},steer:(text)=>session.steer(text),abort:()=>session.abort(),dispose:()=>{unsubscribe();session.dispose();},text:()=>session.getLastAssistantText() || ''};
 };
}

export class Coordinator {
 private active=new Map<string,{handle?:AgentHandle;runId:string;cancelled?:boolean;done:Promise<void>}>();
 private busy=false;
 constructor(private store:Store,private factory:AgentFactory,private cleanup?: (task:Task)=>Promise<void>){}
 recover(){
  this.store.transaction(()=>{
   this.store.db.prepare("UPDATE tasks SET status='interrupted' WHERE status='running'").run();
   this.store.db.prepare("UPDATE stage_runs SET status='interrupted',ended_at=? WHERE status='running'").run(Date.now());
   this.store.db.prepare("UPDATE commands SET status='interrupted',result=? WHERE status='running'").run(JSON.stringify({error:'Interrupted by restart; inspect task before retry'}));
  });
 }
 requestTransition(taskId:string,target:Stage){
  const task=this.store.task(taskId);
  if(stages.indexOf(target)!==stages.indexOf(task.stage)+1)throw new Error('Invalid transition');
  const id=randomUUID();
  this.store.db.prepare("INSERT INTO transition_proposals VALUES(?,?,?,?,?,0)").run(id,taskId,task.stage,target,task.version);
  this.store.event(taskId,task.stage,'transition_proposal',{id,target,version:task.version,description:`进入 ${target} 并开始该阶段执行`});
 }
 start(taskId:string,text?:string){
  if(this.active.has(taskId))throw new Error('Task already running');
  const task=this.store.task(taskId), runId=randomUUID();
  this.store.db.prepare("INSERT INTO stage_runs(id,task_id,stage,status,started_at) VALUES(?,?,?,'running',?)").run(runId,taskId,task.stage,Date.now());
  this.store.db.prepare("UPDATE tasks SET status='running',updated_at=? WHERE id=?").run(Date.now(),taskId);
  const entry={runId,done:Promise.resolve()} as {handle?:AgentHandle;runId:string;cancelled?:boolean;done:Promise<void>};
  this.active.set(taskId,entry);
  entry.done=(async()=>{
   try {
    const handle=await this.factory(task,(type,payload)=>{
     this.store.event(taskId,task.stage,type,payload);
     if(type==='tool_execution_start')this.store.db.prepare('UPDATE stage_runs SET step=? WHERE id=?').run(String((payload as {toolName?:string}).toolName||type),runId);
    },target=>this.requestTransition(taskId,target));
    entry.handle=handle;
    if(entry.cancelled){handle.dispose();return;}
    const previous=this.store.db.prepare('SELECT stage,result FROM stage_runs WHERE task_id=? AND result IS NOT NULL ORDER BY started_at DESC LIMIT 4').all(taskId);
    const initial=`Task: ${task.description}\nChange: task-${task.id}\nStage: ${task.stage}\nPrevious stage results: ${JSON.stringify(previous)}\nExecute the current stage skill and stop for human input or when finished.`;
    await handle.prompt(text || initial);
    if(!entry.cancelled){
     const result=this.store.redact(handle.text());
     this.store.db.prepare("UPDATE stage_runs SET status='completed',result=?,ended_at=? WHERE id=?").run(result,Date.now(),runId);
     this.store.db.prepare("UPDATE tasks SET status=?,updated_at=?,summary=? WHERE id=?").run(task.stage==='Archive'?'completed':'waiting_input',Date.now(),result,taskId);
     this.store.event(taskId,task.stage,'result',{text:result});
    }
   } catch(error){
    if(!entry.cancelled){
     const message=this.store.redact(error instanceof Error?error.message:'Agent execution failed');
     this.store.db.prepare("UPDATE stage_runs SET status='failed',error=?,ended_at=? WHERE id=?").run(message,Date.now(),runId);
     this.store.db.prepare("UPDATE tasks SET status='failed',updated_at=? WHERE id=?").run(Date.now(),taskId);
     this.store.event(taskId,task.stage,'error',{message});
    }
   } finally {entry.handle?.dispose(); if(this.active.get(taskId)===entry)this.active.delete(taskId);}
  })();
 }
 async control(taskId:string,type:string,payload:Record<string,unknown>){
  const task=this.store.task(taskId), active=this.active.get(taskId);
  this.store.event(taskId,task.stage,'human_control',{type,payload});
  if(type==='cleanup'){
   if(active)throw new Error('Stop active execution before cleanup');
   if(!this.cleanup)throw new Error('Workspace cleanup unavailable');
   await this.cleanup(task);
  } else if(type==='pause' || type==='stop'){
   if(active){active.cancelled=true;await active.handle?.abort();await active.done;}
   const status=type==='pause'?'paused':'stopped';
   this.store.db.prepare('UPDATE tasks SET status=?,updated_at=? WHERE id=?').run(status,Date.now(),taskId);
   this.store.db.prepare("UPDATE stage_runs SET status=?,ended_at=? WHERE task_id=? AND status='running'").run(status,Date.now(),taskId);
  } else if(type==='transition' || type==='confirm_transition'){
   if(active)throw new Error('Stop active execution before transition');
   let target=payload.target as Stage;
   if(type==='confirm_transition'){
    const proposal=this.store.db.prepare('SELECT * FROM transition_proposals WHERE id=? AND task_id=? AND confirmed=0').get(String(payload.proposalId),taskId);
    if(!proposal || proposal.version!==task.version || proposal.stage!==task.stage)throw new Error('Transition proposal is stale');
    target=proposal.target as Stage;
   }
   this.store.transition(taskId,target,Number(payload.version));
   if(type==='confirm_transition')this.store.db.prepare('UPDATE transition_proposals SET confirmed=1 WHERE id=?').run(String(payload.proposalId));
   this.start(taskId);
  } else if(type==='message'){
   if(typeof payload.text!=='string' || !payload.text.trim())throw new Error('Message is required');
   this.store.event(taskId,task.stage,'user_message',{text:payload.text});
   const explicit=payload.text.trim().match(/^(?:进入|转到|转移到|move to)\s*(Explore|Propose|Apply|Archive)[。.!！]?$/i);
   if(explicit){const target=stages.find(s=>s.toLowerCase()===explicit[1].toLowerCase())!;this.requestTransition(taskId,target);}
   else if(active?.handle)await active.handle.steer(payload.text);
   else if(active)throw new Error('Agent is preparing; retry message shortly');
   else this.start(taskId,payload.text);
  } else if(type==='resume' || type==='retry' || type==='start'){
   this.start(taskId,typeof payload.text==='string'?payload.text:undefined);
  } else throw new Error('Invalid command');
 }
 async tick(){
  if(this.busy)return;this.busy=true;
  try {
   const commands=this.store.db.prepare("SELECT * FROM commands WHERE status='queued' ORDER BY rowid LIMIT 50").all();
   for(const row of commands){
    this.store.db.prepare("UPDATE commands SET status='running' WHERE id=?").run(row.id);
    try {await this.control(String(row.task_id),String(row.type),JSON.parse(String(row.payload)));this.store.completeCommand(String(row.id),{status:'accepted'});}
    catch(error){const message=error instanceof Error?error.message:'Command failed';this.store.db.prepare("UPDATE commands SET status='failed',result=? WHERE id=?").run(JSON.stringify({error:message}),row.id);this.store.event(String(row.task_id),this.store.task(String(row.task_id)).stage,'command_error',{message});}
   }
  } finally {this.busy=false;}
 }
 async idle(taskId:string){await this.active.get(taskId)?.done;}
 async close(){await Promise.all([...this.active.keys()].map(id=>this.control(id,'stop',{})));}
}
