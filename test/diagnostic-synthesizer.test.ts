import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {synthesizeStructuredDiagnostic, buildHeuristicStructuredDiagnosis} from '../src/diagnostic-synthesizer.ts';

test('buildHeuristicStructuredDiagnosis generates valid 3-part fallback data', () => {
  const result1 = buildHeuristicStructuredDiagnosis({
    message: 'Error: uncaughtException: tasks.md missing from OpenSpec directory',
    category: 'artifact_validation',
    details: 'Validation failed: tasks.md is required'
  });

  assert.equal(result1.analysis, 'tasks.md missing from OpenSpec directory');
  assert.ok(result1.suggestions.length >= 1);
  assert.ok(result1.suggestions.some(s => s.includes('tasks.md') || s.includes('产物')));
  assert.equal(result1.rawTrace, 'Validation failed: tasks.md is required');

  const result2 = buildHeuristicStructuredDiagnosis({
    message: '{"error":{"message":"Invalid model token"}}',
    category: 'model_auth'
  });
  assert.equal(result2.analysis, 'Invalid model token');
  assert.ok(result2.suggestions.some(s => s.includes('Token') || s.includes('凭据') || s.includes('Relay')));
  assert.equal(result2.rawTrace, '{"error":{"message":"Invalid model token"}}');

  const resultCi1 = buildHeuristicStructuredDiagnosis({
    message: 'GitHub Actions failed: runner macos-13 is deprecated and cancelled',
    category: 'runtime_environment'
  });
  assert.equal(resultCi1.analysis, 'CI 流水线失败且未成功运行。');
  assert.deepEqual(resultCi1.suggestions, [
    '检查并更新 .github/workflows/ 或 CI 配置文件中的构建矩阵，将已下线或不可用的 Runner 标签（如 macos-13）替换为支持的版本（如 macos-14）。',
    '确认流水线触发规则与环境变量配置无误。',
    '在下方“补充信息”中说明修复意图，触发重新推送流水线。'
  ]);

  const resultCi2 = buildHeuristicStructuredDiagnosis({
    message: 'Unknown error occurred',
    stage: 'MR'
  });
  assert.equal(resultCi2.analysis, 'CI 流水线失败且未成功运行。');
  assert.deepEqual(resultCi2.suggestions, [
    '检查并更新 .github/workflows/ 或 CI 配置文件中的构建矩阵，将已下线或不可用的 Runner 标签（如 macos-13）替换为支持的版本（如 macos-14）。',
    '确认流水线触发规则与环境变量配置无误。',
    '在下方“补充信息”中说明修复意图，触发重新推送流水线。'
  ]);
});

test('synthesizeStructuredDiagnostic successfully synthesizes structured diagnosis via gateway', async () => {
  const server = createServer(async (req, res) => {
    if (req.url === '/v1/responses' && req.method === 'POST') {
      res.writeHead(200, {'content-type': 'application/json'});
      res.end(JSON.stringify({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  analysis: 'GitHub Actions 构建因缺少 Node 依赖失败',
                  suggestions: [
                    '在工作区运行 npm install 安装依赖',
                    '检查 package.json 与 package-lock.json 一致性'
                  ],
                  rawTrace: 'npm ERR! missing dependency: fastify'
                })
              }
            ]
          }
        ]
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const gatewayUrl = `http://127.0.0.1:${port}`;

  try {
    const result = await synthesizeStructuredDiagnostic({
      message: 'npm test failed in CI',
      rawTrace: 'npm ERR! missing dependency: fastify',
      category: 'unknown',
      gatewayUrl
    });

    assert.equal(result.analysis, 'GitHub Actions 构建因缺少 Node 依赖失败');
    assert.deepEqual(result.suggestions, [
      '在工作区运行 npm install 安装依赖',
      '检查 package.json 与 package-lock.json 一致性'
    ]);
    assert.equal(result.rawTrace, 'npm ERR! missing dependency: fastify');
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('synthesizeStructuredDiagnostic falls back to heuristic diagnosis on malformed LLM response', async () => {
  const server = createServer(async (req, res) => {
    res.writeHead(200, {'content-type': 'application/json'});
    res.end(JSON.stringify({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: 'This is not valid JSON at all.'
            }
          ]
        }
      ]
    }));
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const gatewayUrl = `http://127.0.0.1:${port}`;

  try {
    const result = await synthesizeStructuredDiagnostic({
      message: 'GitHub Actions workflow failed with exit code 1',
      details: 'Error: Command failed with exit code 1',
      category: 'unknown',
      gatewayUrl
    });

    assert.equal(result.analysis, 'GitHub Actions workflow failed with exit code 1');
    assert.ok(result.suggestions.length >= 1);
    assert.ok(result.suggestions.some(s => s.includes('Actions') || s.includes('CI') || s.includes('排查')));
    assert.equal(result.rawTrace, 'Error: Command failed with exit code 1');
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('synthesizeStructuredDiagnostic falls back on gateway timeout or network error', async () => {
  const server = createServer(async (_req, res) => {
    // Hangs or returns 500
    res.writeHead(500, {'content-type': 'application/json'});
    res.end(JSON.stringify({error: 'Gateway internal failure'}));
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const gatewayUrl = `http://127.0.0.1:${port}`;

  try {
    const result = await synthesizeStructuredDiagnostic({
      message: 'Upstream rate limit exceeded (429)',
      category: 'model_rate_limit',
      gatewayUrl
    });

    assert.equal(result.analysis, 'Upstream rate limit exceeded (429)');
    assert.ok(result.suggestions.length >= 1);
    assert.ok(result.suggestions.some(s => s.includes('限流') || s.includes('Rate Limit') || s.includes('供应商')));
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
