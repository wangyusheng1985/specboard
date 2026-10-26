import {test} from 'node:test';
import assert from 'node:assert/strict';
import {responsesToChat,chatToResponses,responseSse} from '../src/protocols.ts';
test('Responses tools and results convert to Chat and back without losing call identity',()=>{
 const chat=responsesToChat({instructions:'system',input:[{role:'user',content:[{type:'input_text',text:'hello'}]},{type:'function_call',call_id:'call1',name:'read',arguments:'{}'},{type:'function_call_output',call_id:'call1',output:'file'}],tools:[{name:'read',parameters:{type:'object'}}],max_output_tokens:100},'m');
 assert.equal(chat.messages[0].role,'system');assert.equal(chat.messages[2].tool_calls[0].id,'call1');assert.equal(chat.messages[3].tool_call_id,'call1');assert.equal(chat.max_tokens,100);
 const response=chatToResponses({id:'r1',choices:[{message:{content:'done',tool_calls:[{id:'call2',function:{name:'write',arguments:'{}'}}]}}],usage:{prompt_tokens:12,completion_tokens:5,total_tokens:17}},'m');
 assert.equal(response.output[1].call_id,'call2');assert.equal(response.usage.total_tokens,17);
 const sse=responseSse(response);assert.match(sse,/response\.completed/);assert.match(sse,/response\.function_call_arguments\.delta/);assert.match(sse,/response\.output_text\.delta/);
 assert.throws(()=>chatToResponses({},'m'),/Malformed/);
});
