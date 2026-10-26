import type pg from 'pg';

export async function migrateRuntime(pool:pg.Pool){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('specboard-migrations'))");
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
  CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,repository_url TEXT NOT NULL,encrypted_token TEXT NOT NULL,default_branch TEXT NOT NULL,workspace_root TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),description TEXT NOT NULL,stage TEXT NOT NULL CHECK(stage IN ('Explore','Propose','Apply','MR','Archive')),status TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0,stage_entered_at BIGINT NOT NULL,updated_at BIGINT NOT NULL DEFAULT 0,summary TEXT NOT NULL DEFAULT '');
  CREATE TABLE IF NOT EXISTS agent_runs(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),stage TEXT NOT NULL,generation INTEGER NOT NULL,status TEXT NOT NULL,lease_expires_at BIGINT NOT NULL,heartbeat_at BIGINT,container_id TEXT,agent_token_id TEXT,created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL);
  CREATE UNIQUE INDEX IF NOT EXISTS active_agent_run ON agent_runs(task_id,stage) WHERE status IN ('queued','claimed','running','waiting_input');
  CREATE UNIQUE INDEX IF NOT EXISTS run_generation ON agent_runs(task_id,stage,generation);
  CREATE TABLE IF NOT EXISTS run_events(run_id TEXT NOT NULL REFERENCES agent_runs(id),generation INTEGER NOT NULL,sequence INTEGER NOT NULL,type TEXT NOT NULL,payload JSONB NOT NULL,created_at BIGINT NOT NULL,PRIMARY KEY(run_id,generation,sequence));
  CREATE TABLE IF NOT EXISTS run_commands(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES agent_runs(id),type TEXT NOT NULL,payload JSONB NOT NULL,status TEXT NOT NULL,created_at BIGINT NOT NULL,delivered_at BIGINT,acknowledged_at BIGINT);
  CREATE TABLE IF NOT EXISTS auth_tokens(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,scope TEXT NOT NULL,run_id TEXT,generation INTEGER,expires_at BIGINT NOT NULL,revoked_at BIGINT);
  CREATE TABLE IF NOT EXISTS runtime_events(sequence BIGSERIAL PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),run_id TEXT REFERENCES agent_runs(id),type TEXT NOT NULL,payload JSONB NOT NULL,created_at BIGINT NOT NULL);
  CREATE TABLE IF NOT EXISTS runtime_results(run_id TEXT PRIMARY KEY REFERENCES agent_runs(id),status TEXT NOT NULL,summary TEXT NOT NULL,validation JSONB NOT NULL DEFAULT '[]',artifacts JSONB NOT NULL DEFAULT '[]',blockers JSONB NOT NULL DEFAULT '[]',error TEXT);
  CREATE TABLE IF NOT EXISTS runtime_workspaces(task_id TEXT PRIMARY KEY REFERENCES tasks(id),project_id TEXT NOT NULL REFERENCES projects(id),branch TEXT NOT NULL,path TEXT NOT NULL UNIQUE,cleanup_status TEXT NOT NULL DEFAULT 'retained');
  CREATE TABLE IF NOT EXISTS runtime_sessions(task_id TEXT NOT NULL REFERENCES tasks(id),stage TEXT NOT NULL,path TEXT NOT NULL,skill_version TEXT NOT NULL,PRIMARY KEY(task_id,stage));
  CREATE TABLE IF NOT EXISTS runtime_requests(principal TEXT NOT NULL,key TEXT NOT NULL,digest TEXT NOT NULL,result JSONB,status_code INTEGER NOT NULL,created_at BIGINT NOT NULL,PRIMARY KEY(principal,key));
  CREATE TABLE IF NOT EXISTS runtime_proposals(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),stage TEXT NOT NULL,target TEXT NOT NULL,version INTEGER NOT NULL,confirmed BOOLEAN NOT NULL DEFAULT false);
  ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS step_lock TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS workspace_prepare_lock ON agent_runs(step_lock) WHERE step_lock IS NOT NULL;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS wait_reason TEXT;
  CREATE TABLE IF NOT EXISTS clarification_batches(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),stage TEXT NOT NULL,stage_version INTEGER NOT NULL,run_id TEXT NOT NULL REFERENCES agent_runs(id),generation INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'pending',questions JSONB NOT NULL,ready_at BIGINT,created_at BIGINT NOT NULL);
  CREATE UNIQUE INDEX IF NOT EXISTS open_clarification ON clarification_batches(task_id,stage) WHERE status IN ('pending','submitted');
  CREATE TABLE IF NOT EXISTS clarification_drafts(batch_id TEXT PRIMARY KEY REFERENCES clarification_batches(id),answers JSONB NOT NULL DEFAULT '{}',additional_context TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS clarification_submissions(batch_id TEXT PRIMARY KEY REFERENCES clarification_batches(id),answers JSONB NOT NULL,additional_context TEXT NOT NULL DEFAULT '',continuation_run TEXT REFERENCES agent_runs(id),consumed_at BIGINT);
  CREATE TABLE IF NOT EXISTS run_artifact_omissions(run_id TEXT NOT NULL REFERENCES agent_runs(id),generation INTEGER NOT NULL,artifact_id TEXT NOT NULL,reason TEXT NOT NULL,instruction_hash TEXT NOT NULL,created_at BIGINT NOT NULL,PRIMARY KEY(run_id,artifact_id));
  CREATE TABLE IF NOT EXISTS run_diagnostics(id TEXT PRIMARY KEY,run_id TEXT NOT NULL UNIQUE REFERENCES agent_runs(id),task_id TEXT NOT NULL REFERENCES tasks(id),stage TEXT NOT NULL,generation INTEGER NOT NULL,diagnostic JSONB NOT NULL,resolved_by TEXT REFERENCES agent_runs(id),created_at BIGINT NOT NULL);
  CREATE TABLE IF NOT EXISTS run_artifact_reports(run_id TEXT PRIMARY KEY REFERENCES agent_runs(id),task_id TEXT NOT NULL REFERENCES tasks(id),stage TEXT NOT NULL,generation INTEGER NOT NULL,report JSONB NOT NULL,created_at BIGINT NOT NULL);
  CREATE TABLE IF NOT EXISTS run_recoveries(run_id TEXT PRIMARY KEY REFERENCES agent_runs(id),diagnostic_id TEXT NOT NULL REFERENCES run_diagnostics(id),intent JSONB NOT NULL,consumed_at BIGINT);
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS outcome_state TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS outcome_revision INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS execution_policy TEXT NOT NULL DEFAULT 'manual';
  UPDATE tasks SET execution_policy='autonomous' WHERE execution_policy='manual';
  CREATE TABLE IF NOT EXISTS execution_episodes(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),stage TEXT NOT NULL,budget_version INTEGER NOT NULL DEFAULT 1,max_rounds INTEGER NOT NULL DEFAULT 5 CHECK(max_rounds>=0),max_active_ms BIGINT NOT NULL DEFAULT 1800000 CHECK(max_active_ms>0),used_rounds INTEGER NOT NULL DEFAULT 0 CHECK(used_rounds>=0),used_active_ms BIGINT NOT NULL DEFAULT 0 CHECK(used_active_ms>=0),status TEXT NOT NULL,revocation_version INTEGER NOT NULL DEFAULT 0,charge_started_at BIGINT,created_at BIGINT NOT NULL);
  CREATE UNIQUE INDEX IF NOT EXISTS open_execution_episode ON execution_episodes(task_id,stage) WHERE status IN ('active','waiting','paused');
  ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS episode_id TEXT REFERENCES execution_episodes(id);
  CREATE TABLE IF NOT EXISTS recovery_decisions(id TEXT PRIMARY KEY,episode_id TEXT NOT NULL REFERENCES execution_episodes(id),origin_run TEXT NOT NULL UNIQUE REFERENCES agent_runs(id),strategy TEXT NOT NULL,attempt_no INTEGER NOT NULL,due_at BIGINT NOT NULL,successor_run TEXT UNIQUE REFERENCES agent_runs(id),session_ready_at BIGINT,container_exited_at BIGINT,status TEXT NOT NULL,revocation_version INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS proposal_approvals(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),task_version INTEGER NOT NULL,artifact_revision TEXT NOT NULL,plan JSONB NOT NULL,apply_run TEXT UNIQUE REFERENCES agent_runs(id),created_at BIGINT NOT NULL,UNIQUE(task_id,task_version,artifact_revision));
  CREATE TABLE IF NOT EXISTS validation_evidence(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES agent_runs(id),approval_id TEXT NOT NULL REFERENCES proposal_approvals(id),command_id TEXT NOT NULL,workspace_revision TEXT NOT NULL,started_at BIGINT NOT NULL,ended_at BIGINT NOT NULL,exit_code INTEGER,timed_out BOOLEAN NOT NULL,summary TEXT NOT NULL,UNIQUE(run_id,command_id,workspace_revision));
  CREATE TABLE IF NOT EXISTS task_merge_requests(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),mr_iid INTEGER,web_url TEXT,title TEXT,source_branch TEXT NOT NULL,target_branch TEXT NOT NULL,pipeline_id INTEGER,pipeline_status TEXT,created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL,UNIQUE(task_id));
  ALTER TABLE projects ADD COLUMN IF NOT EXISTS git_user_name TEXT;
  ALTER TABLE projects ADD COLUMN IF NOT EXISTS git_user_email TEXT;
  ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at BIGINT;
  ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_stage_check;
  ALTER TABLE tasks ADD CONSTRAINT tasks_stage_check CHECK(stage IN ('Explore','Propose','Apply','MR','Archive'));
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at BIGINT;
  INSERT INTO schema_migrations(version) VALUES('outcomes-v1') ON CONFLICT DO NOTHING;
  INSERT INTO schema_migrations(version) VALUES('mr-stage-v1') ON CONFLICT DO NOTHING;
  INSERT INTO schema_migrations(version) VALUES('task-soft-delete-v1') ON CONFLICT DO NOTHING;
  INSERT INTO schema_migrations(version) VALUES('project-soft-delete-v1') ON CONFLICT DO NOTHING;
  INSERT INTO schema_migrations(version) VALUES('runtime-v1') ON CONFLICT DO NOTHING;`);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
