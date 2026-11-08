import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('work and chat navigation write deep-link hash routes', async () => {
 const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
 assert.match(app, /window\.addEventListener\('hashchange'/);
 assert.match(app, /function applyRoute/);
 assert.match(app, /await switchMode\('chat', \{chatId: route\.chatId\}\)/);
 assert.match(app, /setRoute\(chatRoutePath\(chatId\)\)/);
 assert.match(app, /setRoute\('\/work'\)/);
 assert.match(app, /setRoute\('\/chat'\)/);
 assert.match(app, /const generation = \+\+chatSelectionGeneration/);
 assert.match(app, /function scrollChatToBottom/);
 assert.match(app, /if \(chatSelectionPending && !forceScroll\) return/);
 assert.match(app, /void applyRoute\(\);$/m);
});
