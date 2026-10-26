import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
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
