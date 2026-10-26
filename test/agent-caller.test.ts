import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createAgentCaller} from '../src/agent-container.ts';

test('Agent caller retries on transient 500 and succeeds', async () => {
 let attempts = 0;
 const server = createServer((req, res) => {
  attempts++;
  if (attempts < 3) {
   res.writeHead(500, {'content-type': 'application/json'});
   return res.end(JSON.stringify({error: 'transient_error'}));
  }
  res.writeHead(200, {'content-type': 'application/json'});
  res.end(JSON.stringify({success: true, attempts}));
 });
 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 try {
  const call = createAgentCaller({
   api: `http://127.0.0.1:${port}`,
   id: 'run-1',
   headers: {authorization: 'Bearer token'},
   maxRetries: 3,
   retryDelayMs: 20
  });
  const result = await call('context');
  assert.equal(result.success, true);
  assert.equal(attempts, 3);
 } finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});

test('Agent caller immediately throws on 4xx without retrying', async () => {
 let attempts = 0;
 const server = createServer((req, res) => {
  attempts++;
  res.writeHead(401, {'content-type': 'application/json'});
  res.end(JSON.stringify({error: 'unauthorized'}));
 });
 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 try {
  const call = createAgentCaller({
   api: `http://127.0.0.1:${port}`,
   id: 'run-2',
   headers: {authorization: 'Bearer token'},
   maxRetries: 3,
   retryDelayMs: 20
  });
  await assert.rejects(async () => {
   await call('context');
  }, /Agent API 401/);
  assert.equal(attempts, 1);
 } finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});

test('Agent caller throws when 5xx retries are exhausted', async () => {
 let attempts = 0;
 const server = createServer((req, res) => {
  attempts++;
  res.writeHead(503, {'content-type': 'application/json'});
  res.end(JSON.stringify({error: 'service_unavailable'}));
 });
 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 try {
  const call = createAgentCaller({
   api: `http://127.0.0.1:${port}`,
   id: 'run-3',
   headers: {authorization: 'Bearer token'},
   maxRetries: 2,
   retryDelayMs: 20
  });
  await assert.rejects(async () => {
   await call('context');
  }, /Agent API 503/);
  assert.equal(attempts, 3); // initial attempt + 2 retries
 } finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});
