import {ApiError} from './runtime-security.ts';
export type Question={id:string;type:'single_choice'|'multiple_choice'|'text'|'confirmation';prompt:string;reason:string;required:boolean;options?:{id:string;label:string;description?:string}[];recommendedOptionIds?:string[]};
export type Answer={optionIds?:string[];text?:string;confirmed?:boolean};
function invalid(message:string):never{throw new ApiError(400,'invalid_clarification',message);}
function text(value:unknown,max:number,required=true):value is string{return typeof value==='string'&&value.length<=max&&(!required||!!value.trim());}
export function validateQuestions(value:unknown):Question[]{
 if(!Array.isArray(value)||!value.length||value.length>20)invalid('Expected 1–20 questions');
 const ids=new Set<string>();
 for(const q of value){
  if(!q||!text(q.id,100)||ids.has(q.id)||!text(q.prompt,2000)||!text(q.reason,4000)||typeof q.required!=='boolean'||!['single_choice','multiple_choice','text','confirmation'].includes(q.type))invalid('Invalid or duplicate question');
  ids.add(q.id);const choice=q.type==='single_choice'||q.type==='multiple_choice';
  if(choice){if(!Array.isArray(q.options)||!q.options.length||q.options.length>20)invalid('Expected 1–20 options');const options=new Set<string>();for(const o of q.options){if(!o||!text(o.id,100)||options.has(o.id)||!text(o.label,500)||(o.description!==undefined&&!text(o.description,2000,false)))invalid('Invalid or duplicate option');options.add(o.id);}if(q.recommendedOptionIds!==undefined&&(!Array.isArray(q.recommendedOptionIds)||new Set(q.recommendedOptionIds).size!==q.recommendedOptionIds.length||q.recommendedOptionIds.some((id:unknown)=>typeof id!=='string'||!options.has(id))||(q.type==='single_choice'&&q.recommendedOptionIds.length>1)))invalid('Invalid recommendation');}
  else if(q.options!==undefined||q.recommendedOptionIds!==undefined)invalid('Options require a choice question');
 }
 return structuredClone(value);
}
export function validateAnswers(questions:Question[],value:unknown,additionalContext:unknown='',draft=false):Record<string,Answer>{
 if(!value||typeof value!=='object'||Array.isArray(value)||!text(additionalContext,20000,false))invalid('Invalid answer batch');
 const answers=value as Record<string,Answer>;
 if(Object.keys(answers).some(id=>!questions.some(q=>q.id===id)))invalid('Unknown question');
 for(const q of questions){const a=Object.hasOwn(answers,q.id)?answers[q.id]:undefined;
  if(a===undefined){if(q.required&&!draft)invalid('Required answer missing: '+q.id);continue;}
  if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['optionIds','text','confirmed'].includes(k))||(a.text!==undefined&&!text(a.text,10000,false)))invalid('Invalid answer: '+q.id);
  const choice=q.type==='single_choice'||q.type==='multiple_choice';
  if(choice){const ids=a.optionIds||[];if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!q.options?.some(o=>o.id===id))||(q.type==='single_choice'&&ids.length>1)||a.confirmed!==undefined)invalid('Invalid choice: '+q.id);if(q.required&&!draft&&!ids.length&&!a.text?.trim())invalid('Required choice missing: '+q.id);}
  else if(q.type==='text'){if(a.optionIds!==undefined||a.confirmed!==undefined||(q.required&&!draft&&!a.text?.trim()))invalid('Invalid text answer: '+q.id);}
  else if(a.optionIds!==undefined||(a.confirmed!==undefined&&typeof a.confirmed!=='boolean')||(q.required&&!draft&&typeof a.confirmed!=='boolean'))invalid('Explicit confirmation required: '+q.id);
 }
 return structuredClone(answers);
}
