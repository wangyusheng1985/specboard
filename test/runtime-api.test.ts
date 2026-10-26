import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRuntimeApi} from '../src/runtime-api.ts';

test('PostgreSQL runtime claims exclusively, scopes tokens, deduplicates events and fences completion',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const {default:pg}=await import('pg');const admin=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});const schema='runtime_test_'+randomUUID().replaceAll('-','');await admin.query(`CREATE SCHEMA ${schema}`);const url=new URL(process.env.TEST_DATABASE_URL!);url.searchParams.set('options',`-c search_path=${schema}`);
 const runtime=await createRuntimeApi({databaseUrl:url.toString(),secret:'api-secret',dispatcherToken:'dispatcher-secret',gatewayUrl:'http://gateway:4000',gatewayAdminToken:'admin-secret',encryptionKey:'key'});
 const {app,pool}=runtime;await app.ready();
 const auth={authorization:'Bearer api-secret'},projectId=randomUUID();
 try{
  await pool.query("UPDATE agent_runs SET status='interrupted' WHERE status='queued'");
  await pool.query('INSERT INTO projects VALUES($1,$2,$3,$4,$5,$6)',[projectId,'fixture','https://example.test/team/project','cipher','main','/workspaces']);
  const body={projectId,description:'Explore fixture'},key=randomUUID();
  const created=await app.inject({method:'POST',url:'/api/v1/tasks',headers:{...auth,'idempotency-key':key},payload:body});assert.equal(created.statusCode,201,created.body);const task=created.json();assert.equal(task.execution_policy,'autonomous');assert.equal(task.outcome_state,'clarifying');
  const repeated=await app.inject({method:'POST',url:'/api/v1/tasks',headers:{...auth,'idempotency-key':key},payload:body});assert.equal(repeated.json().id,task.id);
  const claim=async(owner:string)=>app.inject({method:'POST',url:'/internal/v1/dispatch/claim',headers:{authorization:'Bearer dispatcher-secret'},payload:{owner}});
  const [a,b]=await Promise.all([claim('a'),claim('b')]);assert.equal(a.json().items.length+b.json().items.length,1);
  const run=[...a.json().items,...b.json().items][0],headers={authorization:`Bearer ${run.token}`,'x-run-generation':String(run.generation)};
  assert.equal((await app.inject({url:`/internal/v1/runs/${run.id}/context`,headers})).statusCode,200);
  assert.equal((await app.inject({url:'/api/v1/projects',headers})).statusCode,401);
  const events={events:[{sequence:1,type:'progress',payload:{message:'done'}}]};
  for(let n=0;n<2;n++){const r=await app.inject({method:'POST',url:`/internal/v1/runs/${run.id}/events`,headers,payload:events});assert.equal(r.statusCode,200,r.body);assert.equal(r.json().acknowledged,1);}
  const timeline=await app.inject({url:`/api/v1/tasks/${task.id}/events`,headers:auth});assert.equal(timeline.json().items.filter((e:any)=>e.type==='progress').length,1);
  const complete=await app.inject({method:'POST',url:`/internal/v1/runs/${run.id}/complete`,headers,payload:{status:'completed',summary:'explored'}});assert.equal(complete.statusCode,200,complete.body);
  assert.equal((await app.inject({url:`/api/v1/tasks/${task.id}`,headers:auth})).json().status,'waiting_input');
  const stale=await app.inject({method:'POST',url:`/internal/v1/runs/${run.id}/heartbeat`,headers,payload:{}});assert.equal(stale.statusCode,409);
  const current=(await app.inject({url:`/api/v1/tasks/${task.id}`,headers:auth})).json();const proposeTransition=await app.inject({method:'POST',url:`/api/v1/tasks/${task.id}/commands`,headers:{...auth,'idempotency-key':randomUUID()},payload:{type:'transition',payload:{target:'Propose',version:current.version}}});assert.equal(proposeTransition.statusCode,202,proposeTransition.body);
  const proposeRun=(await claim('propose')).json().items[0];assert.ok(proposeRun);const proposeHeaders={authorization:`Bearer ${proposeRun.token}`,'x-run-generation':String(proposeRun.generation)};const proposeDone=await app.inject({method:'POST',url:`/internal/v1/runs/${proposeRun.id}/complete`,headers:proposeHeaders,payload:{status:'completed',summary:'proposal complete'}});assert.equal(proposeDone.statusCode,200,proposeDone.body);
  const proposalForApply=(await app.inject({method:'POST',url:`/api/v1/tasks/${task.id}/commands`,headers:{...auth,'idempotency-key':randomUUID()},payload:{type:'message',payload:{text:'进入 Apply'}}})).json();assert.ok(proposalForApply.proposalId);const approval=await app.inject({method:'POST',url:`/api/v1/tasks/${task.id}/approve-proposal`,headers:{...auth,'idempotency-key':randomUUID()},payload:{proposalId:proposalForApply.proposalId,validationPlan:{commands:['npm test']}}});assert.equal(approval.statusCode,202,approval.body);
  const applyRun=(await claim('apply')).json().items[0];assert.ok(applyRun);const applyHeaders={authorization:`Bearer ${applyRun.token}`,'x-run-generation':String(applyRun.generation)};const workspaceRevision='workspace-revision-1';const applyDone=await app.inject({method:'POST',url:`/internal/v1/runs/${applyRun.id}/complete`,headers:applyHeaders,payload:{status:'completed',summary:'implementation complete',workspaceRevision,validation:[{command:'npm test',commandId:'npm-test',startedAt:1,endedAt:2,exitCode:0,timedOut:false,workspaceRevision,summary:'passed'}]}});assert.equal(applyDone.statusCode,200,applyDone.body);const delivered=(await app.inject({url:`/api/v1/tasks/${task.id}`,headers:auth})).json();assert.equal(delivered.stage,'Apply');assert.equal(delivered.outcome_state,'delivered');assert.equal((await app.inject({url:`/api/v1/tasks/${task.id}/runs`,headers:auth})).json().items.filter((run:any)=>run.stage==='Archive').length,0);
  const archived=await app.inject({method:'POST',url:`/api/v1/tasks/${task.id}/archive`,headers:{...auth,'idempotency-key':randomUUID()},payload:{}});assert.equal(archived.statusCode,202,archived.body);const archiveRun=(await claim('archive')).json().items[0];assert.ok(archiveRun);const archiveHeaders={authorization:`Bearer ${archiveRun.token}`,'x-run-generation':String(archiveRun.generation)};assert.equal((await app.inject({method:'POST',url:`/internal/v1/runs/${archiveRun.id}/complete`,headers:archiveHeaders,payload:{status:'completed',summary:'archived'}})).statusCode,200);assert.equal((await app.inject({url:`/api/v1/tasks/${task.id}`,headers:auth})).json().outcome_state,'archived');

  const lane=await app.inject({url:'/api/v1/lane?stage=Archive&limit=1',headers:auth});assert.equal(lane.statusCode,200);assert.ok(lane.json().items.length);assert.equal(lane.json().items[0].outcome_state,'archived');
  assert.equal((await app.inject({url:`/api/v1/tasks/${task.id}/runs`,headers:auth})).json().items.length,4);
  assert.equal((await app.inject({url:'/api/v1/projects',headers:auth})).statusCode,200);
  const docs=await app.inject({method:'POST',url:'/api/v1/connect',headers:auth});assert.equal(docs.statusCode,200);
  assert.equal((await app.inject({url:'/documentation/',headers:{cookie:docs.headers['set-cookie'] as string}})).statusCode,200);
  const task2=(await app.inject({method:'POST',url:'/api/v1/tasks',headers:{...auth,'idempotency-key':randomUUID()},payload:{projectId,description:'conversation'}})).json();
  const second=(await claim('conversation')).json().items[0],secondHeaders={authorization:`Bearer ${second.token}`,'x-run-generation':String(second.generation)};
  const post=async(path:string,payload:any,headers:any=secondHeaders)=>app.inject({method:'POST',url:path,headers,payload});
  const registered=await post(`/internal/v1/runs/${second.id}/container`,{containerId:'fixture-container',generation:second.generation},{authorization:'Bearer dispatcher-secret'});assert.equal(registered.statusCode,200,registered.body);assert.equal((await app.inject({url:`/api/v1/tasks/${task2.id}`,headers:auth})).json().status,'running');assert.equal((await app.inject({url:'/api/v1/lane?stage=Explore',headers:auth})).json().items.find((t:any)=>t.id===task2.id).status,'running');
  assert.equal((await post(`/internal/v1/runs/${second.id}/heartbeat`,{})).statusCode,200);
  const report={checkedAt:Date.now(),schema:'unknown',validator:'test',overallStatus:'incomplete',items:[{path:'proposal.md',status:'missing',reason:'missing'}]};assert.equal((await post(`/internal/v1/runs/${second.id}/artifact-report`,report)).statusCode,200);assert.equal((await app.inject({url:`/api/v1/tasks/${task2.id}/artifact-reports`,headers:auth})).json().items.length,1);assert.equal((await app.inject({url:`/api/v1/tasks/${task2.id}/artifact-reports`})).statusCode,401);
  assert.equal((await post(`/internal/v1/runs/${second.id}/workspace-lock`,{})).statusCode,200);
  assert.equal((await post(`/internal/v1/runs/${second.id}/workspace-lock`,{release:true})).statusCode,200);
  assert.equal((await post(`/internal/v1/runs/${second.id}/session`,{path:'/sessions/test.jsonl',skillVersion:'hash'})).statusCode,200);
  assert.equal((await post(`/api/v1/tasks/${task2.id}/commands`,{type:'message',payload:{text:'extra context'}},{...auth,'idempotency-key':randomUUID()})).statusCode,202);
  const commands=(await app.inject({url:`/internal/v1/runs/${second.id}/commands`,headers:secondHeaders})).json().items;assert.equal(commands.length,1);
  assert.equal((await post(`/internal/v1/runs/${second.id}/ack`,{commandId:commands[0].id})).statusCode,200);
  assert.equal((await post(`/api/v1/tasks/${task2.id}/commands`,{type:'pause',payload:{}},{...auth,'idempotency-key':randomUUID()})).statusCode,202);
  await post(`/internal/v1/runs/${second.id}/complete`,{status:'paused'});
  const proposal=(await post(`/api/v1/tasks/${task2.id}/commands`,{type:'message',payload:{text:'进入 Propose'}},{...auth,'idempotency-key':randomUUID()})).json();assert.ok(proposal.proposalId);
  assert.equal((await app.inject({url:`/api/v1/tasks/${task2.id}/proposals`,headers:auth})).json().items.length,1);
  const confirmed=await post(`/api/v1/tasks/${task2.id}/commands`,{type:'confirm_transition',payload:{proposalId:proposal.proposalId,version:0}},{...auth,'idempotency-key':randomUUID()});assert.equal(confirmed.statusCode,202,confirmed.body);
  const nextRun=(await claim('recover')).json().items[0];assert.ok(nextRun);
  await pool.query('UPDATE agent_runs SET lease_expires_at=0 WHERE id=$1',[nextRun.id]);
  const reconciliation=await app.inject({url:'/internal/v1/dispatch/reconcile',headers:{authorization:'Bearer dispatcher-secret'}});assert.ok(reconciliation.json().items.some((item:any)=>item.id===nextRun.id));
  const failed=await post(`/internal/v1/runs/${nextRun.id}/failure`,{generation:nextRun.generation,error:'timeout'},{authorization:'Bearer dispatcher-secret'});assert.equal(failed.statusCode,200);assert.equal((await app.inject({url:`/api/v1/tasks/${task2.id}/diagnostics`,headers:auth})).json().items[0].diagnostic.category,'interrupted');
  const manual=(await app.inject({url:`/api/v1/tasks/${task2.id}/diagnostics`,headers:auth})).json().items[0];assert.equal((await post(`/api/v1/tasks/${task2.id}/recovery`,{diagnosticId:manual.id,taskVersion:1,action:'retry_stage'},{...auth,'idempotency-key':randomUUID()})).statusCode,409);
  const retry=await post(`/api/v1/tasks/${task2.id}/commands`,{type:'retry',payload:{}},{...auth,'idempotency-key':randomUUID()});assert.equal(retry.statusCode,409,retry.body);
  const spec=await app.inject({url:'/openapi.json',headers:auth});assert.equal(spec.json().openapi,'3.1.0');assert.ok(spec.json().paths['/api/v1/tasks']);
  assert.equal((await app.inject({url:'/openapi.json'})).statusCode,401);

  // Soft delete task verification
  const del = await app.inject({method:'DELETE',url:`/api/v1/tasks/${task2.id}`,headers:{...auth,'idempotency-key':randomUUID()}});
  assert.equal(del.statusCode,200,del.body);
  assert.equal(del.json().deleted,true);
  const getDeleted = await app.inject({url:`/api/v1/tasks/${task2.id}`,headers:auth});
  assert.equal(getDeleted.statusCode,404);
  const laneAfter = await app.inject({url:'/api/v1/lane?stage=Propose',headers:auth});
  assert.equal(laneAfter.json().items.some((t:any)=>t.id===task2.id),false);
 }finally{await app.close();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});
