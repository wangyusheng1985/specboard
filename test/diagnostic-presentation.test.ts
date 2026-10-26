import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterVisibleDiagnostics} from '../public/diagnostic-presentation.js';

test('suppresses diagnostic card when task is actively recovering from safe_boundary failure', () => {
 const rows = [
  {
   id: 'diag-1',
   stage: 'Propose',
   created_at: 1000,
   diagnostic: {
    occurredAt: 1000,
    category: 'unknown',
    step: 'model',
    message: 'Agent API 500',
    recoverySafety: 'safe_boundary'
   }
  }
 ];
 const runs = [
  {id: 'run-1', stage: 'Propose', status: 'failed', updated_at: 1000, error: 'Agent API 500'}
 ];

 // 1. Task is recovering
 const recoveringResult = filterVisibleDiagnostics({
  rows,
  runs,
  selected: {id: 't1', stage: 'Propose', status: 'failed', outcome_state: 'recovering'},
  viewStage: 'Propose'
 });
 assert.equal(recoveringResult.showCard, false);
 assert.equal(recoveringResult.visible.length, 0);
 assert.equal(recoveringResult.legacy.length, 0);

 // 2. Task successor is queued
 const queuedResult = filterVisibleDiagnostics({
  rows,
  runs,
  selected: {id: 't1', stage: 'Propose', status: 'queued', outcome_state: 'recovering'},
  viewStage: 'Propose'
 });
 assert.equal(queuedResult.showCard, false);
 assert.equal(queuedResult.visible.length, 0);

 // 3. Task successor is running
 const runningResult = filterVisibleDiagnostics({
  rows,
  runs,
  selected: {id: 't1', stage: 'Propose', status: 'running', outcome_state: 'executing'},
  viewStage: 'Propose'
 });
 assert.equal(runningResult.showCard, false);
 assert.equal(runningResult.visible.length, 0);
});

test('does not duplicate legacy failure items when structured diagnostic exists', () => {
 const rows = [
  {
   id: 'diag-1',
   stage: 'Apply',
   created_at: 2000,
   diagnostic: {
    occurredAt: 2000,
    category: 'unknown',
    step: 'model',
    message: 'Agent API 500',
    recoverySafety: 'manual_inspection'
   }
  }
 ];
 const runs = [
  {id: 'run-1', stage: 'Apply', status: 'failed', updated_at: 2000, error: 'Agent API 500'}
 ];
 const result = filterVisibleDiagnostics({
  rows,
  runs,
  selected: {id: 't2', stage: 'Apply', status: 'failed', outcome_state: 'blocked'},
  viewStage: 'Apply'
 });
 assert.equal(result.showCard, true);
 assert.equal(result.visible.length, 1);
 // Legacy items must be empty because structured diagnostic is present
 assert.equal(result.legacy.length, 0);
});

test('shows diagnostic card when budget is exhausted (blocked) or requires manual_inspection', () => {
 // Case 1: safe_boundary but budget exhausted (outcome_state === 'blocked')
 const blockedResult = filterVisibleDiagnostics({
  rows: [
   {
    id: 'diag-blocked',
    stage: 'Explore',
    created_at: 3000,
    diagnostic: {
     occurredAt: 3000,
     category: 'unknown',
     step: 'model',
     message: 'Agent API 500',
     recoverySafety: 'safe_boundary'
    }
   }
  ],
  runs: [{id: 'run-blocked', stage: 'Explore', status: 'failed', updated_at: 3000}],
  selected: {id: 't3', stage: 'Explore', status: 'failed', outcome_state: 'blocked'},
  viewStage: 'Explore'
 });
 assert.equal(blockedResult.showCard, true);
 assert.equal(blockedResult.visible.length, 1);
 assert.equal(blockedResult.visible[0].diagnostic?.message, 'Agent API 500');

 // Case 2: manual_inspection required even during active status
 const inspectionResult = filterVisibleDiagnostics({
  rows: [
   {
    id: 'diag-inspect',
    stage: 'Apply',
    created_at: 4000,
    diagnostic: {
     occurredAt: 4000,
     category: 'artifact_validation',
     step: 'validation',
     message: 'Unconfirmed tool side effects',
     recoverySafety: 'manual_inspection'
    }
   }
  ],
  runs: [{id: 'run-inspect', stage: 'Apply', status: 'failed', updated_at: 4000}],
  selected: {id: 't4', stage: 'Apply', status: 'failed', outcome_state: 'blocked'},
  viewStage: 'Apply'
 });
 assert.equal(inspectionResult.showCard, true);
 assert.equal(inspectionResult.visible.length, 1);
 assert.equal(inspectionResult.visible[0].diagnostic?.recoverySafety, 'manual_inspection');
});

test('ignores failures from previous runs if stage was later completed', () => {
 const rows = [
  {
   id: 'old-diag',
   stage: 'Explore',
   created_at: 1000,
   diagnostic: {
    occurredAt: 1000,
    category: 'unknown',
    step: 'model',
    message: 'Old error',
    recoverySafety: 'manual_inspection'
   }
  }
 ];
 const runs = [
  {id: 'run-old', stage: 'Explore', status: 'failed', updated_at: 1000},
  {id: 'run-new', stage: 'Explore', status: 'completed', updated_at: 2000}
 ];
 const result = filterVisibleDiagnostics({
  rows,
  runs,
  selected: {id: 't5', stage: 'Explore', status: 'waiting_input', outcome_state: 'clarifying'},
  viewStage: 'Explore'
 });
 assert.equal(result.showCard, false);
 assert.equal(result.visible.length, 0);
 assert.equal(result.legacy.length, 0);
});
