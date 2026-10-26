import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {GitLabClient} from '../src/gitlab-client.ts';

test('GitLabClient creates MR or returns existing MR', async () => {
 let created = false;
 const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  res.setHeader('content-type', 'application/json');
  assert.equal(req.headers['private-token'], 'test-token');

  if (url.pathname.endsWith('/merge_requests') && req.method === 'GET') {
   if (!created) {
    return res.end(JSON.stringify([]));
   }
   return res.end(JSON.stringify([{
    id: 101,
    iid: 1,
    title: 'Test MR',
    web_url: 'https://gitlab.example.test/group/project/-/merge_requests/1',
    source_branch: 'feature',
    target_branch: 'main',
    state: 'opened'
   }]));
  }

  if (url.pathname.endsWith('/merge_requests') && req.method === 'POST') {
   created = true;
   return res.end(JSON.stringify({
    id: 101,
    iid: 1,
    title: 'Test MR',
    web_url: 'https://gitlab.example.test/group/project/-/merge_requests/1',
    source_branch: 'feature',
    target_branch: 'main',
    state: 'opened'
   }));
  }

  res.statusCode = 404;
  res.end('{}');
 });

 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 try {
  const client = new GitLabClient(`http://127.0.0.1:${port}`, 'group/project', 'test-token');
  const mr = await client.createMR({
   sourceBranch: 'feature',
   targetBranch: 'main',
   title: 'Test MR'
  });
  assert.equal(mr.iid, 1);
  assert.equal(mr.source_branch, 'feature');

  // Next call should find existing
  const existing = await client.createMR({
   sourceBranch: 'feature',
   targetBranch: 'main',
   title: 'Test MR'
  });
  assert.equal(existing.iid, 1);
 } finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});

test('GitLabClient queries pipeline, jobs, and job trace', async () => {
 const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  if (url.pathname.endsWith('/pipelines')) {
   res.setHeader('content-type', 'application/json');
   return res.end(JSON.stringify([{
    id: 42,
    iid: 12,
    status: 'failed',
    ref: 'feature',
    sha: 'abcd1234',
    web_url: 'https://gitlab.example.test/pipelines/42'
   }]));
  }
  if (url.pathname.endsWith('/pipelines/42/jobs')) {
   res.setHeader('content-type', 'application/json');
   return res.end(JSON.stringify([
    {id: 99, name: 'unit-test', stage: 'test', status: 'failed'}
   ]));
  }
  if (url.pathname.endsWith('/jobs/99/trace')) {
   res.setHeader('content-type', 'text/plain');
   return res.end('AssertionError: expected true but got false');
  }
  res.statusCode = 404;
  res.end('{}');
 });

 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 try {
  const client = new GitLabClient(`http://127.0.0.1:${port}`, 'group/project', 'test-token');
  const pipeline = await client.getLatestPipeline('feature');
  assert.equal(pipeline?.id, 42);
  assert.equal(pipeline?.status, 'failed');

  const jobs = await client.getPipelineJobs(42);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].name, 'unit-test');

  const trace = await client.getJobTrace(99);
  assert.match(trace, /AssertionError/);
 } finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});
