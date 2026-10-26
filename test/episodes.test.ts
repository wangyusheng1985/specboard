import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {migrateRuntime} from '../src/runtime-migration.ts';
import {EpisodeService} from '../src/episodes.ts';
import {inTransaction} from '../src/runtime-security.ts';
test('episode migration and budget persist and exclude human waiting',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const admin=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL}),schema='episode_'+randomUUID().replaceAll('-','');await admin.query(`CREATE SCHEMA ${schema}`);const url=new URL(process.env.TEST_DATABASE_URL!);url.searchParams.set('options',`-c search_path=${schema}`);const pool=new pg.Pool({connectionString:url.toString()});
 try{await migrateRuntime(pool);const p=randomUUID(),t=randomUUID();await pool.query('INSERT INTO projects VALUES($1,$2,$3,$4,$5,$6)',[p,'p','https://example.test/repo','cipher','main','/workspaces']);await pool.query("INSERT INTO tasks(id,project_id,description,stage,status,stage_entered_at) VALUES($1,$2,'task','Apply','failed',0)",[t,p]);let now=1000;const service=new EpisodeService(pool,()=>now);const id=await inTransaction(pool,db=>service.create(db,t,'Apply'));
 await inTransaction(pool,db=>service.settle(db,id,true));now=4000;await inTransaction(pool,db=>service.settle(db,id,false));now=1000000;const waiting=await inTransaction(pool,db=>service.settle(db,id,false));assert.equal(waiting.used_active_ms,3000);
 const round=await inTransaction(pool,db=>service.chargeRound(db,id));assert.equal(round.attempt,1);assert.equal(round.dueAt,1002000);now+=2000;await inTransaction(pool,db=>service.settle(db,id,false));
 await migrateRuntime(pool);const restarted=new EpisodeService(pool,()=>now);const persisted=await inTransaction(pool,db=>restarted.locked(db,id));assert.equal(persisted.used_rounds,1);assert.equal(Number(persisted.used_active_ms),5000);assert.equal((await pool.query('SELECT execution_policy FROM tasks WHERE id=$1',[t])).rows[0].execution_policy,'autonomous');
 await assert.rejects(inTransaction(pool,db=>service.create(db,t,'Apply')),/duplicate/);assert.equal((await pool.query('SELECT count(*) FROM execution_episodes')).rows[0].count,'1');
 await inTransaction(pool,async db=>{await service.locked(db,id);await db.query('UPDATE execution_episodes SET used_rounds=5 WHERE id=$1',[id]);});await assert.rejects(inTransaction(pool,db=>service.chargeRound(db,id)),/exhausted/);
 await service.pause(id);assert.equal((await pool.query('SELECT status FROM execution_episodes WHERE id=$1',[id])).rows[0].status,'paused');
 }finally{await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});
