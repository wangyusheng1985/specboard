import {createServer} from 'node:http';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGatewayServer} from '../src/gateway-server.ts';
import {randomUUID} from 'node:crypto';
test('Gateway persists encrypted relay edits, enforces admin auth and preserves configuration across restart',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const {default:pg}=await import('pg');const admin=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});const schema='gateway_test_'+randomUUID().replaceAll('-','');await admin.query(`CREATE SCHEMA ${schema}`);
 const databaseUrl=new URL(process.env.TEST_DATABASE_URL!);databaseUrl.searchParams.set('options',`-c search_path=${schema}`);
 const options={databaseUrl:databaseUrl.toString(),token:'gateway-test-token',adminToken:'admin-test-token',encryptionKey:'test-key',allowedHosts:['relay.example']};
 let gateway=await createGatewayServer(options);await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));
 let base=`http://127.0.0.1:${(gateway.server.address() as {port:number}).port}`;
 const headers={authorization:'Bearer admin-test-token','content-type':'application/json'};
 try{
  assert.equal((await fetch(base+'/health')).status,200);
  assert.equal((await fetch(base+'/admin/v1/relays')).status,401);
  const name=randomUUID(),body={name,url:'https://relay.example/v1',token:'top-secret',protocol:'openai-responses' as const,model:'m',priority:75,retries:2,timeoutMs:30000,enabled:true,allowInsecureHttp:false};
  const saved=await fetch(base+'/admin/v1/relays',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(saved.status,200);const relay=await saved.json();assert.ok(!JSON.stringify(relay).includes('top-secret'));
  const candidates=await gateway.repository.candidates();assert.equal(candidates.find(x=>x.id===relay.id)!.token,'top-secret');
  const edited=await fetch(base+'/admin/v1/relays',{method:'POST',headers,body:JSON.stringify({...body,id:relay.id,token:'',enabled:false})});assert.equal(edited.status,200);assert.equal((await edited.json()).enabled,false);
  await gateway.close();gateway=await createGatewayServer(options);await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(gateway.server.address() as {port:number}).port}`;
  const list=await fetch(base+'/admin/v1/relays',{headers});assert.ok((await list.json()).items.some((x:any)=>x.id===relay.id));
  const removed=await fetch(base+'/admin/v1/relays/'+relay.id,{method:'DELETE',headers});assert.equal((await removed.json()).removed,true);
  const upstream=createServer((_req,res)=>{res.writeHead(401);res.end('secret upstream details');});await new Promise<void>(resolve=>upstream.listen(0,'127.0.0.1',resolve));try{const port=(upstream.address() as any).port;options.allowedHosts.push('127.0.0.1:'+port);await gateway.repository.save({...body,name:'auth failure',url:`http://127.0.0.1:${port}/v1`,allowInsecureHttp:true,retries:0});const failed=await fetch(base+'/v1/responses',{method:'POST',headers:{authorization:'Bearer gateway-test-token','content-type':'application/json'},body:'{}'});const error=await failed.json();assert.equal(error.error.code,'model_auth');assert.equal(error.error.attemptCount,1);assert.ok(error.error.requestId);assert.ok(!JSON.stringify(error).includes('secret upstream'));}finally{await new Promise<void>(resolve=>upstream.close(()=>resolve()));}
  assert.equal((await fetch(base+'/v1/responses',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,401);
 }finally{await gateway.close();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});
