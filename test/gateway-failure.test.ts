import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LlmGateway} from '../src/llm-gateway.ts';
test('gateway all relay failure remains classified and circuit cooling is deterministic',async()=>{
 const original=globalThis.fetch,gateway=new LlmGateway({allowedHosts:['a.example','b.example'],token:'test'});gateway.addRelay({name:'a',url:'https://a.example/v1',token:'x',protocol:'openai-responses',model:'m',priority:100,retries:0,enabled:true});gateway.addRelay({name:'b',url:'https://b.example/v1',token:'y',protocol:'openai-responses',model:'m',priority:50,retries:0,enabled:true});let calls=0;
 globalThis.fetch=(async()=>{calls++;return new Response('{}',{status:503});}) as typeof fetch;
 try{for(let i=0;i<3;i++)await assert.rejects(gateway.request({input:'x'}),/All LLM relays failed/);assert.ok(calls>=4);assert.equal(gateway.candidates().length,0);}finally{globalThis.fetch=original;}
});
