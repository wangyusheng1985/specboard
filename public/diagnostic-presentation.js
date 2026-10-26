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
