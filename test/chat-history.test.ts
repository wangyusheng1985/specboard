import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeChatEvents} from '../public/chat-history.js';

test('mergeChatEvents sorts events and normalizes PostgreSQL bigint sequences', () => {
 const merged = mergeChatEvents(
  [{sequence: '3', type: 'c'}, {sequence: 1, type: 'a'}],
  [{sequence: '2', type: 'b'}, {sequence: 3, type: 'c2'}]
 );
 assert.deepEqual(merged.map(event => event.sequence), [1, 2, 3]);
 assert.deepEqual(merged.map(event => event.type), ['a', 'b', 'c2']);
});

test('mergeChatEvents ignores events without a finite sequence', () => {
 const merged = mergeChatEvents(
  [{sequence: 2, type: 'b'}],
  [{type: 'missing'}, {sequence: null, type: 'null'}, {sequence: 'bad', type: 'bad'}, {sequence: '1', type: 'a'}]
 );
 assert.deepEqual(merged.map(event => event.type), ['a', 'b']);
});
