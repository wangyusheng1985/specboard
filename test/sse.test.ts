import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.ts';

const secret='sse-test-secret-123456789012345678901234';
test('authenticated SSE resumes after a sequence cursor', async()=>{
 const dir=await mkdtemp(join(tmpdir(),'specboard-sse-'));
 const app=createApp({dataDir:dir,secret,encryptionKey:secret,workspaceRoot:join(dir,'work'),sessionDir:join(dir,'sessions'),agentDir:join(dir,'pi'),allowedHosts:[],factory:async()=>({prompt:async()=>{},steer:async()=>{},abort:async()=>{},dispose(){},text:()=>''})});
 await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${(app.server.address() as {port:number}).port}`;
 try{
  app.store.db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run('p','p','https://example.test/p','cipher','main',join(dir,'work'));
  const task=app.store.createTask('p','sse task');app.store.event(task.id,'Explore','first',{ok:true});
  const events=app.store.events(task.id);const response=await fetch(`${base}/api/v1/events?taskId=${task.id}&after=${events[0].sequence}`,{headers:{authorization:`Bearer ${secret}`}});
  assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/text\/event-stream/);
  app.store.event(task.id,'Explore','second',{ok:true});
  const reader=response.body!.getReader();const decoder=new TextDecoder();let text='';const deadline=Date.now()+3000;
  while(Date.now()<deadline&&!text.includes('second')){const result=await Promise.race([reader.read(),new Promise<{done:true;value:undefined}>(resolve=>setTimeout(()=>resolve({done:true,value:undefined}),600))]);if(result.value)text+=decoder.decode(result.value);}
  assert.match(text,/second/);await reader.cancel();

  // Test SSE query token authentication
  const tokenQueryRes=await fetch(`${base}/api/v1/events?taskId=${task.id}&after=0&token=${secret}`);
  assert.equal(tokenQueryRes.status,200);
  assert.match(tokenQueryRes.headers.get('content-type')||'',/text\/event-stream/);
  await tokenQueryRes.body?.cancel();
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
