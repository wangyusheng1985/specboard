import {classifyFailure} from './diagnostics.ts';
import {createServer} from 'node:http';
import pg from 'pg';
import {RelayRepository} from './relay-repository.ts';
import {LlmGateway} from './llm-gateway.ts';
import {constantTimeEqual} from './tokens.ts';

export async function createGatewayServer(options:{databaseUrl:string;token:string;adminToken:string;encryptionKey:string;allowedHosts:string[]}){
 const pool=new pg.Pool({connectionString:options.databaseUrl});const repository=new RelayRepository(pool,options.encryptionKey,options.allowedHosts);await repository.migrate();
 const gateways=new Map<string,LlmGateway>();
 const server=createServer(async(req,res)=>{
  const send=(status:number,data:unknown)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
  const url=new URL(req.url||'/','http://gateway');
  try{
   if(req.method==='GET'&&url.pathname==='/health'){await pool.query('SELECT 1');return send(200,{status:'ok'});}
   const isAdmin=constantTimeEqual(req.headers.authorization||'',`Bearer ${options.adminToken}`);
   if(url.pathname.startsWith('/admin/v1/')){
    if(!isAdmin)return send(401,{error:'Admin Token required'});
    if(req.method==='GET'&&url.pathname==='/admin/v1/relays')return send(200,{items:await repository.list()});
    let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>65536)return send(413,{error:'Body too large'});}
    if(req.method==='POST'&&url.pathname==='/admin/v1/relays')return send(200,await repository.save(JSON.parse(raw)));
    if(req.method==='DELETE'&&url.pathname.startsWith('/admin/v1/relays/'))return send(200,{removed:await repository.remove(url.pathname.split('/').at(-1)!)});
    return send(404,{error:'Not found'});
   }
   if(!constantTimeEqual(req.headers.authorization||'',`Bearer ${options.token}`))return send(401,{error:'Gateway Token required'});
   if(req.method!=='POST'||url.pathname!=='/v1/responses')return send(404,{error:'Not found'});
   let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>2*1024*1024)return send(413,{error:'Body too large'});}
   const candidates=await repository.candidates();
   const fingerprint=JSON.stringify(candidates);
   let gateway=gateways.get(fingerprint);
   if(!gateway){gateway=new LlmGateway({token:options.token,allowedHosts:options.allowedHosts});for(const relay of candidates)gateway.addRelay({...relay});gateways.clear();gateways.set(fingerprint,gateway);}
   const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
   const {response,metadata}=await gateway.request(JSON.parse(raw),controller.signal);
   res.writeHead(200,{'content-type':response.headers.get('content-type')||'application/json','x-request-id':metadata.requestId,'x-relay-attempts':String(metadata.attempts),'x-relay-fallback':String(metadata.fallback)});
   try{if(response.body)for await(const chunk of response.body as any)res.write(Buffer.from(chunk));res.end();}catch{res.destroy(new Error('stream_interrupted'));}
  }catch(error){if(!res.headersSent){if(url.pathname.startsWith('/admin/'))send(502,{error:error instanceof Error?error.message:'Request failed'});else{const source=error as any,cause=source.cause||source;send(502,{error:{code:classifyFailure({status:cause.status,code:cause.name==='TimeoutError'?'TimeoutError':cause.code}),message:'All LLM relays failed',requestId:source.requestId,attemptCount:source.attempts}});}}else res.destroy();}
 });
 return {server,repository,async close(){await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();}};
}
if(process.env.GATEWAY_SERVER==='true'){
 const gateway=await createGatewayServer({databaseUrl:process.env.GATEWAY_DATABASE_URL||process.env.DATABASE_URL||'',token:process.env.GATEWAY_TOKEN||'',adminToken:process.env.GATEWAY_ADMIN_TOKEN||'',encryptionKey:process.env.ENCRYPTION_KEY||'',allowedHosts:(process.env.GATEWAY_ALLOWED_HOSTS||'').split(',').filter(Boolean)});
 gateway.server.listen(Number(process.env.PORT||4000),'0.0.0.0');
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{void gateway.close().then(()=>process.exit(0));});
}
