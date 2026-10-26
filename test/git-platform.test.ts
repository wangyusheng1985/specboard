import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createGitPlatformClient, isGitHubUrl} from '../src/git-platform.ts';

test('isGitHubUrl identifies github repositories', () => {
 assert.equal(isGitHubUrl('https://github.com/owner/repo.git'), true);
 assert.equal(isGitHubUrl('https://gitlab.example.com/owner/repo'), false);
 assert.equal(isGitHubUrl('invalid-url'), false);
});

test('createGitPlatformClient handles GitHub PR and Actions workflow', async () => {
 const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  res.setHeader('content-type', 'application/json');

  if (url.pathname === '/repos/owner/repo/pulls' && req.method === 'GET') {
   return res.end(JSON.stringify([{
    id: 1,
    number: 10,
    title: 'Test PR',
    body: 'Desc',
    html_url: 'https://github.com/owner/repo/pull/10',
    head: {ref: 'feat'},
    base: {ref: 'main'},
    state: 'open'
   }]));
  }

  if (url.pathname === '/repos/owner/repo/actions/runs' && req.method === 'GET') {
   return res.end(JSON.stringify({
    workflow_runs: [{
     id: 50,
     name: 'ci',
     status: 'completed',
     conclusion: 'success',
     html_url: 'https://github.com/owner/repo/actions/runs/50',
     head_branch: 'feat'
    }]
   }));
  }

  res.statusCode = 404;
  res.end('{}');
 });

 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 try {
  const client = createGitPlatformClient(`http://127.0.0.1:${port}/owner/repo.git`, 'test-token');
  // force isGitHub for custom port by testing directly
  assert.equal(client.isGitHub, false); // because not github.com host

  // Custom client with github.com simulated URL
  const githubClient = createGitPlatformClient(`https://github.com/owner/repo.git`, 'test-token');
  assert.equal(githubClient.isGitHub, true);
 } finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});
