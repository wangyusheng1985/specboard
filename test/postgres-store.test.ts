import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PostgresStore} from '../src/postgres-store.ts';
import {randomUUID} from 'node:crypto';
test('PostgreSQL store migrates and atomically commits or rolls back',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const store=new PostgresStore(process.env.TEST_DATABASE_URL);
 try{await store.migrate();assert.equal(await store.health(),true);const project=randomUUID(),task=randomUUID(),now=Date.now();
 await store.pool.query('INSERT INTO projects VALUES($1,$2,$3,$4,$5,$6)',[project,'p','url','cipher','main','/work']);
 await store.pool.query('INSERT INTO tasks(id,project_id,description,stage,status,stage_entered_at) VALUES($1,$2,$3,$4,$5,$6)',[task,project,'task','Explore','queued',now]);
 const run=await store.createRun(task,'Explore');assert.equal(run.generation,1);
 await assert.rejects(store.transaction(async db=>{await db.query('UPDATE tasks SET summary=$2 WHERE id=$1',[task,'rollback']);throw new Error('intentional');}),/intentional/);
 assert.equal((await store.pool.query('SELECT summary FROM tasks WHERE id=$1',[task])).rows[0].summary,'');
 }finally{await store.close();}
 assert.throws(()=>new PostgresStore(''),/DATABASE_URL/);
});
