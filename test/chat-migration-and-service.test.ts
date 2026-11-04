import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.ts';

test('Store supports chat tasks with or without projectId', () => {
  const store = new Store();
  // 1. 无项目绑定的会话任务
  const generalChat = store.createTask(null, '探讨算法问题', 'chat');
  assert.equal(generalChat.kind, 'chat');
  const fetched = store.db.prepare('SELECT id, project_id, description, kind FROM tasks WHERE id=?').get(generalChat.id) as any;
  assert.equal(fetched.kind, 'chat');
  assert.equal(fetched.project_id, null);

  // 2. 普通工作任务
  const project = store.db.prepare("INSERT INTO projects(id,name,repository_url,encrypted_token,default_branch,workspace_root) VALUES('p1','test','url','token','main','/tmp')").run();
  const workTask = store.createTask('p1', '实现功能', 'work');
  const fetchedWork = store.db.prepare('SELECT id, project_id, description, kind FROM tasks WHERE id=?').get(workTask.id) as any;
  assert.equal(fetchedWork.kind, 'work');
  assert.equal(fetchedWork.project_id, 'p1');
  // 3. 删除任务支持（包括无 project_id 的 chat 任务）
  const delChatRes = store.deleteTask(generalChat.id);
  assert.equal(delChatRes.id, generalChat.id);
  assert.equal(delChatRes.deleted, true);
  const deletedGeneralChat = store.task(generalChat.id);
  assert.ok(deletedGeneralChat.deletedAt);
  assert.equal(deletedGeneralChat.status, 'stopped');

  const delWorkRes = store.deleteTask(workTask.id);
  assert.equal(delWorkRes.id, workTask.id);
  assert.equal(delWorkRes.deleted, true);
  const deletedWorkTask = store.task(workTask.id);
  assert.ok(deletedWorkTask.deletedAt);
  assert.equal(deletedWorkTask.status, 'stopped');
});
