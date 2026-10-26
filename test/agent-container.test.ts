import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {responseSse} from '../src/protocols.ts';
const exec=promisify(execFile);
test('Agent image includes Python, ruff and Go toolchains',{skip:process.env.TEST_AGENT_CONTAINER!=='true',timeout:30000},async()=>{const result=await exec('docker',['run','--rm','--read-only','--tmpfs','/tmp:rw,nosuid,exec,size=268435456','--user','1000:1000',process.env.TEST_AGENT_IMAGE||'specboard-agent:verify','sh','-c',`set -eu
python3 --version
ruff --version
go version
go env GOCACHE
mkdir -p /tmp/verify && cd /tmp/verify
printf 'import unittest\\n\\n\\nclass Example(unittest.TestCase):\\n    def test_ok(self):\\n        self.assertEqual(1 + 1, 2)\\n' > test_example.py
python3 -m compileall -q .
python3 -m unittest discover
ruff check --no-cache .
python3 -m venv .venv
printf 'module example.test/verify\\n\\ngo 1.26\\n' > go.mod
printf 'package verify\\nimport "testing"\\nfunc TestOK(t *testing.T) {}\\n' > verify_test.go
go test ./...
go vet ./...
gofmt -w verify_test.go`]);assert.match(result.stdout,/Python 3/);assert.match(result.stdout,/ruff/);assert.match(result.stdout,/go version/);assert.match(result.stdout,/\/tmp\/go-cache/);});
test('real Agent image loads context, persists session, calls Responses and reports completion',{skip:process.env.TEST_AGENT_CONTAINER!=='true',timeout:60000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'specboard-agent-e2e-'));await mkdir(join(root,'work/p/tasks/t'),{recursive:true});await mkdir(join(root,'work/p/repository'),{recursive:true});await exec('git',['init',join(root,'work/p/repository')]);await exec('git',['init',join(root,'work/p/tasks/t')]);await mkdir(join(root,'sessions'),{recursive:true});
 const calls:string[]=[],events:any[]=[],task={id:'t',project_id:'p',description:'Report successful fixture validation',stage:'Explore'};let completion:any;let report:any;let refuseConsumption=false;let artifactIndex=0;const artifacts=['.openspec.yaml','proposal.md','design.md','tasks.md','specs/example/spec.md'];let asking=false,ready=false,continuation=false,consumed=false,sessionPath='';
 const server=createServer(async(req,res)=>{
  const path=req.url!;calls.push(path);let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw||'{}');res.setHeader('content-type','application/json');
  if(path.endsWith('/context'))return res.end(JSON.stringify({task,project:{id:'p',name:'fixture',default_branch:'main'},workspace:{path:'/workspaces/p/tasks/t'},gatewayUrl:`http://host.docker.internal:${(server.address() as any).port}`,previousResults:[],...(continuation?{session:{path:sessionPath},clarification:{id:'batch',answers:{q:{text:'Use plan A'}}}}:{})}));
  if(path.endsWith('/repository-credential'))return res.end(JSON.stringify({token:'test-fixture'}));
  if(path.endsWith('/commands'))return res.end(JSON.stringify({items:[]}));
  if(path.endsWith('/artifact-report'))report=body;
  if(path.endsWith('/events')){events.push(...body.events);return res.end(JSON.stringify({acknowledged:events.length}));}
  if(path.endsWith('/session'))sessionPath=body.path;
  if(path.endsWith('/clarifications'))return res.end(JSON.stringify({id:'batch'}));
  if(path.endsWith('/clarification-ready'))ready=true;
  if(path.endsWith('/clarification-consumed')){if(refuseConsumption){res.statusCode=503;return res.end('{}');}consumed=true;}
  if(path.endsWith('/complete')){completion=body;return res.end('{}');}
  if(path==='/v1/responses'){
   const artifact=continuation&&artifactIndex<artifacts.length?artifacts[artifactIndex++]:null;
   const response={id:'resp_test',object:'response',model:'fixture',status:'completed',output:artifact?[{id:'write'+artifactIndex,type:'function_call',call_id:'write'+artifactIndex,name:'write',arguments:JSON.stringify({path:'openspec/changes/task-t/'+artifact,content:artifact==='tasks.md'?'- [ ] Deliver feature':'Fixture planning artifact'})}]:asking?[{id:'call',type:'function_call',call_id:'clarify',name:'request_clarification',arguments:JSON.stringify({questions:[{id:'q',type:'text',prompt:'Which approach?',reason:'Need a decision',required:true}]})}]:[{id:'msg_test',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'Fixture success.',annotations:[]}]}],usage:{input_tokens:1,output_tokens:1,total_tokens:2}};
   res.setHeader('content-type','text/event-stream');return res.end(responseSse(response));
  }
  return res.end('{}');
 });await new Promise<void>(resolve=>server.listen(0,'0.0.0.0',resolve));
 try{
  const port=(server.address() as any).port;
  const launch=()=>exec('docker',['run','--rm','--user','0','--add-host','host.docker.internal:host-gateway','-v',`${root}/work:/workspaces`,'-v',`${root}/sessions:/sessions`,'-e','AGENT_SERVER=true','-e','RUN_ID=r','-e','RUN_GENERATION=1','-e',`API_URL=http://host.docker.internal:${port}`,'-e','AGENT_TOKEN=fixture','-e','GATEWAY_TOKEN=fixture',process.env.TEST_AGENT_IMAGE||'specboard-agent:verify'],{timeout:45000});
  await launch();
  assert.equal(completion?.status,'completed',JSON.stringify(completion));assert.match(completion.summary,/Fixture success/);assert.ok(calls.some(p=>p.endsWith('/session')));assert.ok(events.length>0);task.stage='Propose';asking=true;completion=undefined;await launch();assert.ok(ready);assert.equal(completion,undefined);asking=false;continuation=true;task.stage='Propose';refuseConsumption=true;await assert.rejects(launch());assert.equal(artifactIndex,0);refuseConsumption=false;await launch();assert.ok(consumed);assert.equal(artifactIndex,artifacts.length);const transcript=await readFile(join(root,'sessions',sessionPath.replace(/^\/sessions\//,'')),'utf8');assert.equal(transcript.split('clarification:batch').length-1,1);assert.equal((completion as any)?.status,'completed');assert.ok(report.items.some((item:any)=>item.path==='proposal.md'));assert.ok(report.items.some((item:any)=>item.path==='tasks.md'));asking=false;continuation=false;completion=undefined;artifactIndex=0;await rm(join(root,'work/p/tasks/t/openspec/changes/task-t/tasks.md'));await assert.rejects(launch());assert.equal((completion as any).diagnostic.category,'artifact_validation');assert.equal(report.items.find((item:any)=>item.path==='tasks.md').status,'missing');assert.ok(report.items.find((item:any)=>item.path==='proposal.md').snapshot);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
});
