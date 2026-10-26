import {designInstructions} from './schema-instructions.ts';
import {verifyOmission,type ArtifactOmission} from './artifact-omissions.ts';
import {inspectPlanningArtifacts,validatePlanningReport} from './artifact-inspection.ts';
import {createDiagnostic,type DiagnosticStep,type DiagnosticCategory} from './diagnostics.ts';
import {Type} from 'typebox';
import {createAgentSession,createBashToolDefinition,createReadToolDefinition,createGrepToolDefinition,createFindToolDefinition,createLsToolDefinition,createEditToolDefinition,createWriteToolDefinition,ModelRuntime,SessionManager,SettingsManager,DefaultResourceLoader,type ToolDefinition} from '@earendil-works/pi-coding-agent';
import {mkdir,stat,writeFile,open,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {verifyStage} from './stage-verification.ts';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export interface AgentCallerOptions{api:string;id:string;headers:Record<string,string>;commandAbort?:AbortController;maxRetries?:number;retryDelayMs?:number;}
export function createAgentCaller(options:AgentCallerOptions){
 const {api,id,headers,commandAbort,maxRetries=3,retryDelayMs=300}=options;
 return async function call(path:string,body?:unknown){
  let attempt=0;
  while(true){
   try{
    const signal=path==='commands'?(commandAbort?AbortSignal.any([commandAbort.signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000)):AbortSignal.timeout(15000);
    const response=await fetch(`${api}/internal/v1/runs/${id}/${path}`,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),signal});
    if(response.ok)return response.json();
    if(response.status>=400&&response.status<500)throw new Error(`Agent API ${response.status}`);
    if(attempt>=maxRetries)throw new Error(`Agent API ${response.status}`);
   }catch(err:any){
    if(commandAbort?.signal.aborted||(err?.message&&typeof err.message==='string'&&err.message.startsWith('Agent API 4'))||attempt>=maxRetries)throw err;
   }
   attempt++;
   await new Promise(resolve=>setTimeout(resolve,attempt*retryDelayMs));
  }
 };
}

export async function runAgent(paths={workspaces:'/workspaces',sessions:'/sessions'}){
 const api=process.env.API_URL!,id=process.env.RUN_ID!,generation=process.env.RUN_GENERATION!,token=process.env.AGENT_TOKEN!;
 const headers={authorization:`Bearer ${token}`,'x-run-generation':generation,'content-type':'application/json'};
 const commandAbort=new AbortController();
 const call=createAgentCaller({api,id,headers,commandAbort});
 const context=await call('context'),cwd=context.workspace.path,project=context.project,task=context.task;
 const env={PATH:process.env.PATH,HOME:'/tmp',LANG:'C.UTF-8',GIT_TERMINAL_PROMPT:'0',TMPDIR:'/tmp',GOCACHE:'/tmp/go-cache',GOMODCACHE:'/tmp/go-mod',GOPATH:'/tmp/go-path',GO111MODULE:'on'};
 const heartbeat=setInterval(()=>{void call('heartbeat',{}).catch(()=>{});},10000);
 let session:any,finished=false,cancelled:string|undefined,questionBatch:string|undefined;
 const pending:any[]=[];let sequence=0;const omissions:ArtifactOmission[]=[];let step:DiagnosticStep='repository';
 const collect=async()=>{if(task.stage==='Propose')await call('artifact-report',await validatePlanningReport(cwd,task.id,await inspectPlanningArtifacts(cwd,task.id,[token,process.env.GATEWAY_TOKEN||'']),omissions));};
 try{
  let locked=false;while(!locked){try{await call('workspace-lock',{});locked=true;}catch{await new Promise(resolve=>setTimeout(resolve,1000));}}
  const credential=await call('repository-credential');
  const gitAuthorName = project.git_user_name || 'Specboard Agent';
  const gitAuthorEmail = project.git_user_email || 'agent@specboard.local';
  const gitEnv={...env,GIT_AUTHOR_NAME:gitAuthorName,GIT_AUTHOR_EMAIL:gitAuthorEmail,GIT_COMMITTER_NAME:gitAuthorName,GIT_COMMITTER_EMAIL:gitAuthorEmail,GIT_CONFIG_COUNT:'2',GIT_CONFIG_KEY_0:'credential.helper',GIT_CONFIG_VALUE_0:'',GIT_CONFIG_KEY_1:'http.extraHeader',GIT_CONFIG_VALUE_1:`Authorization: Basic ${Buffer.from('oauth2:'+credential.token).toString('base64')}`};
  const root=join(paths.workspaces,project.id),repository=join(root,'repository');await mkdir(root,{recursive:true});
  const git=async(args:string[],path?:string)=>{try{return await exec('git',args,{cwd:path,env:gitEnv,timeout:120000});}catch{throw new Error('Repository operation failed');}};
  if(!await stat(repository).catch(()=>null))await git(['clone','--no-checkout','--',project.repository_url,repository]);
  if(!await stat(cwd).catch(()=>null)){await git(['fetch','origin',project.default_branch],repository);await mkdir(dirname(cwd),{recursive:true});await git(['worktree','add','-b',`specboard/${task.id}`,cwd,'FETCH_HEAD'],repository);}
  const gitlabToken=credential.token;credential.token='';await call('workspace-lock',{release:true});
  const require=createRequire(import.meta.url),rootPackage=dirname(dirname(require.resolve('@fission-ai/openspec')));
  const skills:Record<string,[string,string]>={Explore:['explore','getExploreSkillTemplate'],Propose:['propose','getOpsxProposeSkillTemplate'],Apply:['apply-change','getApplyChangeSkillTemplate'],MR:['apply-change','getApplyChangeSkillTemplate'],Archive:['archive-change','getArchiveChangeSkillTemplate']};
  const [file,method]=skills[task.stage],module=await import(join(rootPackage,'dist/core/templates/workflows',file+'.js')),skill=module[method]().instructions;
  if(!await stat(join(cwd,'openspec')).catch(()=>null)){await mkdir(join(cwd,'openspec'),{recursive:true});await writeFile(join(cwd,'openspec/config.yaml'),'schema: spec-driven\n');}
  step='session';
  const agentDir=join(paths.sessions,task.id,'config');await mkdir(agentDir,{recursive:true});
  const runtime=await ModelRuntime.create({modelsPath:null,authPath:join(agentDir,'auth.json')});
  runtime.registerProvider('gateway',{baseUrl:context.gatewayUrl+'/v1',api:'openai-responses',models:[{id:'agent-default',name:'Agent Gateway',reasoning:false,input:['text'],contextWindow:128000,maxTokens:16384,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}}]});
  await runtime.setRuntimeApiKey('gateway',process.env.GATEWAY_TOKEN!);
  if(context.clarification&&(!context.session?.path||!await stat(context.session.path).catch(()=>null)))throw new Error('Clarification session is missing; manual recovery required');
  const manager=context.session?.path&&await stat(context.session.path).catch(()=>null)?SessionManager.open(context.session.path):SessionManager.create(cwd,join(paths.sessions,task.id,task.stage));
  if(context.session?.path){
   const entries=manager.buildSessionContext().messages as any[],outstanding=new Set<string>();
   for(const message of entries){if(message.role==='assistant')for(const part of message.content||[])if(part.type==='toolCall')outstanding.add(part.id);if(message.role==='toolResult')outstanding.delete(message.toolCallId);}
   if(outstanding.size)throw new Error('Session contains unconfirmed tool operations; inspect workspace and session before recovery');
  }
  const loader=new DefaultResourceLoader({cwd,agentDir,noExtensions:true,noSkills:true,noPromptTemplates:true,appendSystemPromptOverride:()=>[skill,`Execute only ${task.stage}. Change name task-${task.id}. Never advance stages or push remote changes automatically. The container includes python3, pip, venv, ruff and Go (go test, go vet, gofmt). Root filesystem is read-only; use the task worktree for virtual environments and generated files. Use /tmp for caches, with GOCACHE=/tmp/go-cache, GOMODCACHE=/tmp/go-mod and GOPATH=/tmp/go-path. Run ruff with --no-cache or set its cache under /tmp. Never install into system directories. Return results, validation and blockers. In Explore stage, you may generate demonstration or prototype files (such as high-fidelity interactive HTML prototypes, markdown summary documents, or architecture diagram files) directly in the workspace when requested or helpful. When user choices are needed call request_clarification with questions containing id, type (single_choice, multiple_choice, text, confirmation), prompt, reason, required, and options with id/label for choice types. Never assume a user answer.`]});await loader.reload();
  const definitions=[createReadToolDefinition(cwd),createGrepToolDefinition(cwd),createFindToolDefinition(cwd),createLsToolDefinition(cwd),createEditToolDefinition(cwd),createWriteToolDefinition(cwd),...(task.stage==='Explore'?[]:[createBashToolDefinition(cwd,{spawnHook:ctx=>({...ctx,env:{...gitEnv,PATH:'/app/node_modules/.bin:'+env.PATH}})})])] as ToolDefinition[];
  const guarded=definitions.map(tool=>({...tool,execute:async(...args:Parameters<ToolDefinition['execute']>)=>{if(questionBatch)throw new Error('Waiting for user answers');return tool.execute(...args);}}));
  const clarificationTool:ToolDefinition={name:'request_clarification',label:'Ask user',description:'Ask the user a batch of questions and suspend this stage. Use before making decisions that require user input.',parameters:Type.Object({questions:Type.Array(Type.Any(),{minItems:1,maxItems:20})}),execute:async(_toolId,params,_signal,_update,ctx)=>{if(questionBatch)throw new Error('Questions already pending');const batch=await call('clarifications',{questions:(params as {questions:unknown[]}).questions});questionBatch=batch.id;ctx.abort();return {content:[{type:'text',text:'Waiting for user answers. Do not continue execution.'}],details:{batchId:batch.id}};}};
  const omissionTool:ToolDefinition={name:'record_artifact_omission',label:'Record optional artifact decision',description:'Record why design is not applicable under spec-driven conditional instructions. Never omit required artifacts. Provide the sha256 of the design instruction.',parameters:Type.Object({artifactId:Type.Literal('design'),reason:Type.String({minLength:1,maxLength:2000}),instructionHash:Type.String()}),execute:async(_id,params)=>{if(task.stage!=='Propose'||questionBatch)throw new Error('Omission unavailable');const {instruction}=await designInstructions();const omission=verifyOmission(params,instruction);await call('artifact-omission',omission);omissions.splice(0,omissions.length,omission);return {content:[{type:'text',text:'Conditional omission recorded with evidence.'}],details:{}};}};
  const result=await createAgentSession({cwd,agentDir,modelRuntime:runtime,model:runtime.getModel('gateway','agent-default'),sessionManager:manager,settingsManager:SettingsManager.inMemory({retry:{enabled:false}}),resourceLoader:loader,tools:[...guarded.map(tool=>tool.name),'request_clarification','record_artifact_omission'],customTools:[...guarded,clarificationTool,omissionTool]});session=result.session;
  await call('session',{path:session.sessionFile,skillVersion:createHash('sha256').update(skill).digest('hex')});
  session.subscribe((event:any)=>{if(event.type==='message_update'&&event.assistantMessageEvent.type==='text_delta')pending.push({sequence:++sequence,type:'text_delta',payload:{text:event.assistantMessageEvent.delta}});else if(['tool_execution_start','tool_execution_end'].includes(event.type))pending.push({sequence:++sequence,type:event.type,payload:event});});
  let flushing=false;
  const flush=async()=>{if(flushing)return;flushing=true;try{while(pending.length){const batch=pending.slice(0,50);await call('events',{events:batch});pending.splice(0,batch.length);}}finally{flushing=false;}};
  const eventTimer=setInterval(()=>{void flush().catch(()=>{});},500);
  const poll=async()=>{while(!finished){try{const {items}=await call('commands');for(const command of items){if(command.type==='message')await session.steer(command.payload.text);else if(['stop','pause'].includes(command.type)){cancelled=command.type==='pause'?'paused':'stopped';await session.abort();}await call('ack',{commandId:command.id});}await flush();}catch{if(!finished)await new Promise(resolve=>setTimeout(resolve,500));}}};
  const polling=poll();
  try{
  if(context.clarification){
   const batch=context.clarification,marker='clarification:'+batch.id;
   if(!manager.getEntries().some((entry:any)=>entry.type==='message'&&entry.message?.role==='user'&&entry.message.content?.some((part:any)=>part.type==='text'&&part.text.startsWith(marker+'\n')))){
    manager.appendMessage({role:'user',content:[{type:'text',text:marker+'\nUser answers: '+JSON.stringify(batch)}],timestamp:Date.now()});
    const file=await open(session.sessionFile,'r+');try{await file.sync();}finally{await file.close();}
   }
   session.agent.state.messages=manager.buildSessionContext().messages;
   await call('clarification-consumed',{});
  }
  if(context.recovery){const marker='recovery:'+context.recovery.diagnostic_id;if(!manager.getEntries().some((entry:any)=>entry.type==='message'&&entry.message?.role==='user'&&entry.message.content?.some((part:any)=>part.text?.startsWith(marker+'\n')))){manager.appendMessage({role:'user',content:[{type:'text',text:marker+'\nContinue this stage without resetting existing work. Recovery intent: '+JSON.stringify(context.recovery.intent)}],timestamp:Date.now()});const file=await open(session.sessionFile,'r+');try{await file.sync();}finally{await file.close();}}session.agent.state.messages=manager.buildSessionContext().messages;}
  if(task.stage==='MR'){
   const commandsResponse = await call('commands').catch(() => ({items:[]}));
   const userMessages = (commandsResponse?.items || []).filter((c: any) => c.type === 'message');
   for(const msg of userMessages){
    if(msg.payload?.text){
     await session.prompt(`User instruction received for MR stage:\n${msg.payload.text}\n\nPlease apply the requested adjustments to the workspace files (e.g. updating .gitignore, cleaning unneeded files, fixing commits).`);
    }
    await call('ack',{commandId:msg.id}).catch(()=>{});
   }
   step='validation';
   const {runMRStage}=await import('./mr-service.ts');
   const mrResult=await runMRStage({
    cwd,
    taskId:task.id,
    description:task.description,
    repositoryUrl:project.repository_url,
    defaultBranch:project.default_branch,
    token:gitlabToken,
    git,
    call,
    session
   });
   const isPr = Boolean(mrResult?.mr?.is_pr);
   const prOrMr = isPr ? `GitHub Pull Request #${mrResult.mr.iid}` : `GitLab Merge Request !${mrResult.mr.iid}`;
   const ciOrActions = isPr ? 'Actions' : 'CI pipeline';
   await call('complete',{
    status:'completed',
    summary:`${prOrMr} created and ${ciOrActions} passed.`,
    validation:mrResult.validation,
    artifacts:[],
    blockers:[]
   });
   return;
  }
  step='model';
  await session.prompt(`Task: ${task.description}\nPrevious results: ${JSON.stringify(context.previousResults)}\nExecute ${task.stage} using its skill.`);
  finished=true;commandAbort.abort();await polling;await flush();
  if(questionBatch){const file=await open(session.sessionFile,'r+');try{await file.sync();}finally{await file.close();}await call('clarification-ready',{batchId:questionBatch});return;}
  const last=session.messages.at(-1);if(last?.stopReason==='error'){let envelope:any;try{const raw=String(last.errorMessage||'');const start=raw.indexOf('{'),end=raw.lastIndexOf('}');const parsed=JSON.parse(raw.slice(start,end+1));envelope=typeof parsed.error==='object'?parsed.error:parsed;}catch{envelope=undefined;}throw Object.assign(new Error(envelope?.message||'LLM gateway request failed'),{category:envelope?.code,requestId:envelope?.requestId,attemptCount:envelope?.attemptCount});}
  step='validation';
  await collect().catch(()=>{});
  const validation=cancelled?[]:(await verifyStage(cwd,task.stage,task.id)).checks;const workspaceRevision=task.stage==='Apply'?(await exec('git',['rev-parse','HEAD'],{cwd,env})).stdout.trim()+'-'+createHash('sha256').update((await exec('git',['diff','--no-ext-diff'],{cwd,env})).stdout).digest('hex').slice(0,16):undefined;const validationEvidence=task.stage==='Apply'?validation.map((command,index)=>({command:`stage-verification:${command}`,commandId:`stage-${index+1}`,startedAt:Date.now(),endedAt:Date.now(),exitCode:0,timedOut:false,workspaceRevision,summary:command})):validation;
  const artifacts: Array<{path: string; content: string}> = [];
  if(!cancelled){
   if(task.stage==='Propose'){
    const content=await readFile(join(cwd,'openspec/changes','task-'+task.id,'tasks.md'),'utf8');
    if(Buffer.byteLength(content)>48000)throw new Error('Planning task checklist exceeds 48 KB upload limit');
    artifacts.push({path:'tasks.md',content});
   } else {
    // Automatically collect untracked or modified prototype / process files in Explore or other stages
    try {
     const statusOutput = (await exec('git', ['status', '--porcelain', '-uall'], {cwd, env})).stdout;
     const lines = statusOutput.split('\n').filter(Boolean);
     for (const l of lines) {
      const match = l.match(/^[?MADRCU\s]{2}\s+(.+)$/);
      if (!match) continue;
      const relPath = match[1].trim().replace(/^"|"$/g, '');
      // Match relevant extensions: .html, .htm, .md, .svg, .json, or anything inside artifacts/ or demo/
      const isTarget = /\.(html|htm|md|svg|json|yaml|yml)$/i.test(relPath) || /^(artifacts|demos?|prototypes?)\//i.test(relPath);
      // Exclude git internal, node_modules, openspec internal (except explicit demo/summary)
      const isExcluded = /^(node_modules|\.git|openspec)\//.test(relPath);
      if (isTarget && !isExcluded) {
       const full = join(cwd, relPath);
       const st = await stat(full).catch(() => null);
       if (st && st.isFile() && st.size > 0 && st.size <= 500000) {
        const textContent = await readFile(full, 'utf8').catch(() => null);
        if (typeof textContent === 'string') {
         artifacts.push({path: relPath, content: textContent});
         if (artifacts.length >= 20) break;
        }
       }
      }
     }
    } catch {
     /* ignore scanning failure */
    }
   }
  }
  await call('complete',{status:cancelled||'completed',summary:session.getLastAssistantText()||'',validation:validationEvidence,workspaceRevision,artifacts,blockers:[]});void polling;
  }finally{clearInterval(eventTimer);}
 }catch(error){finished=true;commandAbort.abort();await collect().catch(()=>{});const source=error as {category?:DiagnosticCategory;requestId?:string;attemptCount?:number};const diagnostic=createDiagnostic({step,requestId:source.requestId,attemptCount:source.attemptCount,message:error instanceof Error?error.message:'Agent failed',category:source.category|| (step==='validation'?'artifact_validation':step==='repository'?'runtime_environment':'unknown'),safeBoundary:step==='model'||(step==='validation'&&!String(error).includes('unconfirmed'))},[token,process.env.GATEWAY_TOKEN||'']);await call('complete',{status:'failed',error:diagnostic.message,diagnostic}).catch(()=>{});throw error;}finally{clearInterval(heartbeat);session?.dispose();}
}
if(process.env.AGENT_SERVER==='true')await runAgent();
