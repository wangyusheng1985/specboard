import {createHash} from 'node:crypto';
export type ArtifactOmission={artifactId:'design';reason:string;instructionHash:string};
export function verifyOmission(input:unknown,instruction:string):ArtifactOmission{
 if(!input||typeof input!=='object')throw new Error('Invalid omission decision');
 const value=input as ArtifactOmission;
 if(value.artifactId!=='design'||typeof value.reason!=='string'||!value.reason.trim()||value.reason.length>2000||!instruction.includes('create only if'))throw new Error('Artifact is not eligible for conditional omission');
 const hash=createHash('sha256').update(instruction).digest('hex');
 if(value.instructionHash!==hash)throw new Error('Omission instruction fingerprint changed');
 return {artifactId:'design',reason:value.reason,instructionHash:hash};
}
