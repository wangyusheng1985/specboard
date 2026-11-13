import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('delivery result shows reviewable summary, validation and blockers', async () => {
 const [app, css] = await Promise.all([
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/style.css', import.meta.url), 'utf8')
 ]);
 assert.match(app, /function renderDeliveryResult\(task,runs\)\{/);
 assert.match(app, /el\('h3','实现完成，等待审阅'\)/);
 assert.match(app, /markdown\(deliveredRun\.summary\)/);
 assert.match(app, /交付摘要/);
 assert.match(app, /验证记录（/);
 assert.match(app, /阻塞项 \/ 后续项/);
 assert.match(app, /renderDeliveryResult\(task,runs\)/);
 assert.match(css, /\.delivery-summary\{/);
 assert.match(css, /\.delivery-validation-item\{/);
 assert.match(css, /\.delivery-blockers\{/);
});
