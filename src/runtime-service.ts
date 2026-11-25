import {createDiagnostic,validateDiagnostic,type Diagnostic} from './diagnostics.ts';
import {synthesizeStructuredDiagnostic} from './diagnostic-synthesizer.ts';
import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import {ApiError,mintToken,inTransaction,digest} from './runtime-security.ts';
import {stages} from './store.ts';
import {AutomaticRecoveryService} from './automatic-recovery.ts';
import {projectOutcome} from './outcomes.ts';
export class RuntimeService{
 constructor(public pool:pg.Pool,public options:{gatewayUrl?:string}={}){this.recovery=new AutomaticRecoveryService(pool);}
 private recovery:AutomaticRecoveryService;
 async task(id:string,db:pg.Pool|pg.PoolClient=this.pool){const row=(await db.query("SELECT t.*,(SELECT diagnostic->>'category' FROM run_diagnostics d WHERE d.task_id=t.id AND d.stage=t.stage ORDER BY d.created_at DESC LIMIT 1) AS failure_category FROM tasks t WHERE t.id=$1 AND t.deleted_at IS NULL",[id])).rows[0];if(!row)throw new ApiError(404,'task_not_found','Task not found');row.outcome_state=projectOutcome(row);return row;}
 async event(db:pg.Pool|pg.PoolClient,taskId:string,runId:string|null,type:string,payload:unknown){await db.query('INSERT INTO runtime_events(task_id,run_id,type,payload,created_at) VALUES($1,$2,$3,$4,$5)',[taskId,runId,type,JSON.stringify(payload),Date.now()]);}
 async enqueue(db:pg.PoolClient,task:any,text?:string){
  const existing=(await db.query("SELECT id FROM agent_runs WHERE task_id=$1 AND status IN ('queued','claimed','running','waiting_input')",[task.id])).rows[0];
  if(existing)throw new ApiError(409,'run_active','Task already has an active run');
  const generation=Number((await db.query('SELECT coalesce(max(generation),0)+1 AS generation FROM agent_runs WHERE task_id=$1 AND stage=$2',[task.id,task.stage])).rows[0].generation);
  const id=randomUUID(),now=Date.now();
  if(task.execution_policy==='manual'){await db.query("UPDATE tasks SET execution_policy='autonomous' WHERE id=$1",[task.id]);task.execution_policy='autonomous';}
  let episodeId:string|null=null;if(task.execution_policy==='autonomous'){episodeId=(await db.query("SELECT id FROM execution_episodes WHERE task_id=$1 AND stage=$2 AND status IN ('active','waiting','paused')",[task.id,task.stage])).rows[0]?.id||null;if(!episodeId){episodeId=randomUUID();await db.query("INSERT INTO execution_episodes(id,task_id,stage,status,created_at) VALUES($1,$2,$3,'active',$4)",[episodeId,task.id,task.stage,now]);}}
  await db.query("INSERT INTO agent_runs(id,task_id,stage,generation,status,lease_expires_at,created_at,updated_at,episode_id) VALUES($1,$2,$3,$4,'queued',$5,$5,$5,$6)",[id,task.id,task.stage,generation,now,episodeId]);
  if(text)await db.query("INSERT INTO run_commands(id,run_id,type,payload,status,created_at) VALUES($1,$2,'message',$3,'queued',$4)",[randomUUID(),id,JSON.stringify({text}),now]);
  await db.query("UPDATE tasks SET status='queued',wait_reason=NULL,outcome_state='executing',outcome_revision=outcome_revision+1,updated_at=$2 WHERE id=$1",[task.id,now]);return {id,generation};
 }
 async create(db:pg.PoolClient,projectId:string|null,description:string,kind:'work'|'chat'='work'){
  if(projectId){
   const project=(await db.query('SELECT id FROM projects WHERE id=$1',[projectId])).rows[0];if(!project)throw new ApiError(404,'project_not_found','Project not found');
  }else if(kind!=='chat'){
   throw new ApiError(400,'project_required','Project is required for work tasks');
  }
  const id=randomUUID(),now=Date.now();
  await db.query("INSERT INTO tasks(id,project_id,description,stage,status,version,stage_entered_at,updated_at,execution_policy,outcome_state,kind) VALUES($1,$2,$3,'Explore','queued',0,$4,$4,'autonomous','clarifying',$5)",[id,projectId||null,description,now,kind]);
  const task=await this.task(id,db);
  await this.enqueue(db,task);
  return task;
 }
 async claim(owner:string){return inTransaction(this.pool,async db=>{
  const recovery=(await db.query("SELECT d.*,e.task_id,e.stage,e.revocation_version AS current_revocation FROM recovery_decisions d JOIN execution_episodes e ON e.id=d.episode_id JOIN agent_runs r ON r.id=d.origin_run WHERE d.status='pending' AND d.due_at<=$1 AND e.status='active' AND d.session_ready_at IS NOT NULL AND d.container_exited_at IS NOT NULL AND d.revocation_version=e.revocation_version AND r.status IN ('failed','interrupted')  FOR UPDATE OF d,e SKIP LOCKED LIMIT 1",[Date.now()])).rows[0];
  if(recovery){const task=await this.task(recovery.task_id,db);const queued=await this.enqueue(db,task);const token=await mintToken(db,'agent',86400000,queued.id,queued.generation);await db.query("UPDATE agent_runs SET status='claimed',agent_token_id=$2,lease_expires_at=$3,updated_at=$4 WHERE id=$1",[queued.id,token.id,Date.now()+60000,Date.now()]);await db.query("UPDATE recovery_decisions SET status='claimed',successor_run=$2 WHERE id=$1",[recovery.id,queued.id]);const diagnostic=(await db.query('SELECT id FROM run_diagnostics WHERE run_id=$1',[recovery.origin_run])).rows[0];if(diagnostic)await db.query('INSERT INTO run_recoveries(run_id,diagnostic_id,intent) VALUES($1,$2,$3) ON CONFLICT(run_id) DO NOTHING',[queued.id,diagnostic.id,JSON.stringify({strategy:recovery.strategy,attempt:recovery.attempt_no})]);await this.event(db,task.id,queued.id,'recovery_claimed',{owner,generation:queued.generation,attempt:recovery.attempt_no});return {items:[{id:queued.id,generation:queued.generation,taskId:task.id,projectId:task.project_id||'',token:token.token}]};}
  const run=(await db.query("SELECT * FROM agent_runs WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1")).rows[0];if(!run)return {items:[]};
  const token=await mintToken(db,'agent',86400000,run.id,run.generation);
  await db.query("UPDATE agent_runs SET status='claimed',agent_token_id=$2,lease_expires_at=$3,updated_at=$4 WHERE id=$1",[run.id,token.id,Date.now()+60000,Date.now()]);
  await this.event(db,run.task_id,run.id,'dispatch_claimed',{owner,generation:run.generation});return {items:[{id:run.id,generation:run.generation,taskId:run.task_id,projectId:(await this.task(run.task_id,db)).project_id||'',token:token.token}]};
 });}
 async active(id:string,generation:number,db:pg.Pool|pg.PoolClient=this.pool){
  const row=(await db.query('SELECT * FROM agent_runs WHERE id=$1',[id])).rows[0];
  if(!row)throw new ApiError(404,'run_not_found','Run not found');
  const latest=(await db.query('SELECT max(generation) AS generation FROM agent_runs WHERE task_id=$1 AND stage=$2',[row.task_id,row.stage])).rows[0];
  if(row.generation!==generation||latest.generation!==generation||!['claimed','running','waiting_input'].includes(row.status)||Number(row.lease_expires_at)<Date.now())throw new ApiError(409,'stale_run','Run is expired or superseded');return row;
 }
 async ingest(id:string,generation:number,events:Array<{sequence:number;type:string;payload:unknown}>){return inTransaction(this.pool,async db=>{
  await db.query('SELECT id FROM agent_runs WHERE id=$1 FOR UPDATE',[id]);const run=await this.active(id,generation,db);
  let sequence=Number((await db.query('SELECT coalesce(max(sequence),0) AS sequence FROM run_events WHERE run_id=$1 AND generation=$2',[id,generation])).rows[0].sequence);
  for(const event of events){
   if(event.sequence<=sequence){const old=(await db.query('SELECT type,payload FROM run_events WHERE run_id=$1 AND generation=$2 AND sequence=$3',[id,generation,event.sequence])).rows[0];if(!old||old.type!==event.type||JSON.stringify(old.payload)!==JSON.stringify(JSON.parse(JSON.stringify(event.payload))))throw new ApiError(409,'event_conflict','Event sequence reused');continue;}
   if(event.sequence!==sequence+1)throw new ApiError(409,'event_gap','Events must be contiguous');
   await db.query('INSERT INTO run_events VALUES($1,$2,$3,$4,$5,$6)',[id,generation,event.sequence,event.type,JSON.stringify(event.payload),Date.now()]);await this.event(db,run.task_id,id,event.type,event.payload);sequence=event.sequence;
  }return {acknowledged:sequence};
 });}
 async complete(id:string,generation:number,result:any){return inTransaction(this.pool,async db=>{
  const row=(await db.query('SELECT * FROM agent_runs WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(row?.generation===generation&&['completed','failed','interrupted','stopped','paused'].includes(row.status)){const prior=(await db.query('SELECT * FROM runtime_results WHERE run_id=$1',[id])).rows[0];if(prior?.status===result.status&&prior?.summary===(result.summary||''))return {status:row.status};throw new ApiError(409,'completion_conflict','Run already completed');}
  const run=await this.active(id,generation,db);
  if((await db.query("SELECT id FROM clarification_batches WHERE run_id=$1 AND status IN ('pending','submitted')",[id])).rowCount)throw new ApiError(409,'clarification_required','Persist session and acknowledge readiness before leaving clarification wait');
  if(run.stage==='Apply'&&result.status==='completed'){const approval=(await db.query('SELECT id FROM proposal_approvals WHERE task_id=$1 ORDER BY created_at DESC LIMIT 1',[run.task_id])).rows[0];if(!approval||!Array.isArray(result.validation)||result.validation.length===0||!result.workspaceRevision||result.validation.some((item:any)=>!item||typeof item.command!=='string'||item.exitCode!==0||item.workspaceRevision!==result.workspaceRevision))throw new ApiError(409,'apply_evidence_required','Apply requires current workspace validation evidence');for(const item of result.validation)await db.query('INSERT INTO validation_evidence(id,run_id,approval_id,command_id,workspace_revision,started_at,ended_at,exit_code,timed_out,summary) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(run_id,command_id,workspace_revision) DO NOTHING',[randomUUID(),id,approval.id,item.command,item.workspaceRevision,item.startedAt||Date.now(),item.endedAt||Date.now(),item.exitCode,item.timedOut===true,String(item.summary||'').slice(0,4000)]);}
  await db.query('INSERT INTO runtime_results(run_id,status,summary,validation,artifacts,blockers,error) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,result.status,result.summary||'',JSON.stringify(result.validation||[]),JSON.stringify(result.artifacts||[]),JSON.stringify(result.blockers||[]),result.error||null]);
  await db.query('UPDATE agent_runs SET status=$2,updated_at=$3 WHERE id=$1',[id,result.status,Date.now()]);
  let recoveryAction:string|undefined;
  if(result.status==='failed'||result.status==='interrupted'){
    let diagnostic:Diagnostic=result.diagnostic?validateDiagnostic(result.diagnostic):createDiagnostic({step:'dispatch',message:result.error||'Execution failed; detailed evidence unavailable',category:result.status==='interrupted'?'interrupted':'unknown'});
    if(!diagnostic.structured){
      try{
        const structured=await synthesizeStructuredDiagnostic({
          message:diagnostic.message,
          details:diagnostic.details,
          stage:run.stage,
          category:diagnostic.category,
          code:diagnostic.code,
          gatewayUrl:this.options.gatewayUrl
        });
        diagnostic={...diagnostic,structured};
      }catch{
        /* synthesis fallback already handled inside synthesizeStructuredDiagnostic */
      }
    }
    await db.query('INSERT INTO run_diagnostics(id,run_id,task_id,stage,generation,diagnostic,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(run_id) DO NOTHING',[diagnostic.id,id,run.task_id,run.stage,generation,JSON.stringify(diagnostic),Date.now()]);
    recoveryAction=(await this.recovery.decideIn(db,id,{category:diagnostic.category,safeBoundary:diagnostic.recoverySafety==='safe_boundary',sessionReady:true,containerExited:true,workspaceReleased:true,unconfirmedTool:false})).action;
  }

  if(result.status==='completed')await db.query('UPDATE run_diagnostics SET resolved_by=$1 WHERE id IN (SELECT diagnostic_id FROM run_recoveries WHERE run_id=$1)',[id]);
  const status=result.status==='completed'?(run.stage==='Archive'?'completed':'waiting_input'):result.status;const outcome=recoveryAction==='retry_request'||recoveryAction==='repair_artifacts'||recoveryAction==='repair_implementation'?'recovering':result.status==='completed'?(run.stage==='Apply'||run.stage==='MR'?'delivered':run.stage==='Archive'?'archived':run.stage==='Propose'?'awaiting_proposal_approval':'clarifying'):['failed','interrupted'].includes(result.status)?'blocked':result.status;
  await db.query('UPDATE tasks SET status=$2,outcome_state=$5,summary=$3,updated_at=$4,outcome_revision=outcome_revision+1 WHERE id=$1',[run.task_id,status,result.summary||result.error||'',Date.now(),outcome]);if(result.status==='completed'&&run.stage==='Propose'){await db.query("INSERT INTO runtime_proposals(id,task_id,stage,target,version,confirmed) VALUES($1,$2,'Propose','Apply',(SELECT version FROM tasks WHERE id=$2),false) ON CONFLICT DO NOTHING",[randomUUID(),run.task_id]);}await this.event(db,run.task_id,id,'run_complete',result);return {status:result.status};
 });}
  async approveProposal(db:pg.PoolClient,taskId:string,body:any){await db.query('SELECT id FROM tasks WHERE id=$1 FOR UPDATE',[taskId]);const task=await this.task(taskId,db);if(task.stage!=='Propose'||task.status==='running')throw new ApiError(409,'proposal_not_approvable','Propose is not ready for approval');const proposal=(await db.query('SELECT * FROM runtime_proposals WHERE id=$1 AND task_id=$2 AND confirmed=false FOR UPDATE',[body.proposalId,taskId])).rows[0];if(!proposal||proposal.version!==task.version||proposal.target!=='Apply')throw new ApiError(409,'stale_proposal','Proposal revision is stale');const report=(await db.query("SELECT report FROM run_artifact_reports WHERE task_id=$1 AND stage='Propose' ORDER BY created_at DESC LIMIT 1",[taskId])).rows[0]?.report;const artifactRevision=digest(JSON.stringify({taskVersion:task.version,report:report||null,validationPlan:body.validationPlan||{}}));if(report?.overallStatus&&report.overallStatus!=='valid')throw new ApiError(409,'proposal_artifacts_invalid','Proposal artifacts require clarification');const existing=(await db.query('SELECT * FROM proposal_approvals WHERE task_id=$1 AND task_version=$2 AND artifact_revision=$3',[taskId,task.version,artifactRevision])).rows[0];if(existing)return existing;const approvalId=randomUUID();await db.query('INSERT INTO proposal_approvals(id,task_id,task_version,artifact_revision,plan,created_at) VALUES($1,$2,$3,$4,$5,$6)',[approvalId,taskId,task.version,artifactRevision,JSON.stringify(body.validationPlan||{}),Date.now()]);await db.query('UPDATE runtime_proposals SET confirmed=true WHERE id=$1',[proposal.id]);await db.query("UPDATE tasks SET stage='Apply',status='queued',version=version+1,stage_entered_at=$2,outcome_state='executing',outcome_revision=outcome_revision+1 WHERE id=$1",[taskId,Date.now()]);const run=await this.enqueue(db,await this.task(taskId,db));await db.query('UPDATE proposal_approvals SET apply_run=$2 WHERE id=$1',[approvalId,run.id]);return {...run,approvalId};}
  async archive(db:pg.PoolClient,taskId:string){await db.query('SELECT id FROM tasks WHERE id=$1 FOR UPDATE',[taskId]);const task=await this.task(taskId,db);if(!['Apply','MR'].includes(task.stage)||task.outcome_state!=='delivered')throw new ApiError(409,'apply_not_delivered','Apply or MR must be delivered and reviewed before archive');if((await db.query("SELECT id FROM agent_runs WHERE task_id=$1 AND status IN ('queued','claimed','running','waiting_input')",[taskId])).rowCount)throw new ApiError(409,'run_active','Task already has an active run');await db.query("UPDATE tasks SET stage='Archive',status='queued',version=version+1,stage_entered_at=$2,outcome_state='executing',outcome_revision=outcome_revision+1 WHERE id=$1",[taskId,Date.now()]);return this.enqueue(db,await this.task(taskId,db));}
  async restartEpisode(db:pg.PoolClient,taskId:string){await db.query('SELECT id FROM tasks WHERE id=$1 FOR UPDATE',[taskId]);const task=await this.task(taskId,db);const previous=(await db.query("SELECT * FROM execution_episodes WHERE task_id=$1 AND stage=$2 ORDER BY created_at DESC LIMIT 1",[taskId,task.stage])).rows[0];if(!previous||!['exhausted','blocked','paused','stopped'].includes(previous.status))throw new ApiError(409,'episode_not_restartable','Episode requires a terminal blocked state');const id=randomUUID();await db.query("INSERT INTO execution_episodes(id,task_id,stage,status,created_at) VALUES($1,$2,$3,'active',$4)",[id,taskId,task.stage,Date.now()]);await db.query("UPDATE tasks SET outcome_state='executing',outcome_revision=outcome_revision+1 WHERE id=$1",[taskId]);return this.enqueue(db,await this.task(taskId,db));}
  async recover(db:pg.PoolClient,taskId:string,body:any){
  if(process.env.RECOVERY_ENABLED==='false')throw new ApiError(409,'recovery_disabled','Recovery is disabled');
  await db.query('SELECT id FROM tasks WHERE id=$1 FOR UPDATE',[taskId]);const task=await this.task(taskId,db);
  const row=(await db.query('SELECT * FROM run_diagnostics WHERE id=$1 AND task_id=$2',[body.diagnosticId,taskId])).rows[0];
  const latest=(await db.query('SELECT id,status FROM agent_runs WHERE task_id=$1 AND stage=$2 ORDER BY generation DESC LIMIT 1',[taskId,task.stage])).rows[0];
  if(!row||row.stage!==task.stage||task.version!==body.taskVersion||latest?.id!==row.run_id||!['failed','interrupted'].includes(latest.status))throw new ApiError(409,'stale_diagnostic','Task or diagnostic changed');
  if(row.diagnostic.recoverySafety!=='safe_boundary')throw new ApiError(409,'manual_inspection','Inspect session and workspace before recovery');
  const allowed=row.diagnostic.category==='artifact_validation'?['complete_artifacts']:['retry_stage','continue_stage'];if(!allowed.includes(body.action))throw new ApiError(400,'invalid_recovery','Recovery action is not applicable');
  if((await db.query("SELECT id FROM clarification_batches WHERE task_id=$1 AND status IN ('pending','submitted')",[taskId])).rowCount)throw new ApiError(409,'clarification_required','Answer questions first');
  if(!(await db.query('SELECT path FROM runtime_sessions WHERE task_id=$1 AND stage=$2',[taskId,task.stage])).rowCount)throw new ApiError(409,'session_missing','Session unavailable; manual inspection required');
  const pendingAuto=(await db.query("SELECT d.id FROM recovery_decisions d JOIN run_diagnostics x ON x.run_id=d.origin_run WHERE x.id=$1 AND d.status='pending' FOR UPDATE",[row.id])).rows[0];if(pendingAuto){await db.query('UPDATE recovery_decisions SET due_at=$2 WHERE id=$1',[pendingAuto.id,Date.now()]);return {id:pendingAuto.id,scheduled:true};}
  const report=(await db.query('SELECT report FROM run_artifact_reports WHERE run_id=$1',[row.run_id])).rows[0]?.report;
  const run=await this.enqueue(db,task);await db.query('INSERT INTO run_recoveries(run_id,diagnostic_id,intent) VALUES($1,$2,$3)',[run.id,row.id,JSON.stringify({action:body.action,additionalContext:body.additionalContext||'',report})]);return run;
 }
 async markStopped(db:pg.PoolClient,taskId:string,activeRunId?:string){
  const now=Date.now();
  await db.query("UPDATE agent_runs SET status='stopped',step_lock=NULL,lease_expires_at=$2,updated_at=$2 WHERE task_id=$1 AND (id=$3 OR status IN ('queued','claimed','running','waiting_input','awaiting_answers','paused','interrupted','failed'))",[taskId,now,activeRunId||null]);
  await db.query("UPDATE tasks SET status='stopped',outcome_state='stopped',wait_reason=NULL,outcome_revision=outcome_revision+1,updated_at=$2 WHERE id=$1",[taskId,now]);
 }

 async command(db:pg.PoolClient,taskId:string,type:string,payload:any){
  await db.query('SELECT id FROM tasks WHERE id=$1 FOR UPDATE',[taskId]);const task=await this.task(taskId,db);
  const run=(await db.query("SELECT * FROM agent_runs WHERE task_id=$1 AND status IN ('queued','claimed','running','waiting_input') ORDER BY created_at DESC LIMIT 1",[taskId])).rows[0];
  const pending=(await db.query("SELECT id FROM clarification_batches WHERE task_id=$1 AND status IN ('pending','submitted')",[taskId])).rows[0];
  if(pending&&type==='pause')return {status:'waiting_input'};
  if(pending&&type!=='stop')throw new ApiError(409,'clarification_required','Answer pending questions before continuing');
  if(pending&&type==='stop'){await db.query("UPDATE clarification_batches SET status='superseded' WHERE task_id=$1 AND status IN ('pending','submitted')",[taskId]);await this.markStopped(db,taskId);return {status:'stopped'};}
  await this.event(db,taskId,run?.id||null,'human_control',{type,payload});
  if(type==='transition'||type==='confirm_transition'){
   if(['failed','interrupted'].includes(task.status))throw new ApiError(409,'stage_incomplete','Recover this stage before advancing');
   if(run)throw new ApiError(409,'run_active','Pause or stop the current run before transition');
   let target=payload.target;
   if(type==='confirm_transition'){const proposal=(await db.query('SELECT * FROM runtime_proposals WHERE id=$1 AND task_id=$2 AND confirmed=false',[payload.proposalId,taskId])).rows[0];if(!proposal||proposal.version!==task.version||proposal.stage!==task.stage)throw new ApiError(409,'stale_proposal','Transition proposal expired');if(proposal.target==='Apply')return this.approveProposal(db,taskId,{proposalId:payload.proposalId,artifactRevision:payload.artifactRevision,validationPlan:payload.validationPlan});target=proposal.target;await db.query('UPDATE runtime_proposals SET confirmed=true WHERE id=$1',[proposal.id]);}
   if(payload.version!==task.version||target!=='Archive'&&stages.indexOf(target)!==stages.indexOf(task.stage)+1)throw new ApiError(409,'invalid_transition','Expected next stage and current task version');
   if(target==='Archive')return this.archive(db,taskId);
   await db.query("UPDATE tasks SET stage=$2,status='queued',version=version+1,stage_entered_at=$3,updated_at=$3,outcome_state='executing',outcome_revision=outcome_revision+1 WHERE id=$1",[taskId,target,Date.now()]);return this.enqueue(db,await this.task(taskId,db));
  }
  if(['resume','retry','message'].includes(type)&&!run&&(await db.query('SELECT id FROM run_diagnostics WHERE task_id=$1 AND run_id=(SELECT id FROM agent_runs WHERE task_id=$1 AND stage=$2 ORDER BY generation DESC LIMIT 1)',[taskId,task.stage])).rowCount&&type!=='message')throw new ApiError(409,'guided_recovery_required','Use a message to describe how to continue this failed stage');
  if(type==='message'){
   await this.event(db,taskId,run?.id||null,'user_message',{text:payload.text});
   const match=String(payload.text).trim().match(/^(?:进入|转到|move to)\s*(Explore|Propose|Apply|Archive)[。.!！]?$/i);
   if(match){const target=stages.find(s=>s.toLowerCase()===match[1].toLowerCase());if(stages.indexOf(target!)!==stages.indexOf(task.stage)+1)throw new ApiError(409,'invalid_transition','Only next stage allowed');const id=randomUUID();await db.query('INSERT INTO runtime_proposals(id,task_id,stage,target,version) VALUES($1,$2,$3,$4,$5)',[id,taskId,task.stage,target,task.version]);return {proposalId:id,target};}
   if(!run)return this.enqueue(db,task,payload.text);
  }
  if(['resume','retry'].includes(type)){if(run)throw new ApiError(409,'run_active','Already running');const next=await this.enqueue(db,task,payload.text);await db.query("UPDATE clarification_submissions SET continuation_run=$2 WHERE continuation_run IN (SELECT id FROM agent_runs WHERE task_id=$1 AND stage=$3 AND status IN ('failed','interrupted','paused'))",[taskId,next.id,task.stage]);return next;}
  if(!run){
   if(type!=='stop')throw new ApiError(409,'no_active_run','No active run');
   await this.markStopped(db,taskId);
   return {status:'stopped'};
  }
  if(['pause','stop'].includes(type)&&run.status==='queued'){await db.query('UPDATE agent_runs SET status=$2,updated_at=$3 WHERE id=$1',[run.id,type==='pause'?'paused':'stopped',Date.now()]);await db.query("UPDATE tasks SET status=$2,outcome_state=$2,wait_reason=NULL,outcome_revision=outcome_revision+1,updated_at=$3 WHERE id=$1",[taskId,type==='pause'?'paused':'stopped',Date.now()]);return {status:type==='pause'?'paused':'stopped'};}
  const id=randomUUID();await db.query("INSERT INTO run_commands(id,run_id,type,payload,status,created_at) VALUES($1,$2,$3,$4,'queued',$5)",[id,run.id,type,JSON.stringify(payload),Date.now()]);
  if(type==='stop'){await this.markStopped(db,taskId,run.id);return {id,status:'stopped'};}
  return {id,status:'queued'};
 }
 async deleteTask(db:pg.PoolClient,taskId:string,paths?:{workspaces?:string;sessions?:string}){
  await db.query('SELECT id FROM tasks WHERE id=$1 FOR UPDATE',[taskId]);
  const task=await this.task(taskId,db);
  const now=Date.now();
  // 1. Cancel active clarifications and stop active runs
  await db.query("UPDATE clarification_batches SET status='superseded' WHERE task_id=$1 AND status IN ('pending','submitted')",[taskId]);
  await db.query("UPDATE agent_runs SET status='stopped',step_lock=NULL WHERE task_id=$1 AND status IN ('queued','claimed','running','waiting_input','awaiting_answers')",[taskId]);
  // 2. Mark task as soft deleted
  await db.query("UPDATE tasks SET deleted_at=$2,status='stopped',wait_reason=NULL,updated_at=$2 WHERE id=$1",[taskId,now]);
  await this.event(db,taskId,null,'task_deleted',{deletedAt:now});
  // 3. Clean up workspace and session directories if paths provided
  if(paths?.workspaces||paths?.sessions){
   const {rm}=await import('node:fs/promises');
   const {join}=await import('node:path');
   if(paths.workspaces&&task.project_id){
    const worktreePath=join(paths.workspaces,task.project_id,'tasks',taskId);
    await rm(worktreePath,{recursive:true,force:true}).catch(()=>{});
   }
   if(paths.sessions){
    const sessionDir=join(paths.sessions,taskId);
    await rm(sessionDir,{recursive:true,force:true}).catch(()=>{});
   }
  }
  return {id:taskId,deleted:true,deletedAt:now};
 }
}
