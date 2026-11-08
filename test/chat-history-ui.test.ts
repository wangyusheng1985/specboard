import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('chat mode exposes history controls and cursor pagination', async () => {
 const [html, app] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/app.js', import.meta.url), 'utf8')
 ]);

 const bar = html.indexOf('id="chat-history-bar"');
 assert.ok(bar > html.indexOf('id="chat-scroll-container"'), 'history bar must live in the chat scroll container');
 assert.ok(bar < html.indexOf('id="chat-messages"'), 'history bar must render before chat messages');
 assert.match(html, /id="chat-history-load"/);
 assert.match(html, /id="chat-history-btn"/);
 assert.match(html, /id="chat-history-status"/);

 assert.match(app, /function loadChatHistory/);
 assert.ok(app.includes('/events?limit=200'));
 assert.ok(app.includes('?after=${chatMaxSequence}&limit=500'));
 assert.ok(app.includes('?before=${before}&limit=200'));
 assert.match(app, /mergeChatEvents\(chatLoadedEvents/);
 assert.match(app, /scrollTop <= 80/);
 assert.match(app, /bindChatHistoryInteractions\(\);/);
});
