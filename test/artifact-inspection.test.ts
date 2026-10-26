import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectPlanningArtifacts,validateArtifactReport,validatePlanningReport} from '../src/artifact-inspection.ts';
test('planning inspection retains partial bounded sanitized files and rejects links',async()=>{
 const cwd=await mkdtemp(join(tmpdir(),'inspect-'));try{const root=join(cwd,'openspec/changes/task-id');await mkdir(join(root,'specs'),{recursive:true});await writeFile(join(root,'proposal.md'),'token=private-value\n'+ 'x'.repeat(40000));await writeFile(join(root,'tasks.md'),Buffer.from([0,1,2]));await symlink('/etc/passwd',join(root,'design.md'));await symlink('/etc',join(root,'specs/escape'));
 const report=await inspectPlanningArtifacts(cwd,'id');assert.equal(report.overallStatus,'incomplete');assert.equal(report.items.find(i=>i.path==='.openspec.yaml')?.status,'missing');const proposal=report.items.find(i=>i.path==='proposal.md')!;assert.ok(proposal.truncated);assert.ok(proposal.sanitized);assert.ok(!proposal.snapshot?.includes('private-value'));assert.equal(report.items.find(i=>i.path==='tasks.md')?.reason,'Binary content withheld');assert.match(report.items.find(i=>i.path==='design.md')!.reason,/link/);assert.match(report.items.find(i=>i.path==='specs/escape')!.reason,/link/);
 assert.throws(()=>validateArtifactReport({...report,items:[{path:'../secret',status:'missing',reason:'no'}]}));assert.throws(()=>validateArtifactReport({...report,items:[{path:'tasks.md',status:'missing',reason:'no',snapshot:'x'.repeat(32769)}]}));assert.throws(()=>validateArtifactReport({...report,items:[report.items[0],report.items[0]]}));assert.throws(()=>validateArtifactReport({...report,items:Array(65).fill(report.items[0])}));assert.throws(()=>validateArtifactReport(null));
 const checked=await validatePlanningReport(cwd,'id',report);assert.equal(checked.overallStatus,'incomplete');
 const missing=await inspectPlanningArtifacts(cwd,'missing');assert.equal(missing.items.length,5);
 }finally{await rm(cwd,{recursive:true,force:true});}
});

test('OpenSpec validation never treats file presence as semantic success',async()=>{
 const cwd=await mkdtemp(join(tmpdir(),'inspect-schema-'));try{const root=join(cwd,'openspec/changes/task-id');await mkdir(join(root,'specs/example'),{recursive:true});await writeFile(join(root,'.openspec.yaml'),'schema: spec-driven\n');for(const file of ['proposal.md','design.md','tasks.md','specs/example/spec.md'])await writeFile(join(root,file),'invalid content');const report=await validatePlanningReport(cwd,'id',await inspectPlanningArtifacts(cwd,'id'));assert.notEqual(report.overallStatus,'valid');assert.ok(report.items.every(item=>item.status!=='present-and-valid'));}finally{await rm(cwd,{recursive:true,force:true});}
});
