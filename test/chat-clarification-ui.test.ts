import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('chat mode exposes pending clarifications and locks the composer', async () => {
 const [html, app] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/app.js', import.meta.url), 'utf8')
 ]);

 const card = html.indexOf('id="chat-clarification-card"');
 assert.ok(card > html.indexOf('id="chat-view"'), 'clarification card must live inside the chat view');
 assert.ok(card < html.indexOf('class="chat-composer-wrap"'), 'clarification card must render before the composer');
 assert.match(html, /id="chat-clarification-content"/);
 assert.match(html, /id="chat-clarification-status"/);

 assert.match(app, /\/api\/v1\/tasks\/\$\{activeChatId\}\/clarifications/);
 assert.match(app, /function renderChatClarification/);
 assert.match(app, /function buildClarificationForm/);
 assert.match(app, /activeChatClarification\?\.status === 'pending'/);
 assert.match(app, /err\?\.code === 'clarification_required'/);
 assert.match(app, /setChatComposerLocked\(true/);
});
