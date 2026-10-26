import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
export async function designInstructions(){
 const require=createRequire(import.meta.url),root=dirname(dirname(require.resolve('@fission-ai/openspec')));
 const yaml=require('yaml') as {parse(text:string):any};
 const schema=yaml.parse(await readFile(join(root,'schemas/spec-driven/schema.yaml'),'utf8'));
 const instruction=schema.artifacts.find((artifact:any)=>artifact.id==='design')?.instruction;
 if(typeof instruction!=='string')throw new Error('Design instructions unavailable');
 return {instruction};
}
