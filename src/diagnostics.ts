import {randomUUID} from 'node:crypto';
export const diagnosticCategories=['model_auth','model_timeout','model_rate_limit','model_upstream','runtime_environment','artifact_validation','interrupted','unknown'] as const;
export type DiagnosticCategory=typeof diagnosticCategories[number];
export const diagnosticSteps=['repository','session','model','tool','validation','upload','dispatch','mr'] as const;
export type DiagnosticStep=typeof diagnosticSteps[number];
export interface StructuredDiagnosis {
  analysis: string;       // LLM 提炼的根因总结
  suggestions: string[];  // 人工介入与解决建议列表 (>=1条)
  rawTrace: string;       // 原始错误上下文与堆栈
}

export type RunDiagnostic = Diagnostic;

export type Diagnostic={id:string;occurredAt:number;step:DiagnosticStep;category:DiagnosticCategory;code:string;message:string;impact:string;details:string;evidenceAvailability:'available'|'partial'|'unavailable';recoverySafety:'safe_boundary'|'manual_inspection';requestId?:string;attemptCount?:number;structured?:StructuredDiagnosis};
export function redactDiagnosticText(value:string,secrets:string[]=[]):string{
 let text=value;
 for(const secret of secrets.filter(Boolean).sort((a,b)=>b.length-a.length))text=text.split(secret).join('[REDACTED]');
 text=text.replace(/\b(authorization|private-token|cookie|set-cookie)\s*:[^\r\n]*/gi,'$1: [REDACTED]');
 text=text.replace(/\b(Bearer|Basic)\s+[^\s"',;]+/gi,'$1 [REDACTED]');
 text=text.replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi,'$1[REDACTED]@');
 text=text.replace(/([?&](?:token|api[_-]?key|secret|password)=)[^&#\s]+/gi,'$1[REDACTED]');
 text=text.replace(/(["']?(?:api[_-]?key|apiToken|access[_-]?token|token|password|secret)["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi,'$1[REDACTED]');
 return text;
}
export function classifyFailure(source:{status?:number;code?:string;category?:DiagnosticCategory}):DiagnosticCategory{
 if(source.category&&diagnosticCategories.includes(source.category))return source.category;
 if(source.status===401||source.status===403)return 'model_auth';
 if(source.status===429)return 'model_rate_limit';
 if(source.status===408||source.status===504||['ETIMEDOUT','TimeoutError'].includes(source.code||''))return 'model_timeout';
 if(source.status!==undefined&&source.status>=500)return 'model_upstream';
 return 'unknown';
}
export function createDiagnostic(input:{step:DiagnosticStep;message:string;details?:string;code?:string;status?:number;category?:DiagnosticCategory;safeBoundary?:boolean;requestId?:string;attemptCount?:number;structured?:StructuredDiagnosis},secrets:string[]=[]):Diagnostic{
 const category=classifyFailure(input);
 const clean=(text:string,max:number)=>redactDiagnosticText(text,secrets).slice(0,max);
 return {id:randomUUID(),occurredAt:Date.now(),step:input.step,category,code:clean(input.code||category,100),message:clean(input.message,2000),impact:'当前阶段未完成；已有工作区和会话保留。',details:clean(input.details||'',8000),evidenceAvailability:input.details?'partial':'unavailable',recoverySafety:input.safeBoundary?'safe_boundary':'manual_inspection',...(input.requestId?{requestId:clean(input.requestId,200)}:{}),...(Number.isInteger(input.attemptCount)&&input.attemptCount!>=0?{attemptCount:input.attemptCount}:{}),...(input.structured?{structured:{analysis:clean(input.structured.analysis,4000),suggestions:Array.isArray(input.structured.suggestions)?input.structured.suggestions.map(s=>clean(String(s),1000)).filter(Boolean):[],rawTrace:clean(input.structured.rawTrace,8000)}}:{})};
}
export function validateDiagnostic(value:unknown,secrets:string[]=[]):Diagnostic{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid diagnostic');
 const d=value as Diagnostic;
 if(!diagnosticSteps.includes(d.step)||!diagnosticCategories.includes(d.category)||typeof d.message!=='string'||d.message.length>2000||typeof d.details!=='string'||d.details.length>8000||typeof d.code!=='string'||d.code.length>100||!['safe_boundary','manual_inspection'].includes(d.recoverySafety)||!['available','partial','unavailable'].includes(d.evidenceAvailability))throw new Error('Invalid diagnostic');
 if(d.requestId!==undefined&&(typeof d.requestId!=='string'||d.requestId.length>200))throw new Error('Invalid diagnostic request id');if(d.attemptCount!==undefined&&(!Number.isInteger(d.attemptCount)||d.attemptCount<0||d.attemptCount>1000))throw new Error('Invalid diagnostic attempts');
 if(d.structured!==undefined){
  if(!d.structured||typeof d.structured!=='object'||Array.isArray(d.structured))throw new Error('Invalid diagnostic structured data');
  if(typeof d.structured.analysis!=='string'||!Array.isArray(d.structured.suggestions)||typeof d.structured.rawTrace!=='string')throw new Error('Invalid diagnostic structured fields');
 }
 const clean=createDiagnostic({...d,safeBoundary:d.recoverySafety==='safe_boundary',structured:d.structured},secrets);
 return {...clean,evidenceAvailability:d.evidenceAvailability};
}
