import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('detail stepper lets users inspect completed stage data', async () => {
 const [app, css] = await Promise.all([
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/style.css', import.meta.url), 'utf8')
 ]);
 assert.match(app, /function renderDetailStepper\(task\)\{[\s\S]*?const viewingIdx=stages\.indexOf\(viewStage\)/);
 assert.match(app, /step\.disabled=idx>currentIdx/);
 assert.match(app, /step\.onclick=\(\)=>\{[\s\S]*?viewStage=stg;[\s\S]*?updateDetail\(\)/);
 assert.match(app, /renderRuns\(runs,task\)/);
 assert.doesNotMatch(app, /run\.stage===stage/);
 assert.match(app, /阶段执行完成 · /);
 assert.match(app, /type=user_message&limit=500/);
 assert.match(app, /getStageLabel\(ev\.stage,task\)/);
 assert.match(app, /const stageRuns=runs\.filter\(r=>r\.stage===viewStage\)/);
 assert.doesNotMatch(app, /const key=r\.stage/);
 assert.match(css, /\.stepper-step\.viewing\{/);
 assert.match(css, /button\.stepper-step\{/);
});
