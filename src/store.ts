import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

export const stages = ['Explore', 'Propose', 'Apply', 'Archive'] as const;
export type Stage = typeof stages[number];
export type RunStatus = 'queued' | 'running' | 'waiting_input' | 'paused' | 'failed' | 'completed' | 'stopped' | 'interrupted';
export interface Project { id: string; name: string; repositoryUrl: string; encryptedToken: string; defaultBranch: string; workspaceRoot: string }
export interface Task { id: string; projectId: string; description: string; stage: Stage; status: RunStatus; version: number; stageEnteredAt: number }

export class Store {
  db: DatabaseSync;
  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, name TEXT NOT NULL, repository_url TEXT NOT NULL, encrypted_token TEXT NOT NULL, default_branch TEXT NOT NULL, workspace_root TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), description TEXT NOT NULL, stage TEXT NOT NULL CHECK(stage IN ('Explore','Propose','Apply','Archive')), status TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, stage_entered_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS lane_order ON tasks(stage,stage_entered_at,id);
      CREATE TABLE IF NOT EXISTS stage_runs(id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), stage TEXT NOT NULL, status TEXT NOT NULL, started_at INTEGER, ended_at INTEGER, step TEXT, result TEXT, error TEXT);
      CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), stage TEXT NOT NULL, session_path TEXT, cwd TEXT NOT NULL, skill_version TEXT NOT NULL, UNIQUE(task_id,stage));
      CREATE TABLE IF NOT EXISTS events(sequence INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL REFERENCES tasks(id), stage TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS workspaces(task_id TEXT PRIMARY KEY REFERENCES tasks(id), project_id TEXT NOT NULL REFERENCES projects(id), branch TEXT NOT NULL, path TEXT NOT NULL UNIQUE, cleanup_status TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY, nonce TEXT NOT NULL UNIQUE, digest TEXT NOT NULL, created_at INTEGER NOT NULL, result TEXT);
      CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), type TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL, result TEXT);
      CREATE TABLE IF NOT EXISTS transition_proposals(id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id),stage TEXT NOT NULL,target TEXT NOT NULL,version INTEGER NOT NULL,confirmed INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS security_events(id INTEGER PRIMARY KEY AUTOINCREMENT,created_at INTEGER NOT NULL,category TEXT NOT NULL,request_id TEXT);
    `);
    const columns=this.db.prepare('PRAGMA table_info(tasks)').all().map(row=>row.name);
    if(!columns.includes('updated_at'))this.db.exec('ALTER TABLE tasks ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0');
    if(!columns.includes('summary'))this.db.exec("ALTER TABLE tasks ADD COLUMN summary TEXT NOT NULL DEFAULT ''");
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  task(id: string): Task {
    const row = this.db.prepare('SELECT id, project_id AS projectId, description, stage, status, version, stage_entered_at AS stageEnteredAt FROM tasks WHERE id=?').get(id);
    if (!row) throw new Error('Task not found');
    return row as unknown as Task;
  }
  createTask(projectId: string, description: string): Task {
    if (typeof description!=='string' || !description.trim() || description.length>20000) throw new Error('Description is required');
    const id = randomUUID();
    this.db.prepare("INSERT INTO tasks(id,project_id,description,stage,status,version,stage_entered_at,updated_at) VALUES(?,?,?,'Explore','queued',0,?,?)").run(id, projectId, description, Date.now(),Date.now());
    return this.task(id);
  }
  private secrets: string[] = [];
  addSecrets(values: string[]) { this.secrets.push(...values.filter(x=>x && !this.secrets.includes(x))); }
  redact(value: string) { for(const secret of this.secrets)value=value.split(secret).join('[REDACTED]');return value.replace(/(?:Bearer\s+|glpat-)[\w.-]+/gi,'[REDACTED]'); }
  event(taskId: string, stage: Stage, type: string, payload: unknown) {
    return Number(this.db.prepare('INSERT INTO events(task_id,stage,type,payload,created_at) VALUES(?,?,?,?,?)').run(taskId, stage, type, this.redact(JSON.stringify(payload)), Date.now()).lastInsertRowid);
  }
  events(taskId: string, after = 0) {
    return this.db.prepare('SELECT * FROM events WHERE task_id=? AND sequence>? ORDER BY sequence').all(taskId, after);
  }
  transition(id: string, next: Stage, expectedVersion: number) {
    return this.transaction(() => {
      const task = this.task(id);
      if (task.version !== expectedVersion) throw new Error('Version conflict');
      if (!stages.includes(next) || stages.indexOf(next) !== stages.indexOf(task.stage) + 1) throw new Error('Invalid transition');
      if (task.status === 'running') throw new Error('Stop active execution before transition');
      this.db.prepare("UPDATE tasks SET stage=?,status='queued',version=version+1,stage_entered_at=?,updated_at=? WHERE id=?").run(next, Date.now(),Date.now(), id);
      this.event(id, next, 'transition', { from: task.stage, to: next });
      return this.task(id);
    });
  }
  lane(stage: Stage, limit = 20, cursor?: string) {
    if (!stages.includes(stage) || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid pagination');
    let anchor: [number, string] | undefined;
    if (cursor) {
      const value = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      if (!Array.isArray(value) || value.length !== 3 || value[0] !== stage || !Number.isSafeInteger(value[1]) || typeof value[2] !== 'string') throw new Error('Invalid cursor');
      anchor = [value[1], value[2]];
    }
    const rows = anchor
      ? this.db.prepare('SELECT tasks.*,projects.name AS project_name FROM tasks JOIN projects ON projects.id=tasks.project_id WHERE stage=? AND (stage_entered_at,tasks.id)<(?,?) ORDER BY stage_entered_at DESC,tasks.id DESC LIMIT ?').all(stage, ...anchor, limit + 1)
      : this.db.prepare('SELECT tasks.*,projects.name AS project_name FROM tasks JOIN projects ON projects.id=tasks.project_id WHERE stage=? ORDER BY stage_entered_at DESC,tasks.id DESC LIMIT ?').all(stage, limit + 1);
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return { items, hasMore, nextCursor: hasMore && last ? Buffer.from(JSON.stringify([stage, last.stage_entered_at, last.id])).toString('base64url') : null };
  }
  command(id: string, taskId: string, type: string, payload: unknown) {
    return this.transaction(() => {
      const encoded = JSON.stringify(payload);
      const existing = this.db.prepare('SELECT * FROM commands WHERE id=?').get(id);
      if (existing) {
        if (existing.task_id !== taskId || existing.type !== type || existing.payload !== encoded) throw new Error('Idempotency key conflict');
        return existing;
      }
      this.db.prepare("INSERT INTO commands VALUES(?,?,?,?,'queued',NULL)").run(id, taskId, type, encoded);
      return this.db.prepare('SELECT * FROM commands WHERE id=?').get(id)!;
    });
  }
  completeCommand(id: string, result: unknown) {
    const updated = this.db.prepare("UPDATE commands SET status='completed',result=? WHERE id=? AND status!='completed'").run(JSON.stringify(result), id);
    if (!updated.changes) throw new Error('Command missing or already completed');
  }
  close() { this.db.close(); }
}
