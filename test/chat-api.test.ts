import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createRuntimeApi} from '../src/runtime-api.ts';

test('Chat API supports creating and querying chat conversations', {skip: !process.env.TEST_DATABASE_URL}, async () => {
  const admin = new pg.Pool({connectionString: process.env.TEST_DATABASE_URL});
  const schema = 'chat_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.TEST_DATABASE_URL!);
  url.searchParams.set('options', `-c search_path=${schema}`);

  const {app, pool} = await createRuntimeApi({
    databaseUrl: url.toString(),
    secret: 'secret',
    dispatcherToken: 'dispatch',
    gatewayUrl: 'http://gateway',
    gatewayAdminToken: 'admin',
    encryptionKey: 'key'
  });
  await app.ready();

  try {
    const auth = {authorization: 'Bearer secret'};
    const post = async (path: string, body: any, headers: any = auth) =>
      app.inject({method: 'POST', url: path, headers: {...headers, 'idempotency-key': randomUUID()}, payload: body});

    // 1. 创建无项目会话
    const res1 = await post('/api/v1/chats', {message: '你好，请帮我分析算法'});
    assert.equal(res1.statusCode, 201);
    const chat1 = res1.json();
    assert.equal(chat1.stage, 'Explore');
    assert.equal(chat1.project_id, null);
    assert.equal(chat1.kind, 'chat');

    // 2. 获取会话列表
    const listRes = await app.inject({method: 'GET', url: '/api/v1/chats', headers: auth});
    assert.equal(listRes.statusCode, 200);
    const items = listRes.json().items;
    assert.equal(items.length, 1);
    assert.equal(items[0].id, chat1.id);

    // 3. 发送新消息追加
    const msgRes = await post(`/api/v1/chats/${chat1.id}/messages`, {message: '进一步说明复杂度'});
    assert.equal(msgRes.statusCode, 202);

    // 4. 获取单个会话详情
    const getRes = await app.inject({method: 'GET', url: `/api/v1/chats/${chat1.id}`, headers: auth});
    assert.equal(getRes.statusCode, 200);
    assert.equal(getRes.json().id, chat1.id);

    // 5. 测试内部 Web 工具路由（模拟 Agent 调用）
    const claimRes = await post('/internal/v1/dispatch/claim', {owner: 'test-runner'}, {authorization: 'Bearer dispatch'});
    const run = claimRes.json().items[0];
    const agentAuth = {authorization: `Bearer ${run.token}`, 'x-run-generation': String(run.generation)};

    const searchRes = await app.inject({
      method: 'POST',
      url: `/internal/v1/runs/${run.id}/web-search`,
      headers: agentAuth,
      payload: {query: 'TypeScript 5.0 features'}
    });
    assert.equal(searchRes.statusCode, 200);
    assert.ok(Array.isArray(searchRes.json().results));

    const fetchRes = await app.inject({
      method: 'POST',
      url: `/internal/v1/runs/${run.id}/fetch-content`,
      headers: agentAuth,
      payload: {url: 'http://127.0.0.1:9999'} // private host should return safe error message or 500
    });
    assert.equal(fetchRes.statusCode, 200);
    assert.ok(fetchRes.json().content.includes('Fetch error') || fetchRes.json().content.includes('restricted'));

    // 6. 删除会话：验证带 --data-raw '{}' 与完全不传 body 均正常返回 200
    const res2 = await post('/api/v1/chats', {message: '第二个会话'});
    assert.equal(res2.statusCode, 201);
    const chat2 = res2.json();

    // 场景 A: 带 '{}' 载荷的 DELETE
    const delRes1 = await app.inject({
      method: 'DELETE',
      url: `/api/v1/chats/${chat1.id}`,
      headers: {...auth, 'content-type': 'application/json', 'idempotency-key': randomUUID()},
      payload: '{}'
    });
    assert.equal(delRes1.statusCode, 200);
    assert.equal(delRes1.json().deleted, true);
    assert.equal(delRes1.json().id, chat1.id);

    // 场景 B: 带 content-type: application/json 但无 body 的 DELETE
    const delRes2 = await app.inject({
      method: 'DELETE',
      url: `/api/v1/chats/${chat2.id}`,
      headers: {...auth, 'content-type': 'application/json', 'idempotency-key': randomUUID()},
      payload: ''
    });
    assert.equal(delRes2.statusCode, 200);
    assert.equal(delRes2.json().deleted, true);
    assert.equal(delRes2.json().id, chat2.id);
  } finally {
    await app.close();
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
