import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runAgent} from '../src/agent-container.ts';
import {SessionManager} from '@earendil-works/pi-coding-agent';
import {responseSse} from '../src/protocols.ts';
test('Agent runtime executes actual SDK request, session recording and event/result upload',async()=>{
 const root=await mkdtemp(join(tmpdir(),'specboard-agent-unit-')),cwd=join(root,'work/p/tasks/t');await mkdir(cwd,{recursive:true});await mkdir(join(root,'work/p/repository'),{recursive:true});
 const env={...process.env};const stages=['Explore'];let currentStage='Explore';let continuation=false,consumed=false;let asking=false,asked=false,ready=false,sessionPath='';let complete:any;const events:any[]=[];
 const server=createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw||'{}'),path=req.url!;res.setHeader('content-type','application/json');
 if(path.endsWith('/context'))return res.end(JSON.stringify({task:{id:'t',stage:currentStage,description:'Say hello'},project:{id:'p',name:'p'},workspace:{path:cwd},previousResults:[],...(continuation?{session:{path:sessionPath},clarification:{id:'batch',answers:{q:{text:'Use A'}}}}:{}),gatewayUrl:`http://127.0.0.1:${(server.address() as any).port}`}));
 if(path.endsWith('/commands'))return res.end('{"items":[]}');
 if(path.endsWith('/repository-credential'))return res.end('{"token":"fixture"}');
 if(path.endsWith('/events'))events.push(...body.events);
 if(path.endsWith('/session'))sessionPath=body.path;
 if(path.endsWith('/clarifications')){asked=true;return res.end(JSON.stringify({id:'batch'}));}
 if(path.endsWith('/clarification-ready'))ready=true;
 if(path.endsWith('/clarification-consumed'))consumed=true;
 if(path.endsWith('/complete'))complete=body;
 if(path==='/v1/responses'){const response={id:'r',object:'response',model:'fixture',status:'completed',output:asking?[{id:'call',type:'function_call',call_id:'call1',name:'request_clarification',arguments:JSON.stringify({questions:[{id:'q',type:'text',prompt:'Choose?',reason:'Need input',required:true}]})}]:[{id:'m',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'Hello fixture',annotations:[]}]}],usage:{input_tokens:1,output_tokens:1,total_tokens:2}};res.setHeader('content-type','text/event-stream');return res.end(responseSse(response));}
 res.end('{}');});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{process.env.API_URL=`http://127.0.0.1:${(server.address() as any).port}`;process.env.RUN_ID='r';process.env.RUN_GENERATION='1';process.env.AGENT_TOKEN='fixture';process.env.GATEWAY_TOKEN='fixture';for(const stage of stages){currentStage=stage;await runAgent({workspaces:join(root,'work'),sessions:join(root,'sessions')});assert.equal(complete.status,'completed');assert.match(complete.summary,/Hello fixture/);}assert.ok(events.length);asking=true;complete=undefined;await runAgent({workspaces:join(root,'work'),sessions:join(root,'sessions')});assert.ok(asked);assert.ok(ready);assert.ok(sessionPath);assert.equal(complete,undefined);asking=false;continuation=true;await runAgent({workspaces:join(root,'work'),sessions:join(root,'sessions')});assert.ok(consumed);assert.equal((complete as any).status,'completed');await runAgent({workspaces:join(root,'work'),sessions:join(root,'sessions')});const recorded=await readFile(sessionPath,'utf8');assert.equal(recorded.split('clarification:batch').length-1,1);const manager=SessionManager.open(sessionPath);manager.appendMessage({role:'assistant',content:[{type:'toolCall',id:'uncertain',name:'bash',arguments:{command:'unsafe'}}],api:'openai-responses',provider:'gateway',model:'agent-default',usage:{totalTokens:0,input:0,output:0,cacheRead:0,cacheWrite:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:'toolUse',timestamp:Date.now()});await assert.rejects(runAgent({workspaces:join(root,'work'),sessions:join(root,'sessions')}),/unconfirmed tool/);
 }finally{for(const key of ['API_URL','RUN_ID','RUN_GENERATION','AGENT_TOKEN','GATEWAY_TOKEN']){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];}await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
});
