import test from 'node:test';
import assert from 'node:assert/strict';
import {agentStartPrompt,CHAT_SYSTEM_PROMPT,isChatTask} from '../src/agent-mode.ts';

test('only chat kind is treated as chat mode', () => {
 assert.equal(isChatTask({kind:'chat'}),true);
 assert.equal(isChatTask({kind:'work'}),false);
 assert.equal(isChatTask({kind:null}),false);
 assert.equal(isChatTask({}),false);
});

test('chat start prompt is plain conversation and does not start an OpenSpec stage', () => {
 const prompt=agentStartPrompt({kind:'chat',stage:'Explore',description:'今天天气怎么样？'},[]);
 assert.match(prompt,/User message: 今天天气怎么样？/);
 assert.match(prompt,/normal conversation/);
 assert.doesNotMatch(prompt,/Execute Explore using its skill/);
 assert.doesNotMatch(prompt,/Execute the current stage skill/);
 assert.match(prompt,/unless the user explicitly asks for OpenSpec work/);
});

test('work start prompt still executes the stage skill', () => {
 const prompt=agentStartPrompt({kind:'work',stage:'Explore',description:'Inspect repository'},[]);
 assert.match(prompt,/Execute Explore using its skill\./);
 assert.doesNotMatch(prompt,/normal conversation/);
});

test('chat system prompt keeps OpenSpec opt-in', () => {
 assert.match(CHAT_SYSTEM_PROMPT,/This is a normal chat, not an OpenSpec stage/);
 assert.match(CHAT_SYSTEM_PROMPT,/do NOT run "openspec" commands/);
 assert.match(CHAT_SYSTEM_PROMPT,/unless the user explicitly asks for OpenSpec planning or change work/);
});
