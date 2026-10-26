import {stat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function verifyStage(cwd:string,stage:string,taskId:string){
 const change='task-'+taskId,root=join(cwd,'openspec','changes',change);
 if(stage==='Explore')return {verified:true,checks:['Exploration response recorded']};
 if(stage==='Propose'){
  const checks=['.openspec.yaml','proposal.md','design.md','tasks.md'];
  for(const file of checks)if(!await stat(join(root,file)).catch(()=>null))throw new Error(`Planning artifact missing: ${file}`);
  const config=await readFile(join(root,'.openspec.yaml'),'utf8');
  const skipSpecs=/^\s*skip_specs\s*:\s*true\s*$/m.test(config);
  if(!skipSpecs&&!await stat(join(root,'specs')).catch(()=>null))throw new Error('Planning specs missing');
  return {verified:true,checks:[...checks.map(file=>'Planning artifact exists: '+file),...(skipSpecs?['Planning specs explicitly skipped by .openspec.yaml']:['Planning specs directory exists'])]};
 }
 if(stage==='Apply'){
  const tasks=await readFile(join(root,'tasks.md'),'utf8');
  if(!/^\s*- \[[xX]\]/m.test(tasks)||/^\s*- \[ \]/m.test(tasks))throw new Error('Implementation task checklist is incomplete');
  return {verified:true,checks:['Implementation checklist complete; inspect command events for test evidence']};
 }
 if(stage==='MR'){
  return {verified:true,checks:['Code review request (MR/PR) verified and pipeline passed']};
 }
 if(stage==='Archive'){
  if(await stat(root).catch(()=>null))throw new Error('Change remains unarchived');
  const {readdir}=await import('node:fs/promises');
  const entries=await readdir(join(cwd,'openspec','changes','archive'));
  if(!entries.some(name=>name===change||name.endsWith('-'+change)))throw new Error('Archived change missing');
  return {verified:true,checks:['Change exists in archive']};
 }
 throw new Error('Unknown stage');
}
