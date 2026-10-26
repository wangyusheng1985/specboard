import pg from 'pg';
import { randomUUID } from 'node:crypto';
import type { Stage } from './store.ts';
const { Pool }=pg;
export class PostgresStore {
 pool:pg.Pool;
 constructor(url=process.env.DATABASE_URL){if(!url)throw new Error('DATABASE_URL is required for PostgreSQL');this.pool=new Pool({connectionString:url,max:Number(process.env.DATABASE_POOL_SIZE||10),connectionTimeoutMillis:10000});}
 async migrate(){await this.pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
   CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,repository_url TEXT NOT NULL,encrypted_token TEXT NOT NULL,default_branch TEXT NOT NULL,workspace_root TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),description TEXT NOT NULL,stage TEXT NOT NULL,status TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0,stage_entered_at BIGINT NOT NULL,updated_at BIGINT NOT NULL DEFAULT 0,summary TEXT NOT NULL DEFAULT '');
   CREATE TABLE IF NOT EXISTS agent_runs(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),stage TEXT NOT NULL,generation INTEGER NOT NULL,status TEXT NOT NULL,lease_expires_at BIGINT NOT NULL,heartbeat_at BIGINT,container_id TEXT,agent_token_id TEXT,created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL);
   CREATE UNIQUE INDEX IF NOT EXISTS active_agent_run ON agent_runs(task_id,stage) WHERE status IN ('queued','running','waiting_input');
   CREATE TABLE IF NOT EXISTS run_events(run_id TEXT NOT NULL REFERENCES agent_runs(id),generation INTEGER NOT NULL,sequence INTEGER NOT NULL,type TEXT NOT NULL,payload JSONB NOT NULL,created_at BIGINT NOT NULL,PRIMARY KEY(run_id,generation,sequence));
   CREATE TABLE IF NOT EXISTS run_commands(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES agent_runs(id),type TEXT NOT NULL,payload JSONB NOT NULL,status TEXT NOT NULL,created_at BIGINT NOT NULL,delivered_at BIGINT,acknowledged_at BIGINT);
   CREATE TABLE IF NOT EXISTS auth_tokens(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,scope TEXT NOT NULL,run_id TEXT,generation INTEGER,expires_at BIGINT NOT NULL,revoked_at BIGINT);`);}
 async transaction<T>(fn:(client:pg.PoolClient)=>Promise<T>):Promise<T>{const client=await this.pool.connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
 async createRun(taskId:string,stage:Stage){return this.transaction(async client=>{const current=await client.query("SELECT generation FROM agent_runs WHERE task_id=$1 AND stage=$2 ORDER BY generation DESC LIMIT 1 FOR UPDATE",[taskId,stage]);const generation=(current.rows[0]?.generation||0)+1;const id=randomUUID(),now=Date.now();await client.query("INSERT INTO agent_runs(id,task_id,stage,generation,status,lease_expires_at,heartbeat_at,created_at,updated_at) VALUES($1,$2,$3,$4,'queued',$5,$6,$6,$6)",[id,taskId,stage,generation,now+30000,now]);return {id,generation};});}
 async health(){await this.pool.query('SELECT 1');return true;}
 async close(){await this.pool.end();}
}
