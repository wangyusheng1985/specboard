import {verifyOmission} from './artifact-omissions.ts';
import {redactDiagnosticText} from './diagnostics.ts';
import {validateArtifactReport} from './artifact-inspection.ts';
import {createDiagnostic} from './diagnostics.ts';
import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import staticFiles from '@fastify/static';
import pg from 'pg';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {migrateRuntime} from './runtime-migration.ts';
import {ClarificationService} from './clarification-service.ts';
import {RuntimeService} from './runtime-service.ts';
import {ApiError,checkToken,idempotent,inTransaction} from './runtime-security.ts';
import {constantTimeEqual} from './tokens.ts';
import {encrypt,decrypt} from './security.ts';
import {stages} from './store.ts';
import {projectOutcome} from './outcomes.ts';
import {GitLabClient} from './gitlab-client.ts';
import {GitHubClient} from './github-client.ts';
import {isGitHubUrl} from './git-platform.ts';
import {performWebSearch, fetchWebContent} from './web-tools.ts';

const object={type:'object',additionalProperties:true};
const error={type:'object',required:['error','requestId'],properties:{error:{type:'object',required:['code','message'],properties:{code:{type:'string'},message:{type:'string'}}},requestId:{type:'string'}}};
const params={type:'object',required:['id'],properties:{id:{type:'string',format:'uuid'}}};
const taskBody={type:'object',additionalProperties:false,required:['projectId','description'],properties:{projectId:{type:'string',format:'uuid'},description:{type:'string',minLength:1,maxLength:20000},kind:{type:'string',enum:['work','chat']}}};
const commandBody={type:'object',additionalProperties:false,required:['type','payload'],properties:{type:{type:'string',enum:['message','pause','stop','resume','retry','transition','confirm_transition','approve_proposal','archive']},payload:object}};
export async function createRuntimeApi(options:{databaseUrl:string;secret:string;dispatcherToken:string;gatewayUrl:string;gatewayAdminToken:string;encryptionKey:string}){
 const pool=new pg.Pool({connectionString:options.databaseUrl,max:10});await migrateRuntime(pool);
 const service=new RuntimeService(pool,{gatewayUrl:options.gatewayUrl}),app=Fastify({logger:false,bodyLimit:65536});
 app.addContentTypeParser('application/json',{parseAs:'string'},(req,body,done)=>{
  if(typeof body!=='string'||body.trim().length===0){
   done(null,{});
   return;
  }
  const defaultParser=app.getDefaultJsonParser('ignore','ignore');
  defaultParser(req,body,done);
 });
 await app.register(swagger,{openapi:{openapi:'3.1.0',info:{title:'Specboard API',version:'1.0.0'},components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer'}}},security:[{bearerAuth:[]}]}});
 const docsSessions=new Map<string,number>();
 app.addHook('onRequest',async(req,reply)=>{
  if(req.url.startsWith('/documentation')||req.url.startsWith('/openapi.json')){
   const cookie=req.headers.cookie?.split('; ').find(x=>x.startsWith('specboard_docs='))?.split('=')[1];
   if(!constantTimeEqual(req.headers.authorization||'',`Bearer ${options.secret}`)&&(!cookie||(docsSessions.get(cookie)||0)<Date.now()))return reply.code(401).send({error:{code:'unauthorized',message:'Connect to the workspace before opening documentation'},requestId:req.id});
  }
 });
 await app.register(swaggerUi,{routePrefix:'/documentation',uiConfig:{persistAuthorization:false}});
 await app.register(staticFiles,{root:fileURLToPath(new URL('../public',import.meta.url)),prefix:'/'});
 app.setErrorHandler((e:any,req,reply)=>{
  const isClient=(e instanceof ApiError)||(typeof e.statusCode==='number'&&e.statusCode>=400&&e.statusCode<500)||Boolean(e.validation);
  if(!isClient)console.error('Unhandled API Error:',e);
  const status=e instanceof ApiError?e.status:e.validation?400:(typeof e.statusCode==='number'&&e.statusCode>=400&&e.statusCode<500)?e.statusCode:500;
  const code=e instanceof ApiError?e.code:e.validation?'invalid_request':e.code||(status===500?'internal_error':'bad_request');
  reply.code(status).send({error:{code,message:status===500?'Request failed':e.message},requestId:req.id});
 });
 const clarification=new ClarificationService(service);
 const responses={200:object,201:object,202:object,400:error,401:error,403:error,404:error,409:error,500:error};
 const publicAuth=async(req:any)=>{
  const tokenHeader=req.headers.authorization||'';
  const queryToken=typeof req.query?.token==='string'?req.query.token:'';
  const authed=constantTimeEqual(tokenHeader,`Bearer ${options.secret}`)||(queryToken!==''&&constantTimeEqual(queryToken,options.secret));
  if(!authed)throw new ApiError(401,'unauthorized','Bearer Token required');
 };
 const dispatchAuth=async(req:any)=>{if(!constantTimeEqual(req.headers.authorization||'',`Bearer ${options.dispatcherToken}`))throw new ApiError(401,'unauthorized','Dispatcher Token required');};
 const agentAuth=async(req:any)=>{const generation=Number(req.headers['x-run-generation']);if(!Number.isInteger(generation))throw new ApiError(400,'invalid_generation','X-Run-Generation required');await checkToken(pool,req.headers.authorization,'agent',req.params.id,generation);};
 function route(method:any,url:string,auth:any,handler:any,schema:any={}){app.route({method,url,preHandler:auth,schema:{response:responses,...schema},handler});}
 route('GET','/health',undefined,async()=>{await pool.query('SELECT 1');return {status:'ok'};},{security:[]});
 route('POST','/api/v1/connect',publicAuth,async(_req:any,reply:any)=>{const token=randomUUID();docsSessions.set(token,Date.now()+3600000);reply.header('set-cookie',`specboard_docs=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`);return {connected:true};});
 route('GET','/openapi.json',publicAuth,async()=>app.swagger());
 route('GET','/docs',publicAuth,async(_req:any,reply:any)=>reply.redirect('/documentation/'));
 route('GET','/api/v1/projects',publicAuth,async(req:any)=>{
  const includeDeleted = req.query?.includeDeleted === 'true' || req.query?.includeDeleted === true;
  const sql = includeDeleted
   ? 'SELECT id,name,repository_url AS "repositoryUrl",default_branch AS "defaultBranch",git_user_name AS "gitUserName",git_user_email AS "gitUserEmail",deleted_at AS "deletedAt" FROM projects ORDER BY name'
   : 'SELECT id,name,repository_url AS "repositoryUrl",default_branch AS "defaultBranch",git_user_name AS "gitUserName",git_user_email AS "gitUserEmail",deleted_at AS "deletedAt" FROM projects WHERE deleted_at IS NULL ORDER BY name';
  return {items:(await pool.query(sql)).rows};
 });
 route('POST','/api/v1/projects',publicAuth,async(req:any,reply:any)=>{
  const body=req.body,url=new URL(body.repositoryUrl);
  const configuredHosts=(process.env.GIT_ALLOWED_HOSTS||process.env.GITLAB_ALLOWED_HOSTS||'').split(',').map(s=>s.trim()).filter(Boolean);
  const allowed = Array.from(new Set([...configuredHosts, 'github.com', 'gitlab.com']));
  if(url.protocol!=='https:'||url.username||url.password||!allowed.includes(url.host))throw new ApiError(400,'invalid_repository','Repository host is not allowed');
  const projectPath=url.pathname.replace(/^\//,'').replace(/\.git$/,'');
  if (isGitHubUrl(body.repositoryUrl)) {
   const ghClient = new GitHubClient(url.origin, projectPath, body.apiToken);
   const ok = await ghClient.validateBranch(body.defaultBranch).catch(() => false);
   if (!ok) throw new ApiError(400,'repository_validation','Repository or branch is inaccessible');
  } else {
   const glClient = new GitLabClient(url.origin, projectPath, body.apiToken);
   const ok = await glClient.validateBranch(body.defaultBranch).catch(() => false);
   if (!ok) throw new ApiError(400,'repository_validation','Repository or branch is inaccessible');
  }
  const result=await idempotent(pool,'api',req.headers['idempotency-key'],{path:req.url,body},201,async db=>{const id=randomUUID();await db.query('INSERT INTO projects VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,body.name,body.repositoryUrl,encrypt(body.apiToken,options.encryptionKey),body.defaultBranch,`/workspaces/${id}`,body.gitUserName||null,body.gitUserEmail||null]);return {id,name:body.name,repositoryUrl:body.repositoryUrl,defaultBranch:body.defaultBranch,gitUserName:body.gitUserName||null,gitUserEmail:body.gitUserEmail||null};});return reply.code(result.status).send(result.result);
 },{body:{type:'object',required:['name','repositoryUrl','apiToken','defaultBranch'],additionalProperties:false,properties:{name:{type:'string',minLength:1,maxLength:150},repositoryUrl:{type:'string',format:'uri'},apiToken:{type:'string',minLength:1},defaultBranch:{type:'string',minLength:1},gitUserName:{type:'string',maxLength:256},gitUserEmail:{type:'string',maxLength:256}}}});
 route('PUT','/api/v1/projects/:id',publicAuth,async(req:any,reply:any)=>{
  const {id}=req.params,body=req.body;
  const existing=(await pool.query('SELECT * FROM projects WHERE id=$1',[id])).rows[0];
  if(!existing)throw new ApiError(404,'project_not_found','Project not found');
  const url=new URL(body.repositoryUrl);
  const configuredHosts=(process.env.GIT_ALLOWED_HOSTS||process.env.GITLAB_ALLOWED_HOSTS||'').split(',').map(s=>s.trim()).filter(Boolean);
  const allowed = Array.from(new Set([...configuredHosts, 'github.com', 'gitlab.com']));
  if(url.protocol!=='https:'||url.username||url.password||!allowed.includes(url.host))throw new ApiError(400,'invalid_repository','Repository host is not allowed');
  const projectPath=url.pathname.replace(/^\//,'').replace(/\.git$/,'');
  const effectiveToken=body.apiToken&&typeof body.apiToken==='string'&&body.apiToken.trim()?body.apiToken:decrypt(existing.encrypted_token,options.encryptionKey);
  if (isGitHubUrl(body.repositoryUrl)) {
   const ghClient = new GitHubClient(url.origin, projectPath, effectiveToken);
   const ok = await ghClient.validateBranch(body.defaultBranch).catch(() => false);
   if (!ok) throw new ApiError(400,'repository_validation','Repository or branch is inaccessible');
  } else {
   const glClient = new GitLabClient(url.origin, projectPath, effectiveToken);
   const ok = await glClient.validateBranch(body.defaultBranch).catch(() => false);
   if (!ok) throw new ApiError(400,'repository_validation','Repository or branch is inaccessible');
  }
  const encryptedToken=body.apiToken&&typeof body.apiToken==='string'&&body.apiToken.trim()?encrypt(body.apiToken,options.encryptionKey):existing.encrypted_token;
  const result=await idempotent(pool,'api',req.headers['idempotency-key'],{path:req.url,body},200,async db=>{
   await db.query('UPDATE projects SET name=$2,repository_url=$3,encrypted_token=$4,default_branch=$5,git_user_name=$6,git_user_email=$7 WHERE id=$1',[id,body.name,body.repositoryUrl,encryptedToken,body.defaultBranch,body.gitUserName||null,body.gitUserEmail||null]);
   return {id,name:body.name,repositoryUrl:body.repositoryUrl,defaultBranch:body.defaultBranch,gitUserName:body.gitUserName||null,gitUserEmail:body.gitUserEmail||null};
  });
  return reply.code(result.status).send(result.result);
 },{params,body:{type:'object',required:['name','repositoryUrl','defaultBranch'],additionalProperties:false,properties:{name:{type:'string',minLength:1,maxLength:150},repositoryUrl:{type:'string',format:'uri'},apiToken:{type:'string'},defaultBranch:{type:'string',minLength:1},gitUserName:{type:'string',maxLength:256},gitUserEmail:{type:'string',maxLength:256}}}});
 route('DELETE','/api/v1/projects/:id',publicAuth,async(req:any,reply:any)=>{
  const {id}=req.params;
  const existing=(await pool.query('SELECT * FROM projects WHERE id=$1',[id])).rows[0];
  if(!existing)throw new ApiError(404,'project_not_found','Project not found');
  const key = req.headers['idempotency-key'] || randomUUID();
  const result=await idempotent(pool,'api',key,{path:req.url,body:{}},200,async db=>{
   await db.query('UPDATE projects SET deleted_at=$2 WHERE id=$1',[id,Date.now()]);
   return {deleted:true,id};
  });
  return reply.code(result.status).send(result.result);
 },{params});
 route('POST','/api/v1/tasks',publicAuth,async(req:any,reply:any)=>{const result=await idempotent(pool,'api',req.headers['idempotency-key'],{path:req.url,body:req.body},201,db=>service.create(db,req.body.projectId,req.body.description,req.body.kind||'work'));return reply.code(result.status).send(result.result);},{body:taskBody});
 route('GET','/api/v1/tasks/:id',publicAuth,async(req:any)=>service.task(req.params.id),{params});
 route('DELETE','/api/v1/tasks/:id',publicAuth,async(req:any,reply:any)=>{
  const paths={workspaces:process.env.WORKSPACE_VOLUME||'/workspaces',sessions:process.env.SESSION_VOLUME||'/sessions'};
  const result=await idempotent(pool,'api',req.headers['idempotency-key'],{path:req.url,body:{}},200,db=>service.deleteTask(db,req.params.id,paths));
  return reply.code(result.status).send(result.result);
 },{params});
 route('GET','/api/v1/chats',publicAuth,async(req:any)=>{
  const projectId=req.query?.projectId;
  const queryParams:any[]=[];
  let sql="SELECT t.*,p.name AS project_name,p.repository_url AS project_repository_url FROM tasks t LEFT JOIN projects p ON p.id=t.project_id WHERE t.deleted_at IS NULL AND t.kind='chat'";
  if(projectId){
   sql+=" AND t.project_id=$1";
   queryParams.push(projectId);
  }
  sql+=" ORDER BY t.updated_at DESC,t.id DESC LIMIT 50";
  const rows=(await pool.query(sql,queryParams)).rows;
  return {items:rows};
 });
 route('POST','/api/v1/chats',publicAuth,async(req:any,reply:any)=>{
  const result=await idempotent(pool,'api',req.headers['idempotency-key'],{path:req.url,body:req.body},201,db=>service.create(db,req.body.projectId||null,req.body.message||req.body.description||'新会话','chat'));
  return reply.code(result.status).send(result.result);
 },{body:{type:'object',required:['message'],properties:{projectId:{type:['string','null']},message:{type:'string',minLength:1,maxLength:20000},description:{type:'string'}}}});
 route('GET','/api/v1/chats/:id',publicAuth,async(req:any)=>service.task(req.params.id),{params});
 route('DELETE','/api/v1/chats/:id',publicAuth,async(req:any,reply:any)=>{
  const paths={workspaces:process.env.WORKSPACE_VOLUME||'/workspaces',sessions:process.env.SESSION_VOLUME||'/sessions'};
  const result=await idempotent(pool,'api',req.headers['idempotency-key'],{path:req.url,body:{}},200,db=>service.deleteTask(db,req.params.id,paths));
  return reply.code(result.status).send(result.result);
 },{params});
 route('POST','/api/v1/chats/:id/messages',publicAuth,async(req:any,reply:any)=>{
  const result=await idempotent(pool,'api',req.headers['idempotency-key'],{path:req.url,body:req.body},202,db=>service.command(db,req.params.id,'message',{text:req.body.message}));
  return reply.code(result.status).send(result.result);
 },{params,body:{type:'object',required:['message'],properties:{message:{type:'string',minLength:1,maxLength:20000}}}});
 route('POST','/api/v1/tasks/:id/approve-proposal',publicAuth,async(req:any,reply:any)=>{const result=await idempotent(pool,'api',req.headers['idempotency-key'],{path:req.url,body:req.body},202,db=>service.approveProposal(db,req.params.id,req.body));return reply.code(result.status).send(result.result);},{params,body:{type:'object',required:['proposalId'],additionalProperties:false,properties:{proposalId:{type:'string',format:'uuid'},validationPlan:object}}});
 route('POST','/api/v1/tasks/:id/archive',publicAuth,async(req:any,reply:any)=>{const result=await idempotent(pool,'api',req.headers['idempotency-key'],{path:req.url,body:req.body||{}},202,db=>service.archive(db,req.params.id));return reply.code(result.status).send(result.result);},{params});
 route('POST','/api/v1/tasks/:id/commands',publicAuth,async(req:any,reply:any)=>{const result=await idempotent(pool,'api',req.headers['idempotency-key'],{path:req.url,body:req.body},202,db=>service.command(db,req.params.id,req.body.type,req.body.payload));return reply.code(result.status).send(result.result);},{params,body:commandBody});

 const clarificationResponses={200:{type:'object',additionalProperties:true},202:{type:'object',properties:{waiting:{type:'boolean'},runId:{type:'string'}}},400:error,401:error,404:error,409:error};


 const answerBody={type:'object',required:['revision','answers'],additionalProperties:false,properties:{revision:{type:'integer',minimum:1},answers:object,additionalContext:{type:'string',maxLength:20000},draftVersion:{type:'integer',minimum:0}}};
 route('GET','/api/v1/tasks/:id/clarifications',publicAuth,async(req:any)=>clarification.list(req.params.id),{params});
 route('PUT','/api/v1/clarifications/:id/draft',publicAuth,async(req:any)=>{const {inTransaction}=await import('./runtime-security.ts');return inTransaction(pool,db=>clarification.draft(db,req.params.id,req.body));},{params,body:answerBody,response:clarificationResponses});
 route('POST','/api/v1/clarifications/:id/answers',publicAuth,async(req:any,reply:any)=>{const result=await idempotent(pool,'api',req.headers['idempotency-key'],{path:req.url,body:req.body},202,db=>clarification.submit(db,req.params.id,req.body));return reply.code(result.status).send(result.result);},{params,body:answerBody,response:clarificationResponses});
 route('POST','/internal/v1/runs/:id/clarifications',agentAuth,async(req:any)=>clarification.publish(req.params.id,Number(req.headers['x-run-generation']),req.body.questions),{params,body:{type:'object',required:['questions'],properties:{questions:{type:'array',minItems:1,maxItems:20,items:object}}}});
 route('POST','/internal/v1/runs/:id/clarification-ready',agentAuth,async(req:any)=>clarification.ready(req.params.id,Number(req.headers['x-run-generation']),req.body.batchId),{params,body:{type:'object',required:['batchId'],properties:{batchId:{type:'string',format:'uuid'}}}});
 route('POST','/api/v1/tasks/:id/restart-episode',publicAuth,async(req:any,reply:any)=>{const result=await idempotent(pool,'api',req.headers['idempotency-key'],{path:req.url,body:req.body||{}},202,db=>service.restartEpisode(db,req.params.id));return reply.code(result.status).send(result.result);},{params});
 route('POST','/api/v1/tasks/:id/recovery',publicAuth,async(req:any,reply:any)=>{const result=await idempotent(pool,'api',req.headers['idempotency-key'],{path:req.url,body:req.body},202,db=>service.recover(db,req.params.id,req.body));return reply.code(result.status).send(result.result);},{params,body:{type:'object',additionalProperties:false,required:['diagnosticId','taskVersion','action'],properties:{diagnosticId:{type:'string',format:'uuid'},taskVersion:{type:'integer',minimum:0},action:{type:'string',enum:['retry_stage','continue_stage','complete_artifacts']},additionalContext:{type:'string',maxLength:20000}}}});
 route('POST','/internal/v1/runs/:id/artifact-omission',agentAuth,async(req:any)=>{const run=await service.active(req.params.id,Number(req.headers['x-run-generation']));if(run.stage!=='Propose')throw new ApiError(409,'invalid_stage','Omissions are limited to Propose');const body=req.body;const {instruction}=await import('./schema-instructions.ts').then(module=>module.designInstructions());const omission=verifyOmission(body,instruction);return inTransaction(pool,async db=>{await db.query('SELECT id FROM agent_runs WHERE id=$1 FOR UPDATE',[run.id]);await service.active(run.id,run.generation,db);await db.query('INSERT INTO run_artifact_omissions(run_id,generation,artifact_id,reason,instruction_hash,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(run_id,artifact_id) DO UPDATE SET reason=excluded.reason,instruction_hash=excluded.instruction_hash',[run.id,run.generation,omission.artifactId,redactDiagnosticText(omission.reason,[options.secret,options.encryptionKey]),omission.instructionHash,Date.now()]);return {saved:true};});},{params,body:{type:'object',additionalProperties:false,required:['artifactId','reason','instructionHash'],properties:{artifactId:{type:'string',enum:['design']},reason:{type:'string',minLength:1,maxLength:2000},instructionHash:{type:'string',pattern:'^[a-f0-9]{64}$'}}}});
 route('GET','/api/v1/tasks/:id/diagnostics',publicAuth,async(req:any)=>{await service.task(req.params.id);return {items:(await pool.query('SELECT * FROM run_diagnostics WHERE task_id=$1 ORDER BY created_at DESC',[req.params.id])).rows};},{params});
 route('GET','/api/v1/tasks/:id/artifact-reports',publicAuth,async(req:any)=>{await service.task(req.params.id);return {items:(await pool.query('SELECT * FROM run_artifact_reports WHERE task_id=$1 ORDER BY created_at DESC',[req.params.id])).rows};},{params});
 route('GET','/api/v1/tasks/:id/mr',publicAuth,async(req:any)=>{await service.task(req.params.id);const row=(await pool.query('SELECT * FROM task_merge_requests WHERE task_id=$1',[req.params.id])).rows[0];return {mr:row||null};},{params});
 route('POST','/internal/v1/runs/:id/mr',agentAuth,async(req:any)=>{
  const run=await service.active(req.params.id,Number(req.headers['x-run-generation']));
  const b=req.body;
  const pipelineId=b.pipelineId!==undefined&&b.pipelineId!==null?String(b.pipelineId):null;
  await pool.query('INSERT INTO task_merge_requests(id,task_id,mr_iid,web_url,title,source_branch,target_branch,pipeline_id,pipeline_status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(task_id) DO UPDATE SET mr_iid=excluded.mr_iid,web_url=excluded.web_url,title=excluded.title,pipeline_id=excluded.pipeline_id,pipeline_status=excluded.pipeline_status,updated_at=excluded.updated_at',[randomUUID(),run.task_id,b.mrIid,b.webUrl,b.title,b.sourceBranch,b.targetBranch,pipelineId,b.pipelineStatus,Date.now(),Date.now()]);
  return {saved:true};
 },{params,body:{type:'object',required:['sourceBranch','targetBranch'],properties:{mrIid:{type:'integer'},webUrl:{type:'string'},title:{type:'string'},sourceBranch:{type:'string'},targetBranch:{type:'string'},pipelineId:{type:['number','string','integer']},pipelineStatus:{type:'string'}}}});
 app.route({method:'POST',url:'/internal/v1/runs/:id/artifact-report',preHandler:agentAuth,bodyLimit:256*1024,schema:{params,body:object,response:responses},handler:async(req:any)=>{const report=validateArtifactReport(req.body,[options.secret,options.dispatcherToken,options.gatewayAdminToken,options.encryptionKey]);return inTransaction(pool,async db=>{await db.query('SELECT id FROM agent_runs WHERE id=$1 FOR UPDATE',[req.params.id]);const run=await service.active(req.params.id,Number(req.headers['x-run-generation']),db);await db.query('INSERT INTO run_artifact_reports(run_id,task_id,stage,generation,report,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(run_id) DO UPDATE SET report=excluded.report,created_at=excluded.created_at',[run.id,run.task_id,run.stage,run.generation,JSON.stringify(report),Date.now()]);return {saved:true};});}});
 route('GET','/api/v1/tasks/:id/runs',publicAuth,async(req:any)=>({items:(await pool.query('SELECT r.*,x.summary,x.validation,x.artifacts,x.blockers,x.error FROM agent_runs r LEFT JOIN runtime_results x ON x.run_id=r.id WHERE task_id=$1 ORDER BY created_at',[req.params.id])).rows}),{params});
 route('GET','/api/v1/tasks/:id/proposals',publicAuth,async(req:any)=>({items:(await pool.query('SELECT * FROM runtime_proposals WHERE task_id=$1 AND confirmed=false',[req.params.id])).rows}),{params});
 route('GET','/api/v1/tasks/:id/events',publicAuth,async(req:any)=>{
  const after=Number(req.query.after||0);
  if(after>0){
   return {items:(await pool.query('SELECT e.*,r.stage FROM runtime_events e LEFT JOIN agent_runs r ON r.id=e.run_id WHERE e.task_id=$1 AND e.sequence>$2 ORDER BY e.sequence LIMIT 500',[req.params.id,after])).rows};
  }
  // When fetching initial events without after, fetch the latest 500 in ascending order
  const rows=(await pool.query('SELECT e.*,r.stage FROM runtime_events e LEFT JOIN agent_runs r ON r.id=e.run_id WHERE e.task_id=$1 ORDER BY e.sequence DESC LIMIT 500',[req.params.id])).rows;
  return {items:rows.reverse()};
 },{params,querystring:{type:'object',properties:{after:{type:'integer',minimum:0}}}});
 route('GET','/api/v1/lane',publicAuth,async(req:any)=>{
  const {stage,limit=20,cursor}=req.query;let anchor:any[]=[];
  if(cursor){try{anchor=JSON.parse(Buffer.from(cursor,'base64url').toString());}catch{throw new ApiError(400,'invalid_cursor','Invalid cursor');}if(anchor.length!==3||anchor[0]!==stage)throw new ApiError(400,'invalid_cursor','Cursor belongs to another lane');}
  const rows=(await pool.query(`SELECT t.*,p.name AS project_name,p.repository_url AS project_repository_url,p.deleted_at AS project_deleted_at,(SELECT diagnostic->>'category' FROM run_diagnostics d WHERE d.task_id=t.id AND d.stage=t.stage ORDER BY d.created_at DESC LIMIT 1) AS failure_category FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.deleted_at IS NULL AND (t.kind IS NULL OR t.kind='work') AND stage=$1 ${anchor.length?'AND (stage_entered_at,t.id)<($3,$4)':''} ORDER BY stage_entered_at DESC,t.id DESC LIMIT $2`,anchor.length?[stage,limit+1,anchor[1],anchor[2]]:[stage,limit+1])).rows;
  const projectedRows=rows.map((row:any)=>({...row,outcome_state:projectOutcome(row)}));
  const items=projectedRows.slice(0,limit),last=items.at(-1);return {items,hasMore:rows.length>limit,nextCursor:rows.length>limit?Buffer.from(JSON.stringify([stage,last.stage_entered_at,last.id])).toString('base64url'):null};
 },{querystring:{type:'object',required:['stage'],properties:{stage:{type:'string',enum:stages},limit:{type:'integer',minimum:1,maximum:100},cursor:{type:'string'}}}});
 route('GET','/api/v1/events',publicAuth,async(req:any,reply:any)=>{
  const taskId=req.query.taskId;await service.task(taskId);let after=Number(req.query.after||0);let writing=false;
  reply.hijack();reply.raw.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});reply.raw.write(': connected\n\n');
  const timer=setInterval(async()=>{if(writing)return;writing=true;try{const rows=(await pool.query('SELECT * FROM runtime_events WHERE task_id=$1 AND sequence>$2 ORDER BY sequence LIMIT 100',[taskId,after])).rows;for(const event of rows){reply.raw.write(`id: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`);after=Number(event.sequence);}}catch{reply.raw.end();clearInterval(timer);}finally{writing=false;}},500);
  req.raw.on('close',()=>clearInterval(timer));
 },{querystring:{type:'object',required:['taskId'],properties:{taskId:{type:'string',format:'uuid'},after:{type:'integer',minimum:0},token:{type:'string'}}}});
 route('GET','/api/v1/llm/relays',publicAuth,async()=>{
  const response=await fetch(options.gatewayUrl+'/admin/v1/relays',{headers:{authorization:`Bearer ${options.gatewayAdminToken}`},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new ApiError(502,'gateway_unavailable','LLM configuration service unavailable');return response.json();
 });
 route('POST','/api/v1/llm/relays',publicAuth,async(req:any)=>{
  const response=await fetch(options.gatewayUrl+'/admin/v1/relays',{method:'POST',headers:{authorization:`Bearer ${options.gatewayAdminToken}`,'content-type':'application/json'},body:JSON.stringify(req.body),signal:AbortSignal.timeout(10000)});
  const data=await response.json();if(!response.ok)throw new ApiError(400,'invalid_relay',data.error||'Relay rejected');return data;
 },{body:{type:'object',required:['name','url','protocol','model','priority','retries','enabled','allowInsecureHttp','timeoutMs'],additionalProperties:false,properties:{id:{type:'string',format:'uuid'},name:{type:'string',minLength:1},url:{type:'string',format:'uri'},token:{type:'string'},protocol:{type:'string',enum:['openai-chat','openai-responses']},model:{type:'string',minLength:1},priority:{type:'integer',minimum:0,maximum:100},retries:{type:'integer',minimum:0,maximum:10},enabled:{type:'boolean'},allowInsecureHttp:{type:'boolean'},timeoutMs:{type:'integer',minimum:1000,maximum:600000}}}});
 route('GET','/internal/v1/dispatch/reconcile',dispatchAuth,async()=>({items:(await pool.query("SELECT id,generation,container_id,status,lease_expires_at FROM agent_runs WHERE status IN ('claimed','running','waiting_input') AND lease_expires_at<$1",[Date.now()])).rows}));
 route('POST','/internal/v1/dispatch/claim',dispatchAuth,async(req:any)=>service.claim(req.body.owner),{body:{type:'object',required:['owner'],properties:{owner:{type:'string',minLength:1}}}});
 route('POST','/internal/v1/runs/:id/workspace-lock',agentAuth,async(req:any)=>{
  const run=await service.active(req.params.id,Number(req.headers['x-run-generation'])),task=await service.task(run.task_id);
  if(!task.project_id)return {locked:true};
  const key='workspace:'+task.project_id;
  await pool.query('UPDATE agent_runs SET step_lock=NULL WHERE lease_expires_at<$1',[Date.now()]);
  const locked=await pool.query("SELECT id FROM agent_runs WHERE task_id IN (SELECT id FROM tasks WHERE project_id=$1) AND step_lock=$2 AND lease_expires_at>$3 AND id<>$4",[task.project_id,key,Date.now(),run.id]);
  if(locked.rowCount)throw new ApiError(409,'workspace_busy','Repository preparation is busy');
  await pool.query('UPDATE agent_runs SET step_lock=$2 WHERE id=$1',[run.id,req.body.release?null:key]);return {locked:!req.body.release};
 },{params,body:{type:'object',properties:{release:{type:'boolean'}}}});
 route('GET','/internal/v1/runs/:id/repository-credential',agentAuth,async(req:any,reply:any)=>{
  const run=await service.active(req.params.id,Number(req.headers['x-run-generation']));
  const task=await service.task(run.task_id);
  if(!task.project_id){reply.header('cache-control','no-store');return {token:''};}
  const row=(await pool.query('SELECT encrypted_token FROM projects WHERE id=$1',[task.project_id])).rows[0];
  reply.header('cache-control','no-store');return {token:decrypt(row.encrypted_token,options.encryptionKey)};
 },{params});
 route('POST','/internal/v1/runs/:id/session',agentAuth,async(req:any)=>{
  const run=await service.active(req.params.id,Number(req.headers['x-run-generation']));
  await pool.query('INSERT INTO runtime_sessions VALUES($1,$2,$3,$4) ON CONFLICT(task_id,stage) DO UPDATE SET path=excluded.path,skill_version=excluded.skill_version',[run.task_id,run.stage,req.body.path,req.body.skillVersion]);return {saved:true};
 },{params,body:{type:'object',required:['path','skillVersion'],properties:{path:{type:'string'},skillVersion:{type:'string'}}}});
 route('GET','/internal/v1/runs/:id/context',agentAuth,async(req:any)=>{
  const run=await service.active(req.params.id,Number(req.headers['x-run-generation'])),task=await service.task(run.task_id);
  const previous=(await pool.query('SELECT r.stage,x.summary FROM agent_runs r JOIN runtime_results x ON x.run_id=r.id WHERE task_id=$1 ORDER BY created_at DESC LIMIT 4',[task.id])).rows;
  const project=task.project_id?(await pool.query('SELECT id,name,repository_url,default_branch,git_user_name,git_user_email FROM projects WHERE id=$1',[task.project_id])).rows[0]:null;
  const session=(await pool.query('SELECT path FROM runtime_sessions WHERE task_id=$1 AND stage=$2',[task.id,task.stage])).rows[0];
  const clarification=(await pool.query('SELECT b.id,b.questions,s.answers,s.additional_context FROM clarification_submissions s JOIN clarification_batches b ON b.id=s.batch_id WHERE s.continuation_run=$1',[run.id])).rows[0];
  const recovery=(await pool.query('SELECT diagnostic_id,intent FROM run_recoveries WHERE run_id=$1',[run.id])).rows[0];
  const workspacePath=project?`/workspaces/${project.id}/tasks/${task.id}`:`/workspaces/_chat/${task.id}`;
  return {run,task,project:project||null,previousResults:previous,session,clarification,recovery,workspace:{path:workspacePath},gatewayUrl:options.gatewayUrl};
 },{params});
 route('POST','/internal/v1/runs/:id/web-search',agentAuth,async(req:any)=>{
  await service.active(req.params.id,Number(req.headers['x-run-generation']));
  const results=await performWebSearch(req.body.query,req.body.numResults||5);
  return {results};
 },{params,body:{type:'object',required:['query'],properties:{query:{type:'string'},numResults:{type:'integer',minimum:1,maximum:20}}}});
 route('POST','/internal/v1/runs/:id/fetch-content',agentAuth,async(req:any)=>{
  await service.active(req.params.id,Number(req.headers['x-run-generation']));
  try{
   const result=await fetchWebContent(req.body.url);
   return result;
  }catch(err:any){
   return {url:req.body.url,content:`Fetch error: ${err.message||'Unknown error'}`,status:500};
  }
 },{params,body:{type:'object',required:['url'],properties:{url:{type:'string'}}}});
 route('GET','/internal/v1/runs/:id/commands',agentAuth,async(req:any)=>{
  const generation=Number(req.headers['x-run-generation']);await service.active(req.params.id,generation);
  const deadline=Date.now()+20000;
  do{const rows=(await pool.query("SELECT * FROM run_commands WHERE run_id=$1 AND acknowledged_at IS NULL ORDER BY created_at,id LIMIT 50",[req.params.id])).rows;if(rows.length)return {items:rows};await new Promise(resolve=>setTimeout(resolve,250));}while(Date.now()<deadline&&!req.raw.destroyed);
  return {items:[]};
 },{params});
 route('POST','/internal/v1/runs/:id/ack',agentAuth,async(req:any)=>{
  await service.active(req.params.id,Number(req.headers['x-run-generation']));
  await pool.query("UPDATE run_commands SET status='acknowledged',acknowledged_at=$3 WHERE id=$1 AND run_id=$2",[req.body.commandId,req.params.id,Date.now()]);return {acknowledged:true};
 },{params,body:{type:'object',required:['commandId'],properties:{commandId:{type:'string',format:'uuid'}}}});
 route('POST','/internal/v1/runs/:id/container',dispatchAuth,async(req:any)=>{
  return inTransaction(pool,async db=>{const updated=await db.query("UPDATE agent_runs SET container_id=$2,status='running',lease_expires_at=$3 WHERE id=$1 AND generation=$4 AND status='claimed' RETURNING task_id",[req.params.id,req.body.containerId,Date.now()+60000,req.body.generation]);
  if(!updated.rowCount)throw new ApiError(409,'stale_run','Run is not claimable');await db.query("UPDATE tasks SET status='running',updated_at=$2 WHERE id=$1",[updated.rows[0].task_id,Date.now()]);return {registered:true};});
 },{params,body:{type:'object',required:['containerId','generation'],properties:{containerId:{type:'string'},generation:{type:'integer',minimum:1}}}});
 route('POST','/internal/v1/runs/:id/failure',dispatchAuth,async(req:any)=>{
  const row=(await pool.query("UPDATE agent_runs SET status='interrupted',step_lock=NULL,updated_at=$2 WHERE id=$1 AND generation=$3 AND status IN ('claimed','running','waiting_input') RETURNING task_id,stage",[req.params.id,Date.now(),req.body.generation])).rows[0];
  if(row){
   let diagnostic=createDiagnostic({step:'dispatch',category:'interrupted',message:'Agent interrupted; inspect session and workspace before retry'});
   try{
    const {synthesizeStructuredDiagnostic}=await import('./diagnostic-synthesizer.ts');
    const structured=await synthesizeStructuredDiagnostic({
     message:diagnostic.message,
     details:diagnostic.details,
     stage:row.stage,
     category:diagnostic.category,
     code:diagnostic.code,
     gatewayUrl:options.gatewayUrl
    });
    diagnostic={...diagnostic,structured};
   }catch{
    /* ignore synthesis failure */
   }
   await pool.query('INSERT INTO run_diagnostics(id,run_id,task_id,stage,generation,diagnostic,created_at) SELECT $1,id,task_id,stage,generation,$2,$3 FROM agent_runs WHERE id=$4 ON CONFLICT(run_id) DO NOTHING',[diagnostic.id,JSON.stringify(diagnostic),Date.now(),req.params.id]);await pool.query("UPDATE tasks SET status='interrupted',updated_at=$2 WHERE id=$1",[row.task_id,Date.now()]);await service.event(pool,row.task_id,req.params.id,'error',{message:'Agent interrupted; inspect results before resume'});
  }
  return {interrupted:true};
 },{params,body:{type:'object',properties:{generation:{type:'integer'},error:{type:'string'}}}});
 route('POST','/internal/v1/runs/:id/clarification-consumed',agentAuth,async(req:any)=>clarification.consume(req.params.id,Number(req.headers['x-run-generation'])),{params});
 route('POST','/internal/v1/runs/:id/heartbeat',agentAuth,async(req:any)=>{const generation=Number(req.headers['x-run-generation']);await service.active(req.params.id,generation);await pool.query('UPDATE agent_runs SET heartbeat_at=$2,lease_expires_at=$3 WHERE id=$1',[req.params.id,Date.now(),Date.now()+60000]);return {expiresAt:Date.now()+60000};},{params});
 route('POST','/internal/v1/runs/:id/events',agentAuth,async(req:any)=>service.ingest(req.params.id,Number(req.headers['x-run-generation']),req.body.events),{params,body:{type:'object',required:['events'],properties:{events:{type:'array',maxItems:100,items:{type:'object',required:['sequence','type','payload'],properties:{sequence:{type:'integer',minimum:1},type:{type:'string'},payload:object}}}}}});
 route('POST','/internal/v1/runs/:id/complete',agentAuth,async(req:any)=>{if(req.body.diagnostic){const {validateDiagnostic}=await import('./diagnostics.ts');req.body.diagnostic=validateDiagnostic(req.body.diagnostic,[options.secret,options.dispatcherToken,options.gatewayAdminToken,options.encryptionKey]);}return service.complete(req.params.id,Number(req.headers['x-run-generation']),req.body);},{params,body:{type:'object',required:['status'],properties:{status:{type:'string',enum:['completed','failed','interrupted','paused','stopped']},summary:{type:'string'},error:{type:'string'},diagnostic:object,validation:{type:'array'},artifacts:{type:'array'},blockers:{type:'array'}}}});
 app.addHook('onClose',async()=>pool.end());
 return {app,pool,service};
}
