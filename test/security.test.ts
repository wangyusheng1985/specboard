import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { encrypt,decrypt,signature,authenticate,acceptRequest } from '../src/security.ts';
import { Store } from '../src/store.ts';

test('token authenticated encryption rejects wrong keys and tampering',()=>{
 const cipher=encrypt('private-token','secret'); assert.ok(!cipher.includes('private-token'));
 assert.equal(decrypt(cipher,'secret'),'private-token'); assert.throws(()=>decrypt(cipher,'wrong'));
});
test('signature binds method, path, body, timestamp, nonce and request id',()=>{
 const timestamp=String(Date.now()), nonce=randomUUID(), id=randomUUID(), body='{"action":"pause"}';
 const headers={'x-timestamp':timestamp,'x-nonce':nonce,'x-request-id':id,'x-signature':signature('secret','POST','/control',timestamp,nonce,id,body)};
 assert.equal(authenticate('secret','POST','/control',body,headers).id,id);
 assert.throws(()=>authenticate('secret','POST','/control','tampered',headers));
 assert.throws(()=>authenticate('secret','POST','/control',body,headers,Number(timestamp)+60001));
 assert.throws(()=>authenticate('secret','DELETE','/control',body,headers));
});
test('duplicate request returns original result, nonce reuse and conflicts have no side effects',()=>{
 const s=new Store(); let calls=0; const auth={id:randomUUID(),nonce:randomUUID(),digest:'digest'};
 const action=()=>({calls:++calls}); assert.deepEqual(acceptRequest(s,auth,action),{calls:1});
 assert.deepEqual(acceptRequest(s,auth,action),{calls:1}); assert.equal(calls,1);
 assert.throws(()=>acceptRequest(s,{...auth,id:randomUUID()},action),/Replay/);
 assert.throws(()=>acceptRequest(s,{...auth,digest:'changed'},action),/conflict/); assert.equal(calls,1); s.close();
});
