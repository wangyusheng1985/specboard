import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyStage} from '../src/stage-verification.ts';
test('stage verification requires real planning, implementation and archive artifacts',async()=>{
 const root=await mkdtemp(join(tmpdir(),'stage-verify-')),change=join(root,'openspec/changes/task-id');await mkdir(join(change,'specs'),{recursive:true});
 await assert.rejects(verifyStage(root,'Propose','id'),/artifact/);
 for(const file of ['.openspec.yaml','proposal.md','design.md','tasks.md'])await writeFile(join(change,file),file==='tasks.md'?'- [x] complete\n':'content');
 assert.equal((await verifyStage(root,'Propose','id')).verified,true);assert.equal((await verifyStage(root,'Apply','id')).verified,true);
 await rm(change,{recursive:true});await mkdir(change,{recursive:true});for(const file of ['.openspec.yaml','proposal.md','design.md','tasks.md'])await writeFile(join(change,file),file==='.openspec.yaml'?'schema: spec-driven\nskip_specs: true\n':file==='tasks.md'?'- [x] complete\n':'content');assert.equal((await verifyStage(root,'Propose','id')).verified,true);
 await rm(change,{recursive:true});await mkdir(join(root,'openspec/changes/archive/2026-task-id'),{recursive:true});assert.equal((await verifyStage(root,'Archive','id')).verified,true);await rm(root,{recursive:true,force:true});
});
