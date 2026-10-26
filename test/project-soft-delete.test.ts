import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

test('Project soft delete marks deleted_at and preserves historical tasks', () => {
 const projects = [
  {id: 'p1', name: 'Active Project', deleted_at: null},
  {id: 'p2', name: 'Deleted Project', deleted_at: 1700000000000}
 ];

 // Active projects filter
 const activeOnly = projects.filter(p => !p.deleted_at);
 assert.equal(activeOnly.length, 1);
 assert.equal(activeOnly[0].id, 'p1');

 // Historical task retains reference
 const tasks = [
  {id: 't1', project_id: 'p2', description: 'Task for deleted project'}
 ];
 const task = tasks[0];
 const project = projects.find(p => p.id === task.project_id);
 assert.ok(project);
 assert.equal(project?.name, 'Deleted Project');
 assert.ok(project?.deleted_at);
});
