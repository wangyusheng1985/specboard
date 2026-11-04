export function taskStatusLabel(task){
 if(task.kind==='chat'){
  if(task.status==='running'||task.status==='queued'||task.status==='claimed'||task.outcome_state==='executing'||task.outcome_state==='recovering'){
   return '正在回答';
  }
  if(task.status==='failed')return '执行失败';
  if(task.status==='interrupted')return '已中断';
  if(task.status==='stopped')return '已停止';
  if(task.status==='paused')return '已暂停';
  if(task.wait_reason==='clarification_required')return '待你澄清';
  return '就绪';
 }
 if(task.outcome_state==='clarifying'){
  if(task.stage==='Explore'&&(task.status==='waiting_input'||task.status==='completed')&&task.wait_reason!=='clarification_required'){
   return '探索完成 · 待推进';
  }
  return '待你澄清';
 }
 if(task.outcome_state==='awaiting_proposal_approval')return '方案待确认';
 if(task.outcome_state==='recovering'||task.outcome_state==='executing')return '执行中';
 if(task.outcome_state==='blocked')return '需要处理';
 if(task.outcome_state==='delivered')return '实现完成 · 待审阅';
 if(task.outcome_state==='archived')return '已归档';
 if(task.outcome_state==='paused')return '已暂停';
 if(task.outcome_state==='stopped')return '已停止';
 if(task.status==='failed'&&task.failure_category==='artifact_validation')return '规划未完成';
 if(task.status==='waiting_input')return task.wait_reason==='clarification_required'?'等待回答':'阶段完成 · 待推进';
 return ({queued:'等待执行',claimed:'等待执行',running:'执行中',paused:'已暂停',failed:'执行失败',completed:'任务已完成',stopped:'已停止',interrupted:'执行中断',awaiting_answers:'等待回答'})[task.status]||task.status;
}

export function taskStatusClass(task){
 if(task.kind==='chat'){
  if(task.status==='running'||task.status==='queued'||task.status==='claimed'||task.outcome_state==='executing'||task.outcome_state==='recovering'){
   return 'status-running';
  }
  if(task.status==='failed'||task.status==='interrupted')return 'status-failed';
  if(task.wait_reason==='clarification_required')return 'status-waiting';
  return 'status-delivered';
 }
 if(task.outcome_state==='recovering'||task.outcome_state==='executing'||task.status==='running')return 'status-running';
 if(task.outcome_state==='clarifying'){
  if(task.stage==='Explore'&&(task.status==='waiting_input'||task.status==='completed')&&task.wait_reason!=='clarification_required'){
   return 'status-delivered';
  }
  return 'status-waiting';
 }
 if(task.outcome_state==='awaiting_proposal_approval'||task.status==='awaiting_answers'||(task.status==='waiting_input'&&task.wait_reason==='clarification_required'))return 'status-waiting';
 if(task.outcome_state==='delivered')return 'status-delivered';
 if(task.outcome_state==='archived'||task.status==='completed')return 'status-completed';
 if(task.outcome_state==='blocked'||task.status==='failed'||task.status==='interrupted')return 'status-failed';
 return 'status-default';
}

