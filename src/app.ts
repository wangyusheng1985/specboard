import { createServer, type IncomingMessage } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Store, stages, type Stage } from './store.ts';
import { authenticate, acceptRequest, encrypt, decrypt } from './security.ts';
import { Workspaces } from './workspaces.ts';
import { Coordinator, piFactory, type AgentFactory } from './agent.ts';

export interface AppOptions { dataDir:string; secret:string; encryptionKey:string; workspaceRoot:string; sessionDir:string; agentDir:string; allowedHosts:string[]; factory?:AgentFactory; workspaces?:Workspaces; }
export function createApp(options:AppOptions){
 if(options.secret.length<32 || options.encryptionKey.length<32)throw new Error('Secrets must contain at least 32 characters');
 mkdirSync(options.dataDir,{recursive:true}); mkdirSync(options.workspaceRoot,{recursive:true});
 const store=new Store(join(options.dataDir,'specboard.sqlite'));
 store.addSecrets([options.secret,options.encryptionKey,process.env.PI_API_KEY||'']);
 for(const row of store.db.prepare('SELECT encrypted_token FROM projects').all())store.addSecrets([decrypt(String(row.encrypted_token),options.encryptionKey)]);
 const workspaces=options.workspaces || new Workspaces(store,options.encryptionKey,options.workspaceRoot,options.allowedHosts);
 const coordinator=new Coordinator(store,options.factory || piFactory(store,workspaces,options.sessionDir,options.agentDir),task=>workspaces.cleanup(task));
 coordinator.recover();
 const sessions=new Map<string,{key:string;expires:number}>();
 const validSecret=(value:string)=>{const a=Buffer.from(value),b=Buffer.from(options.secret);return a.length===b.length && timingSafeEqual(a,b);};
 const sessionFor=(req:IncomingMessage)=>{
  const id=req.headers.cookie?.split('; ').find(x=>x.startsWith('specboard='))?.slice(10);
  const session=id?sessions.get(id):undefined;
  if(session && session.expires>Date.now())return session;
  if(id)sessions.delete(id);
 };
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url||'/','http://localhost');
  const send=(status:number,value:unknown)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  res.setHeader('Referrer-Policy','no-referrer');
  try {
   if(req.method==='GET' && url.pathname==='/health')return send(200,{status:'ok'});
   const assets:Record<string,[string,string]>={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};
   if(req.method==='GET' && assets[url.pathname]){const [file,type]=assets[url.pathname];res.writeHead(200,{'content-type':type,'cache-control':'no-cache'});return res.end(readFileSync(new URL(`../public/${file}`,import.meta.url)));}
   if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}` && req.headers.origin!==`https://${req.headers.host}`)return send(403,{error:'Cross-origin request rejected'});
   if(req.method==='POST' && url.pathname==='/api/connect'){
    // Deployment credential bootstrap; no application mutation occurs here.
    const bearer=req.headers.authorization?.replace(/^Bearer /,'')||'';
    if(!validSecret(bearer)){audit('authentication_failed');return send(401,{error:'Authentication failed'});}
    for(const [id,value] of sessions)if(value.expires<Date.now())sessions.delete(id);
    if(sessions.size>=1000)return send(429,{error:'Too many sessions'});
    const id=randomBytes(32).toString('hex'),key=randomBytes(32).toString('hex');
    sessions.set(id,{key,expires:Date.now()+3600000});
    res.setHeader('Set-Cookie',`specboard=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600${process.env.COOKIE_SECURE==='true'?'; Secure':''}`);
    return send(200,{signingKey:key,expiresAt:Date.now()+3600000});
   }
   const session=sessionFor(req);
   const bearer=req.headers.authorization?.startsWith('Bearer ') && validSecret(req.headers.authorization.slice(7));
   if(req.method==='GET'){
    if(!session && !bearer)return send(401,{error:'Authentication failed'});
    if(url.pathname==='/api/projects')return send(200,workspaces.list());
    if(url.pathname==='/api/board')return send(200,Object.fromEntries(stages.map(stage=>[stage,store.lane(stage)])));
    if(url.pathname==='/api/lane')return send(200,store.lane(url.searchParams.get('stage') as Stage,Number(url.searchParams.get('limit')||20),url.searchParams.get('cursor')||undefined));
    const match=url.pathname.match(/^\/api\/tasks\/([\w-]+)(\/(events|runs|conversations|proposals|workspace))?$/);
    if(match){
     const task=store.task(match[1]);
     if(!match[3])return send(200,task);
     if(match[3]==='events'){
      const after=Number(url.searchParams.get('after')||0);
      if(!Number.isSafeInteger(after) || after<0)throw new Error('Invalid event cursor');
      return send(200,store.events(task.id,after));
     }
     const queries:Record<string,string>={runs:'SELECT * FROM stage_runs WHERE task_id=? ORDER BY started_at',conversations:'SELECT * FROM conversations WHERE task_id=?',proposals:'SELECT * FROM transition_proposals WHERE task_id=? AND confirmed=0',workspace:'SELECT * FROM workspaces WHERE task_id=?'};
     return send(200,store.db.prepare(queries[match[3]]).all(task.id));
    }
    return send(404,{error:'Not found'});
   }
   if(req.method!=='POST')return send(405,{error:'Method not allowed'});
   let body='';for await(const chunk of req){body+=chunk.toString();if(Buffer.byteLength(body)>65536)return send(413,{error:'Body too large'});}
   const auth=authenticate(session?.key||options.secret,req.method,url.pathname+url.search,body,req.headers,Date.now(),Number(process.env.REQUEST_WINDOW_MS||60000));
   const input=JSON.parse(body);
   if(url.pathname==='/api/projects'){
    const existing=store.db.prepare('SELECT digest,result FROM requests WHERE id=?').get(auth.id);
    if(existing){if(existing.digest!==auth.digest)throw new Error('Request ID conflict');return send(200,JSON.parse(existing.result as string));}
    await workspaces.validate(input);
    store.addSecrets([input.apiToken]);
    return send(201,acceptRequest(store,auth,()=>{
     const id=randomUUID();
     store.db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run(id,input.name,input.repositoryUrl,encrypt(input.apiToken,options.encryptionKey),input.defaultBranch,resolve(options.workspaceRoot,id));
     return workspaces.list().find(p=>p.id===id);
    }));
   }
   if(url.pathname==='/api/tasks')return send(201,acceptRequest(store,auth,()=>{
    const task=store.createTask(input.projectId,input.description);
    store.db.prepare("INSERT INTO commands VALUES(?,?,?,?,'queued',NULL)").run(auth.id,task.id,'start','{}');
    return task;
   }));
   const match=url.pathname.match(/^\/api\/tasks\/([\w-]+)\/commands$/);
   if(match){
    if(!['transition','confirm_transition','pause','resume','retry','stop','message','cleanup'].includes(input.type))throw new Error('Invalid command');
    return send(202,acceptRequest(store,auth,()=>{
     const task=store.task(match[1]);
     const payload=input.payload||{};
     if(input.type==='transition'){
      if(!stages.includes(payload.target) || stages.indexOf(payload.target)!==stages.indexOf(task.stage)+1)throw new Error('Invalid transition');
      if(payload.version!==task.version)throw new Error('Version conflict');
     }
     store.db.prepare("INSERT INTO commands VALUES(?,?,?,?,'queued',NULL)").run(auth.id,task.id,input.type,JSON.stringify(payload));
     return {id:auth.id,status:'queued'};
    }));
   }
   return send(404,{error:'Not found'});
  }catch(error){
   const message=error instanceof Error?error.message:'';
   if(/Authentication|Replay|conflict/.test(message))audit('request_rejected');
   const safe=['Authentication failed','Replay rejected','Request ID conflict','Invalid pagination','Invalid cursor','Task not found','Project not found','Description is required','Invalid transition','Version conflict','Invalid command','Project fields are required','Repository host must be configured in GITLAB_ALLOWED_HOSTS'];
   send(message==='Authentication failed'?401:400,{error:safe.includes(message)?message:'Request rejected; check configuration and input'});
  }
 });
 function audit(category:string){store.db.prepare('INSERT INTO security_events(created_at,category) VALUES(?,?)').run(Date.now(),category);}
 const tick=setInterval(()=>{void coordinator.tick();},100);tick.unref();
 const cleanup=setInterval(()=>{store.db.prepare('DELETE FROM requests WHERE created_at<?').run(Date.now()-7*86400000);},3600000);cleanup.unref();
 return {server,store,coordinator,async close(){clearInterval(tick);clearInterval(cleanup);await coordinator.close();await new Promise<void>(resolve=>server.close(()=>resolve()));store.close();}};
}
