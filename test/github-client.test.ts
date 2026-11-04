import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {GitHubClient} from '../src/github-client.ts';

test('GitHubClient validates branch and gets/creates PR', async () => {
 let created = false;
 const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  res.setHeader('content-type', 'application/json');
  assert.ok(req.headers['authorization']?.includes('test-github-token'));

  if (url.pathname === '/repos/owner/repo/branches/main' && req.method === 'GET') {
   return res.end(JSON.stringify({name: 'main'}));
  }

  if (url.pathname === '/repos/owner/repo/branches/nonexistent' && req.method === 'GET') {
   res.statusCode = 404;
   return res.end(JSON.stringify({message: 'Branch not found'}));
  }

  if (url.pathname === '/repos/owner/repo/pulls' && req.method === 'GET') {
   if (!created) {
    return res.end(JSON.stringify([]));
   }
   return res.end(JSON.stringify([{
    id: 999,
    number: 42,
    title: 'Test PR',
    body: 'Test PR Description',
    html_url: 'https://github.com/owner/repo/pull/42',
    head: {ref: 'feat/test'},
    base: {ref: 'main'},
    state: 'open'
   }]));
  }

  if (url.pathname === '/repos/owner/repo/pulls' && req.method === 'POST') {
   created = true;
   return res.end(JSON.stringify({
    id: 999,
    number: 42,
    title: 'Test PR',
    body: 'Test PR Description',
    html_url: 'https://github.com/owner/repo/pull/42',
    head: {ref: 'feat/test'},
    base: {ref: 'main'},
    state: 'open'
   }));
  }

  res.statusCode = 404;
  res.end('{}');
 });

 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 try {
  const client = new GitHubClient(`http://127.0.0.1:${port}`, 'owner/repo', 'test-github-token');
  
  // Validate branches
  const valid = await client.validateBranch('main');
  assert.equal(valid, true);
  const invalid = await client.validateBranch('nonexistent');
  assert.equal(invalid, false);

  // Create PR
  const pr = await client.createPR({
   sourceBranch: 'feat/test',
   targetBranch: 'main',
   title: 'Test PR',
   description: 'Test PR Description'
  });
  assert.equal(pr.number, 42);
  assert.equal(pr.title, 'Test PR');

  // Should find existing
  const existing = await client.createPR({
   sourceBranch: 'feat/test',
   targetBranch: 'main',
   title: 'Test PR'
  });
  assert.equal(existing.number, 42);
 } finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});

test('GitHubClient queries workflow runs and failed job logs', async () => {
 const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  res.setHeader('content-type', 'application/json');

  if (url.pathname === '/repos/owner/repo/actions/runs' && req.method === 'GET') {
   return res.end(JSON.stringify({
    total_count: 1,
    workflow_runs: [{
     id: 1010,
     name: 'CI',
     status: 'completed',
     conclusion: 'failure',
     html_url: 'https://github.com/owner/repo/actions/runs/1010',
     head_branch: 'feat/test',
     head_sha: 'sha123'
    }]
   }));
  }

  if (url.pathname === '/repos/owner/repo/actions/runs/1010/jobs' && req.method === 'GET') {
   return res.end(JSON.stringify({
    total_count: 1,
    jobs: [{
     id: 2020,
     name: 'test-job',
     status: 'completed',
     conclusion: 'failure'
    }]
   }));
  }

  if (url.pathname === '/repos/owner/repo/actions/jobs/2020/logs' && req.method === 'GET') {
   res.setHeader('content-type', 'text/plain');
   return res.end('Error: Process completed with exit code 1.\nAssertionFailedError: expected true but got false');
  }

  res.statusCode = 404;
  res.end('{}');
 });

 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 try {
  const client = new GitHubClient(`http://127.0.0.1:${port}`, 'owner/repo', 'test-github-token');
  const run = await client.getLatestWorkflowRun('feat/test');
  assert.ok(run);
  assert.equal(run?.id, 1010);
  assert.equal(run?.conclusion, 'failure');

  const failedLogs = await client.getFailedJobLogs(1010);
  assert.ok(failedLogs);
  assert.equal(failedLogs?.name, 'test-job');
  assert.match(failedLogs?.trace || '', /AssertionFailedError/);
 } finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});

test('GitHubClient extracts cancelled and timed_out jobs and generates fallback trace when logs unavailable', async () => {
 const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  res.setHeader('content-type', 'application/json');

  if (url.pathname === '/repos/owner/repo/actions/runs/3030/jobs' && req.method === 'GET') {
   return res.end(JSON.stringify({
    total_count: 2,
    jobs: [
     {
      id: 4041,
      name: 'Build (macos-13 - x86_64)',
      status: 'completed',
      conclusion: 'cancelled',
      html_url: 'https://github.com/owner/repo/actions/runs/3030/job/4041',
      labels: ['macos-13', 'x86_64'],
      runner_name: 'GitHub Actions 1'
     },
     {
      id: 4042,
      name: 'lint',
      status: 'completed',
      conclusion: 'success'
     }
    ]
   }));
  }

  // 404 on log download simulating queued/cancelled job without log stream
  if (url.pathname === '/repos/owner/repo/actions/jobs/4041/logs' && req.method === 'GET') {
   res.statusCode = 404;
   return res.end('{"message":"Not Found"}');
  }

  res.statusCode = 404;
  res.end('{}');
 });

 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 try {
  const client = new GitHubClient(`http://127.0.0.1:${port}`, 'owner/repo', 'test-github-token');
  const jobLogs = await client.getFailedJobLogs(3030);
  assert.ok(jobLogs);
  assert.equal(jobLogs.name, 'Build (macos-13 - x86_64)');
  assert.match(jobLogs.trace, /did not succeed/);
  assert.match(jobLogs.trace, /Conclusion: cancelled/);
  assert.match(jobLogs.trace, /Runner labels: macos-13, x86_64/);
  assert.match(jobLogs.trace, /Runner name: GitHub Actions 1/);
  assert.match(jobLogs.trace, /Job URL: https:\/\/github.com\/owner\/repo\/actions\/runs\/3030\/job\/4041/);
 } finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});
