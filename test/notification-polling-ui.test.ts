import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('detail polling keeps observing lanes so browser notifications still fire', async () => {
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(app,/async function observeVisibleLaneTasks\(\)\{[\s\S]*?if\(!notifications\.enabled\(\)\)return;[\s\S]*?observeTasks\(/);
 assert.match(app,/if\(selected&&\$\('#detail-dialog'\)\.open\)\{\s*await updateDetail\(\);\s*\/\/[\s\S]*?await observeVisibleLaneTasks\(\);/);
 assert.match(app,/const \[data,chats\]=await Promise\.all/);
 assert.match(app,/const \[pages,chats\]=await Promise\.all/);
 assert.match(app,/\.\.\.\(chats\.items\|\|\[\]\)/);
 assert.ok((app.match(/api\('\/api\/v1\/chats'\)/g)||[]).length>=2);
});
