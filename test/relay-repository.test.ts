import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRelay,publicRelay,type RelayConfig} from '../src/relay-repository.ts';
const config:RelayConfig={id:'relay',name:'primary',url:'https://relay.example/v1',token:'private-secret',model:'gpt-test',protocol:'openai-responses',priority:100,retries:2,enabled:true,allowInsecureHttp:false,timeoutMs:30000};
test('relay validation and public projection protect credentials and routing limits',()=>{
 assert.equal(validateRelay(config,['relay.example']).priority,100);
 assert.ok(!JSON.stringify(publicRelay(config)).includes('private-secret'));
 assert.equal(publicRelay(config).hasToken,true);
 for(const input of [{...config,priority:101},{...config,retries:-1},{...config,timeoutMs:0},{...config,enabled:'true'},{...config,protocol:'unknown'},{...config,token:''},{...config,url:'https://user:pass@relay.example/v1'},{...config,url:'https://relay.example/v1?token=secret'},{...config,url:'ftp://relay.example/v1'}])assert.throws(()=>validateRelay(input as RelayConfig,['relay.example']));
 assert.throws(()=>validateRelay(config,[]),/允许列表/);
 assert.throws(()=>validateRelay({...config,url:'http://relay.example/v1'},['relay.example']),/HTTP/);
 assert.equal(validateRelay({...config,url:'http://relay.example/v1',allowInsecureHttp:true},['relay.example']).allowInsecureHttp,true);
 assert.throws(()=>validateRelay({...config,url:'http://169.254.169.254',allowInsecureHttp:true},['169.254.169.254']),/元数据/);
});
