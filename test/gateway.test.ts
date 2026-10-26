import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LlmGateway} from '../src/llm-gateway.ts';
const relay={name:'a',url:'https://relay.example/v1',token:'secret',protocol:'openai-responses' as const,model:'model',priority:100,retries:2,enabled:true};
test('gateway options, relay projection and attempt budget are explicit',()=>{const gateway=new LlmGateway({token:'test',maxAttemptsPerEpisode:1});const added=gateway.addRelay(relay);assert.equal(added.name,'a');assert.equal(added.model,'model');assert.equal(added.protocol,'openai-responses');assert.equal(added.priority,100);assert.equal(added.enabled,true);assert.equal(gateway.candidates().length,1);});

test('gateway preserves API base path and exhausts retries before fallback',async()=>{
 const original=globalThis.fetch,calls:string[]=[];const gateway=new LlmGateway({allowedHosts:['relay.example','backup.example'],token:'test'});
 gateway.addRelay(relay);gateway.addRelay({...relay,name:'backup',url:'https://backup.example/v1',priority:50,retries:0});
 globalThis.fetch=(async(url,options)=>{calls.push(String(url));assert.equal(options?.redirect,'error');return new Response('{}',{status:String(url).includes('backup')?200:503});}) as typeof fetch;
 try{const result=await gateway.request({input:'hello'});assert.equal(result.metadata.attempts,4);assert.deepEqual(calls,['https://relay.example/v1/responses','https://relay.example/v1/responses','https://relay.example/v1/responses','https://backup.example/v1/responses']);assert.equal(result.metadata.fallback,true);assert.equal(gateway.candidates().length,1);}finally{globalThis.fetch=original;}
});
test('authentication errors skip retries and cancellation does not trigger fallback',async()=>{
 const original=globalThis.fetch,gateway=new LlmGateway({allowedHosts:['relay.example'],token:'test'});gateway.addRelay(relay);let calls=0;
 globalThis.fetch=(async()=>{calls++;return new Response('{}',{status:401});}) as typeof fetch;
 try{await assert.rejects(gateway.request({input:'hello'}),/All LLM/);assert.equal(calls,1);
 const controller=new AbortController();controller.abort();globalThis.fetch=(async()=>{calls++;throw new Error('cancelled');}) as typeof fetch;
 await assert.rejects(gateway.request({input:'hello'},controller.signal),/cancelled/);assert.equal(calls,2);
 }finally{globalThis.fetch=original;}
});

test('gateway rejects disallowed endpoints and reports all relays failed',async()=>{
 const gateway=new LlmGateway({allowedHosts:['relay.example'],token:'test'});
 assert.throws(()=>gateway.addRelay({...relay,url:'http://relay.example/v1'}),/HTTP/);
 assert.throws(()=>gateway.addRelay({...relay,url:'https://other.example/v1'}),/host/);
 await assert.rejects(gateway.request({input:'hello'}),/All LLM relays failed/);
 gateway.addRelay({...relay,enabled:false});assert.equal(gateway.candidates().length,0);
});
