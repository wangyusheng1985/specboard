import test from 'node:test';
import assert from 'node:assert/strict';
import {TOOL_OUTPUT_LIMIT, truncateToolOutput} from '../public/tool-output.js';

test('short tool output is returned unchanged', () => {
 const result = truncateToolOutput('git log output');
 assert.deepEqual(result, {text: 'git log output', truncated: false, originalLength: 14, limit: TOOL_OUTPUT_LIMIT});
});

test('long tool output keeps the beginning and the end', () => {
 const text = `${'A'.repeat(30000)}${'B'.repeat(30000)}`;
 const result = truncateToolOutput(text, 1000);
 assert.equal(result.truncated, true);
 assert.equal(result.originalLength, 60000);
 assert.ok(result.text.startsWith('A'.repeat(600)));
 assert.ok(result.text.endsWith('B'.repeat(400)));
 assert.match(result.text, /中间内容已截断/);
});

test('the default limit matches the agent-side 50KB budget', () => {
 assert.equal(TOOL_OUTPUT_LIMIT, 50000);
 const result = truncateToolOutput('x'.repeat(TOOL_OUTPUT_LIMIT + 1));
 assert.equal(result.truncated, true);
 assert.equal(result.originalLength, TOOL_OUTPUT_LIMIT + 1);
});
