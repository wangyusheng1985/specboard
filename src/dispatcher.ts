import Docker from 'dockerode';
import {randomUUID} from 'node:crypto';

export function agentContainerConfig(job:{id:string;generation:number;projectId?:string|null;token:string},options:{image:string;apiUrl:string;network:string;workspaceVolume:string;sessionVolume:string;gatewayToken:string}){
 if(!/^[a-f0-9-]{36}$/.test(job.id)||!Number.isInteger(job.generation)||job.generation<1)throw new Error('Invalid run identity');
 return {name:`specboard-agent-${job.id}-${job.generation}`,Image:options.image,User:'1000:1000',Env:[`RUN_ID=${job.id}`,`RUN_GENERATION=${job.generation}`,`API_URL=${options.apiUrl}`,`AGENT_TOKEN=${job.token}`,`GATEWAY_TOKEN=${options.gatewayToken}`],Labels:{'specboard.managed':'true','specboard.run':job.id,'specboard.generation':String(job.generation)},HostConfig:{ReadonlyRootfs:true,Memory:2*1024**3,NanoCpus:2e9,PidsLimit:256,CapDrop:['ALL'],SecurityOpt:['no-new-privileges'],NetworkMode:options.network,Tmpfs:{'/tmp':'rw,nosuid,exec,size=268435456'},Mounts:[{Type:'volume' as const,Source:options.workspaceVolume,Target:'/workspaces'},{Type:'volume' as const,Source:options.sessionVolume,Target:'/sessions'}]}};
}
export async function startDispatcher(){
 const api=process.env.API_URL||'http://specboard:3000',token=process.env.DISPATCHER_TOKEN||'',owner=randomUUID(),docker=new Docker({socketPath:'/var/run/docker.sock'});
 const options={image:process.env.AGENT_IMAGE||'ghcr.io/wangyusheng1985/specboard-agent:latest',apiUrl:api,network:process.env.AGENT_NETWORK||'specboard_internal',workspaceVolume:process.env.WORKSPACE_VOLUME||'specboard_workspaces',sessionVolume:process.env.SESSION_VOLUME||'specboard_sessions',gatewayToken:process.env.GATEWAY_TOKEN||''};
 async function call(path:string,body:unknown){const response=await fetch(api+path,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`Dispatcher API ${response.status}`);return response.json();}
 let stopped=false;let busy=false;
 async function tick(){if(busy)return;busy=true;try{
  const {items}=await call('/internal/v1/dispatch/claim',{owner});
  for(const job of items){try{const config=agentContainerConfig(job,options);let container=docker.getContainer(config.name);try{await container.inspect();}catch{container=await docker.createContainer(config);}const state=await container.inspect();if(!state.State.Running)await container.start();await call(`/internal/v1/runs/${job.id}/container`,{generation:job.generation,containerId:container.id});}
   catch{await call(`/internal/v1/runs/${job.id}/failure`,{generation:job.generation,error:'Container launch failed'}).catch(()=>{});}}
  const response=await fetch(api+'/internal/v1/dispatch/reconcile',{headers:{authorization:`Bearer ${token}`}});
  if(response.ok){for(const run of (await response.json()).items){if(run.container_id){const container=docker.getContainer(run.container_id);await container.stop({t:5}).catch(()=>{});}await call(`/internal/v1/runs/${run.id}/failure`,{generation:run.generation,error:'Heartbeat expired'});}}
  const containers=await docker.listContainers({all:true,filters:JSON.stringify({label:['specboard.managed=true']})});
  for(const data of containers){if(data.State==='exited'){await call(`/internal/v1/runs/${data.Labels['specboard.run']}/failure`,{generation:Number(data.Labels['specboard.generation']),error:'Container exited without active lease'}).catch(()=>{});await docker.getContainer(data.Id).remove();}}
 }catch(error){console.error(error instanceof Error?error.message:'Dispatcher failed');}finally{busy=false;}}
 const timer=setInterval(()=>{if(!stopped)void tick();},1000);await tick();
 return ()=>{stopped=true;clearInterval(timer);};
}
if(process.env.DISPATCHER_SERVER==='true'){const stop=await startDispatcher();for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stop();process.exit(0);});}
