import {test} from 'node:test';
import assert from 'node:assert/strict';
import {taskStatusLabel, taskStatusClass} from '../public/task-status.js';

test('taskStatusLabel unifies recovering and executing as 执行中', () => {
 assert.equal(taskStatusLabel({outcome_state: 'recovering', status: 'running'}), '执行中');
 assert.equal(taskStatusLabel({outcome_state: 'executing', status: 'running'}), '执行中');
 assert.equal(taskStatusLabel({outcome_state: 'recovering', status: 'failed'}), '执行中');
});

test('taskStatusClass maps tasks to semantic visual classes', () => {
 assert.equal(taskStatusClass({outcome_state: 'recovering', status: 'running'}), 'status-running');
 assert.equal(taskStatusClass({status: 'running'}), 'status-running');
 assert.equal(taskStatusClass({outcome_state: 'clarifying'}), 'status-waiting');
 assert.equal(taskStatusClass({status: 'awaiting_answers'}), 'status-waiting');
 assert.equal(taskStatusClass({status: 'waiting_input', wait_reason: 'clarification_required'}), 'status-waiting');
 assert.equal(taskStatusClass({outcome_state: 'delivered'}), 'status-delivered');
 assert.equal(taskStatusClass({status: 'completed'}), 'status-completed');
 assert.equal(taskStatusClass({outcome_state: 'blocked'}), 'status-failed');
 assert.equal(taskStatusClass({status: 'failed'}), 'status-failed');
 assert.equal(taskStatusClass({status: 'queued'}), 'status-default');
});

test('taskStatusLabel preserves other semantic outcome states', () => {
 assert.equal(taskStatusLabel({outcome_state: 'clarifying'}), '待你澄清');
 assert.equal(taskStatusLabel({outcome_state: 'awaiting_proposal_approval'}), '方案待确认');
 assert.equal(taskStatusLabel({outcome_state: 'blocked'}), '需要处理');
 assert.equal(taskStatusLabel({outcome_state: 'delivered'}), '实现完成 · 待审阅');
 assert.equal(taskStatusLabel({outcome_state: 'archived'}), '已归档');
 assert.equal(taskStatusLabel({outcome_state: 'paused'}), '已暂停');
 assert.equal(taskStatusLabel({outcome_state: 'stopped'}), '已停止');
});

test('taskStatusLabel distinguishes genuine clarification from explore completed', () => {
 assert.equal(taskStatusLabel({stage: 'Explore', status: 'waiting_input', outcome_state: 'clarifying', wait_reason: 'clarification_required'}), '待你澄清');
 assert.equal(taskStatusLabel({stage: 'Explore', status: 'awaiting_answers', outcome_state: 'clarifying'}), '待你澄清');
 assert.equal(taskStatusLabel({stage: 'Explore', status: 'waiting_input', outcome_state: 'clarifying', wait_reason: null}), '探索完成 · 待推进');
 assert.equal(taskStatusLabel({stage: 'Explore', status: 'completed', outcome_state: 'clarifying'}), '探索完成 · 待推进');
 assert.equal(taskStatusClass({stage: 'Explore', status: 'waiting_input', outcome_state: 'clarifying', wait_reason: null}), 'status-delivered');
 assert.equal(taskStatusClass({stage: 'Explore', status: 'waiting_input', outcome_state: 'clarifying', wait_reason: 'clarification_required'}), 'status-waiting');
});

test('user comment events can be filtered and formatted for display in task outcome', () => {
 const events = [
  {type: 'dispatch_claimed', payload: {owner: 'test'}},
  {type: 'user_message', payload: {text: '请修改 .gitignore 并合并 commit'}, created_at: 1792638000000},
  {type: 'human_control', payload: {type: 'message', payload: {text: '第二条用户评论'}}, created_at: 1792638010000}
 ];
 const userEvents = events.filter(e => e.type === 'user_message' || (e.type === 'human_control' && e.payload?.type === 'message'));
 assert.equal(userEvents.length, 2);
 const texts = userEvents.map(e => e.payload?.text || e.payload?.payload?.text);
 assert.deepEqual(texts, ['请修改 .gitignore 并合并 commit', '第二条用户评论']);
});
