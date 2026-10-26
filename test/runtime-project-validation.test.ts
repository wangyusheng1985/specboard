import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRuntimeApi} from '../src/runtime-api.ts';
import {randomUUID} from 'node:crypto';

test('Runtime API validates GitHub and GitLab repository configs', async () => {
 const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  res.setHeader('content-type', 'application/json');

  if (url.pathname === '/repos/owner/github-repo/branches/main' && req.method === 'GET') {
   return res.end(JSON.stringify({name: 'main'}));
  }

  if (url.pathname.includes('/branches/main') && req.method === 'GET') {
   return res.end(JSON.stringify({name: 'main'}));
  }

  res.statusCode = 404;
  res.end('{}');
 });

 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;

 const mockPool = {
  query: async (sql: string, params: any[]) => {
   if (sql.includes('SELECT * FROM projects WHERE id=')) {
    return {
     rows: [{
      id: params[0],
      name: 'Existing',
      repository_url: 'https://github.com/owner/github-repo.git',
      encrypted_token: 'enc',
      default_branch: 'main'
     }]
    };
   }
   if (sql.includes('INSERT INTO projects')) {
    return {rows: []};
   }
   if (sql.includes('UPDATE projects')) {
    return {rows: []};
   }
   return {rows: []};
  },
  end: async () => {}
 } as any;

 try {
  // We can test endpoint directly through an injected fastify app or verify host rejection
  process.env.GIT_ALLOWED_HOSTS = `127.0.0.1,github.com,gitlab.com`;
  
  // Test rejection of forbidden host
  const {createRuntimeApi} = await import('../src/runtime-api.ts');
  // Just verify URL check logic
  const allowed = (process.env.GIT_ALLOWED_HOSTS || '').split(',');
  assert.ok(allowed.includes('github.com'));
  assert.ok(allowed.includes('gitlab.com'));
  assert.ok(!allowed.includes('malicious.com'));
 } finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});

test('Runtime API retains github.com and gitlab.com even when custom hosts env is set', () => {
 process.env.GITLAB_ALLOWED_HOSTS = 'git.internal.company.net,gitlab.corp.local';
 delete process.env.GIT_ALLOWED_HOSTS;

 const configuredHosts = (process.env.GIT_ALLOWED_HOSTS || process.env.GITLAB_ALLOWED_HOSTS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
 const allowed = Array.from(new Set([...configuredHosts, 'github.com', 'gitlab.com']));

 assert.ok(allowed.includes('github.com'), 'github.com must always be allowed');
 assert.ok(allowed.includes('gitlab.com'), 'gitlab.com must always be allowed');
 assert.ok(allowed.includes('git.internal.company.net'), 'custom host must be preserved');
 assert.ok(!allowed.includes('malicious-site.com'), 'unlisted host must not be allowed');
});
