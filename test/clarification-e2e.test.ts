import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
import {createRuntimeApi} from '../src/runtime-api.ts';
import {createGatewayServer} from '../src/gateway-server.ts';
import {encrypt} from '../src/security.ts';
import {inTransaction} from '../src/runtime-security.ts';
import {responseSse} from '../src/protocols.ts';
const exec=promisify(execFile);
test('real API PostgreSQL Gateway and restarted Agent complete Propose clarification',{skip:process.env.TEST_AGENT_CONTAINER!=='true'||!process.env.TEST_DATABASE_URL,timeout:60000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'clarification-full-')),schema='clarify_e2e_'+randomUUID().replaceAll('-',''),admin=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});await admin.query(`CREATE SCHEMA ${schema}`);const db=new URL(process.env.TEST_DATABASE_URL!);db.searchParams.set('options',`-c search_path=${schema}`);
 let answered=false,index=0;const files=['.openspec.yaml','proposal.md','design.md','tasks.md','specs/feature/spec.md'];
 const upstream=createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw);if(JSON.stringify(body).includes('Use option A'))answered=true;const file=answered?files[index++]:undefined;const output=!answered?[{id:'ask',type:'function_call',call_id:'ask',name:'request_clarification',arguments:JSON.stringify({questions:[{id:'approach',type:'single_choice',prompt:'Choose approach',reason:'Define implementation',required:true,options:[{id:'a',label:'Option A'}]},{id:'constraints',type:'text',prompt:'Constraints?',reason:'Define limits',required:true}]})}]:file?[{id:'write'+index,type:'function_call',call_id:'write'+index,name:'write',arguments:JSON.stringify({path:'openspec/changes/task-'+taskId+'/'+file,content:file==='tasks.md'?'- [ ] Implement feature':'# Planning artifact\nUse option A'})}]:[{id:'done',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'# Proposal complete\nArtifacts written using user answers.',annotations:[]}]}];const response={id:'response',object:'response',model:'fixture',status:'completed',output,usage:{input_tokens:1,output_tokens:1,total_tokens:2}};res.writeHead(200,{'content-type':body.stream?'text/event-stream':'application/json'});res.end(body.stream?responseSse(response):JSON.stringify(response));});await new Promise<void>(r=>upstream.listen(0,'0.0.0.0',r));
 const upstreamPort=(upstream.address() as any).port;const gateway=await createGatewayServer({databaseUrl:db.toString(),token:'gateway-token',adminToken:'admin',encryptionKey:'test',allowedHosts:['127.0.0.1:'+upstreamPort]});await new Promise<void>(r=>gateway.server.listen(0,'0.0.0.0',r));const gatewayPort=(gateway.server.address() as any).port;
 await gateway.repository.save({name:'fixture',url:`http://127.0.0.1:${upstreamPort}/v1`,token:'fixture',protocol:'openai-responses',model:'fixture',priority:100,retries:0,timeoutMs:10000,enabled:true,allowInsecureHttp:true});
 const oldFlag=process.env.CLARIFICATIONS_ENABLED;
 const runtime=await createRuntimeApi({databaseUrl:db.toString(),secret:'api',dispatcherToken:'dispatch',gatewayUrl:`http://host.docker.internal:${gatewayPort}`,gatewayAdminToken:'admin',encryptionKey:'test'});await runtime.app.listen({port:0,host:'0.0.0.0'});const apiPort=(runtime.app.server.address() as any).port,projectId=randomUUID();let taskId='';
 try{
 await runtime.pool.query('INSERT INTO projects VALUES($1,$2,$3,$4,$5,$6)',[projectId,'fixture','https://example.test/repo',encrypt('fixture','test'),'main','/workspaces']);const task=await inTransaction(runtime.pool,db=>runtime.service.create(db,projectId,'Create proposal with user choices'));taskId=task.id;await runtime.pool.query("UPDATE tasks SET stage='Propose' WHERE id=$1",[taskId]);await runtime.pool.query("UPDATE agent_runs SET stage='Propose' WHERE task_id=$1",[taskId]);
 await mkdir(join(root,'work',projectId,'repository'),{recursive:true});await mkdir(join(root,'work',projectId,'tasks',taskId),{recursive:true});await mkdir(join(root,'sessions'));
 const launch=async()=>{const claim=(await runtime.service.claim('e2e')).items[0];assert.ok(claim);await exec('docker',['run','--rm','--user','0','--add-host','host.docker.internal:host-gateway','-v',`${root}/work:/workspaces`,'-v',`${root}/sessions:/sessions`,'-e','AGENT_SERVER=true','-e',`RUN_ID=${claim.id}`,'-e',`RUN_GENERATION=${claim.generation}`,'-e',`AGENT_TOKEN=${claim.token}`,'-e','GATEWAY_TOKEN=gateway-token','-e',`API_URL=http://host.docker.internal:${apiPort}`,process.env.TEST_AGENT_IMAGE||'specboard-agent:verify'],{timeout:45000});};
 await launch();const auth={authorization:'Bearer api'};const batches=(await runtime.app.inject({url:`/api/v1/tasks/${taskId}/clarifications`,headers:auth})).json().items;assert.equal(batches.length,1);assert.ok(batches[0].ready_at);const batch=batches[0];
 process.env.CLARIFICATIONS_ENABLED='false';
 const answer={revision:1,answers:{approach:{optionIds:['a'],text:'Use option A'},constraints:{text:'No external services'}},additionalContext:'Keep it simple'},headers={...auth,'idempotency-key':randomUUID()};const submit=()=>runtime.app.inject({method:'POST',url:`/api/v1/clarifications/${batch.id}/answers`,headers,payload:answer});assert.equal((await submit()).statusCode,202);assert.equal((await submit()).statusCode,202);
 await launch();assert.ok(answered);assert.match(await readFile(join(root,'work',projectId,'tasks',taskId,'openspec/changes/task-'+taskId+'/proposal.md'),'utf8'),/option A/);const result=await runtime.service.task(taskId);const runs=(await runtime.app.inject({url:`/api/v1/tasks/${taskId}/runs`,headers:auth})).json().items;assert.equal(runs.at(-1).artifacts[0].path,'tasks.md');assert.match(runs.at(-1).artifacts[0].content,/Implement feature/);assert.equal(result.stage,'Propose');assert.equal(result.status,'waiting_input');assert.equal((await runtime.pool.query('SELECT status FROM clarification_batches WHERE id=$1',[batch.id])).rows[0].status,'consumed');assert.equal((await runtime.pool.query('SELECT count(*) FROM agent_runs WHERE task_id=$1',[taskId])).rows[0].count,'2');
 }finally{if(oldFlag===undefined)delete process.env.CLARIFICATIONS_ENABLED;else process.env.CLARIFICATIONS_ENABLED=oldFlag;await runtime.app.close();await gateway.close();await new Promise<void>(r=>upstream.close(()=>r()));await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();await rm(root,{recursive:true,force:true});}
});
