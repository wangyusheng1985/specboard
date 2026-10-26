import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.ts';
import { Store } from '../src/store.ts';
import { RunService } from '../src/runs.ts';
const secret='version-test-secret-123456789012345678';
test('unversioned mutation routes require /api/v1',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'specboard-version-'));const app=createApp({dataDir:dir,secret,encryptionKey:secret,workspaceRoot:join(dir,'work'),sessionDir:join(dir,'sessions'),agentDir:join(dir,'pi'),allowedHosts:[],factory:async()=>({prompt:async()=>{},steer:async()=>{},abort:async()=>{},dispose(){},text:()=>''})});await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${(app.server.address() as {port:number}).port}`;
 try{const response=await fetch(base+'/api/tasks',{method:'POST',headers:{authorization:`Bearer ${secret}`,'content-type':'application/json'},body:'{}'});assert.equal(response.status,410);assert.match(await response.text(),/API version required/);}finally{await app.close();await rm(dir,{recursive:true,force:true});}
});

test('dispatcher leases are exclusive across owners',()=>{
 const store=new Store();store.db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run('p','p','https://example.test/p','cipher','main','/work');const task=store.createTask('p','dispatch');const runs=new RunService(store);const first=runs.create(task.id,'Explore');const now=Date.now();store.db.prepare('INSERT INTO dispatch_leases VALUES(?,?,?)').run(first.run.id,'one',now+30000);const claimed=store.db.prepare("INSERT OR IGNORE INTO dispatch_leases VALUES(?,?,?)").run(first.run.id,'two',now+30000);assert.equal(claimed.changes,0);store.close();});
