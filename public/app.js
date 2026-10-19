const stages=['Explore','Propose','Apply','Archive'];
const statuses={queued:'等待执行',running:'执行中',waiting_input:'等待补充',paused:'已暂停',failed:'执行失败',completed:'已完成',stopped:'已停止',interrupted:'执行中断'};
const $=s=>document.querySelector(s);
let key,projects=[],selected,viewStage,eventSequence=0,seen=new Set(),polling=false;
const lanes=new Map();
const notice=text=>{$('#notice').textContent=text;const dialog=document.querySelector('dialog[open]');if(dialog){let status=dialog.querySelector('.dialog-notice');if(!status){status=el('p',undefined,'dialog-notice');status.setAttribute('role','status');dialog.append(status);}status.textContent=text;}};
function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
async function api(path,body){
 const headers={};
 if(body!==undefined){
  if(!key)throw new Error('请先连接工作空间');
  const raw=JSON.stringify(body),timestamp=String(Date.now()),nonce=crypto.randomUUID(),id=crypto.randomUUID();
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const signing=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=[...new Uint8Array(await crypto.subtle.sign('HMAC',signing,new TextEncoder().encode(['POST',path,timestamp,nonce,id,digest].join('\n'))))].map(x=>x.toString(16).padStart(2,'0')).join('');
  Object.assign(headers,{'content-type':'application/json','x-timestamp':timestamp,'x-nonce':nonce,'x-request-id':id,'x-signature':signature});
 }
 const response=await fetch(path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'请求失败');return data;
}
function closeDialog(button){button.closest('dialog').close();}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeDialog(b));
$('#connect').onclick=()=>$('#connect-dialog').showModal();
$('#connect-form').onsubmit=async event=>{
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('button.primary');button.disabled=true;
 try{const response=await fetch('/api/connect',{method:'POST',headers:{authorization:'Bearer '+form.elements.secret.value}});const data=await response.json();if(!response.ok)throw new Error(data.error);key=data.signingKey;form.reset();$('#connect-dialog').close();$('#connect').textContent='已连接';await refresh();notice('');}
 catch(error){form.querySelector('.form-error').textContent=error.message;}finally{button.disabled=false;}
};
async function refresh(){
 try{projects=await api('/api/projects');const data=await api('/api/board');lanes.clear();$('#board').replaceChildren();for(const stage of stages){lanes.set(stage,data[stage]);renderLane(stage);}notice('');}
 catch(error){notice(error.message);}
}
function renderLane(stage){
 const data=lanes.get(stage);let section=document.getElementById('lane-'+stage);
 if(!section){section=el('section',undefined,'lane');section.id='lane-'+stage;section.setAttribute('aria-label',stage);$('#board').append(section);}
 section.replaceChildren();const title=el('h2');title.append(el('span',undefined,'dot'),document.createTextNode(stage),el('span',String(data.items.length)+(data.hasMore?'+':''),'count'));section.append(title);
 section.ondragover=event=>{event.preventDefault();section.classList.add('drop');};section.ondragleave=()=>section.classList.remove('drop');
 section.ondrop=async event=>{event.preventDefault();section.classList.remove('drop');try{const task=JSON.parse(event.dataTransfer.getData('text/plain'));await transition(task,stage);}catch(error){notice(error.message);}};
 const cards=el('div',undefined,'cards');
 for(const task of data.items){
  const card=el('button',undefined,'card');card.draggable=true;card.ondragstart=event=>event.dataTransfer.setData('text/plain',JSON.stringify({id:task.id,stage:task.stage,version:task.version}));
  card.onclick=()=>openTask(task.id);card.append(el('p',task.project_name,'card-project'),el('p',task.description,'card-title'));
  const footer=el('div',undefined,'card-footer');footer.append(el('span',statuses[task.status]||task.status,'badge'),el('span',new Date(task.updated_at||task.stage_entered_at).toLocaleDateString()));card.append(footer);cards.append(card);
 }
 if(!data.items.length)cards.append(el('p','暂无任务','empty'));section.append(cards);
 if(data.hasMore){const load=el('button','加载更多','load');load.onclick=async()=>{load.disabled=true;try{const next=await api('/api/lane?stage='+stage+'&cursor='+encodeURIComponent(data.nextCursor));lanes.set(stage,{...next,items:[...data.items,...next.items]});renderLane(stage);}catch(error){notice(error.message);load.disabled=false;}};section.append(load);}
}
$('#refresh').onclick=refresh;
$('#projects').onclick=async()=>{try{projects=await api('/api/projects');$('#project-list').replaceChildren(...projects.map(p=>el('li',p.name+' · '+p.defaultBranch)));$('#project-dialog').showModal();}catch(error){notice(error.message);}};
$('#new-task').onclick=async()=>{try{projects=await api('/api/projects');if(!projects.length)throw new Error('请先配置一个 GitLab 项目');$('#project-select').replaceChildren(...projects.map(p=>{const option=el('option',p.name);option.value=p.id;return option;}));$('#task-dialog').showModal();}catch(error){notice(error.message);}};
for(const [id,path] of [['project-form','/api/projects'],['task-form','/api/tasks']]){
 $('#'+id).onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('.primary');button.disabled=true;try{const result=await api(path,Object.fromEntries(new FormData(form)));form.reset();form.closest('dialog').close();await refresh();if(id==='task-form')await openTask(result.id);}catch(error){form.querySelector('.form-error').textContent=error.message;}finally{button.disabled=false;}};
}
async function transition(task,target){if(stages.indexOf(target)!==stages.indexOf(task.stage)+1)throw new Error('只能转移到下一阶段');if(!confirm(`进入 ${target} 并开始该阶段执行？`))return;await api(`/api/tasks/${task.id}/commands`,{type:'transition',payload:{target,version:task.version}});notice('阶段转移已提交，请稍候查看执行结果。');}
async function openTask(id){
 try{selected=await api('/api/tasks/'+id);viewStage=selected.stage;eventSequence=0;seen.clear();$('#messages').replaceChildren();$('#detail-title').textContent=selected.description;$('#detail-project').textContent=projects.find(p=>p.id===selected.projectId)?.name||'任务详情';$('#detail-dialog').showModal();await updateDetail(true);}
 catch(error){notice(error.message);}
}
async function command(type,payload={}){if(!selected)return;await api(`/api/tasks/${selected.id}/commands`,{type,payload});}
for(const button of document.querySelectorAll('[data-control]'))button.onclick=async()=>{button.disabled=true;try{await command(button.dataset.control);await updateDetail();}catch(error){notice(error.message);}finally{button.disabled=false;}};
$('#advance').onclick=async()=>{try{await transition(selected,stages[stages.indexOf(selected.stage)+1]);}catch(error){notice(error.message);}};
$('#message-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{await command('message',{text:form.elements.text.value});form.reset();await updateDetail();}catch(error){notice(error.message);}finally{button.disabled=false;}};
function addEvent(event){
 if(seen.has(event.sequence))return;seen.add(event.sequence);
 const payload=JSON.parse(event.payload);let text='';
 if(event.type==='text_delta')text=payload.text||'';
 else if(event.type==='user_message')text=payload.text;
 else if(event.type==='result')text='阶段结果\n'+payload.text;
 else if(event.type==='error'||event.type==='command_error')text=payload.message;
 else if(event.type==='tool_execution_start')text='正在执行工具：'+payload.toolName;
 else if(event.type==='tool_execution_end')text='工具结果：'+payload.toolName+'\n'+JSON.stringify(payload.result);
 else if(event.type==='workspace')text='工作区：'+JSON.stringify(payload);
 else if(event.type==='human_control')text='人工操作：'+payload.type;
 if(!text)return;
 if(event.type==='text_delta' && $('#messages').lastElementChild?.dataset.type==='text_delta')$('#messages').lastElementChild.append(document.createTextNode(text));
  else{const block=el('div',undefined,'message '+event.type);block.dataset.type=event.type;block.append(el('small',event.type==='user_message'?'你':event.type==='text_delta'?'Agent':new Date(event.created_at).toLocaleTimeString()),document.createTextNode(text));$('#messages').append(block);}
 const messages=$('#messages');if(messages.scrollHeight-messages.scrollTop-messages.clientHeight<180)messages.scrollTop=messages.scrollHeight;
}
async function updateDetail(reset=false){
 if(!selected || !$('#detail-dialog').open)return;
 const [task,runs,proposals,events]=await Promise.all([api('/api/tasks/'+selected.id),api(`/api/tasks/${selected.id}/runs`),api(`/api/tasks/${selected.id}/proposals`),api(`/api/tasks/${selected.id}/events?after=${reset?0:eventSequence}`)]);
 selected=task;$('#detail-meta').textContent=`${task.stage} · ${statuses[task.status]||task.status} · 版本 ${task.version}`;
 $('#advance').disabled=task.stage==='Archive'||task.status==='running';
 $('#message-form').hidden=viewStage!==task.stage;
 $('#stage-tabs').replaceChildren(...stages.map(stage=>{const button=el('button',stage);button.setAttribute('role','tab');button.setAttribute('aria-selected',String(viewStage===stage));button.onclick=()=>{viewStage=stage;seen.clear();eventSequence=0;$('#messages').replaceChildren();void updateDetail(true);};return button;}));
 if(reset){seen.clear();$('#messages').replaceChildren();}
 for(const event of events){if(event.stage===viewStage)addEvent(event);eventSequence=Math.max(eventSequence,event.sequence);}
 $('#runs').replaceChildren(...runs.filter(run=>run.stage===viewStage).map(run=>{const pre=el('pre',`${statuses[run.status]||run.status}\n开始：${run.started_at?new Date(run.started_at).toLocaleString():'-'}\n结束：${run.ended_at?new Date(run.ended_at).toLocaleString():'-'}\n步骤：${run.step||'-'}\n${run.result||run.error||''}`);return pre;}));
 $('#proposal').replaceChildren(...proposals.filter(p=>p.stage===task.stage&&p.version===task.version).map(proposal=>{const button=el('button',`确认进入 ${proposal.target} 并开始执行`);button.onclick=async()=>{try{await command('confirm_transition',{proposalId:proposal.id,version:task.version});button.disabled=true;}catch(error){notice(error.message);}};return button;}));
}
setInterval(async()=>{if(polling||!selected||!$('#detail-dialog').open)return;polling=true;try{await updateDetail();}catch(error){notice(error.message);}finally{polling=false;}},1200);
$('#detail-dialog').addEventListener('close',()=>{selected=undefined;void refresh();});
await refresh();
