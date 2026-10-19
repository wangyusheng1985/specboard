import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp,mkdir,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.ts';
import { Workspaces } from '../src/workspaces.ts';
import { encrypt } from '../src/security.ts';
import { Coordinator, type AgentFactory } from '../src/agent.ts';
const exec=promisify(execFile);
test('real Git worktrees isolate concurrent tasks, retain uncommitted changes and enforce cleanup ownership',async()=>{
 const root=await mkdtemp(join(tmpdir(),'specboard-worktrees-'));const s=new Store();
 try{
  const origin=join(root,'origin');await mkdir(origin);
  await exec('git',['init','-b','main',origin]);await writeFile(join(origin,'README.md'),'base');
  await exec('git',['-C',origin,'add','.']);await exec('git',['-C',origin,'-c','user.name=Test','-c','user.email=test@example.test','commit','-m','initial']);
  const workspaceRoot=join(root,'work');await mkdir(workspaceRoot);
  s.db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run('p','Local fixture',origin,encrypt('fixture-token','key'),'main',join(workspaceRoot,'p'));
  const manager=new Workspaces(s,'key',workspaceRoot,[]);
  const a=s.createTask('p','a'),b=s.createTask('p','b');
  const [pa,pb]=await Promise.all([manager.prepare(a),manager.prepare(b)]);
  assert.notEqual(pa,pb);await writeFile(join(pa,'README.md'),'changed');assert.equal(await readFile(join(pb,'README.md'),'utf8'),'base');
  s.db.prepare("UPDATE tasks SET status='stopped'").run();
  await assert.rejects(manager.cleanup(s.task(a.id)),/uncommitted/);
  assert.equal(s.db.prepare('SELECT cleanup_status FROM workspaces WHERE task_id=?').get(a.id)!.cleanup_status,'failed');
  s.db.prepare('UPDATE workspaces SET path=? WHERE task_id=?').run(pa+'-tampered',a.id);
  await assert.rejects(manager.cleanup(s.task(a.id)),/ownership/);
  await manager.cleanup(s.task(b.id));assert.equal(s.db.prepare('SELECT cleanup_status FROM workspaces WHERE task_id=?').get(b.id)!.cleanup_status,'removed');
  assert.ok(s.events(a.id).some(e=>e.type==='workspace'));assert.ok(!JSON.stringify(s.events(a.id)).includes('fixture-token'));
 }finally{s.close();await rm(root,{recursive:true,force:true});}
});
test('pause, resume and restart require explicit recovery and do not duplicate execution',async()=>{
 const s=new Store();s.db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run('p','p','url','cipher','main','/work');const task=s.createTask('p','task');
 let finish:()=>void=()=>{},runs=0,aborted=0;
 const factory:AgentFactory=async()=>({prompt:async()=>{runs++;await new Promise<void>(resolve=>{finish=resolve;});},steer:async()=>{},abort:async()=>{aborted++;finish();},dispose(){},text:()=>''});
 const c=new Coordinator(s,factory);c.start(task.id);await new Promise(resolve=>setImmediate(resolve));await c.control(task.id,'pause',{});
 assert.equal(aborted,1);assert.equal(s.task(task.id).status,'paused');await c.control(task.id,'resume',{});await new Promise(resolve=>setImmediate(resolve));assert.equal(runs,2);await c.control(task.id,'stop',{});
 s.db.prepare("UPDATE tasks SET status='running' WHERE id=?").run(task.id);
 s.db.prepare("INSERT INTO commands VALUES('interrupted',?,'message','{}','running',NULL)").run(task.id);
 c.recover();assert.equal(s.task(task.id).status,'interrupted');assert.equal(s.db.prepare("SELECT status FROM commands WHERE id='interrupted'").get()!.status,'interrupted');await c.tick();assert.equal(runs,2);s.close();
});
