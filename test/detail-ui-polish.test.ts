import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('detail header chips, preview copy icon and run times are consistent', async () => {
 const [app, css] = await Promise.all([
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/style.css', import.meta.url), 'utf8')
 ]);
 assert.match(css, /\.detail-meta-group \.task-id-chip,[\s\S]*?height:26px;min-height:26px/);
 assert.match(css, /#preview-dialog-copy-btn \.nav-icon\{[^}]*width:15px/);
 assert.match(css, /#preview-dialog-copy-btn \.copy-icon\{[^}]*width:15px/);
 assert.match(app, /const started=run\.started_at\|\|run\.created_at,ended=run\.ended_at\|\|run\.updated_at/);
 assert.match(app, /开始：\$\{started\?new Date\(started\)\.toLocaleString\(\):'-'\}/);
});
