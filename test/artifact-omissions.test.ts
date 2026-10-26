import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyOmission} from '../src/artifact-omissions.ts';
import {designInstructions} from '../src/schema-instructions.ts';
test('conditional omission requires eligible artifact and matching authoritative instructions',async()=>{
 const {instruction}=await designInstructions(),instructionHash=createHash('sha256').update(instruction).digest('hex');const value={artifactId:'design',reason:'No cross-cutting or architectural decisions are needed',instructionHash};
 assert.equal(verifyOmission(value,instruction).artifactId,'design');
 assert.throws(()=>verifyOmission({...value,artifactId:'tasks'},instruction));
 assert.throws(()=>verifyOmission({...value,instructionHash:'0'.repeat(64)},instruction));
 assert.throws(()=>verifyOmission({...value,reason:''},instruction));
 assert.throws(()=>verifyOmission(value,'mandatory artifact'));
 assert.throws(()=>verifyOmission(null,instruction));
});
