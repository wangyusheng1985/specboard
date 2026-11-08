import test from 'node:test';
import assert from 'node:assert/strict';
import {chatRoutePath, parseChatRoute} from '../public/chat-route.js';

test('parseChatRoute reads work, new chat and chat id routes', () => {
 assert.deepEqual(parseChatRoute('#/work'), {mode: 'work'});
 assert.deepEqual(parseChatRoute('#/chat'), {mode: 'chat', chatId: null});
 assert.deepEqual(parseChatRoute('#/chat/123e4567-e89b-12d3-a456-426614174000'), {
  mode: 'chat',
  chatId: '123e4567-e89b-12d3-a456-426614174000'
 });
 assert.deepEqual(parseChatRoute(''), null);
 assert.deepEqual(parseChatRoute('#/unknown'), null);
 assert.deepEqual(parseChatRoute('#/chat/not-a-uuid'), null);
});

test('chatRoutePath produces canonical hash routes', () => {
 assert.equal(chatRoutePath(), '/chat');
 assert.equal(chatRoutePath(null), '/chat');
 assert.equal(chatRoutePath('123e4567-e89b-12d3-a456-426614174000'), '/chat/123e4567-e89b-12d3-a456-426614174000');
});
