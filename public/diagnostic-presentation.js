export function normalizeStructuredDiagnosis(diagnostic){
 if (diagnostic?.structured && typeof diagnostic.structured === 'object') {
  const structured = diagnostic.structured;
  const analysis = typeof structured.analysis === 'string' && structured.analysis.trim()
   ? structured.analysis.trim()
   : (diagnostic.message || '任务执行受阻');

  let suggestions = [];
  if (Array.isArray(structured.suggestions)) {
   suggestions = structured.suggestions
    .map(s => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);
  }
  const rawTrace = typeof structured.rawTrace === 'string' && structured.rawTrace.trim()
   ? structured.rawTrace.trim()
   : (diagnostic.details || diagnostic.message || '');

  const fullText = `${analysis} ${diagnostic.message || ''} ${rawTrace}`;
  const isCiFailure = /cancelled|macos-13|runner|actions failed|pipeline/i.test(fullText) || diagnostic?.stage === 'MR';
  if (isCiFailure && suggestions.some(s => s.includes('tasks.md') || s.includes('产物'))) {
   suggestions = [
    '检查并更新 .github/workflows/ 中的构建矩阵与 Runner 标签（如将已淘汰的 macos-13 替换为 macos-14）。',
    '在下方“补充信息”中发送说明触发重新运行。'
   ];
  }
  if (!suggestions.length) {
   suggestions = ['查看原始技术上下文与堆栈跟踪，定位具体的执行异常点。'];
  }

  return {
   analysis,
   suggestions,
   rawTrace
  };
 }

 // Legacy structure fallback
 const analysis = (diagnostic?.message && typeof diagnostic.message === 'string' && diagnostic.message.trim())
  ? diagnostic.message.trim()
  : '任务执行受阻';

 const suggestions = [];
 const category = diagnostic?.category || '';
 const code = diagnostic?.code || '';
 const fullText = `${diagnostic?.message || ''} ${diagnostic?.details || ''} ${code}`;
 const isCiFailure = /cancelled|macos-13|runner|actions failed|pipeline/i.test(fullText) || diagnostic?.stage === 'MR';

 if (isCiFailure) {
  suggestions.push('检查并更新 .github/workflows/ 中的构建矩阵与 Runner 标签（如将下线的 macos-13 替换为 macos-14）。');
  suggestions.push('在下方“补充信息”中发送说明触发重新运行。');
 } else if (category === 'artifact_validation' || code.includes('artifact')) {
  suggestions.push('检查工作区任务产物（如 tasks.md / proposal.md / design.md），确保符合 OpenSpec 规范且无空缺或格式错误。');
  suggestions.push('根据阶段要求补充缺失的产物文件或在澄清对话中确认产物范围。');
 } else if (category === 'model_auth' || code.includes('auth') || code === '401' || code === '403') {
  suggestions.push('检查 LLM 网关 Relay 配置及 API Token 凭据是否有效且具备访问权限。');
  suggestions.push('在设置中验证模型供应商鉴权配置是否过期。');
 } else if (category === 'model_timeout' || category === 'model_rate_limit' || code.includes('timeout') || code === '429') {
  suggestions.push('检查上游大模型供应商服务状态，确认是否触发限流（Rate Limit）或响应超时。');
  suggestions.push('稍后在补充信息中发送消息重试，或在后台配置多 Relay 故障转移。');
 } else if (category === 'runtime_environment') {
  suggestions.push('检查 Agent 容器执行环境及宿主机资源（CPU/内存/磁盘空间）是否充足。');
  suggestions.push('检查工作区依赖安装与环境变量配置。');
 } else {
  suggestions.push('检查工作区与配置，定位具体的执行异常点。');
  suggestions.push('查看原始错误日志与技术上下文以获取排查线索。');
 }

 const rawTrace = (diagnostic?.details && typeof diagnostic.details === 'string' && diagnostic.details.trim())
  ? diagnostic.details.trim()
  : (diagnostic?.message && typeof diagnostic.message === 'string' ? diagnostic.message.trim() : '');

 return {
  analysis,
  suggestions,
  rawTrace
 };
}

export function filterVisibleDiagnostics(options){
 const rows=options.rows||[];
 const runs=options.runs||[];
 const selected=options.selected||{};
 const viewStage=options.viewStage;

 const latestCompletedByStage=new Map();
 for(const run of runs){
  if(run.status==='completed'){
   latestCompletedByStage.set(run.stage,Math.max(Number(latestCompletedByStage.get(run.stage)||0),Number(run.updated_at||run.created_at||0)));
  }
 }
 const isRecovering=selected.outcome_state==='recovering'||['queued','running'].includes(selected.status||'');
 const history=rows
  .filter(row=>row.stage===viewStage&&!row.resolved_by&&Number(row.created_at||row.diagnostic?.occurredAt||0)>Number(latestCompletedByStage.get(row.stage||'')||0))
  .sort((a,b)=>Number(b.created_at||b.diagnostic?.occurredAt||0)-Number(a.created_at||a.diagnostic?.occurredAt||0))
  .slice(0,1);

 const visible=history.filter(row=>{
  const d=row.diagnostic;
  if(!d)return false;
  if(d.recoverySafety==='safe_boundary'&&isRecovering)return false;
  if(['model_timeout','model_rate_limit','model_upstream','unknown'].includes(d.category||'')&&isRecovering)return false;
  return true;
 });

 const legacy=(history.length===0&&!isRecovering&&['failed','interrupted'].includes(selected.status||''))
  ?runs.filter(run=>run.stage===viewStage&&['failed','interrupted'].includes(run.status)&&Number(run.updated_at||run.created_at||0)>Number(latestCompletedByStage.get(run.stage)||0)).sort((a,b)=>Number(b.updated_at||b.created_at||0)-Number(a.updated_at||a.created_at||0)).slice(0,1)
  :[];

 return {
  showCard:visible.length>0||legacy.length>0,
  visible,
  legacy
 };
}
