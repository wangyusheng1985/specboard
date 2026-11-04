import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterVisibleDiagnostics, normalizeStructuredDiagnosis} from '../public/diagnostic-presentation.js';

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

test('normalizeStructuredDiagnosis: extracts structured data directly when structured field exists', () => {
 const structuredDiag = {
  message: 'Agent API 500',
  details: 'raw details from server',
  structured: {
   analysis: 'LLM Gateway 请求超时并耗尽重试次数',
   suggestions: [
    '检查 Relay 配置及 upstream 状态',
    '尝试在 `llm-settings` 中切换备份中转'
   ],
   rawTrace: 'TimeoutError: Gateway 504 Gateway Timeout\n  at fetch (/src/gateway.ts:12)'
  }
 };

 const res = normalizeStructuredDiagnosis(structuredDiag);
 assert.equal(res.analysis, 'LLM Gateway 请求超时并耗尽重试次数');
 assert.deepEqual(res.suggestions, [
  '检查 Relay 配置及 upstream 状态',
  '尝试在 `llm-settings` 中切换备份中转'
 ]);
 assert.equal(res.rawTrace, 'TimeoutError: Gateway 504 Gateway Timeout\n  at fetch (/src/gateway.ts:12)');
});

test('normalizeStructuredDiagnosis: provides fallback suggestion when structured.suggestions is empty', () => {
 const diag = {
  message: 'Custom error',
  structured: {
   analysis: '自定义原因',
   suggestions: [],
   rawTrace: 'trace'
  }
 };
 const res = normalizeStructuredDiagnosis(diag);
 assert.equal(res.analysis, '自定义原因');
 assert.equal(res.suggestions.length, 1);
 assert.match(res.suggestions[0], /排查|定位/);
 assert.equal(res.rawTrace, 'trace');
});

test('normalizeStructuredDiagnosis: handles legacy diagnostic without structured field', () => {
 // Case 1: model_auth
 const authDiag = {
  category: 'model_auth',
  code: '401',
  message: 'Invalid API Key',
  details: 'HTTP 401 Unauthorized from relay'
 };
 const authRes = normalizeStructuredDiagnosis(authDiag);
 assert.equal(authRes.analysis, 'Invalid API Key');
 assert.ok(authRes.suggestions.length >= 1);
 assert.match(authRes.suggestions[0], /Token|Relay|鉴权/);
 assert.equal(authRes.rawTrace, 'HTTP 401 Unauthorized from relay');

 // Case 2: artifact_validation
 const artifactDiag = {
  category: 'artifact_validation',
  message: 'tasks.md 格式不符合 OpenSpec',
  details: 'Schema validation failed: tasks.md is missing checkbox'
 };
 const artifactRes = normalizeStructuredDiagnosis(artifactDiag);
 assert.equal(artifactRes.analysis, 'tasks.md 格式不符合 OpenSpec');
 assert.ok(artifactRes.suggestions.length >= 1);
 assert.match(artifactRes.suggestions[0], /tasks\.md|产物/);
 assert.equal(artifactRes.rawTrace, 'Schema validation failed: tasks.md is missing checkbox');

 // Case 3: model_timeout
 const timeoutDiag = {
  category: 'model_timeout',
  message: 'Request timed out'
 };
 const timeoutRes = normalizeStructuredDiagnosis(timeoutDiag);
 assert.equal(timeoutRes.analysis, 'Request timed out');
 assert.ok(timeoutRes.suggestions.length >= 1);
 assert.match(timeoutRes.suggestions[0], /限流|超时|Relay/);
 assert.equal(timeoutRes.rawTrace, 'Request timed out');

 // Case 4: runtime_environment
 const runtimeDiag = {
  category: 'runtime_environment',
  message: 'Container killed OOM'
 };
 const runtimeRes = normalizeStructuredDiagnosis(runtimeDiag);
 assert.equal(runtimeRes.analysis, 'Container killed OOM');
 assert.ok(runtimeRes.suggestions.length >= 1);
 assert.match(runtimeRes.suggestions[0], /容器|资源/);

 // Case 5: CI / Runner failure in legacy fallback
 const ciDiag1 = {
  category: 'runtime_environment',
  message: 'Actions failed with cancelled job on runner macos-13'
 };
 const ciRes1 = normalizeStructuredDiagnosis(ciDiag1);
 assert.deepEqual(ciRes1.suggestions, [
  '检查并更新 .github/workflows/ 中的构建矩阵与 Runner 标签（如将下线的 macos-13 替换为 macos-14）。',
  '在下方“补充信息”中发送说明触发重新运行。'
 ]);
 assert.ok(!ciRes1.suggestions.some(s => s.includes('tasks.md')));

 const ciDiag2 = {
  stage: 'MR',
  message: 'MR pipeline failed'
 };
 const ciRes2 = normalizeStructuredDiagnosis(ciDiag2);
 assert.deepEqual(ciRes2.suggestions, [
  '检查并更新 .github/workflows/ 中的构建矩阵与 Runner 标签（如将下线的 macos-13 替换为 macos-14）。',
  '在下方“补充信息”中发送说明触发重新运行。'
 ]);

 // Case 6: null/undefined or empty legacy diagnostic
 const emptyRes = normalizeStructuredDiagnosis(null);
 assert.equal(emptyRes.analysis, '任务执行受阻');
 assert.ok(emptyRes.suggestions.length >= 1);
 assert.match(emptyRes.suggestions[0], /检查工作区与配置/);
 assert.equal(emptyRes.rawTrace, '');
});
