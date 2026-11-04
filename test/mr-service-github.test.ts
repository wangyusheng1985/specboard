import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {runMRStage} from '../src/mr-service.ts';

test('runMRStage handles GitHub PR and Actions workflow run', async () => {
 const calls: string[] = [];
 const mrApiCalls: any[] = [];

 const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  res.setHeader('content-type', 'application/json');

  if (url.pathname === '/repos/owner/repo/pulls' && req.method === 'GET') {
   return res.end(JSON.stringify([]));
  }
  if (url.pathname === '/repos/owner/repo/pulls' && req.method === 'POST') {
   return res.end(JSON.stringify({
    id: 99,
    number: 7,
    title: 'feat: GitHub feature',
    body: 'PR Description',
    html_url: 'https://github.com/owner/repo/pull/7',
    head: {ref: 'specboard/t-gh'},
    base: {ref: 'main'},
    state: 'open'
   }));
  }
  if (url.pathname === '/repos/owner/repo/actions/runs') {
   return res.end(JSON.stringify({
    workflow_runs: [{
     id: 777,
     name: 'ci',
     status: 'completed',
     conclusion: 'success',
     html_url: 'https://github.com/owner/repo/actions/runs/777',
     head_branch: 'specboard/t-gh',
     head_sha: 'abcdef'
    }]
   }));
  }

  res.statusCode = 404;
  res.end('{}');
 });

 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 process.env.TEST_GITHUB_HOST = `127.0.0.1:${port}`;
 try {
  const result = await runMRStage({
   cwd: '/tmp',
   taskId: 't-gh',
   description: 'GitHub feature',
   repositoryUrl: `http://127.0.0.1:${port}/owner/repo.git`,
   defaultBranch: 'main',
   token: 'secret',
   git: async (args: string[]) => {
    calls.push(args.join(' '));
    return {stdout: ''};
   },
   call: async (path: string, body?: any) => {
    mrApiCalls.push({path, body});
    return {saved: true};
   },
   pollIntervalMs: 50
  });

  assert.equal(result.mr.iid, 7);
  assert.equal(result.pipeline?.status, 'success');
  assert.equal(result.validation[0].command, 'github-actions:pipeline');
  assert.match(result.validation[0].summary, /GitHub Actions/);
 } finally {
  delete process.env.TEST_GITHUB_HOST;
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});

test('runMRStage polls and waits for asynchronously created Actions workflow run', async () => {
 const calls: string[] = [];
 const mrApiCalls: any[] = [];
 let runPollCount = 0;

 const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  res.setHeader('content-type', 'application/json');

  if (url.pathname === '/repos/owner/repo/pulls' && req.method === 'GET') {
   return res.end(JSON.stringify([]));
  }
  if (url.pathname === '/repos/owner/repo/pulls' && req.method === 'POST') {
   return res.end(JSON.stringify({
    id: 101,
    number: 8,
    title: 'feat: Async actions',
    body: 'PR Description',
    html_url: 'https://github.com/owner/repo/pull/8',
    head: {ref: 'specboard/t-async'},
    base: {ref: 'main'},
    state: 'open'
   }));
  }
  if (url.pathname === '/repos/owner/repo/actions/runs') {
   runPollCount++;
   // First 2 calls return no runs (simulating GitHub queue latency)
   if (runPollCount <= 2) {
    return res.end(JSON.stringify({workflow_runs: []}));
   }
   // 3rd call returns queued with real-world 64-bit GitHub Actions Run ID
   if (runPollCount === 3) {
    return res.end(JSON.stringify({
     workflow_runs: [{
      id: 40338650316,
      name: 'ci',
      status: 'queued',
      conclusion: null,
      html_url: 'https://github.com/owner/repo/actions/runs/40338650316',
      head_branch: 'specboard/t-async',
      head_sha: '112233'
     }]
    }));
   }
   // Later calls return success
   return res.end(JSON.stringify({
    workflow_runs: [{
     id: 40338650316,
     name: 'ci',
     status: 'completed',
     conclusion: 'success',
     html_url: 'https://github.com/owner/repo/actions/runs/40338650316',
     head_branch: 'specboard/t-async',
     head_sha: '112233'
    }]
   }));
  }

  res.statusCode = 404;
  res.end('{}');
 });

 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 process.env.TEST_GITHUB_HOST = `127.0.0.1:${port}`;
 try {
  const result = await runMRStage({
   cwd: '/tmp',
   taskId: 't-async',
   description: 'Async actions feature',
   repositoryUrl: `http://127.0.0.1:${port}/owner/repo.git`,
   defaultBranch: 'main',
   token: 'secret',
   git: async (args: string[]) => {
    calls.push(args.join(' '));
    return {stdout: ''};
   },
   call: async (path: string, body?: any) => {
    mrApiCalls.push({path, body});
    return {saved: true};
   },
   pollIntervalMs: 20,
   discoveryTimeoutMs: 5000,
   discoveryPollIntervalMs: 20
  });

  assert.equal(result.mr.iid, 8);
  assert.equal(result.pipeline?.id, 40338650316);
  assert.equal(result.pipeline?.status, 'success');
  // Verified that the big integer pipelineId 40338650316 was reported to backend
  assert.ok(mrApiCalls.some(c => c.body?.pipelineId === 40338650316));
 } finally {
  delete process.env.TEST_GITHUB_HOST;
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});

test('runMRStage safely skips when no CI configured, but throws when CI configured and timed out', async () => {
 const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-test-ci-'));
 try {
  const server = createServer((req, res) => {
   const url = new URL(req.url!, `http://${req.headers.host}`);
   res.setHeader('content-type', 'application/json');

   if (url.pathname === '/repos/owner/repo/pulls') {
    return res.end(JSON.stringify({
     id: 102,
     number: 9,
     title: 'feat: No CI',
     body: 'PR Description',
     html_url: 'https://github.com/owner/repo/pull/9',
     head: {ref: 'specboard/t-noci'},
     base: {ref: 'main'},
     state: 'open'
    }));
   }
   if (url.pathname === '/repos/owner/repo/actions/runs') {
    return res.end(JSON.stringify({workflow_runs: []}));
   }
   res.statusCode = 404;
   res.end('{}');
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as any).port;
  process.env.TEST_GITHUB_HOST = `127.0.0.1:${port}`;
  try {
   // 1. Without CI file: safe skip
   const noCiResult = await runMRStage({
    cwd: tempDir,
    taskId: 't-noci',
    description: 'No CI repo',
    repositoryUrl: `http://127.0.0.1:${port}/owner/repo.git`,
    defaultBranch: 'main',
    token: 'secret',
    git: async () => ({stdout: ''}),
    call: async () => ({saved: true}),
    pollIntervalMs: 10,
    discoveryTimeoutMs: 50,
    discoveryPollIntervalMs: 10
   });
   assert.equal(noCiResult.pipeline, null);
   assert.equal(noCiResult.validation[0].command, 'github-actions:none');

   // 2. With CI file: timeout should throw
   const workflowsDir = path.join(tempDir, '.github', 'workflows');
   fs.mkdirSync(workflowsDir, {recursive: true});
   fs.writeFileSync(path.join(workflowsDir, 'test.yml'), 'name: CI\non: [push]');

   await assert.rejects(
    runMRStage({
     cwd: tempDir,
     taskId: 't-withci',
     description: 'With CI repo',
     repositoryUrl: `http://127.0.0.1:${port}/owner/repo.git`,
     defaultBranch: 'main',
     token: 'secret',
     git: async () => ({stdout: ''}),
     call: async () => ({saved: true}),
     pollIntervalMs: 10,
     discoveryTimeoutMs: 50,
     discoveryPollIntervalMs: 10
    }),
    /workflow was not triggered/i
   );
  } finally {
   delete process.env.TEST_GITHUB_HOST;
   await new Promise<void>(resolve => server.close(() => resolve()));
  }
 } finally {
  fs.rmSync(tempDir, {recursive: true, force: true});
 }
});

test('runMRStage waits for NEW pipeline ID after repush instead of reusing stale failed run', async () => {
 const mrApiCalls: any[] = [];
 let repushHappened = false;
 let newRunPolledCount = 0;

 const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  res.setHeader('content-type', 'application/json');

  if (url.pathname === '/repos/owner/repo/pulls') {
   return res.end(JSON.stringify({
    id: 103,
    number: 15,
    title: 'feat: Re-push new pipeline test',
    body: 'PR Description',
    html_url: 'https://github.com/owner/repo/pull/15',
    head: {ref: 'specboard/t-repush'},
    base: {ref: 'main'},
    state: 'open'
   }));
  }

  if (url.pathname === '/repos/owner/repo/actions/runs') {
   if (!repushHappened) {
    // Initial run fails
    return res.end(JSON.stringify({
     workflow_runs: [{
      id: 7001,
      name: 'ci',
      status: 'completed',
      conclusion: 'failure',
      html_url: 'https://github.com/owner/repo/actions/runs/7001',
      head_branch: 'specboard/t-repush'
     }]
    }));
   }

   newRunPolledCount++;
   // After repush, first poll still returns the old run 7001 (simulating GitHub queue delay)
   if (newRunPolledCount <= 2) {
    return res.end(JSON.stringify({
     workflow_runs: [{
      id: 7001,
      name: 'ci',
      status: 'completed',
      conclusion: 'failure',
      html_url: 'https://github.com/owner/repo/actions/runs/7001',
      head_branch: 'specboard/t-repush'
     }]
    }));
   }

   // 3rd poll returns the new run 7002 with success
   return res.end(JSON.stringify({
    workflow_runs: [{
     id: 7002,
     name: 'ci',
     status: 'completed',
     conclusion: 'success',
     html_url: 'https://github.com/owner/repo/actions/runs/7002',
     head_branch: 'specboard/t-repush'
    }]
   }));
  }

  if (url.pathname.includes('/jobs')) {
   return res.end(JSON.stringify({
    jobs: [{
     id: 991,
     name: 'test_job',
     status: 'completed',
     conclusion: 'failure'
    }]
   }));
  }

  if (url.pathname.includes('/logs')) {
   return res.end('Compilation error at line 123');
  }

  res.statusCode = 404;
  res.end('{}');
 });

 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 process.env.TEST_GITHUB_HOST = `127.0.0.1:${port}`;
 try {
  let sessionPrompted = false;
  const result = await runMRStage({
   cwd: '/tmp',
   taskId: 't-repush',
   description: 'Re-push new pipeline test',
   repositoryUrl: `http://127.0.0.1:${port}/owner/repo.git`,
   defaultBranch: 'main',
   token: 'secret',
   git: async (args: string[]) => {
    if (args.includes('push') && sessionPrompted) {
     repushHappened = true;
    }
    // Return mock diff on first failure repair
    if (args.includes('diff') && args.includes('--cached')) {
     return sessionPrompted ? 'file.ts\n' : '';
    }
    return {stdout: ''};
   },
   call: async (path: string, body?: any) => {
    mrApiCalls.push({path, body});
    return {saved: true};
   },
   session: {
    prompt: async () => {
     sessionPrompted = true;
    }
   },
   pollIntervalMs: 15,
   discoveryTimeoutMs: 500,
   discoveryPollIntervalMs: 15
  });

  assert.equal(result.pipeline?.id, 7002);
  assert.equal(result.pipeline?.status, 'success');
  assert.ok(mrApiCalls.some(c => c.body?.pipelineId === 7002));
 } finally {
  delete process.env.TEST_GITHUB_HOST;
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});

test('runMRStage initial discovery waits for pipeline matching current commit SHA and skips stale runs', async () => {
 const mrApiCalls: any[] = [];
 let pollCount = 0;

 const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  res.setHeader('content-type', 'application/json');

  if (url.pathname === '/repos/owner/repo/pulls') {
   return res.end(JSON.stringify({
    id: 104,
    number: 16,
    title: 'feat: Initial sha discovery test',
    body: 'PR Description',
    html_url: 'https://github.com/owner/repo/pull/16',
    head: {ref: 'specboard/t-sha'},
    base: {ref: 'main'},
    state: 'open'
   }));
  }

  if (url.pathname === '/repos/owner/repo/actions/runs') {
   pollCount++;
   // First 2 polls return an older workflow run from prior commit sha 'old_sha_000'
   if (pollCount <= 2) {
    return res.end(JSON.stringify({
     workflow_runs: [{
      id: 8001,
      name: 'ci',
      status: 'completed',
      conclusion: 'failure',
      html_url: 'https://github.com/owner/repo/actions/runs/8001',
      head_branch: 'specboard/t-sha',
      head_sha: 'old_sha_000'
     }]
    }));
   }

   // 3rd poll returns the new workflow run matching current commit 'new_sha_111'
   return res.end(JSON.stringify({
    workflow_runs: [{
     id: 8002,
     name: 'ci',
     status: 'completed',
     conclusion: 'success',
     html_url: 'https://github.com/owner/repo/actions/runs/8002',
     head_branch: 'specboard/t-sha',
     head_sha: 'new_sha_111'
    }]
   }));
  }

  res.statusCode = 404;
  res.end('{}');
 });

 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 process.env.TEST_GITHUB_HOST = `127.0.0.1:${port}`;
 try {
  const result = await runMRStage({
   cwd: '/tmp',
   taskId: 't-sha',
   description: 'Initial sha discovery test',
   repositoryUrl: `http://127.0.0.1:${port}/owner/repo.git`,
   defaultBranch: 'main',
   token: 'secret',
   previousPipelineId: 8001,
   git: async (args: string[]) => {
    if (args.includes('rev-parse') && args.includes('HEAD')) {
     return 'new_sha_111';
    }
    return {stdout: ''};
   },
   call: async (path: string, body?: any) => {
    mrApiCalls.push({path, body});
    return {saved: true};
   },
   pollIntervalMs: 15,
   discoveryTimeoutMs: 1000,
   discoveryPollIntervalMs: 15
  });

  assert.equal(result.pipeline?.id, 8002);
  assert.equal(result.pipeline?.sha, 'new_sha_111');
  assert.equal(result.pipeline?.status, 'success');
 } finally {
  delete process.env.TEST_GITHUB_HOST;
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});

test('runMRStage prompts session with accurate job name and fallback trace when job is cancelled without logs', async () => {
 const mrApiCalls: any[] = [];
 let sessionPrompt = '';
 let pushCount = 0;

 const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  res.setHeader('content-type', 'application/json');

  if (url.pathname === '/repos/owner/repo/pulls') {
   return res.end(JSON.stringify({
    id: 105,
    number: 17,
    title: 'feat: Cancelled job test',
    body: 'PR Description',
    html_url: 'https://github.com/owner/repo/pull/17',
    head: {ref: 'specboard/t-cancelled'},
    base: {ref: 'main'},
    state: 'open'
   }));
  }

  if (url.pathname === '/repos/owner/repo/actions/runs') {
   if (pushCount <= 1) {
    return res.end(JSON.stringify({
     workflow_runs: [{
      id: 9001,
      name: 'ci',
      status: 'completed',
      conclusion: 'cancelled',
      html_url: 'https://github.com/owner/repo/actions/runs/9001',
      head_branch: 'specboard/t-cancelled',
      head_sha: 'sha_canc'
     }]
    }));
   }

   return res.end(JSON.stringify({
    workflow_runs: [{
     id: 9002,
     name: 'ci',
     status: 'completed',
     conclusion: 'success',
     html_url: 'https://github.com/owner/repo/actions/runs/9002',
     head_branch: 'specboard/t-cancelled',
     head_sha: 'sha_fixed'
    }]
   }));
  }

  if (url.pathname.includes('/jobs')) {
   return res.end(JSON.stringify({
    jobs: [{
     id: 5555,
     name: 'Build (macos-13 - x86_64)',
     status: 'completed',
     conclusion: 'cancelled',
     labels: ['macos-13', 'x86_64'],
     html_url: 'https://github.com/owner/repo/actions/runs/9001/job/5555'
    }]
   }));
  }

  // 404 for log download
  if (url.pathname.includes('/logs')) {
   res.statusCode = 404;
   return res.end('{"message":"Not Found"}');
  }

  res.statusCode = 404;
  res.end('{}');
 });

 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 process.env.TEST_GITHUB_HOST = `127.0.0.1:${port}`;
 try {
  const result = await runMRStage({
   cwd: '/tmp',
   taskId: 't-cancelled',
   description: 'Cancelled job test',
   repositoryUrl: `http://127.0.0.1:${port}/owner/repo.git`,
   defaultBranch: 'main',
   token: 'secret',
   git: async (args: string[]) => {
    if (args.includes('push')) {
     pushCount++;
    }
    if (args.includes('rev-parse') && args.includes('HEAD')) {
     return pushCount <= 1 ? 'sha_canc' : 'sha_fixed';
    }
    if (args.includes('diff') && args.includes('--cached')) {
     return sessionPrompt ? '.github/workflows/ci.yml\n' : '';
    }
    return {stdout: ''};
   },
   call: async (path: string, body?: any) => {
    mrApiCalls.push({path, body});
    return {saved: true};
   },
   session: {
    prompt: async (text: string) => {
     sessionPrompt = text;
    }
   },
   pollIntervalMs: 15,
   discoveryTimeoutMs: 1000,
   discoveryPollIntervalMs: 15
  });

  assert.equal(result.pipeline?.id, 9002);
  assert.equal(result.pipeline?.status, 'success');
  // Verify session prompt contains real job name and not 'job unknown' or 'test'
  assert.match(sessionPrompt, /Job "Build \(macos-13 - x86_64\)" failed/);
  assert.match(sessionPrompt, /Runner labels: macos-13, x86_64/);
  assert.match(sessionPrompt, /Conclusion: cancelled/);
  assert.match(sessionPrompt, /Please diagnose and modify the workspace files \(including CI configurations under \.github\/workflows\/ or project source files\) to fix this failure\./);
  assert.match(sessionPrompt, /If the failure indicates an unavailable or deprecated runner \(e\.g\. macos-13\), update the workflow matrix accordingly\./);
 } finally {
  delete process.env.TEST_GITHUB_HOST;
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});
