import {verifyOmission,type ArtifactOmission} from './artifact-omissions.ts';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {lstat,open,readdir,realpath} from 'node:fs/promises';
import {join,relative,sep} from 'node:path';
import {redactDiagnosticText} from './diagnostics.ts';
export type ArtifactItem={path:string;status:'present-and-valid'|'missing'|'invalid'|'not-applicable'|'unavailable';reason:string;snapshot?:string;truncated?:boolean;sanitized?:boolean};
export type ArtifactReport={checkedAt:number;schema:string;validator:string;overallStatus:'valid'|'incomplete'|'unavailable';items:ArtifactItem[]};
export function validateArtifactReport(value:unknown,secrets:string[]=[]):ArtifactReport{
 if(!value||typeof value!=='object')throw new Error('Invalid artifact report');const r=value as ArtifactReport;
 if(!Number.isFinite(r.checkedAt)||typeof r.schema!=='string'||r.schema.length>100||typeof r.validator!=='string'||r.validator.length>200||!['valid','incomplete','unavailable'].includes(r.overallStatus)||!Array.isArray(r.items)||r.items.length>64||Buffer.byteLength(JSON.stringify(r))>192*1024)throw new Error('Invalid artifact report');
 const paths=new Set<string>();const items=r.items.map(item=>{
  if(typeof item.path!=='string'||item.path.length>500||item.path.startsWith('/')||item.path.split(/[\\/]/).some(p=>p==='..')||paths.has(item.path)||!['present-and-valid','missing','invalid','not-applicable','unavailable'].includes(item.status)||typeof item.reason!=='string'||item.reason.length>2000||(item.snapshot!==undefined&&(typeof item.snapshot!=='string'||Buffer.byteLength(item.snapshot)>32768)))throw new Error('Invalid artifact item');paths.add(item.path);
  const snapshot=item.snapshot===undefined?undefined:redactDiagnosticText(item.snapshot,secrets);return {path:item.path,status:item.status,reason:redactDiagnosticText(item.reason,secrets),...(snapshot===undefined?{}:{snapshot,sanitized:item.sanitized===true||snapshot!==item.snapshot}),...(item.truncated?{truncated:true}:{})};
 });return {checkedAt:r.checkedAt,schema:r.schema,validator:r.validator,overallStatus:r.overallStatus,items};
}
export async function inspectPlanningArtifacts(cwd:string,taskId:string,secrets:string[]=[]):Promise<ArtifactReport>{
 const expected=join(cwd,'openspec','changes','task-'+taskId),items:ArtifactItem[]=[];
 const report=():ArtifactReport=>({checkedAt:Date.now(),schema:'unknown',validator:'bounded snapshot; semantic validation unavailable',overallStatus:'unavailable',items});
 const within=(root:string,path:string)=>{const rel=relative(root,path);return rel===''||(!rel.startsWith('..'+sep)&&rel!=='..'&&!rel.startsWith(sep));};
 let root:string;try{for(const part of ['openspec','openspec/changes','openspec/changes/task-'+taskId]){if((await lstat(join(cwd,part))).isSymbolicLink()){items.push({path:'.',status:'unavailable',reason:'Symbolic link rejected'});return report();}}const workspace=await realpath(cwd),canonicalExpected=join(workspace,'openspec','changes','task-'+taskId);root=await realpath(expected);if(!within(workspace,root)||root!==canonicalExpected){items.push({path:'.',status:'unavailable',reason:'Change root is a symbolic link or outside workspace'});return report();}}catch{for(const path of ['.openspec.yaml','proposal.md','design.md','tasks.md','specs'])items.push({path,status:'missing',reason:'Change directory missing'});return {...report(),overallStatus:'incomplete'};}
 let budget=96*1024;
 async function inspect(path:string){
  if(items.length>=64)return;
  try{const full=join(root,path);const info=await lstat(full);if(info.isSymbolicLink()||!within(root,await realpath(full))){items.push({path,status:'unavailable',reason:'Symbolic link rejected'});return;}
   if(info.isDirectory()){if(path==='specs'||path.startsWith('specs/')){const entries=await readdir(full);if(!entries.length)items.push({path,status:'missing',reason:'Specification directory is empty'});for(const name of entries.sort())if(items.length<64)await inspect(join(path,name));}else items.push({path,status:'invalid',reason:'Expected a text file'});return;}
   if(!info.isFile()){items.push({path,status:'unavailable',reason:'Not a regular file'});return;}
   const {constants}=await import('node:fs');const file=await open(full,constants.O_RDONLY|constants.O_NOFOLLOW);let bytes:Buffer;try{bytes=Buffer.alloc(Math.min(32768,budget)+1);const result=await file.read(bytes,0,bytes.length,0);bytes=bytes.subarray(0,result.bytesRead);}finally{await file.close();}
   if(bytes.includes(0)){items.push({path,status:'unavailable',reason:'Binary content withheld'});return;}
   const limit=Math.min(32768,budget),truncated=info.size>limit;const original=bytes.subarray(0,limit).toString('utf8');let snapshot=redactDiagnosticText(original,secrets);while(Buffer.byteLength(snapshot)>32768)snapshot=snapshot.slice(0,-1);budget-=Buffer.byteLength(snapshot);
   items.push({path,status:'unavailable',reason:'File exists; semantic validation has not run',snapshot,truncated,sanitized:snapshot!==original});
  }catch(error){items.push({path,status:(error as NodeJS.ErrnoException).code==='ENOENT'?'missing':'unavailable',reason:(error as NodeJS.ErrnoException).code==='ENOENT'?'File missing':'File cannot be inspected'});}
 }
 for(const path of ['.openspec.yaml','proposal.md','design.md','tasks.md','specs'])await inspect(path);
 return validateArtifactReport({...report(),overallStatus:items.some(i=>i.status==='missing'||i.status==='invalid')?'incomplete':'unavailable'},secrets);
}

export async function validatePlanningReport(cwd:string,taskId:string,report:ArtifactReport,omissions:ArtifactOmission[]=[]):Promise<ArtifactReport>{
 if(report.items.some(item=>item.reason.toLowerCase().includes('symbolic link')))return report;
 const run=promisify(execFile),command=join(process.cwd(),'node_modules/.bin/openspec'),change='task-'+taskId;
 try{
  const {stdout}=await run(command,['status','--change',change,'--json'],{cwd,timeout:15000,maxBuffer:65536,env:{...process.env,HOME:'/tmp',OPENSPEC_TELEMETRY_DISABLED:'1'}});
  const status=JSON.parse(stdout);let accepted:ArtifactOmission|undefined;if(status.schemaName==='spec-driven'&&omissions.length){const {stdout:instructions}=await run(command,['instructions','design','--change',change,'--json'],{cwd,timeout:15000,maxBuffer:65536});try{accepted=verifyOmission(omissions[0],JSON.parse(instructions).instruction);}catch{accepted=undefined;}}let semantic:boolean;try{await run(command,['validate',change,'--strict'],{cwd,timeout:15000,maxBuffer:65536});semantic=true;}catch(error){if((error as any).killed||(error as any).code==='ENOENT')return {...report,validator:'OpenSpec validation unavailable or timed out'};semantic=false;}
  const items=report.items.map(item=>{if(item.path==='design.md'&&item.status==='missing'&&accepted)return {...item,status:'not-applicable' as const,reason:'Recorded conditional omission: '+accepted.reason};const artifact=status.artifacts?.find((a:any)=>a.outputPath===item.path||(a.id==='specs'&&item.path.startsWith('specs')));if(artifact?.status==='skipped')return {...item,status:'not-applicable' as const,reason:'Skipped by change metadata and schema'};if(item.snapshot!==undefined&&!item.truncated)return {...item,status:semantic?'present-and-valid' as const:'invalid' as const,reason:semantic?'OpenSpec strict validation passed':'OpenSpec strict validation failed; inspect planning structure'};return item;});
  return {...report,schema:status.schemaName||'unknown',validator:'OpenSpec strict validation',items,overallStatus:semantic&&status.isPlanningComplete?'valid':'incomplete'};
 }catch{return {...report,validator:'OpenSpec CLI unavailable or timed out',overallStatus:report.overallStatus};}
}
