import { randomUUID } from 'node:crypto';
import type { Store, Stage } from './store.ts';
import { issueToken, authenticateBearer } from './tokens.ts';

export interface AgentRun { id:string; taskId:string; stage:Stage; generation:number; status:string; leaseExpiresAt:number; heartbeatAt:number|null; containerId:string|null }
const leaseMs=Number(process.env.AGENT_LEASE_MS||30000);
export class RunService {
 constructor(private store:Store) {}
 create(taskId:string, stage:Stage) {
  return this.store.transaction(()=>{
   const active=this.store.db.prepare("SELECT * FROM agent_runs WHERE task_id=? AND stage=? AND status IN ('queued','running','waiting_input') ORDER BY generation DESC LIMIT 1").get(taskId,stage);
   if(active)throw new Error('Active run already exists');
   const prior=this.store.db.prepare('SELECT MAX(generation) AS generation FROM agent_runs WHERE task_id=? AND stage=?').get(taskId,stage) as {generation:number|null};
   const generation=(prior.generation??0)+1,id=randomUUID(),now=Date.now();
   this.store.db.prepare("INSERT INTO agent_runs(id,task_id,stage,generation,status,lease_expires_at,heartbeat_at,created_at,updated_at) VALUES(?,?,?,?,'queued',?,?,?,?)").run(id,taskId,stage,generation,now+leaseMs,now,now,now);
   const token=issueToken(this.store,'agent',{runId:id,generation,ttlMs:Math.max(leaseMs*4,120000)});
   this.store.db.prepare('UPDATE agent_runs SET agent_token_id=? WHERE id=?').run(token.id,id);
   return {run:this.get(id)!,token:token.token};
  });
 }
 get(id:string) { return this.store.db.prepare('SELECT id,task_id AS taskId,stage,generation,status,lease_expires_at AS leaseExpiresAt,heartbeat_at AS heartbeatAt,container_id AS containerId FROM agent_runs WHERE id=?').get(id) as AgentRun|undefined; }
 auth(id:string,authorization:string|undefined,generation:number){
  const token=authenticateBearer(this.store,authorization,'agent',{runId:id,generation});
  const run=this.get(id);
  if(!run || run.generation!==generation || run.leaseExpiresAt<=Date.now() || !['queued','running','waiting_input'].includes(run.status))throw new Error('Stale run');
  const latest=this.store.db.prepare('SELECT MAX(generation) AS generation FROM agent_runs WHERE task_id=? AND stage=?').get(run.taskId,run.stage);
  if(latest?.generation!==generation)throw new Error('Stale run');
  return token;
 }
 context(id:string,authorization:string|undefined,generation:number){this.auth(id,authorization,generation);const run=this.get(id);if(!run)throw new Error('Run not found');const task=this.store.task(run.taskId);const previous=this.store.db.prepare('SELECT stage,result,error FROM stage_runs WHERE task_id=? AND result IS NOT NULL ORDER BY started_at DESC LIMIT 4').all(run.taskId);return {run,task:{id:task.id,projectId:task.projectId,description:task.description,stage:task.stage},previousResults:previous};}
 heartbeat(id:string,authorization:string|undefined,generation:number){this.auth(id,authorization,generation);const now=Date.now();const result=this.store.db.prepare("UPDATE agent_runs SET heartbeat_at=?,lease_expires_at=?,status=CASE WHEN status='queued' THEN 'running' ELSE status END,updated_at=? WHERE id=? AND generation=? AND status NOT IN ('completed','failed','stopped','interrupted')").run(now,now+leaseMs,now,id,generation);if(!result.changes)throw new Error('Stale run');return this.get(id)!;}
 events(id:string,authorization:string|undefined,generation:number,items:Array<{sequence:number;type:string;payload:unknown}>){this.auth(id,authorization,generation);return this.store.transaction(()=>{for(const item of items){if(!Number.isSafeInteger(item.sequence)||item.sequence<0)throw new Error('Invalid event sequence');const inserted=this.store.db.prepare('INSERT OR IGNORE INTO run_events VALUES(?,?,?,?,?,?)').run(id,generation,item.sequence,item.type,this.store.redact(JSON.stringify(item.payload)),Date.now());if(inserted.changes)this.store.event(this.get(id)!.taskId,this.get(id)!.stage,item.type,item.payload);}return {accepted:items.map(x=>x.sequence)};});}
 complete(id:string,authorization:string|undefined,generation:number,input:{status:'completed'|'failed'|'interrupted';summary?:string;error?:string;validation?:unknown;artifacts?:unknown[]}){this.auth(id,authorization,generation);const result=this.store.transaction(()=>{const now=Date.now();const updated=this.store.db.prepare("UPDATE agent_runs SET status=?,updated_at=?,lease_expires_at=? WHERE id=? AND generation=? AND status NOT IN ('completed','failed','stopped','interrupted')").run(input.status,now,now,id,generation);if(!updated.changes)throw new Error('Stale or already completed run');this.store.db.prepare("UPDATE stage_runs SET status=?,result=?,error=?,ended_at=? WHERE id=(SELECT id FROM stage_runs WHERE task_id=(SELECT task_id FROM agent_runs WHERE id=?) AND stage=(SELECT stage FROM agent_runs WHERE id=?) ORDER BY started_at DESC LIMIT 1)").run(input.status,input.summary||'',input.error||null,now,id,id);this.store.event(this.get(id)!.taskId,this.get(id)!.stage,'run_complete',{status:input.status,summary:input.summary,error:input.error,validation:input.validation,artifacts:input.artifacts});return this.get(id)!;});return result;}
 commands(id:string,authorization:string|undefined,generation:number,after=0){this.auth(id,authorization,generation);return this.store.db.prepare("SELECT id,type,payload,created_at AS createdAt FROM run_commands WHERE run_id=? AND status='queued' AND rowid>? ORDER BY rowid LIMIT 50").all(id,after);}
 acknowledgeCommand(id:string,authorization:string|undefined,generation:number,commandId:string){this.auth(id,authorization,generation);const result=this.store.db.prepare("UPDATE run_commands SET status='acknowledged',acknowledged_at=? WHERE id=? AND run_id=? AND status IN ('queued','delivered')").run(Date.now(),commandId,id);if(!result.changes)throw new Error('Command not found');return {acknowledged:true};}
 expire(){const now=Date.now();return this.store.db.prepare("UPDATE agent_runs SET status='interrupted',updated_at=? WHERE lease_expires_at<? AND status IN ('queued','running','waiting_input')").run(now,now).changes;}
}
