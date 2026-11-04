import {test} from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {ApiError} from '../src/runtime-security.ts';

function createTestApp() {
  const app = Fastify({logger: false});
  app.addContentTypeParser('application/json', {parseAs: 'string'}, (req, body, done) => {
    if (typeof body !== 'string' || body.trim().length === 0) {
      done(null, {});
      return;
    }
    const defaultParser = app.getDefaultJsonParser('ignore', 'ignore');
    defaultParser(req, body, done);
  });
  app.setErrorHandler((e: any, req, reply) => {
    const isClient = (e instanceof ApiError) || (typeof e.statusCode === 'number' && e.statusCode >= 400 && e.statusCode < 500) || Boolean(e.validation);
    if (!isClient) console.error('Unhandled API Error:', e);
    const status = e instanceof ApiError ? e.status : e.validation ? 400 : (typeof e.statusCode === 'number' && e.statusCode >= 400 && e.statusCode < 500) ? e.statusCode : 500;
    const code = e instanceof ApiError ? e.code : e.validation ? 'invalid_request' : e.code || (status === 500 ? 'internal_error' : 'bad_request');
    reply.code(status).send({error: {code, message: status === 500 ? 'Request failed' : e.message}, requestId: req.id});
  });
  return app;
}

test('Fastify JSON parser handles empty body with application/json header without 500', async () => {
  const app = createTestApp();
  app.delete('/api/v1/chats/:id', async (req) => {
    return {success: true, task: (req.params as any).id, body: req.body};
  });
  await app.ready();

  // 1. DELETE without body but with application/json header
  const resEmpty = await app.inject({
    method: 'DELETE',
    url: '/api/v1/chats/chat-123',
    headers: {'content-type': 'application/json'},
    payload: ''
  });
  assert.equal(resEmpty.statusCode, 200);
  assert.deepEqual(resEmpty.json(), {success: true, task: 'chat-123', body: {}});

  // 2. DELETE with raw empty object '{}'
  const resObj = await app.inject({
    method: 'DELETE',
    url: '/api/v1/chats/chat-123',
    headers: {'content-type': 'application/json'},
    payload: '{}'
  });
  assert.equal(resObj.statusCode, 200);
  assert.deepEqual(resObj.json(), {success: true, task: 'chat-123', body: {}});

  // 3. DELETE with whitespace body
  const resWs = await app.inject({
    method: 'DELETE',
    url: '/api/v1/chats/chat-123',
    headers: {'content-type': 'application/json'},
    payload: '   '
  });
  assert.equal(resWs.statusCode, 200);
  assert.deepEqual(resWs.json(), {success: true, task: 'chat-123', body: {}});

  await app.close();
});

test('Fastify errorHandler preserves 4xx status and does not convert to 500 internal_error', async () => {
  const app = createTestApp();
  app.post('/api/v1/items', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {type: 'string'}
        }
      }
    }
  }, async (req) => req.body);
  await app.ready();

  // Invalid JSON syntax returns 400 bad_request / FST_ERR_CTP_INVALID_JSON_BODY, not 500
  const resInvalidJson = await app.inject({
    method: 'POST',
    url: '/api/v1/items',
    headers: {'content-type': 'application/json'},
    payload: '{not-json'
  });
  assert.equal(resInvalidJson.statusCode, 400);
  assert.notEqual(resInvalidJson.json().error.code, 'internal_error');
  assert.equal(resInvalidJson.json().error.code, 'FST_ERR_CTP_INVALID_JSON_BODY');

  // Schema validation failure returns 400 invalid_request, not 500
  const resValidation = await app.inject({
    method: 'POST',
    url: '/api/v1/items',
    headers: {'content-type': 'application/json'},
    payload: JSON.stringify({wrongField: 123})
  });
  assert.equal(resValidation.statusCode, 400);
  assert.equal(resValidation.json().error.code, 'invalid_request');

  await app.close();
});
