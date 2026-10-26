import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.ts';
import { signature, encrypt } from '../src/security.ts';
import type { AgentFactory } from '../src/agent.ts';

const secret='test-only-secret-not-for-deployment-1234';
test('HTTP workflow, signed mutations, paged lanes, stage handoff, intervention and restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'specboard-app-'));
 const prompts:string[]=[];
 const factory:AgentFactory=async(task,emit)=>({
  async prompt(text){prompts.push(text);emit('text_delta',{text:`${task.stage} output`});emit('tool_execution_start',{toolName:'read'});emit('tool_execution_end',{toolName:'read',result:{ok:true}});},
  async steer(){},async abort(){},dispose(){},text:()=>`Verified ${task.stage}`
 });
 const options={dataDir:dir,secret,encryptionKey:secret,workspaceRoot:join(dir,'work'),sessionDir:join(dir,'sessions'),agentDir:join(dir,'pi'),allowedHosts:[],factory};
 let app=createApp(options);
 const listen=async()=>{await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));return `http://127.0.0.1:${(app.server.address() as {port:number}).port}`;};
 let base=await listen();
 const get=async(path:string)=>{const r=await fetch(base+path,{headers:{authorization:`Bearer ${secret}`}});assert.equal(r.status,200);return r.json();};
 const post=async(path:string,body:unknown,id=randomUUID(),nonce=randomUUID())=>{
  const raw=JSON.stringify(body), timestamp=String(Date.now());
  return fetch(base+path,{method:'POST',headers:{'content-type':'application/json','x-request-id':id,'x-nonce':nonce,'x-timestamp':timestamp,'x-signature':signature(secret,'POST',path,timestamp,nonce,id,raw)},body:raw});
 };
 try{
  app.store.db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run('p','Project','https://gitlab.example/team/repo',encrypt('fixture-token',secret),'main',join(dir,'work'));
  assert.equal((await fetch(base+'/api/v1/board')).status,401);
  const create=await post('/api/v1/tasks',{projectId:'p',description:'Build feature'});assert.equal(create.status,201);const task=await create.json();
  await app.coordinator.tick();await app.coordinator.idle(task.id);
  const board=await get('/api/v1/board');assert.equal(board.Explore.items[0].project_name,'Project');assert.equal(board.Explore.items[0].summary,'Verified Explore');
  const events=await get(`/api/v1/tasks/${task.id}/events`);assert.ok(events.some((event:{type:string})=>event.type==='text_delta'));
  const after=events[events.length-1].sequence;assert.deepEqual(await get(`/api/v1/tasks/${task.id}/events?after=${after}`),[]);
  let version=0;
  for(const stage of ['Propose','Apply','Archive']){
   const path=`/api/v1/tasks/${task.id}/commands`, id=randomUUID();
   const body={type:'transition',payload:{target:stage,version}};
   assert.equal((await post(path,body,id)).status,202);
   assert.equal((await post(path,body,id)).status,202);
   await app.coordinator.tick();await app.coordinator.idle(task.id);version++;
   assert.equal((await get('/api/v1/tasks/'+task.id)).stage,stage);
  }
  assert.ok(prompts.some(text=>text.includes('Verified Propose')));
  assert.equal(app.store.db.prepare('SELECT count(*) AS n FROM stage_runs WHERE task_id=?').get(task.id)!.n,4);
  assert.equal((await post(`/api/v1/tasks/${task.id}/commands`,{type:'transition',payload:{target:'Explore',version}})).status,400);
  const replay=await post('/api/v1/tasks',{projectId:'p',description:'Second'});const second=await replay.json();await app.coordinator.tick();await app.coordinator.idle(second.id);
  await post(`/api/v1/tasks/${second.id}/commands`,{type:'message',payload:{text:'进入 Propose'}});await app.coordinator.tick();
  assert.equal(app.store.task(second.id).stage,'Explore');
  const proposals=await get(`/api/v1/tasks/${second.id}/proposals`);assert.equal(proposals.length,1);
  await post(`/api/v1/tasks/${second.id}/commands`,{type:'confirm_transition',payload:{proposalId:proposals[0].id,version:0}});await app.coordinator.tick();await app.coordinator.idle(second.id);
  assert.equal(app.store.task(second.id).stage,'Propose');
  await app.close();app=createApp(options);base=await listen();assert.equal((await get('/api/v1/tasks/'+task.id)).stage,'Archive');
  assert.equal((await get(`/api/v1/tasks/${task.id}/events`)).length>0,true);
 } finally {await app.close();await rm(dir,{recursive:true,force:true});}
});

test('security failures cause no task side effects and sessions use short-lived signing keys',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'specboard-security-'));
 const app=createApp({dataDir:dir,secret,encryptionKey:secret,workspaceRoot:join(dir,'work'),sessionDir:join(dir,'sessions'),agentDir:join(dir,'pi'),allowedHosts:[],factory:async()=>{throw new Error('Must not execute');}});
 await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${(app.server.address() as {port:number}).port}`;
 try{
  const raw=JSON.stringify({projectId:'p',description:'tamper'}),timestamp=String(Date.now()-120000),nonce=randomUUID(),id=randomUUID();
  const response=await fetch(base+'/api/v1/tasks',{method:'POST',headers:{'x-timestamp':timestamp,'x-nonce':nonce,'x-request-id':id,'x-signature':signature(secret,'POST','/api/v1/tasks',timestamp,nonce,id,raw)},body:raw});
  assert.equal(response.status,401);assert.equal(app.store.db.prepare('SELECT count(*) AS n FROM tasks').get()!.n,0);
  const connected=await fetch(base+'/api/v1/connect',{method:'POST',headers:{authorization:`Bearer ${secret}`}});
  assert.equal(connected.status,200);const connection=await connected.json();assert.notEqual(connection.signingKey,secret);
  assert.match(connected.headers.get('set-cookie')!,/HttpOnly; SameSite=Strict/);
  assert.equal((await fetch(base+'/api/v1/connect',{method:'POST',headers:{authorization:`Bearer ${secret}`,origin:'https://attacker.example'}})).status,403);
  assert.equal(app.store.db.prepare('SELECT count(*) AS n FROM security_events').get()!.n,1);
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
