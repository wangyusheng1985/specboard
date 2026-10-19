import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store,stages } from '../src/store.ts';
import { Workspaces } from '../src/workspaces.ts';
import { piFactory } from '../src/agent.ts';

test('real Pi SDK creates and restores stage sessions with packaged OpenSpec skills without model calls',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'specboard-pi-')),s=new Store();
 const old={provider:process.env.PI_PROVIDER,model:process.env.PI_MODEL,key:process.env.PI_API_KEY};
 process.env.PI_PROVIDER='anthropic';process.env.PI_MODEL='claude-sonnet-4-5';process.env.PI_API_KEY='fixture-no-network';
 try{
  s.db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run('p','Fixture','https://gitlab.example/team/repo','encrypted','main',dir);
  const workspaces=new Workspaces(s,'key',dir,[]);workspaces.prepare=async()=>dir;
  const factory=piFactory(s,workspaces,join(dir,'sessions'),join(dir,'pi'));
  const task=s.createTask('p','Inspect repository');
  for(const stage of stages){
   const handle=await factory({...task,stage},()=>{},()=>{});handle.dispose();
   const conversation=s.db.prepare('SELECT * FROM conversations WHERE task_id=? AND stage=?').get(task.id,stage)!;
   assert.equal(conversation.cwd,dir);assert.match(conversation.skill_version as string,/^[a-f0-9]{64}$/);assert.ok(conversation.session_path);
  }
  assert.equal(s.db.prepare('SELECT count(*) AS n FROM conversations').get()!.n,4);
 }finally{
  for(const [name,value] of [['PI_PROVIDER',old.provider],['PI_MODEL',old.model],['PI_API_KEY',old.key]]){if(value===undefined)delete process.env[name!];else process.env[name!]=value;}
  s.close();await rm(dir,{recursive:true,force:true});
 }
});

test('GitLab project validation requires allowed HTTPS origin, verifies branch and encrypts token',async()=>{
 const s=new Store(),original=globalThis.fetch;const calls:string[]=[];
 globalThis.fetch=(async(input,init)=>{calls.push(String(input));assert.equal((init?.headers as Record<string,string>)['PRIVATE-TOKEN'],'fixture-secret');return new Response('{}',{status:200});}) as typeof fetch;
 try{
  const manager=new Workspaces(s,'encryption-key','/workspaces',['gitlab.example']);
  const input={name:'Project',repositoryUrl:'https://gitlab.example/group/repository.git',apiToken:'fixture-secret',defaultBranch:'feature/test'};
  const project=await manager.save(input);assert.equal(calls.length,2);assert.ok(calls[1].includes('feature%2Ftest'));
  assert.ok(!JSON.stringify(project).includes('fixture-secret'));
  assert.ok(!JSON.stringify(s.db.prepare('SELECT * FROM projects').all()).includes('fixture-secret'));
  await assert.rejects(manager.validate({...input,repositoryUrl:'https://untrusted.example/repo.git'}),/host/);
  await assert.rejects(manager.validate({...input,repositoryUrl:'http://gitlab.example/repo.git'}),/host/);
  globalThis.fetch=(async()=>new Response('{}',{status:401})) as typeof fetch;
  await assert.rejects(manager.save(input),/401/);assert.equal(manager.list().length,1);
 }finally{globalThis.fetch=original;s.close();}
});
