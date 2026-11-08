import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldEnableBashTool} from '../src/agent-tool-policy.ts';

test('chat Explore tasks receive bash while work Explore tasks do not', () => {
 assert.equal(shouldEnableBashTool({stage: 'Explore', kind: 'chat'}), true);
 assert.equal(shouldEnableBashTool({stage: 'Explore', kind: 'work'}), false);
 assert.equal(shouldEnableBashTool({stage: 'Explore'}), false);
 assert.equal(shouldEnableBashTool({stage: 'Explore', kind: null}), false);
});

test('non-Explore stages keep bash enabled', () => {
 assert.equal(shouldEnableBashTool({stage: 'Propose', kind: 'work'}), true);
 assert.equal(shouldEnableBashTool({stage: 'Apply', kind: 'work'}), true);
 assert.equal(shouldEnableBashTool({stage: 'Archive', kind: 'work'}), true);
});
