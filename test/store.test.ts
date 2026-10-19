import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store, stages } from '../src/store.ts';

function seed(store: Store) {
  store.db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run('p','Project','https://gitlab.example/team/repo','encrypted','main','/workspaces');
  return store.createTask('p','Build feature');
}

test('schema represents project, run, conversation, workspace and request associations', () => {
  const s = new Store();
  const t = seed(s);
  s.db.prepare('INSERT INTO stage_runs(id,task_id,stage,status) VALUES(?,?,?,?)').run('r',t.id,t.stage,'queued');
  s.db.prepare('INSERT INTO conversations VALUES(?,?,?,?,?,?)').run('c',t.id,t.stage,'session.jsonl','/workspaces/task','sha256:skill');
  s.db.prepare('INSERT INTO workspaces VALUES(?,?,?,?,?)').run(t.id,'p','task/branch','/workspaces/task','retained');
  s.db.prepare('INSERT INTO requests VALUES(?,?,?,?,?)').run('request','nonce','digest',Date.now(),'{}');
  s.addSecrets(['fixture-token']);
  s.event(t.id,'Explore','tool_execution_end',{text:'token fixture-token'});
  assert.ok(!JSON.stringify(s.events(t.id)).includes('fixture-token'));
  assert.ok(JSON.stringify(s.events(t.id)).includes('[REDACTED]'));
  assert.equal(s.task(t.id).projectId,'p');
  assert.throws(() => s.createTask('missing','Feature'), /FOREIGN KEY/);
  s.close();
});

test('forward state machine rejects skip, backward and stale versions without mutation', () => {
  const s = new Store(); const t = seed(s);
  assert.throws(() => s.transition(t.id,'Apply',0), /Invalid transition/);
  assert.equal(s.task(t.id).stage,'Explore');
  assert.equal(s.transition(t.id,'Propose',0).version,1);
  assert.throws(() => s.transition(t.id,'Apply',0), /Version conflict/);
  assert.throws(() => s.transition(t.id,'Explore',1), /Invalid transition/);
  s.db.prepare("UPDATE tasks SET status='running' WHERE id=?").run(t.id);
  assert.throws(() => s.transition(t.id,'Apply',1), /Stop active/);
  s.close();
});

test('each lane has independent stable cursor under insertions', () => {
  const s = new Store(); seed(s);
  for (const stage of stages) {
    for (let i = 0; i < 5; i++) {
      const t = s.createTask('p',stage + i);
      s.db.prepare('UPDATE tasks SET stage=?,stage_entered_at=? WHERE id=?').run(stage,100+i,t.id);
    }
    const first = s.lane(stage,2);
    assert.equal(first.items.length,2);
    const fresh = s.createTask('p','new');
    s.db.prepare('UPDATE tasks SET stage=? WHERE id=?').run(stage,fresh.id);
    const second = s.lane(stage,2,first.nextCursor!);
    assert.equal(second.items.length,2);
    assert.ok(second.items.every(row => !first.items.some(x => x.id === row.id)));
    const other = stages.find(x => x !== stage)!;
    assert.throws(() => s.lane(other,2,first.nextCursor!),/Invalid cursor/);
  }
  s.close();
});

test('events remain ordered and durable after reopening', () => {
  const dir = mkdtempSync(join(tmpdir(),'specboard-'));
  try {
    const path = join(dir,'db.sqlite'); let s = new Store(path); const t = seed(s);
    const a = s.event(t.id,'Explore','message',{ text: 'one' });
    const b = s.event(t.id,'Explore','message',{ text: 'two' });
    assert.ok(b > a);
    s.command('op',t.id,'pause',{}); s.completeCommand('op',{ status:'paused' });
    s.close(); s = new Store(path);
    assert.equal(s.command('op',t.id,'pause',{}).result,JSON.stringify({status:'paused'}));
    assert.throws(() => s.command('op',t.id,'resume',{}),/Idempotency key conflict/);
    assert.throws(() => s.completeCommand('op',{status:'changed'}),/already completed/);
    assert.equal(s.events(t.id,a).length,1);
    assert.equal(s.task(t.id).description,'Build feature'); s.close();
  } finally { rmSync(dir,{recursive:true}); }
});
