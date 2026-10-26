import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeApi} from '../src/runtime-api.ts';
import {randomUUID} from 'node:crypto';

test('PUT /api/v1/projects/:id updates existing project and allows empty token to retain existing credentials', {skip: !process.env.TEST_DATABASE_URL}, async () => {
 const originalFetch = globalThis.fetch;
 globalThis.fetch = (async (url: any, init: any) => {
  const token = init?.headers?.['PRIVATE-TOKEN'];
  if (token === 'orig-token' || token === 'new-token') {
   return new Response('{}', {status: 200});
  }
  return new Response('{}', {status: 401});
 }) as any;

 const secret = '0123456789abcdef0123456789abcdef';
 const token = '0123456789abcdef0123456789abcdef';
 const encryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
 const runtime = await createRuntimeApi({
  databaseUrl: process.env.TEST_DATABASE_URL || 'postgres://specboard:specboard@127.0.0.1:5432/specboard',
  secret,
  dispatcherToken: token,
  gatewayUrl: 'http://gateway.local',
  gatewayAdminToken: token,
  encryptionKey
 });

 const auth = {authorization: `Bearer ${secret}`};

 try {
  // 1. Create project
  const createRes = await runtime.app.inject({
   method: 'POST',
   url: '/api/v1/projects',
   headers: {...auth, 'idempotency-key': randomUUID()},
   payload: {
    name: 'Initial Project',
    repositoryUrl: 'https://gitlab.com/group/repo.git',
    apiToken: 'orig-token',
    defaultBranch: 'main'
   }
  });
  assert.equal(createRes.statusCode, 201, createRes.body);
  const created = createRes.json();
  const projectId = created.id;

  // 2. Update without token (should retain original token and pass branch validation)
  const updateRes1 = await runtime.app.inject({
   method: 'PUT',
   url: `/api/v1/projects/${projectId}`,
   headers: {...auth, 'idempotency-key': randomUUID()},
   payload: {
    name: 'Renamed Project',
    repositoryUrl: 'https://gitlab.com/group/repo.git',
    defaultBranch: 'main',
    gitUserName: 'Custom Author',
    gitUserEmail: 'author@company.com'
   }
  });
  assert.equal(updateRes1.statusCode, 200, updateRes1.body);
  const updated1 = updateRes1.json();
  assert.equal(updated1.name, 'Renamed Project');
  assert.equal(updated1.gitUserName, 'Custom Author');
  assert.equal(updated1.gitUserEmail, 'author@company.com');

  // Verify list reflects updates
  const listRes = await runtime.app.inject({
   method: 'GET',
   url: '/api/v1/projects',
   headers: auth
  });
  const proj = listRes.json().items.find((p: any) => p.id === projectId);
  assert.equal(proj.name, 'Renamed Project');
  assert.equal(proj.gitUserName, 'Custom Author');

  // 3. Update with new token
  const updateRes2 = await runtime.app.inject({
   method: 'PUT',
   url: `/api/v1/projects/${projectId}`,
   headers: {...auth, 'idempotency-key': randomUUID()},
   payload: {
    name: 'Renamed Project V2',
    repositoryUrl: 'https://gitlab.com/group/repo.git',
    defaultBranch: 'main',
    apiToken: 'new-token'
   }
  });
  assert.equal(updateRes2.statusCode, 200, updateRes2.body);
  assert.equal(updateRes2.json().name, 'Renamed Project V2');
 } finally {
  globalThis.fetch = originalFetch;
  await runtime.app.close();
 }
});
