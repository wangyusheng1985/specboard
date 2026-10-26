import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import {EpisodeService} from './episodes.ts';
import {recoveryStrategy,type RecoveryEvidence} from './outcomes.ts';
import {inTransaction} from './runtime-security.ts';
export class AutomaticRecoveryService{
 constructor(public pool:pg.Pool,public episodes=new EpisodeService(pool)){}
 async decide(runId:string,evidence:RecoveryEvidence,retryAfterMs=0){return inTransaction(this.pool,db=>this.decideIn(db,runId,evidence,retryAfterMs));}
 async decideIn(db:pg.PoolClient,runId:string,evidence:RecoveryEvidence,retryAfterMs=0){
  // Task -> episode -> run is the global lock ordering for recovery decisions.
  const original=(await db.query('SELECT task_id FROM agent_runs WHERE id=$1',[runId])).rows[0];if(!original)throw new Error('Run missing');
  const task=(await db.query('SELECT * FROM tasks WHERE id=$1 FOR UPDATE',[original.task_id])).rows[0];
  const run=(await db.query('SELECT * FROM agent_runs WHERE id=$1',[runId])).rows[0];
  if(task.execution_policy!=='autonomous'||!run.episode_id)return {action:'manual'};
  const episode=await this.episodes.locked(db,run.episode_id);
  const existing=(await db.query('SELECT * FROM recovery_decisions WHERE origin_run=$1',[runId])).rows[0];if(existing)return {action:existing.strategy,id:existing.id};
  const latest=(await db.query('SELECT id FROM agent_runs WHERE task_id=$1 AND stage=$2 ORDER BY generation DESC LIMIT 1',[task.id,run.stage])).rows[0];
  if(latest?.id!==run.id||task.stage!==run.stage||!['failed','interrupted'].includes(run.status)||episode.status!=='active')return {action:'stale'};
  if(process.env.AUTO_RECOVERY_ENABLED==='false')return {action:'disabled'};
  const strategy=recoveryStrategy(evidence);
  const sessionReady=(await db.query('SELECT 1 FROM runtime_sessions WHERE task_id=$1 AND stage=$2',[task.id,run.stage])).rowCount!>0;
  if(strategy==='block'||strategy==='clarify'||strategy==='reconcile_read_only'||!sessionReady){
   await this.episodes.settle(db,episode.id,false);await db.query("UPDATE tasks SET outcome_state=$2,outcome_revision=outcome_revision+1 WHERE id=$1",[task.id,strategy==='clarify'?'clarifying':'blocked']);return {action:!sessionReady?'reconcile_read_only':strategy};
  }
  // Do not catch SQL transaction failures: only domain budget exhaustion is handled here.
  let charged;try{charged=await this.episodes.chargeRound(db,episode.id,retryAfterMs);}catch(error){if((error as any).code!=='budget_exhausted')throw error;await db.query("UPDATE execution_episodes SET status='exhausted' WHERE id=$1",[episode.id]);await db.query("UPDATE tasks SET outcome_state='blocked',outcome_revision=outcome_revision+1 WHERE id=$1",[task.id]);return {action:'budget_exhausted'};}
  const id=randomUUID();await db.query("INSERT INTO recovery_decisions(id,episode_id,origin_run,strategy,attempt_no,due_at,status,revocation_version,session_ready_at,container_exited_at) VALUES($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9)",[id,episode.id,run.id,strategy,charged.attempt,charged.dueAt,charged.revocationVersion,Date.now(),Date.now()]);await db.query("UPDATE tasks SET outcome_state='recovering',outcome_revision=outcome_revision+1 WHERE id=$1",[task.id]);return {action:strategy,id};
 }
}
