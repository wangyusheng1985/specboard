import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.ts';
import {RunService} from '../src/runs.ts';
import {authenticateBearer,issueToken,revokeToken} from '../src/tokens.ts';

function fixture(){const store=new Store();store.db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run('p','p','https://example.test/p','cipher','main','/workspace');const task=store.createTask('p','Task');return {store,task,runs:new RunService(store)};}

test('scoped tokens store only hashes, enforce expiry and revocation',()=>{
 const {store}=fixture();try{
  const issued=issueToken(store,'dispatcher');
  assert.ok(!JSON.stringify(store.db.prepare('SELECT * FROM auth_tokens').all()).includes(issued.token));
  assert.equal(authenticateBearer(store,`Bearer ${issued.token}`,'dispatcher').id,issued.id);
  assert.throws(()=>authenticateBearer(store,`Bearer ${issued.token}`,'api'));
  revokeToken(store,issued.id);assert.throws(()=>authenticateBearer(store,`Bearer ${issued.token}`,'dispatcher'));
  const expired=issueToken(store,'api',{ttlMs:-1});assert.throws(()=>authenticateBearer(store,`Bearer ${expired.token}`,'api'));
 }finally{store.close();}
});
test('leases and generations fence old agents, duplicate events do not enter task timeline twice',()=>{
 const {store,task,runs}=fixture();try{
  const a=runs.create(task.id,'Explore');const auth=`Bearer ${a.token}`;
  assert.throws(()=>runs.create(task.id,'Explore'),/Active/);
  runs.heartbeat(a.run.id,auth,1);
  const events=[{sequence:1,type:'progress',payload:{text:'hello'}}];
  runs.events(a.run.id,auth,1,events);runs.events(a.run.id,auth,1,events);
  assert.equal(store.events(task.id).length,1);
  assert.throws(()=>runs.context(a.run.id,auth,2));
  store.db.prepare('UPDATE agent_runs SET lease_expires_at=0 WHERE id=?').run(a.run.id);
  assert.throws(()=>runs.heartbeat(a.run.id,auth,1),/Stale/);
  runs.expire();const b=runs.create(task.id,'Explore');assert.equal(b.run.generation,2);
  assert.throws(()=>runs.context(a.run.id,auth,1),/Stale/);
  assert.equal(runs.context(b.run.id,`Bearer ${b.token}`,2).task.id,task.id);
 }finally{store.close();}
});
