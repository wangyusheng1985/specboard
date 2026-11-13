import {taskStatusLabel, taskStatusClass} from './task-status.js';
import {createNotificationAdapter,createTaskObserver,notificationTarget} from './notifications.js';
import {markdown} from './markdown.js';
import {DetailRefreshState} from './detail-refresh-state.js';
import {filterVisibleDiagnostics, normalizeStructuredDiagnosis} from './diagnostic-presentation.js';
import {truncateToolOutput} from './tool-output.js';
import {mergeChatEvents} from './chat-history.js';
import {chatRoutePath, parseChatRoute} from './chat-route.js';
if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{});}
const stages=['Explore','Propose','Apply','MR','Archive'];
const uuid=()=>crypto.randomUUID?.()||([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));
const statuses={claimed:'等待执行',awaiting_answers:'等待回答',queued:'等待执行',running:'执行中',waiting_input:'等待补充',paused:'已暂停',failed:'执行失败',completed:'已完成',stopped:'已停止',interrupted:'执行中断'};
const $=s=>document.querySelector(s);
let notificationChannel;try{notificationChannel=new BroadcastChannel('specboard-notifications');}catch{/* Optional cross-tab hints. */}let notificationStorage;try{notificationStorage=localStorage;}catch{/* Storage may be blocked. */}const notifications=createNotificationAdapter(globalThis,notificationStorage,notificationChannel);const taskObserver=createTaskObserver(notifications,location.origin);const detailState=new DetailRefreshState();
let key=localStorage.getItem('specboard.apiKey')||'',projects=[],selected,viewStage,polling=false;
const lanes=new Map();

function showToast(message, type = 'info', duration = 3500) {
 if (!message) return;
 const container = $('#toast-container');
 if (!container) return;
 const toast = el('div', undefined, `toast toast-${type}`);
 const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
 iconSvg.setAttribute('class', 'toast-icon');
 iconSvg.setAttribute('viewBox', '0 0 16 16');
 iconSvg.setAttribute('fill', 'none');
 iconSvg.setAttribute('stroke', 'currentColor');
 iconSvg.setAttribute('stroke-width', '2');
 iconSvg.setAttribute('stroke-linecap', 'round');
 iconSvg.setAttribute('stroke-linejoin', 'round');
 iconSvg.setAttribute('aria-hidden', 'true');
 if (type === 'success') {
  iconSvg.innerHTML = '<path d="M3.5 8.5l3 3 6-6"></path>';
 } else if (type === 'error') {
  iconSvg.innerHTML = '<circle cx="8" cy="8" r="6"></circle><line x1="8" y1="5" x2="8" y2="8.5"></line><line x1="8" y1="11" x2="8.01" y2="11"></line>';
 } else {
  iconSvg.innerHTML = '<circle cx="8" cy="8" r="6"></circle><line x1="8" y1="7.5" x2="8" y2="11"></line><line x1="8" y1="5" x2="8.01" y2="5"></line>';
 }
 const textSpan = el('span', message, 'toast-text');
 const closeBtn = el('button', '×', 'toast-close');
 closeBtn.type = 'button';
 closeBtn.setAttribute('aria-label', '关闭通知');
 toast.append(iconSvg, textSpan, closeBtn);

 let timer;
 const startTimer = () => { timer = setTimeout(dismiss, duration); };
 const clearTimer = () => { clearTimeout(timer); };
 const dismiss = () => {
  clearTimer();
  toast.classList.add('toast-exit');
  setTimeout(() => toast.remove(), 180);
 };
 closeBtn.onclick = dismiss;
 toast.addEventListener('mouseenter', clearTimer);
 toast.addEventListener('mouseleave', startTimer);

 while (container.children.length >= 3) {
  container.firstElementChild?.remove();
 }
 container.append(toast);
 startTimer();
}

const notice = text => {
 $('#notice').textContent = text;
 const dialog = document.querySelector('dialog[open]');
 if (dialog) {
  let status = dialog.querySelector('.dialog-notice');
  if (!status) {
   status = el('p', undefined, 'dialog-notice');
   status.setAttribute('role', 'status');
   dialog.append(status);
  }
  status.textContent = text;
 }
 if (text) {
  const isSuccess = /成功|已连接|已保存|已归档|已完成|已退出/.test(text);
  const isError = /失败|错误|拒绝|失效|未完成/.test(text);
  const type = isSuccess ? 'success' : isError ? 'error' : 'info';
  showToast(text, type);
 }
};

function markFormInvalid(form, errorMsg) {
 const errorEl = form.querySelector('.form-error');
 if (errorEl) errorEl.textContent = errorMsg;
 const firstInput = form.querySelector('input:not([type=hidden]),textarea,select');
 if (firstInput) {
  firstInput.classList.remove('is-invalid');
  void firstInput.offsetWidth;
  firstInput.classList.add('is-invalid');
  firstInput.focus();
 }
 form.querySelectorAll('input,textarea,select').forEach(input => {
  input.addEventListener('input', () => {
   input.classList.remove('is-invalid');
   if (errorEl && errorEl.textContent === errorMsg) errorEl.textContent = '';
  }, {once: true});
 });
}

function setButtonLoading(button, loading, text) {
 button.disabled = loading;
 if (loading) {
  button.dataset.origText = button.textContent || '';
  const spinner = el('span', undefined, 'btn-spinner');
  button.replaceChildren(spinner, document.createTextNode(text || button.dataset.origText));
 } else {
  if (button.dataset.origText) {
   button.textContent = button.dataset.origText;
   delete button.dataset.origText;
  }
 }
}

function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
async function api(path,body,method,requestId){
 if(!key)throw new Error('请先连接工作空间');
 const headers={authorization:'Bearer '+key};
 const reqMethod = method || (body === undefined ? 'GET' : 'POST');
 if (body !== undefined || reqMethod === 'POST' || reqMethod === 'PUT' || reqMethod === 'DELETE') {
  headers['idempotency-key'] = requestId || uuid();
  if (body !== undefined) headers['content-type'] = 'application/json';
 }
 const response=await fetch(path,{method:reqMethod,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json();if(response.status===401){localStorage.removeItem('specboard.apiKey');key='';updateConnectButton(false);throw new Error('连接已失效，请重新连接');}if(!response.ok){const error=new Error(data.error?.message||data.error||'请求失败');error.code=data.error?.code;error.status=response.status;throw error;}
 return Array.isArray(data.items)&&!('hasMore' in data)?data.items:data;
}
function closeDialog(button){button.closest('dialog').close();}
function setupDrawer(dialog){
 const title=dialog.querySelector('h2');if(title){title.id||=dialog.id+'-title';dialog.setAttribute('aria-labelledby',title.id);}
 let outside=false;const hit=event=>{const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
 dialog.addEventListener('pointerdown',event=>{outside=event.target===dialog&&hit(event);});
 dialog.addEventListener('click',event=>{if(outside&&event.target===dialog&&hit(event))dialog.close();outside=false;});
}
document.querySelectorAll('dialog').forEach(setupDrawer);
let pendingConfirmation;
function openDrawer(dialog){
 if(pendingConfirmation)pendingConfirmation(false);
 document.querySelectorAll('dialog[open]').forEach(current=>{if(current!==dialog)current.close();});
 if(!dialog.open)dialog.showModal();
}
function askConfirm(title,message,action='确认操作',host){
 if(pendingConfirmation)pendingConfirmation(false);
 return new Promise(resolve=>{
  const panel=el('section',undefined,'inline-confirm');panel.setAttribute('role','region');panel.setAttribute('aria-label',title);
  panel.append(el('h3',title),el('p',message));const actions=el('div',undefined,'actions'),cancel=el('button','取消','secondary'),accept=el('button',action,'primary');cancel.type=accept.type='button';actions.append(cancel,accept);panel.append(actions);
  const dialog=host?.closest('dialog'),previous=document.activeElement;
  const finish=value=>{panel.remove();dialog?.removeEventListener('close',onClose);pendingConfirmation=undefined;if(previous?.isConnected)previous.focus({preventScroll:true});resolve(value);};
  const onClose=()=>finish(false);pendingConfirmation=finish;cancel.onclick=()=>finish(false);accept.onclick=()=>finish(true);dialog?.addEventListener('close',onClose,{once:true});
  let mountTarget=host||document.querySelector('.heading')||document.body;
  const parentLi=host?.closest('li');
  if(parentLi){
   mountTarget=parentLi;
  }
  mountTarget.after(panel);cancel.focus({preventScroll:true});panel.scrollIntoView({block:'nearest'});
 });
}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeDialog(b));
$('#connect').onclick=()=>{if(key){localStorage.removeItem('specboard.apiKey');key='';taskObserver.reset();updateConnectButton(false);notice('已退出当前工作空间');}else openDrawer($('#connect-dialog'));};
$('#connect-form').onsubmit=async event=>{
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('button.primary');setButtonLoading(button,true,'连接中…');
 try{const response=await fetch('/api/v1/connect',{method:'POST',headers:{authorization:'Bearer '+form.elements.secret.value}});const data=await response.json();if(!response.ok)throw new Error(data.error);key=form.elements.secret.value;localStorage.setItem('specboard.apiKey',key);form.reset();$('#connect-dialog').close();updateConnectButton(true);await refresh();schedulePoll();openNotificationTarget();notice('已连接到工作空间');}
 catch(error){markFormInvalid(form,error.message);}finally{setButtonLoading(button,false);}
};
async function refresh(){
 try{
  projects=await api('/api/v1/projects');
  const [data,chats]=await Promise.all([
   Promise.all(stages.map(async stage=>[stage,await api('/api/v1/lane?stage='+stage+'&limit=20')])),
   api('/api/v1/chats').catch(()=>({items:[]}))
  ]);
  const byStage=Object.fromEntries(data);
  lanes.clear();$('#board').replaceChildren();
  for(const stage of stages){lanes.set(stage,byStage[stage]);renderLane(stage);}
  observeTasks([...Object.values(byStage).flatMap(lane=>lane.items),...(chats.items||[])]);
  notice('');
 }catch(error){notice(error.message);}
}
function getStageLabel(stage,taskOrProject=null){
 if(stage!=='MR')return stage;
 if(taskOrProject){
  const url=taskOrProject.project_repository_url||taskOrProject.repositoryUrl||taskOrProject.repository_url||(projects.find(p=>p.id===taskOrProject.project_id)?.repositoryUrl)||'';
  if(url.toLowerCase().includes('github.com'))return'PR';
  if(url.toLowerCase().includes('gitlab'))return'MR';
 }
 return'MR / PR';
}

function renderLane(stage){
 const data=lanes.get(stage);let section=document.getElementById('lane-'+stage);
 if(!section){section=el('section',undefined,'lane');section.id='lane-'+stage;section.setAttribute('aria-label',stage);$('#board').append(section);}
 section.replaceChildren();const title=el('h2');
 const laneDisplayTitle=getStageLabel(stage);
 title.append(el('span',undefined,'dot'),document.createTextNode(laneDisplayTitle),el('span',String(data.items.length)+(data.hasMore?'+':''),'count'));section.append(title);
 section.ondragover=event=>{event.preventDefault();section.classList.add('drop');};section.ondragleave=()=>section.classList.remove('drop');
 section.ondrop=async event=>{event.preventDefault();section.classList.remove('drop');try{const task=JSON.parse(event.dataTransfer.getData('text/plain'));await transition(task,stage);}catch(error){notice(error.message);}};
 const cards=el('div',undefined,'cards');
 for(const task of data.items){
  const card=el('button',undefined,'card');card.dataset.taskId=task.id;card.draggable=true;
  const statusClass=taskStatusClass(task);
  if(statusClass==='status-running')card.classList.add('is-running');
  card.ondragstart=event=>{
   card.classList.add('dragging-card');
   document.body.classList.add('is-dragging');
   event.dataTransfer.setData('text/plain',JSON.stringify({id:task.id,stage:task.stage,version:task.version,description:task.description}));
  };
  card.ondragend=()=>{
   card.classList.remove('dragging-card');
   document.body.classList.remove('is-dragging');
  };
  card.onclick=()=>openTask(task.id);
  const projectP=el('p',undefined,'card-project');
  const taskRepoUrl=task.project_repository_url||(projects.find(p=>p.id===task.project_id)?.repositoryUrl)||'';
  const vcsPlatform=getVcsPlatform(taskRepoUrl);
  const isRunning=statusClass==='status-running';
  const vcsIcon=createVcsIcon(vcsPlatform,isRunning);
  vcsIcon.classList.add('card-project-icon');
  projectP.append(vcsIcon,document.createTextNode(task.project_name||'Project'));
  if(task.project_deleted_at){
   const delTag=el('span','[已删除]','project-deleted-tag');
   projectP.append(delTag);
  }
  const titleP=el('p',task.description,'card-title');
  titleP.title=task.description;
  card.append(projectP,titleP);
  const footer=el('div',undefined,'card-footer');
  const badge=el('span',undefined,'badge '+statusClass);
  if(statusClass==='status-running'||statusClass==='status-waiting'){
   badge.append(el('span',undefined,'pulse-dot'));
  }
  badge.append(document.createTextNode(taskStatusLabel(task)));
  const timeSpan=el('span',new Date(Number(task.updated_at||task.stage_entered_at)).toLocaleDateString(),'card-time');
  footer.append(badge,timeSpan);card.append(footer);cards.append(card);
 }
 if(!data.items.length)cards.append(el('p','暂无任务','empty'));section.append(cards);
 if(data.hasMore){const load=el('button','加载更多','load');load.onclick=async()=>{load.disabled=true;try{const next=await api('/api/v1/lane?stage='+stage+'&cursor='+encodeURIComponent(data.nextCursor));lanes.set(stage,{...next,items:[...data.items,...next.items]});renderLane(stage);}catch(error){notice(error.message);load.disabled=false;}};section.append(load);}
}
$('#refresh').onclick=async()=>{
 const icon=$('#refresh .refresh-icon');
 if(icon){
  icon.classList.remove('is-spinning');
  void icon.offsetWidth;
  icon.classList.add('is-spinning');
  setTimeout(()=>icon.classList.remove('is-spinning'),500);
 }
 await refresh();
};

// Trash zone setup for drag and drop task deletion
const trashZone=$('#trash-zone');
if(trashZone){
 trashZone.ondragover=event=>{event.preventDefault();trashZone.classList.add('drag-over');};
 trashZone.ondragleave=()=>trashZone.classList.remove('drag-over');
 trashZone.ondrop=async event=>{
  event.preventDefault();
  trashZone.classList.remove('drag-over');
  document.body.classList.remove('is-dragging');
  try{
   const raw=event.dataTransfer.getData('text/plain');
   if(!raw)return;
   const taskData=JSON.parse(raw);
   if(!taskData?.id)return;
   const confirmed=await askConfirm(
    '确认删除任务',
    `确认要删除任务 "${taskData.description||taskData.id}" 吗？如果任务正在运行将会被安全终止，关联的临时工作区和过程文件也将被清理。`,
    '确认删除',
    trashZone
   );
   if(!confirmed)return;
   await api(`/api/v1/tasks/${taskData.id}`,undefined,'DELETE');
   notice('任务已成功删除');
   if(selected?.id===taskData.id){
    $('#detail-dialog')?.close();
   }
   await refresh();
  }catch(error){
   notice(error.message);
  }
 };
}
function updateConnectButton(connected) {
 const btn = $('#connect');
 if (!btn) return;
 let dot = btn.querySelector('.connect-dot');
 if (!dot) {
  dot = el('span', undefined, 'connect-dot');
  btn.prepend(dot);
 }
 let label = btn.querySelector('.connect-label');
 if (!label) {
  label = el('span', undefined, 'connect-label');
  btn.append(label);
 }
 dot.classList.toggle('connected', Boolean(connected));
 label.textContent = connected ? '已连接' : '连接';
}

function updateNotificationControl(){
 const button=$('#browser-notifications'),state=notifications.permission();
 if(!button)return;
 let label=button.querySelector('.btn-label');
 if(!label){
  label=el('span',undefined,'btn-label');
  button.append(label);
 }
 label.textContent=state==='granted'&&notifications.enabled()?'停用通知':state==='denied'?'通知已阻止':state==='unsupported'?'通知不可用':'启用通知';
 button.disabled=state==='denied'||state==='unsupported';
 button.title=state==='unsupported'?'需要支持浏览器通知的安全上下文（HTTPS）':state==='denied'?'请在浏览器设置中允许通知':'仅系统通知：阶段完成、待回答、失败、停止及任务完成；页面关闭后不保证送达';
}
async function enableNotifications(){
 if(notifications.enabled()){
  notifications.disable();
  notice('已停用系统通知');
 }else{
  const result=await notifications.request();
  taskObserver.reset();
  if(result==='granted'){
   const testNotification=notifications.notifyTest(location.origin);
   notice(testNotification?'已启用浏览器通知；已请求系统发送测试通知，如未出现请检查浏览器与系统通知设置':'已启用浏览器通知，但通知请求失败，请检查浏览器通知权限');
  }else if(result==='denied'){
   notice('浏览器已阻止通知，请在浏览器或系统设置中允许通知权限');
  }else if(result==='unsupported'){
   notice('当前环境不支持通知（需 HTTPS 安全上下文）');
  }
 }
 updateNotificationControl();
}
function observeTasks(items){taskObserver.observe(items);}
async function observeVisibleLaneTasks(){
 if(!notifications.enabled())return;
 try{
  const [pages,chats]=await Promise.all([
   Promise.all(stages.map(stage=>api('/api/v1/lane?stage='+stage+'&limit=20'))),
   api('/api/v1/chats').catch(()=>({items:[]}))
  ]);
  if(key)observeTasks([...pages.flatMap(page=>page.items),...(chats.items||[])]);
 }catch{/* Notification observation must never interrupt task polling. */}
}
let locatingNotification=false;
async function openNotificationTarget(){const target=notificationTarget(location.search);if(!target||locatingNotification)return;if(!key){openDrawer($('#connect-dialog'));return;}locatingNotification=true;try{await openTask(target.task);if(selected?.id===target.task&&target.stage&&stages.indexOf(target.stage)<=stages.indexOf(selected.stage)){viewStage=target.stage;await updateDetail();}}finally{locatingNotification=false;history.replaceState(null,'',location.pathname);}}
updateNotificationControl();$('#browser-notifications').onclick=enableNotifications;globalThis.addEventListener('focus',updateNotificationControl);
function getVcsPlatform(urlStr){
 if(!urlStr)return'git';
 const low=String(urlStr).toLowerCase();
 if(low.includes('github.com'))return'github';
 if(low.includes('gitlab'))return'gitlab';
 return'git';
}

function createVcsIcon(platform,isRunning=false){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 16 16');
 svg.setAttribute('fill','none');
 svg.setAttribute('stroke','currentColor');
 svg.setAttribute('stroke-width','1.6');
 svg.setAttribute('stroke-linecap','round');
 svg.setAttribute('stroke-linejoin','round');
 svg.setAttribute('aria-hidden','true');
 svg.classList.add('vcs-icon','vcs-'+platform);
 if(isRunning)svg.classList.add('is-running-icon');

 if(platform==='github'){
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('fill','currentColor');
  svg.setAttribute('stroke','none');
  svg.innerHTML='<path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>';
  return svg;
 }
 if(platform==='gitlab'){
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('fill','none');
  svg.setAttribute('stroke','currentColor');
  svg.setAttribute('stroke-width','2');
  svg.innerHTML='<path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 5.48 2h.06a.43.43 0 0 1 .41.3l2.42 7.45h7.26l2.42-7.45a.43.43 0 0 1 .41-.3h.06a.42.42 0 0 1 .41.16l2.44 7.51 1.22 3.78a.84.84 0 0 1-.3.94z"/>';
  return svg;
 }
 svg.innerHTML='<path d="M2 3.5a1 1 0 0 1 1-1h3l1.5 2H13a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9z"></path>';
 return svg;
}

function renderProjectList(){
 const list=$('#project-list');if(!list)return;
 list.replaceChildren(...projects.map(p=>{
  const li=el('li',undefined,'project-item');
  const info=el('div',undefined,'project-info');
  const platform=getVcsPlatform(p.repositoryUrl);
  const platformName=platform==='github'?'GitHub':platform==='gitlab'?'GitLab':'Git';
  const nameRow=el('div',undefined,'project-name-row');
  nameRow.append(createVcsIcon(platform),el('strong',p.name),el('span',platformName,'project-platform-badge vcs-badge-'+platform));
  info.append(nameRow,el('small',`${p.defaultBranch} · ${p.repositoryUrl}`));
  if(p.gitUserName)info.append(el('small',`提交者: ${p.gitUserName} <${p.gitUserEmail||''}>`));
  const actions=el('div',undefined,'project-actions');
  const edit=el('button','编辑','secondary');
  edit.type='button';
  edit.onclick=()=>{
   const form=$('#project-form');
   form.elements.id.value=p.id;
   form.elements.name.value=p.name;
   form.elements.repositoryUrl.value=p.repositoryUrl;
   form.elements.defaultBranch.value=p.defaultBranch;
   form.elements.apiToken.value='';
   form.elements.apiToken.required=false;
   form.elements.gitUserName.value=p.gitUserName||'';
   form.elements.gitUserEmail.value=p.gitUserEmail||'';
   $('#project-form-eyebrow').textContent='EDIT PROJECT';
   $('#project-form-title').textContent=`编辑 ${platformName} 项目`;
   $('#project-submit').textContent='保存修改';
   form.querySelector('.form-error').textContent='';
  };
  const del=el('button','删除','secondary project-del-btn');
  del.type='button';
  del.onclick=async()=>{
   const confirmed=await askConfirm(
    '确认删除项目',
    `确认要删除项目 "${p.name}" 吗？历史关联的任务将被安全保留，但该项目将无法再创建新任务。`,
    '确认删除',
    del
   );
   if(!confirmed)return;
   del.disabled=true;
   try{
    await api(`/api/v1/projects/${p.id}`,undefined,'DELETE');
    notice('项目已删除');
    projects=await api('/api/v1/projects');
    renderProjectList();
    resetProjectForm();
    await refresh();
   }catch(error){
    notice(error.message);
   }finally{
    del.disabled=false;
   }
  };
  actions.append(edit,del);
  li.append(info,actions);
  return li;
 }));
}

function resetProjectForm(){
 const form=$('#project-form');if(!form)return;
 form.reset();
 form.elements.id.value='';
 form.elements.apiToken.required=true;
 $('#project-form-eyebrow').textContent='NEW PROJECT';
 $('#project-form-title').textContent='添加代码仓库（GitHub / GitLab）';
 $('#project-submit').textContent='验证并保存';
 form.querySelector('.form-error').textContent='';
}

$('#projects').onclick=async()=>{try{projects=await api('/api/v1/projects');renderProjectList();resetProjectForm();openDrawer($('#project-dialog'));}catch(error){notice(error.message);}};
$('#project-new-btn').onclick=resetProjectForm;
$('#project-reset').onclick=resetProjectForm;
$('#new-task').onclick=async()=>{try{projects=await api('/api/v1/projects');if(!projects.length)throw new Error('请先配置一个代码仓库（GitHub / GitLab）');$('#project-select').replaceChildren(...projects.map(p=>{const option=el('option',p.name);option.value=p.id;return option;}));openDrawer($('#task-dialog'));}catch(error){notice(error.message);}};
$('#task-form').onsubmit=async event=>{
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('.primary');setButtonLoading(button,true,'创建中…');
 try{const result=await api('/api/v1/tasks',Object.fromEntries(new FormData(form)));form.reset();form.closest('dialog').close();await refresh();await openTask(result.id);notice('任务创建成功');}
 catch(error){markFormInvalid(form,error.message);}finally{setButtonLoading(button,false);}
};
$('#project-form').onsubmit=async event=>{
 event.preventDefault();const form=event.currentTarget,button=$('#project-submit');setButtonLoading(button,true,'验证并保存中…');
 try{
  const data=Object.fromEntries(new FormData(form));
  const isEdit=Boolean(data.id);
  const path=isEdit?`/api/v1/projects/${data.id}`:'/api/v1/projects';
  const method=isEdit?'PUT':'POST';
  await api(path,data,method);
  resetProjectForm();
  projects=await api('/api/v1/projects');
  renderProjectList();
  notice(isEdit?'项目更新成功':'项目添加成功');
  await refresh();
 }catch(error){markFormInvalid(form,error.message);}finally{setButtonLoading(button,false);}
};
async function transition(task,target){if(stages.indexOf(target)!==stages.indexOf(task.stage)+1)throw new Error('只能转移到下一阶段');const host=$('#detail-advance-btn')||document.body;if(!await askConfirm(`进入 ${target}`,`确认开始 ${target} 阶段吗？任务将进入执行队列。`,'开始执行',host))return;await api(`/api/v1/tasks/${task.id}/commands`,{type:'transition',payload:{target,version:task.version}});notice('阶段转移已提交，请稍候查看执行结果。');}
async function copyToClipboard(text){
 try{
  if(navigator.clipboard&&navigator.clipboard.writeText){
   await navigator.clipboard.writeText(text);
   return true;
  }
 }catch(e){}
 try{
  const ta=document.createElement('textarea');
  ta.value=text;
  ta.style.position='fixed';
  ta.style.left='-9999px';
  ta.style.top='0';
  ta.style.opacity='0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  const ok=document.execCommand('copy');
  document.body.removeChild(ta);
  if(ok)return true;
 }catch(e){}
 return false;
}

let copyIdTimer;
function renderDetailTaskIdChip(task){
 const chip=$('#detail-task-id');if(!chip)return;
 clearTimeout(copyIdTimer);
 chip.classList.remove('copied');
 const shortId='#'+task.id.slice(0,8);
 const svgCopy='<svg class="task-id-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h2.5"/></svg>';
 const svgCheck='<svg class="task-id-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.25 4.75L6 12l-3.25-3.25"/></svg>';
 chip.innerHTML=`<span>${shortId}</span>${svgCopy}`;
 chip.title=`点击复制任务直达链接 (${shortId})`;
 chip.onclick=async()=>{
  const shareUrl=`${location.origin}/?task=${task.id}&stage=${task.stage}`;
  const success=await copyToClipboard(shareUrl);
  if(success){
   chip.classList.add('copied');
   chip.innerHTML=`<span>已复制</span>${svgCheck}`;
   notice('已复制任务直达链接到剪贴板');
   clearTimeout(copyIdTimer);
   copyIdTimer=setTimeout(()=>{
    chip.classList.remove('copied');
    chip.innerHTML=`<span>${shortId}</span>${svgCopy}`;
   },2000);
  }else{
   notice(`任务直达链接: ${shareUrl}`);
  }
 };
}

function renderDetailRepoChip(task){
 const chip=$('#detail-project');if(!chip)return;
 const projectObj=projects.find(p=>p.id===task.project_id);
 const repoUrl=task.project_repository_url||projectObj?.repositoryUrl||'';
 const platform=getVcsPlatform(repoUrl);
 const icon=createVcsIcon(platform);
 icon.classList.add('repo-chip-icon');
 const isDeleted=Boolean(task.project_deleted_at||projectObj?.deletedAt||(projectObj&&projectObj.deleted_at));
 const projectName=projectObj?.name||task.project_name||'项目';
 chip.replaceChildren(icon,document.createTextNode(projectName));
 if(isDeleted){chip.append(el('span','[已删除]','project-deleted-tag'));}
}
async function openTask(id){
 try{
  selected=await api('/api/v1/tasks/'+id);
  viewStage=selected.stage;
  commentsSignature='';
  runsSignature='';
  switchDetailTab('results');
  const titleEl=$('#detail-title');
  if(titleEl){titleEl.textContent=selected.description;titleEl.title=selected.description;}
  renderDetailTaskIdChip(selected);
  renderDetailRepoChip(selected);
  renderDetailStepper(selected);
  openDrawer($('#detail-dialog'));
  await updateDetail(true);
  schedulePoll();
 }
 catch(error){notice(error.message);}
}
async function command(type,payload={}){if(!selected)return;await api(`/api/v1/tasks/${selected.id}/commands`,{type,payload});}
$('#message-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{await command('message',{text:form.elements.text.value});form.reset();await updateDetail();}catch(error){notice(error.message);}finally{button.disabled=false;}};
function syncBoardTask(task){
 for(const [stage,data]of lanes){const index=data.items.findIndex(item=>item.id===task.id);if(index<0)continue;if(stage!==task.stage){data.items.splice(index,1);renderLane(stage);}else{data.items[index]={...data.items[index],...task};const card=[...document.querySelectorAll('.card')].find(node=>node.dataset.taskId===task.id);if(card){const statusClass=taskStatusClass(task);card.classList.toggle('is-running',statusClass==='status-running');const badge=card.querySelector('.badge');if(badge){badge.className='badge '+statusClass;badge.replaceChildren();if(statusClass==='status-running'||statusClass==='status-waiting'){badge.append(el('span',undefined,'pulse-dot'));}badge.append(document.createTextNode(taskStatusLabel(task)));}}}}
}
function setAdvanceAction(label,iconType,disabled,handler){
 const btn=$('#detail-advance-btn');if(!btn)return;
 const icon=$('#detail-advance-icon'),textEl=$('#detail-advance-label');
 if(textEl)textEl.textContent=label;btn.disabled=Boolean(disabled);btn.title=label;
 if(icon){
  let svg='<path d="M5 12h14M12 5l7 7-7 7"/>';
  if(iconType==='check')svg='<path d="M20 6L9 17l-5-5"/>';
  else if(iconType==='retry')svg='<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16M21 21v-5h-5"/>';
  else if(iconType==='stop')svg='<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/>';
  icon.innerHTML=svg;
 }
 btn.onclick=handler;
}
async function updateDetail(){
 if(!selected || !$('#detail-dialog').open)return;
 const taskId=selected.id,detailRoot=$('#detail-dialog .drawer-body'),refreshSequence=detailState.begin(taskId,detailRoot);if($('#detail-dialog .drawer-body').querySelector('[data-settings-view]'))return;
 const [task,runs,proposals,clarifications,diagnosticsData,reports,mrData,eventsData]=await Promise.all([
  api('/api/v1/tasks/'+selected.id),
  api(`/api/v1/tasks/${selected.id}/runs`),
  api(`/api/v1/tasks/${selected.id}/proposals`),
  api(`/api/v1/tasks/${selected.id}/clarifications`),
  api(`/api/v1/tasks/${selected.id}/diagnostics`),
  api(`/api/v1/tasks/${selected.id}/artifact-reports`),
  api(`/api/v1/tasks/${selected.id}/mr`).catch(()=>({mr:null})),
  api(`/api/v1/tasks/${selected.id}/events`).catch(()=>({items:[]}))
 ]);
 const diagnostics=Array.isArray(diagnosticsData)?diagnosticsData:(diagnosticsData?.items||[]);
 if(!selected||selected.id!==taskId||!$('#detail-dialog').open||!detailState.current(refreshSequence,taskId,true))return;
 if(viewStage===selected.stage&&task.stage!==selected.stage){viewStage=task.stage;}
 selected=task;syncBoardTask(task);if(selected.version!==task.version&&detailRoot.querySelector('[data-detail-input][data-detail-dirty="true"]'))notice('任务版本已变化，已保留未提交内容，请确认后再提交。');
 renderDetailRepoChip(task);
 renderDetailTaskIdChip(task);
 renderDetailStepper(task);
 renderTaskOverview(task);
 const titleEl=$('#detail-title');
 if(titleEl){titleEl.textContent=task.description;titleEl.title=task.description;}
 const statusClass=taskStatusClass(task);
 const statusLabel=taskStatusLabel(task);
 const metaBadge=$('#detail-meta');
 if(metaBadge){
  if(task.stage==='Explore'&&statusLabel==='探索完成 · 待推进'){
   metaBadge.hidden=true;
  }else{
   metaBadge.hidden=false;
   metaBadge.className='badge '+statusClass;
   metaBadge.replaceChildren();
   if(statusClass==='status-running'||statusClass==='status-waiting'){metaBadge.append(el('span',undefined,'pulse-dot'));}
   metaBadge.append(document.createTextNode(`${task.stage} · ${statusLabel}`));
  }
 }
 const deliveryRoot=$('#delivery-result');if(deliveryRoot){deliveryRoot.replaceChildren();if(task.outcome_state==='delivered'&&task.stage==='Apply'){const deliveredRun=runs.filter(run=>run.stage==='Apply'&&run.status==='completed').at(-1),evidence=deliveredRun?.validation||[];deliveryRoot.append(el('h3','实现完成，等待审阅'),el('p',`验证记录：${evidence.length} 条`));}}
 const mrRoot=$('#mr-result');if(mrRoot){mrRoot.replaceChildren();const mr=mrData?.mr;if(mr){const isGitHub=(mr.web_url&&mr.web_url.includes('github.com'))||(selected.repository_url&&selected.repository_url.includes('github.com'));const platformName=isGitHub?'GitHub':'GitLab';const prOrMr=isGitHub?'PR':'MR';const ciOrActions=isGitHub?'Actions':'CI';const card=el('article',undefined,'run-card');const titleRow=el('p',undefined,'run-meta');const linkText=isGitHub?`GitHub PR #${mr.mr_iid||''} · ${mr.title||'Pull Request'}`:`GitLab MR !${mr.mr_iid||''} · ${mr.title||'Merge Request'}`;const link=el('a',linkText);if(mr.web_url){link.href=mr.web_url;link.target='_blank';link.rel='noopener noreferrer';}titleRow.append(link);const branchRow=el('p',`${mr.source_branch} ➔ ${mr.target_branch}`,'run-meta');const pipelinePrefix=isGitHub?'Actions Workflow':'Pipeline';const pipelineText=mr.pipeline_id?`${pipelinePrefix} #${mr.pipeline_id} · ${mr.pipeline_status||'进行中'}`:`${ciOrActions}: 等待触发`;const pipelineBadge=el('span',pipelineText,'badge');card.append(el('h4',`${platformName} ${prOrMr} 与 ${ciOrActions} 状态`),titleRow,branchRow,pipelineBadge);mrRoot.append(card);}}
 const current=stages.indexOf(task.stage),active=['queued','running'].includes(task.status);
 const proposalReady=task.stage==='Propose'&&proposals.some(p=>p.stage==='Propose'&&p.version===task.version&&!p.confirmed)&&!active&&!task.wait_reason;
 const targetStageLabel=getStageLabel('MR',task);
 const applyRunning=['Apply','MR'].includes(task.stage)&&active;const stageDelivered=['Apply','MR'].includes(task.stage)&&task.outcome_state==='delivered'&&!active;const isBlocked=task.outcome_state==='blocked'&&!active;

 // 1. Header Stop button logic
 const stopBtn=$('#detail-stop-btn');
 if(stopBtn){
  const canStop=active||['queued','running','paused','interrupted'].includes(task.status)||(task.status==='waiting_input'&&task.wait_reason==='clarification_required');
  stopBtn.disabled=!canStop;
  stopBtn.onclick=async()=>{stopBtn.disabled=true;try{await command('stop');await updateDetail();}catch(error){notice(error.message);}finally{stopBtn.disabled=false;}};
 }

 // 2. Header Advance/Action button logic
 if(proposalReady){
  setAdvanceAction('确认方案并开始执行','check',false,async()=>{
   const btn=$('#detail-advance-btn');btn.disabled=true;
   try{
    const proposal=(await api(`/api/v1/tasks/${selected.id}/proposals`)).find(p=>p.stage===selected.stage&&p.version===selected.version);
    if(!proposal)throw new Error('当前方案已变化，请刷新后重新审阅');
    await api(`/api/v1/tasks/${selected.id}/approve-proposal`,{proposalId:proposal.id,validationPlan:{}});
    await updateDetail();
   }catch(error){notice(error.message);}finally{btn.disabled=false;}
  });
 }else if(applyRunning){
  setAdvanceAction('停止并归档','stop',false,async()=>{
   const btn=$('#detail-advance-btn');btn.disabled=true;
   try{await command('stop');await updateDetail();}catch(error){notice(error.message);}finally{btn.disabled=false;}
  });
 }else if(stageDelivered){
  const label=task.stage==='MR'?'确认归档':`进入 ${targetStageLabel} 阶段`;
  setAdvanceAction(label,'arrow',false,async()=>{
   const btn=$('#detail-advance-btn');
   if(task.stage==='MR'){
    if(!await askConfirm('确认归档',`确认归档已审阅的 ${targetStageLabel} 与实现结果？`,'确认归档',btn))return;
    btn.disabled=true;
    try{await api(`/api/v1/tasks/${task.id}/archive`,{});await updateDetail();}catch(error){notice(error.message);}finally{btn.disabled=false;}
   }else{try{await transition(selected,'MR');}catch(error){notice(error.message);}}
  });
 }else if(isBlocked){
  setAdvanceAction('重试当前阶段','retry',false,async()=>{
   const btn=$('#detail-advance-btn');btn.disabled=true;
   try{await api(`/api/v1/tasks/${task.id}/commands`,{type:'message',payload:{text:'恢复当前阶段执行'}});await updateDetail();}catch(error){notice(error.message);}finally{btn.disabled=false;}
  });
 }else{
  const nextLabel=current<4?`进入 ${getStageLabel(stages[current+1],task)}`:'已完成';
  const disabled=current===4||active||['failed','interrupted'].includes(task.status)||task.wait_reason==='clarification_required'||(task.stage==='Propose'&&!proposalReady);
  setAdvanceAction(nextLabel,'arrow',disabled,async()=>{try{await transition(selected,stages[stages.indexOf(selected.stage)+1]);}catch(error){notice(error.message);}});
 }

 renderClarifications(clarifications,task);
 renderDiagnostics(diagnostics,runs);
 renderArtifactReport(reports);
 renderStageArtifacts(runs);

 // Update Tab Badges
 const stageRuns=runs.filter(r=>r.stage===viewStage);
 const artifactPaths=new Set();
 for(const r of stageRuns){for(const a of (r.artifacts||[])){if(a?.path)artifactPaths.add(a.path);}}
 const badgeResults=$('#tab-badge-results');
 if(badgeResults){
  if(artifactPaths.size>0){badgeResults.textContent=String(artifactPaths.size);badgeResults.hidden=false;}
  else{badgeResults.hidden=true;}
 }
 const rawEvents=Array.isArray(eventsData)?eventsData:(eventsData?.items||[]);
 const userEvents=rawEvents.filter(e=>e.type==='user_message'&&Boolean(e.payload?.text));
 const badgeInteraction=$('#tab-badge-interaction');
 if(badgeInteraction){
  if(userEvents.length>0){badgeInteraction.textContent=String(userEvents.length);badgeInteraction.hidden=false;}
  else{badgeInteraction.hidden=true;}
 }

 const checklist=runs.filter(run=>run.stage==='Propose').reverse().flatMap(run=>(run.artifacts||[]).filter(a=>a.path==='tasks.md'&&typeof a.content==='string')).at(0);
 renderComments(eventsData,task);
 const tasksRoot=$('#propose-tasks');if(!reports.some(r=>r.stage===viewStage))tasksRoot.replaceChildren();tasksRoot.hidden=viewStage!=='Propose';if(viewStage==='Propose'&&!reports.some(r=>r.stage===viewStage)){const panel=el('details');panel.open=true;panel.append(el('summary','实施任务清单 · tasks.md'),checklist?markdown(checklist.content):el('p','暂无任务清单快照，Propose 完成后显示。','empty'));tasksRoot.append(panel);}
 renderRuns(runs,viewStage,task);
 $('#proposal').replaceChildren();
}

let commentsSignature='',runsSignature='';
function renderComments(eventsData,task){
 const commentsRoot=$('#comments-thread');if(!commentsRoot)return;
 const rawEvents=Array.isArray(eventsData)?eventsData:(eventsData?.items||[]);
 const userEvents=rawEvents.filter(e=>e.type==='user_message'&&Boolean(e.payload?.text));
 const signature=task.id+':'+userEvents.map(e=>e.id+':'+e.created_at+':'+(e.payload?.text?.length||0)).join('|');
 if(signature===commentsSignature)return;commentsSignature=signature;
 commentsRoot.replaceChildren();
 if(!userEvents.length)return;
 const threadCard=el('div',undefined,'comments-card');
 const sortedComments=[...userEvents].reverse();
 for(const ev of sortedComments){
  const text=ev.payload?.text||ev.payload?.payload?.text||'';
  if(!text)continue;
  const msgItem=el('div',undefined,'user-comment-item');
  msgItem.append(
   el('div',undefined,'comment-header'),
   markdown(text)
  );
  msgItem.querySelector('.comment-header').append(
   el('span','用户指令 · 评论','comment-author'),
   el('time',ev.created_at?new Date(Number(ev.created_at)).toLocaleString():'','comment-time')
  );
  threadCard.append(msgItem);
 }
 commentsRoot.append(threadCard);
}

let activeDetailTab='results';
function switchDetailTab(tabName){
 if(tabName==='info')tabName='overview';
 activeDetailTab=tabName;
 document.querySelectorAll('.detail-tab-btn').forEach(btn=>{
  const active=btn.dataset.tab===tabName;
  btn.classList.toggle('active',active);
  btn.setAttribute('aria-selected',String(active));
 });
 document.querySelectorAll('.detail-tab-panel').forEach(panel=>{
  const active=panel.id==='panel-'+tabName;
  panel.classList.toggle('active',active);
  panel.hidden=!active;
 });
 const body=$('#detail-dialog .drawer-body');
 if(body)body.scrollTop=0;
}
document.querySelectorAll('.detail-tab-btn').forEach(btn=>{
 btn.onclick=()=>switchDetailTab(btn.dataset.tab);
});

function renderDetailStepper(task){
 const root=$('#detail-stepper');if(!root)return;
 const currentIdx=stages.indexOf(task.stage);
 const items=stages.map((stg,idx)=>{
  const label=getStageLabel(stg,task);
  const isDone=currentIdx>idx;
  const isCurrent=currentIdx===idx;
  const step=el('div',undefined,'stepper-step'+(isCurrent?' active':isDone?' done':''));
  const dot=el('span',undefined,'stepper-dot');
  step.append(dot,el('span',label));
  return step;
 });
 root.replaceChildren();
 items.forEach((item,idx)=>{
  root.append(item);
  if(idx<items.length-1){
   root.append(el('span','➔','stepper-arrow'));
  }
 });
}

function renderTaskOverview(task){
 const root=$('#task-overview-content');if(!root)return;
 root.replaceChildren();
 const projectObj=projects.find(p=>p.id===task.project_id);
 const projectName=projectObj?.name||task.project_name||'未知项目';
 const repoUrl=task.project_repository_url||projectObj?.repositoryUrl||'-';
 const defaultBranch=projectObj?.defaultBranch||task.default_branch||'main';
 const grid=el('div',undefined,'task-overview-grid');
 
 const itemProject=el('div',undefined,'task-overview-item');
 itemProject.append(el('small','所属代码仓库'),el('strong',projectName));
 
 const itemBranch=el('div',undefined,'task-overview-item');
 itemBranch.append(el('small','目标分支 / 协议'),el('strong',defaultBranch+' · '+getVcsPlatform(repoUrl).toUpperCase()));
 
 const itemStage=el('div',undefined,'task-overview-item');
 const stageStatusText=(task.stage==='Explore'&&taskStatusLabel(task)==='探索完成 · 待推进')?task.stage:`${task.stage} · ${taskStatusLabel(task)}`;
 itemStage.append(el('small','当前阶段 · 状态'),el('strong',stageStatusText));
 
 const itemTime=el('div',undefined,'task-overview-item');
 const timeStr=task.stage_entered_at?new Date(Number(task.stage_entered_at)).toLocaleString():'-';
 itemTime.append(el('small','进入阶段时间'),el('strong',timeStr));
 
 grid.append(itemProject,itemBranch,itemStage,itemTime);
 
 const descTitle=el('p','完整需求描述与目标约束：','eyebrow');
 descTitle.style.marginBottom='8px';
 const descBox=el('div',task.description,'task-desc-box');
 root.append(grid,descTitle,descBox);
}

function renderRuns(runs,stage,task){
 const runsRoot=$('#runs');if(!runsRoot)return;
 const completedRuns=runs.filter(run=>run.stage===stage&&run.status==='completed'&&Boolean(run.summary||run.result));
 const signature=task.id+':'+stage+':'+completedRuns.map(r=>r.id+':'+r.status+':'+(r.summary?.length||0)+':'+(r.result?.length||0)+':'+(r.ended_at||r.started_at||0)).join('|');
 if(signature===runsSignature)return;runsSignature=signature;
 runsRoot.replaceChildren(...completedRuns.sort((a,b)=>Number(b.started_at||0)-Number(a.started_at||0)).map(run=>{
  const card=el('article',undefined,'run-card');
  const contentBox=el('div',undefined,'run-card-collapsible is-collapsed');
  contentBox.append(
   el('h4','阶段执行完成'),
   el('p',`开始：${run.started_at?new Date(run.started_at).toLocaleString():'-'} · 结束：${run.ended_at?new Date(run.ended_at).toLocaleString():'-'}`,'run-meta'),
   markdown(run.summary||run.result||'')
  );
  const textContent=(run.summary||run.result||'').trim();
  const lineCount=textContent.split('\n').length;
  // If content is very short (<= 4 lines and <= 180 chars), skip collapsible mask
  if(lineCount<=4&&textContent.length<=180){
   contentBox.classList.remove('is-collapsed');
   card.append(contentBox);
  }else{
   const expandBar=el('div',undefined,'card-expand-bar');
   const toggleBtn=el('button','展开详情 ↓','card-expand-toggle');
   toggleBtn.type='button';
   toggleBtn.onclick=()=>{
    const collapsed=contentBox.classList.toggle('is-collapsed');
    toggleBtn.textContent=collapsed?'展开详情 ↓':'收起 ↑';
   };
   expandBar.append(toggleBtn);
   card.append(contentBox,expandBar);
  }
  return card;
 }));
}

let pollingTimer=null,isPolling=false;
async function schedulePoll(){
 clearTimeout(pollingTimer);
 if(!key)return;
 if(isPolling)return;
 isPolling=true;
 let nextDelay=2500;
 try{
  if(selected&&$('#detail-dialog').open){
   await updateDetail();
   // The detail drawer skips the board refresh, so observe the lanes here as
   // well; otherwise browser notifications stop firing while a task is open.
   await observeVisibleLaneTasks();
   const active=['queued','running'].includes(selected.status);
   nextDelay=active?2500:8000;
  }else{
   await refresh();
   nextDelay=3000;
  }
 }catch(error){
  notice(error.message);
  nextDelay=5000;
 }finally{
  isPolling=false;
  pollingTimer=setTimeout(schedulePoll,nextDelay);
 }
}

$('#refresh').onclick=async()=>{
 const btn=$('#refresh'),icon=btn?.querySelector('.refresh-icon');
 if(icon)icon.classList.add('is-spinning');
 try{
  if(selected&&$('#detail-dialog').open)await updateDetail();
  else await refresh();
 }finally{
  if(icon)setTimeout(()=>icon.classList.remove('is-spinning'),400);
 }
};

$('#detail-dialog').addEventListener('close',()=>{
 detailState.close();
 selected=undefined;
 commentsSignature='';
 runsSignature='';
 void refresh();
 schedulePoll();
});
if(key){updateConnectButton(true);void refresh();schedulePoll();}else openDrawer($('#connect-dialog'));openNotificationTarget();
async function loadRelays(){
 const relays=await api('/api/v1/llm/relays');
 $('#relay-list').replaceChildren(...relays.map(relay=>{
  const row=el('div',undefined,'message');
  row.append(el('strong',relay.name+' · '+relay.model),el('p',`优先级 ${relay.priority} · 重试 ${relay.retries} · ${relay.enabled?'启用':'禁用'} · ${relay.protocol}`));
  const edit=el('button','编辑');edit.onclick=()=>{const form=$('#relay-form');for(const [name,value]of Object.entries(relay)){const input=form.elements.namedItem(name);if(!input)continue;if(input.type==='checkbox')input.checked=value;else input.value=value;}form.elements.token.value='';};row.append(edit);return row;
 }));
}
$('#llm-settings').onclick=async()=>{try{await loadRelays();openDrawer($('#llm-dialog'));}catch(error){notice(error.message);}};
$('#relay-reset').onclick=()=>$('#relay-form').reset();
$('#relay-form').onsubmit=async event=>{
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('.primary');setButtonLoading(button,true,'保存中…');
 try{const data=Object.fromEntries(new FormData(form));if(!data.id)delete data.id;for(const field of ['priority','retries','timeoutMs'])data[field]=Number(data[field]);data.enabled=form.elements.enabled.checked;data.allowInsecureHttp=form.elements.allowInsecureHttp.checked;
 await api('/api/v1/llm/relays',data);form.reset();await loadRelays();notice('中转配置已保存');
 }catch(error){markFormInvalid(form,error.message);}finally{setButtonLoading(button,false);}
};

let clarificationSignature='',clarificationFormCleanup=null;
function buildClarificationForm(item,onSubmitted){
 const form=el('form'),inputs=new Map();let version=item.draft_version||0,saveQueue=Promise.resolve(),submitId=uuid(),draftTimer;
 for(const q of item.questions){
  const field=el('fieldset',undefined,'question-field'),legend=el('legend',q.prompt+(q.required?' *':''));
  field.append(legend,el('p',q.reason,'question-reason'));
  const controls=[];
  if(q.options)for(const option of q.options){
   const label=el('label',undefined,'answer-option'),input=el('input');
   input.type=q.type==='multiple_choice'?'checkbox':'radio';input.name=q.id;input.value=option.id;
   input.checked=item.draft_answers?.[q.id]?.optionIds?.includes(option.id)||false;
   label.append(input,el('span',option.label+(q.recommendedOptionIds?.includes(option.id)?' · 推荐':'')));
   if(option.description)label.append(el('small',option.description));
   controls.push(input);field.append(label);
  }
  if(q.type==='confirmation')for(const [value,title]of [['true','同意方案'],['false','需要调整']]){
   const label=el('label',undefined,'answer-option'),input=el('input');
   input.type='radio';input.name=q.id;input.value=value;
   input.checked=String(item.draft_answers?.[q.id]?.confirmed)===value;
   label.append(input,el('span',title));controls.push(input);field.append(label);
  }
  const label=el('label',q.type==='text'?'你的回答':'其他方案或说明'),text=el('textarea');
  text.rows=2;text.maxLength=10000;text.value=item.draft_answers?.[q.id]?.text||'';
  label.append(text);field.append(label);inputs.set(q.id,{q,controls,text});form.append(field);
 }
 const label=el('label','额外补充'),extra=el('textarea');extra.rows=2;extra.maxLength=20000;extra.value=item.draft_context||'';
 label.append(extra);
 const status=el('span',undefined,'draft-status-pill');status.setAttribute('role','status');
 status.append(el('span',undefined,'status-dot'),document.createTextNode(''));
 const actions=el('div',undefined,'actions'),button=el('button','提交并继续','primary');
 actions.append(button);form.append(label,status,actions);
 const payload=()=>{const answers={};for(const [id,{q,controls,text}]of inputs){const answer={text:text.value};if(q.options)answer.optionIds=controls.filter(c=>c.checked).map(c=>c.value);if(q.type==='confirmation'){const checked=controls.find(c=>c.checked);if(checked)answer.confirmed=checked.value==='true';}answers[id]=answer;}return {revision:item.revision,answers,additionalContext:extra.value};};
 const save=()=>{const data={...payload(),draftVersion:version};saveQueue=saveQueue.catch(()=>{}).then(async()=>{data.draftVersion=version;const result=await api('/api/v1/clarifications/'+item.id+'/draft',data,'PUT');version=result.version;status.className='draft-status-pill saved';status.replaceChildren(el('span',undefined,'status-dot'),document.createTextNode('草稿已保存'));});saveQueue.catch(error=>{status.className='draft-status-pill';status.textContent=error.message;});};
 const valid=()=>{const {answers}=payload();return item.questions.every(q=>!q.required||(q.type==='confirmation'?typeof answers[q.id].confirmed==='boolean':q.type==='text'?!!answers[q.id].text.trim():!!answers[q.id].optionIds?.length||!!answers[q.id].text.trim()));};
 button.disabled=!valid();
 form.oninput=()=>{button.disabled=!valid();submitId=uuid();status.className='draft-status-pill';status.replaceChildren(el('span',undefined,'status-dot'),document.createTextNode('编辑中…'));clearTimeout(draftTimer);draftTimer=setTimeout(save,600);};
 form.onsubmit=async event=>{event.preventDefault();clearTimeout(draftTimer);button.disabled=true;try{await saveQueue.catch(()=>{});await api('/api/v1/clarifications/'+item.id+'/answers',payload(),'POST',submitId);await onSubmitted?.();}catch(error){status.textContent=error.message;}finally{button.disabled=!valid();}};
 return {form,cleanup:()=>clearTimeout(draftTimer)};
}
function renderClarifications(batches,task){
 const history=batches.filter(b=>b.stage===viewStage),batch=history.find(b=>b.status==='pending'),editable=viewStage===task.stage;
 const signature=task.id+':'+viewStage+':'+history.map(b=>b.id+':'+b.revision+':'+b.status).join(',');
 const clarificationCard=$('#clarification-card');
 const feedbackCard=$('#feedback-card');
 if(clarificationCard){
  clarificationCard.hidden=!batch||!editable;
 }
 if(feedbackCard){
  feedbackCard.hidden=!editable||history.some(b=>b.status==='submitted');
 }
 $('#clarification-status').textContent=batch?'等待你的回答':'';
 if(signature===clarificationSignature)return;
 clarificationSignature=signature;
 clarificationFormCleanup?.();clarificationFormCleanup=null;
 const root=$('#clarification-content');root.replaceChildren();
 if(!batch||!editable)return;
 const built=buildClarificationForm(batch,async()=>{clarificationSignature='';await updateDetail();});
 clarificationFormCleanup=built.cleanup;
 root.append(built.form);
}

function renderInlineCode(text) {
 const span = document.createElement('span');
 const parts = String(text || '').split(/(`[^`]+`)/g);
 for (const part of parts) {
  if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
   span.append(el('code', part.slice(1, -1), 'diag-inline-code'));
  } else if (part) {
   span.append(document.createTextNode(part));
  }
 }
 return span;
}

let diagnosticSignature='';
function renderDiagnostics(rows,runs){
 const signature=selected.id+':'+viewStage+':'+selected.version+':'+selected.status+':'+(selected.outcome_state||'')+':'+JSON.stringify(rows)+':'+runs.map(r=>r.id+':'+r.status).join(',');if(signature===diagnosticSignature)return;diagnosticSignature=signature;
 const root=$('#diagnostic-content'),card=$('#diagnostic-card'),cardTitle=$('#diagnostic-title');
 const {showCard,visible,legacy}=filterVisibleDiagnostics({rows,runs,selected,viewStage});
 card.hidden=!showCard;root.replaceChildren();
 if(card.hidden)return;

 for(const row of visible){
  const d=row.diagnostic;
  const structured=normalizeStructuredDiagnosis(d);
  const container=el('div',undefined,'diag-container');

  if(cardTitle){
   cardTitle.textContent=d.recoverySafety==='manual_inspection'?'执行受阻，需要人工核查':(selected.outcome_state==='blocked'?'自动恢复已暂停，需要处理':'执行受阻，需要处理');
  }

  // 第一部分：根因分析
  const secAnalysis=el('div',undefined,'diag-section diag-root-cause');
  secAnalysis.append(el('h4','受阻根因分析','diag-section-title'));
  const pCause=el('p',undefined,'diag-cause-text');
  pCause.append(renderInlineCode(structured.analysis));
  secAnalysis.append(pCause);
  container.append(secAnalysis);

  // 第二部分：建议列表
  if(structured.suggestions.length>0){
   const secSuggestions=el('div',undefined,'diag-section diag-suggestions');
   secSuggestions.append(el('h4','人工介入与解决建议','diag-section-title'));
   const ol=el('ol',undefined,'diag-suggestions-list');
   structured.suggestions.forEach((item,idx)=>{
    const li=el('li',undefined,'diag-suggestion-item');
    const badge=el('span',String(idx+1),'diag-num-badge');
    const content=el('div',undefined,'diag-suggestion-content');
    content.append(renderInlineCode(item));
    li.append(badge,content);
    ol.append(li);
   });
   secSuggestions.append(ol);
   container.append(secSuggestions);
  }

  // 第三部分：原始日志/堆栈（折叠面板 + 复制按钮）
  if(structured.rawTrace){
   const secTrace=el('div',undefined,'diag-section diag-raw-trace-section');
   const details=el('details',undefined,'diag-raw-accordion');
   const summary=el('summary',undefined,'diag-raw-summary');
   summary.append(el('span','原始技术上下文与堆栈 (Raw Trace)','diag-summary-title'));
   
   const traceContent=el('div',undefined,'diag-raw-body');
   const pre=el('pre',undefined,'diag-code-block');
   pre.append(el('code',structured.rawTrace));

   const copy=el('button',undefined,'copy-btn diag-copy-btn');
   copy.type='button';
   copy.append(el('span','📋','copy-icon'),document.createTextNode('复制原始信息'));
   copy.onclick=async(e)=>{
    e.preventDefault();
    e.stopPropagation();
    try{
     await navigator.clipboard.writeText(structured.rawTrace);
     copy.classList.add('copied');
     copy.replaceChildren(el('span','✓','copy-icon'),document.createTextNode('已复制'));
     setTimeout(()=>{
      copy.classList.remove('copied');
      copy.replaceChildren(el('span','📋','copy-icon'),document.createTextNode('复制原始信息'));
     },2000);
    }catch{
     notice('自动复制不可用，请从诊断文本区手动复制。');
    }
   };

   const traceToolbar=el('div',undefined,'diag-trace-toolbar');
   traceToolbar.append(copy);

   traceContent.append(pre,traceToolbar);
   details.append(summary,traceContent);
   secTrace.append(details);
   container.append(secTrace);
  }

  // 辅助操作与提示
  if(viewStage===selected.stage&&(d.category==='model_auth'||d.category==='model_timeout'||d.category==='model_upstream')){
   const configure=el('button','检查 LLM 配置','secondary');
   configure.style.marginTop='10px';
   configure.onclick=async()=>{try{await loadRelays();const detail=$('#detail-dialog'),body=detail.querySelector('.drawer-body'),head=detail.querySelector('.drawer-head'),settings=$('#llm-dialog'),savedScroll=body.scrollTop;const content=[...body.children].map(node=>({node,hidden:node.hidden}));content.forEach(({node})=>node.hidden=true);const panel=el('section'),back=el('button','返回任务详情');panel.dataset.settingsView='true';const settingsBody=settings.querySelector('.drawer-body'),originalParent=settingsBody.parentNode;const formState=[...settings.querySelectorAll('input,select,textarea')].map(input=>({input,value:input.value,checked:input.checked}));panel.append(back,settingsBody);body.append(panel);const restore=()=>{originalParent.append(settingsBody);formState.forEach(({input,value,checked})=>{input.value=value;input.checked=checked;});panel.remove();content.forEach(({node,hidden})=>node.hidden=hidden);head.hidden=false;body.scrollTop=savedScroll;void updateDetail();detail.removeEventListener('close',restore);};back.onclick=restore;detail.addEventListener('close',restore,{once:true});}catch(error){notice(error.message);}};
   container.append(configure);
  }

  if(viewStage===selected.stage&&!row.resolved_by&&['failed','interrupted'].includes(selected.status)){
   if(d.recoverySafety==='safe_boundary'){
    container.append(el('p','可以在下方“补充信息”中说明恢复意图，系统会保留当前工作区并重新启动本阶段。','diag-hint-text'));
   } else if(d.recoverySafety==='manual_inspection'){
    container.append(el('p','需要先核查会话和工作区，避免重复执行结果不明确的操作。','diag-hint-text'));
   }
  }

  root.append(container);
 }

 for(const run of legacy){
  const legacyBox=el('div',undefined,'diag-section diag-legacy-item');
  legacyBox.append(el('p',(run.error||'执行中断')+' · 可以在补充信息中说明意图重新启动'));
  root.append(legacyBox);
 }
}
function renderArtifactReport(rows){
 const root=$('#propose-tasks');if(viewStage!=='Propose')return;const row=rows.find(r=>r.stage==='Propose');if(!row)return;root.replaceChildren();root.append(el('p',`规划快照 · ${new Date(row.report.checkedAt).toLocaleString()} · generation ${row.generation}`,'run-meta'));const labels={'present-and-valid':'校验通过',missing:'缺失',invalid:'无效','not-applicable':'不适用',unavailable:'校验不可用'};
 for(const item of row.report.items){const details=el('details');details.open=item.status==='missing'||item.status==='invalid';details.dataset.detailState='artifact-'+item.path;details.append(el('summary',item.path+' · '+labels[item.status]),el('p',item.reason));if(item.truncated)details.append(el('p','内容已截断'));if(item.sanitized)details.append(el('p','内容已脱敏'));if(item.snapshot!==undefined)details.append(markdown(item.snapshot));root.append(details);}
}

let activePreviewBlobUrl = null;
function renderStageArtifacts(runs){
 const card=$('#artifacts-card'),gallery=$('#artifacts-gallery'),countBadge=$('#artifacts-count');
 if(!card||!gallery)return;
 // Find all artifacts for the currently viewed stage across runs
 const stageRuns=runs.filter(r=>r.stage===viewStage);
 const allArtifacts=[];
 const seenPaths=new Set();
 for(const r of stageRuns.slice().reverse()){
  for(const a of (r.artifacts||[])){
   if(a&&typeof a.path==='string'&&!seenPaths.has(a.path)){
    seenPaths.add(a.path);
    allArtifacts.push(a);
   }
  }
 }
 if(!allArtifacts.length){
  card.hidden=true;
  gallery.replaceChildren();
  if(activePreviewBlobUrl){URL.revokeObjectURL(activePreviewBlobUrl);activePreviewBlobUrl=null;}
  return;
 }
 card.hidden=false;
 if(countBadge)countBadge.textContent=`${allArtifacts.length} 个文件`;
 
 // Check if gallery already rendered same signature
 const signature=viewStage+':'+allArtifacts.map(a=>a.path+':'+(a.content?a.content.length:0)).join(',');
 if(gallery.dataset.signature===signature)return;
 gallery.dataset.signature=signature;
 gallery.replaceChildren();

 const listGrid=el('div',undefined,'artifacts-grid');

 function showPreview(item){
  const dialog=$('#artifact-preview-dialog');
  if(!dialog)return;
  if(activePreviewBlobUrl){URL.revokeObjectURL(activePreviewBlobUrl);activePreviewBlobUrl=null;}

  const ext=item.path.split('.').pop()?.toLowerCase()||'txt';
  const badge=$('#preview-dialog-badge');
  if(badge){
   badge.textContent=ext.toUpperCase();
   badge.className='artifact-ext-badge ext-'+ext;
  }
  const filename=$('#preview-dialog-filename');
  if(filename)filename.textContent=item.path;

  const copyBtn=$('#preview-dialog-copy-btn');
  if(copyBtn){
   copyBtn.onclick=async()=>{
    try{
     await navigator.clipboard.writeText(item.content||'');
     copyBtn.classList.add('copied');
     copyBtn.innerHTML='<span class="copy-icon">✓</span><span>已复制</span>';
     setTimeout(()=>{
      copyBtn.classList.remove('copied');
      copyBtn.innerHTML='<span class="copy-icon">📋</span><span>复制内容</span>';
     },2000);
    }catch{notice('复制失败，请手动选择复制。');}
   };
  }

  const externalBtn=$('#preview-dialog-external-btn');
  if(ext==='html'||ext==='htm'){
   const blob=new Blob([item.content||''],{type:'text/html;charset=utf-8'});
   activePreviewBlobUrl=URL.createObjectURL(blob);
   if(externalBtn){
    externalBtn.href=activePreviewBlobUrl;
    externalBtn.hidden=false;
   }
  }else{
   if(externalBtn)externalBtn.hidden=true;
  }

  const body=$('#preview-dialog-body');
  if(body){
   body.replaceChildren();
   if(ext==='html'||ext==='htm'){
    const iframe=document.createElement('iframe');
    iframe.className='artifact-iframe';
    iframe.sandbox='allow-scripts allow-modals allow-forms';
    iframe.src=activePreviewBlobUrl;
    body.append(iframe);
   }else if(ext==='md'||ext==='markdown'){
    const mdBox=el('div',undefined,'artifact-md-box');
    mdBox.append(markdown(item.content||''));
    body.append(mdBox);
   }else{
    const pre=document.createElement('pre');
    pre.className='artifact-code-pre';
    const code=document.createElement('code');
    code.textContent=item.content||'';
    pre.append(code);
    body.append(pre);
   }
  }

  if(typeof dialog.showModal==='function')dialog.showModal();
  else dialog.setAttribute('open','');
 }

 $('#preview-dialog-close-btn').onclick=()=>{
  const dialog=$('#artifact-preview-dialog');
  if(dialog){
   if(typeof dialog.close==='function')dialog.close();
   else dialog.removeAttribute('open');
  }
  if(activePreviewBlobUrl){URL.revokeObjectURL(activePreviewBlobUrl);activePreviewBlobUrl=null;}
 };
 $('#artifact-preview-dialog')?.addEventListener('close',()=>{
  if(activePreviewBlobUrl){URL.revokeObjectURL(activePreviewBlobUrl);activePreviewBlobUrl=null;}
 });

 for(const item of allArtifacts){
  const ext=item.path.split('.').pop()?.toLowerCase()||'txt';
  const sizeKb=Math.max(1,Math.round((item.content?item.content.length:0)/1024));
  const cardItem=el('div',undefined,'artifact-card');
  const info=el('div',undefined,'artifact-card-info');
  const badge=el('span',ext.toUpperCase(),'artifact-ext-badge ext-'+ext);
  const name=el('span',item.path,'artifact-name');
  const size=el('small',`${sizeKb} KB`,'artifact-size');
  info.append(badge,name,size);

  const previewBtn=el('button','预览','secondary artifact-btn');
  previewBtn.type='button';
  previewBtn.onclick=()=>{
   listGrid.querySelectorAll('.artifact-card').forEach(c=>c.classList.remove('active-preview'));
   cardItem.classList.add('active-preview');
   showPreview(item);
  };

  cardItem.append(info,previewBtn);
  listGrid.append(cardItem);
 }

 gallery.append(listGrid);
}

// ---------------------------------------------------------------------------
// Dual Mode & Chat Mode Management
// ---------------------------------------------------------------------------
let currentMode = localStorage.getItem('specboard.currentMode') || 'work';
let chatConversations = [];
let activeChatId = null;
let chatEventTimer = null;
let chatEventSource = null;
let chatMaxSequence = 0;
let chatLoadedEvents = [];
let chatHistoryHasMore = false;
let chatHistoryLoading = false;
let chatHistoryUserInteracted = false;
let activeChatTask = null;
let chatSelectionGeneration = 0;
let chatSelectionPending = false;
let appModeInitialized = false;
let routeInitialized = false;
let routeApplying = false;
let chatClarificationSignature = '';
let chatClarificationFormCleanup = null;
let activeChatClarification = null;
let chatComposerLocked = false;

function setChatComposerLocked(locked, message) {
 const input = $('#chat-input');
 const button = $('#chat-send-btn');
 const box = $('.chat-composer-box');
 if (!input || !button) {
  chatComposerLocked = locked;
  return;
 }
 if (!input.dataset.normalPlaceholder) input.dataset.normalPlaceholder = input.placeholder;
 if (locked) {
  chatComposerLocked = true;
  input.disabled = true;
  input.placeholder = message || '请先完成澄清确认…';
  button.disabled = true;
  box?.classList.add('is-locked');
  return;
 }
 const wasLocked = chatComposerLocked;
 chatComposerLocked = false;
 input.disabled = false;
 input.placeholder = input.dataset.normalPlaceholder || input.placeholder;
 if (wasLocked) button.disabled = false;
 box?.classList.remove('is-locked');
}

function scrollChatToBottom() {
 const box = $('#chat-scroll-container');
 if (!box) return;
 const apply = () => { box.scrollTop = box.scrollHeight; };
 apply();
 requestAnimationFrame(apply);
}

function focusChatClarification() {
 const card = $('#chat-clarification-card');
 if (!card || card.hidden) return;
 card.classList.remove('is-attention');
 void card.offsetWidth;
 card.classList.add('is-attention');
 card.scrollIntoView({block: 'nearest', behavior: 'smooth'});
 const target = card.querySelector('textarea') || card.querySelector('input') || card.querySelector('button.primary');
 target?.focus({preventScroll: true});
}

function resetChatClarification() {
 chatClarificationFormCleanup?.();
 chatClarificationFormCleanup = null;
 chatClarificationSignature = '';
 activeChatClarification = null;
 const card = $('#chat-clarification-card');
 if (card) card.hidden = true;
 const root = $('#chat-clarification-content');
 if (root) root.replaceChildren();
 const status = $('#chat-clarification-status');
 if (status) status.textContent = '';
 setChatComposerLocked(false);
}

function renderChatHistoryBar() {
 const active = Boolean(activeChatId) && currentMode === 'chat';
 const visible = active && (chatHistoryHasMore || chatHistoryLoading);
 const bar = $('#chat-history-bar');
 const load = $('#chat-history-load');
 const status = $('#chat-history-status');
 const header = $('#chat-history-btn');
 if (bar) bar.hidden = !visible;
 if (header) {
  header.hidden = !visible;
  header.disabled = chatHistoryLoading;
  header.title = chatHistoryLoading ? '正在加载历史…' : '查看更早的消息';
 }
 if (load) {
  load.disabled = chatHistoryLoading;
  load.textContent = chatHistoryLoading ? '正在加载历史…' : '查看更早的消息';
 }
 if (status) status.textContent = chatHistoryLoading ? '请稍候…' : '';
}

function resetChatHistory() {
 chatLoadedEvents = [];
 chatMaxSequence = 0;
 chatHistoryHasMore = false;
 chatHistoryLoading = false;
 chatHistoryUserInteracted = false;
 activeChatTask = null;
 renderChatHistoryBar();
}

async function loadChatHistory({jumpToTop = false} = {}) {
 if (!activeChatId || chatHistoryLoading || !chatHistoryHasMore) return;
 const chatId = activeChatId;
 const before = chatLoadedEvents[0]?.sequence;
 if (!before) return;
 chatHistoryLoading = true;
 renderChatHistoryBar();
 const scrollBox = $('#chat-scroll-container');
 try {
  const response = await api(`/api/v1/tasks/${chatId}/events?before=${before}&limit=200`);
  if (activeChatId !== chatId) return;
  const page = Array.isArray(response) ? {items: response, hasMore: false} : (response || {});
  chatLoadedEvents = mergeChatEvents(chatLoadedEvents, page.items || []);
  chatHistoryHasMore = Boolean(page.hasMore);
  lastRenderedDigest = '';
  const previousTop = scrollBox?.scrollTop || 0;
  const previousHeight = scrollBox?.scrollHeight || 0;
  renderChatMessages(chatLoadedEvents, activeChatTask || {});
  if (scrollBox) {
   if (jumpToTop) scrollBox.scrollTop = 0;
   else scrollBox.scrollTop = previousTop + Math.max(0, scrollBox.scrollHeight - previousHeight);
  }
 } catch (error) {
  notice(error.message || '加载历史失败');
 } finally {
  if (activeChatId === chatId) {
   chatHistoryLoading = false;
   renderChatHistoryBar();
  }
 }
}

function bindChatHistoryInteractions() {
 const scrollBox = $('#chat-scroll-container');
 $('#chat-history-load')?.addEventListener('click', () => {
  chatHistoryUserInteracted = true;
  void loadChatHistory({jumpToTop: true});
 });
 $('#chat-history-btn')?.addEventListener('click', () => {
  chatHistoryUserInteracted = true;
  void loadChatHistory({jumpToTop: true});
 });
 if (!scrollBox) return;
 const armOnly = () => { chatHistoryUserInteracted = true; };
 const armAndLoad = () => {
  chatHistoryUserInteracted = true;
  if (scrollBox.scrollTop <= 80) void loadChatHistory();
 };
 scrollBox.addEventListener('wheel', armAndLoad, {passive: true});
 scrollBox.addEventListener('touchmove', armAndLoad, {passive: true});
 scrollBox.addEventListener('pointerdown', armOnly);
 scrollBox.addEventListener('scroll', () => {
  if (!chatHistoryUserInteracted) return;
  if (scrollBox.scrollTop <= 80) void loadChatHistory();
 }, {passive: true});
}

function renderChatClarification(batches, chat) {
 const card = $('#chat-clarification-card');
 const root = $('#chat-clarification-content');
 const status = $('#chat-clarification-status');
 if (!card || !root) return 'none';
 const list = Array.isArray(batches) ? batches : (batches?.items || []);
 const relevant = list.filter(b => b.stage === chat.stage && ['pending', 'submitted'].includes(b.status));
 const batch = relevant.length ? relevant[relevant.length - 1] : null;
 activeChatClarification = batch;

 if (batch?.status === 'pending') {
  setChatComposerLocked(true, '请先回答上方的澄清问题，提交后会自动继续…');
 } else if (batch?.status === 'submitted') {
  setChatComposerLocked(true, '澄清答案已提交，正在继续执行…');
 } else {
  setChatComposerLocked(false);
 }

 const signature = `${chat.id}:${chat.stage}:${batch ? `${batch.id}:${batch.revision}:${batch.status}` : 'none'}`;
 if (signature === chatClarificationSignature) return signature;
 chatClarificationSignature = signature;
 chatClarificationFormCleanup?.();
 chatClarificationFormCleanup = null;
 root.replaceChildren();
 card.hidden = !batch;
 if (status) status.textContent = '';
 if (!batch) return signature;

 if (status) status.textContent = batch.status === 'pending' ? '等待你的回答' : '已提交，继续执行中';
 if (batch.status === 'submitted') {
  root.append(el('p', '澄清答案已提交，系统已启动新的执行轮次，完成后会在这里继续。', 'chat-clarification-note'));
  return signature;
 }

 const built = buildClarificationForm(batch, async () => {
  chatClarificationSignature = '';
  setChatComposerLocked(true, '澄清答案已提交，正在继续执行…');
  await refreshActiveChat(true).catch(error => notice(error.message || '会话刷新失败'));
 });
 chatClarificationFormCleanup = built.cleanup;
 root.append(built.form);
 requestAnimationFrame(() => card.scrollIntoView({block: 'nearest', behavior: 'smooth'}));
 return signature;
}

function setRoute(path, {replace = false} = {}) {
 const hash = `#${path}`;
 if (location.hash === hash) {
  routeInitialized = true;
  return;
 }
 if (replace || !routeInitialized) history.replaceState(null, '', hash);
 else location.hash = hash;
 routeInitialized = true;
}

function parseRoute() {
 return parseChatRoute(location.hash);
}

async function applyRoute() {
 if (routeApplying) return;
 routeApplying = true;
 try {
  const route = parseRoute();
  if (!route) {
   if (currentMode === 'chat') {
    if (!appModeInitialized) await switchMode('chat');
    else setRoute(activeChatId ? chatRoutePath(activeChatId) : '/chat', {replace: true});
   } else if (!appModeInitialized) {
    await switchMode('work');
   } else {
    setRoute('/work', {replace: true});
   }
   return;
  }
  if (route.mode === 'work') {
   if (!appModeInitialized || currentMode !== 'work') await switchMode('work');
   else setRoute('/work', {replace: true});
   return;
  }
  if (!appModeInitialized || currentMode !== 'chat') {
   await switchMode('chat', {chatId: route.chatId});
  } else if (route.chatId) {
   if (activeChatId !== route.chatId) await selectChat(route.chatId);
  } else if (activeChatId) {
   resetNewChat();
  }
 } finally {
  routeApplying = false;
 }
}

async function switchMode(mode, {chatId} = {}) {
 const wasChat = currentMode === 'chat' && appModeInitialized;
 if (mode === 'chat' && wasChat && chatId === undefined) {
  setRoute(activeChatId ? chatRoutePath(activeChatId) : '/chat');
  return;
 }
 currentMode = mode;
 localStorage.setItem('specboard.currentMode', mode);
 appModeInitialized = true;
 const workBtn = $('#mode-btn-work');
 const chatBtn = $('#mode-btn-chat');
 const workView = $('#work-view');
 const chatView = $('#chat-view');

 if (mode === 'chat') {
  workBtn?.classList.remove('active');
  workBtn?.setAttribute('aria-checked', 'false');
  chatBtn?.classList.add('active');
  chatBtn?.setAttribute('aria-checked', 'true');
  if (workView) workView.hidden = true;
  if (chatView) chatView.hidden = false;
  await initChatMode(chatId);
 } else {
  chatBtn?.classList.remove('active');
  chatBtn?.setAttribute('aria-checked', 'false');
  workBtn?.classList.add('active');
  workBtn?.setAttribute('aria-checked', 'true');
  if (chatView) chatView.hidden = true;
  if (workView) workView.hidden = false;
  chatSelectionGeneration += 1;
  chatSelectionPending = false;
  if (chatEventTimer) {
   clearInterval(chatEventTimer);
   chatEventTimer = null;
  }
  setRoute('/work');
  refresh();
 }
}

$('#mode-btn-work')?.addEventListener('click', () => void switchMode('work'));
$('#mode-btn-chat')?.addEventListener('click', () => void switchMode('chat'));
window.addEventListener('hashchange', () => { void applyRoute(); });

// ---------------------------------------------------------------------------
// Vector SVG Icons System Helper
// ---------------------------------------------------------------------------
const ICONS = {
 globe: '<svg class="icon-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6"></circle><line x1="2" y1="8" x2="14" y2="8"></line><path d="M8 2a9 9 0 0 1 3 6 9 9 0 0 1-3 6 9 9 0 0 1-3-6 9 9 0 0 1 3-6z"></path></svg>',
 repo: '<svg class="icon-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 3.5a1 1 0 0 1 1-1h3.764a1 1 0 0 1 .707.293L8.5 4.3a1 1 0 0 0 .707.293H13.5a1 1 0 0 1 1 1V12.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-9z"></path></svg>',
 brain: '<svg class="icon-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5a2.5 2.5 0 0 0-4.5 1.5c0 .7.3 1.3.8 1.8A2.5 2.5 0 0 0 2 9a2.5 2.5 0 0 0 4 2V3.5z"></path><path d="M10 3.5a2.5 2.5 0 0 1 4.5 1.5c0 .7-.3 1.3-.8 1.8A2.5 2.5 0 0 1 14 9a2.5 2.5 0 0 1-4 2V3.5z"></path><path d="M6 6.5h4M6 9.5h4"></path></svg>',
 wrench: '<svg class="icon-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 2.5a3 3 0 0 0-3.8 3.8L2.5 10.5a1.5 1.5 0 0 0 2 2l4.2-4.2a3 3 0 0 0 3.8-3.8l-2-2z"></path></svg>',
 search: '<svg class="icon-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7" cy="7" r="4.5"></circle><line x1="10.5" y1="10.5" x2="14" y2="14"></line></svg>',
 fetch: '<svg class="icon-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6L9 2z"></path><polyline points="9 2 9 6 13 6"></polyline><line x1="6" y1="9" x2="10" y2="9"></line><line x1="6" y1="12" x2="9" y2="12"></line></svg>',
 terminal: '<svg class="icon-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 5 6 8 3 11"></polyline><line x1="8" y1="11" x2="13" y2="11"></line></svg>',
 edit: '<svg class="icon-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 2.5l2.5 2.5L5 13.5H2.5V11L11 2.5z"></path></svg>',
 cog: '<svg class="icon-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="2.5"></circle><path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"></path></svg>'
};

async function loadChatProjects() {
 try {
  if (!projects || !projects.length) {
   projects = await api('/api/v1/projects');
  }
  const contextSelect = $('#chat-project-context-select');
  if (contextSelect) {
   const currentVal = contextSelect.value;
   contextSelect.replaceChildren(
    (() => { const o = el('option', '通用对话（无项目上下文）'); o.value = ''; return o; })(),
    ...projects.map(p => { const o = el('option', `项目: ${p.name}`); o.value = p.id; return o; })
   );
   contextSelect.value = currentVal;
  }
 } catch {}
}

async function loadChatList() {
 try {
  const res = await api('/api/v1/chats');
  chatConversations = Array.isArray(res) ? res : (res?.items || []);
  renderChatList();
 } catch (e) {}
}

function renderChatList() {
 const list = $('#chat-list');
 if (!list) return;
 list.replaceChildren();
 if (!chatConversations.length) {
  const empty = el('li', '暂无历史会话', 'empty-chat-item');
  empty.style.padding = '24px 12px';
  empty.style.textAlign = 'center';
  empty.style.color = 'var(--muted)';
  empty.style.fontSize = '12px';
  list.append(empty);
  return;
 }
 for (const c of chatConversations) {
  const item = el('li', undefined, 'chat-list-item' + (c.id === activeChatId ? ' active' : ''));
  const header = el('div', undefined, 'chat-item-header');
  const title = el('span', c.description || '新会话', 'chat-item-title');
  const delBtn = el('button', undefined, 'chat-item-del-btn');
  delBtn.type = 'button';
  delBtn.title = '删除会话';
  delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
  delBtn.onclick = async (e) => {
   e.stopPropagation();
   if (!confirm('确定删除此会话记录吗？')) return;
   try {
    await api(`/api/v1/chats/${c.id}`, {}, 'DELETE');
    notice('会话已删除');
    if (activeChatId === c.id) resetNewChat();
    await loadChatList();
   } catch (err) {
    notice(err.message || '删除失败');
   }
  };
  header.append(title, delBtn);

  const meta = el('div', undefined, 'chat-item-meta');
  const proj = el('span', undefined, 'chat-item-proj');
  if (c.project_name) {
   proj.innerHTML = `${ICONS.repo}<span>${c.project_name}</span>`;
  } else {
   proj.innerHTML = `${ICONS.globe}<span>通用</span>`;
  }
  const time = el('span', new Date(Number(c.updated_at || c.stage_entered_at)).toLocaleDateString('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}), 'chat-item-time');
  meta.append(proj, time);

  item.append(header, meta);
  item.onclick = () => selectChat(c.id);
  list.append(item);
 }
}

let lastRenderedDigest = '';

function stopChatStream() {
 if (chatEventSource) {
  chatEventSource.close();
  chatEventSource = null;
 }
}

function startChatStream(chatId, startSeq) {
 stopChatStream();
 if (!activeChatId || activeChatId !== chatId || !key) return;

 const url = `/api/v1/events?taskId=${encodeURIComponent(chatId)}&after=${startSeq}&token=${encodeURIComponent(key)}`;
 const es = new EventSource(url);
 chatEventSource = es;

 es.onmessage = (e) => {
  if (activeChatId !== chatId) {
   stopChatStream();
   return;
  }
  try {
   const ev = JSON.parse(e.data);
   const sequence = Number(ev?.sequence);
   if (ev && Number.isFinite(sequence)) {
    chatMaxSequence = Math.max(chatMaxSequence, sequence);
    handleLiveStreamEvent({...ev, sequence}, chatId);
   }
  } catch (err) {}
 };

 es.onerror = () => {
  // 断开或出错时由轮询兜底
 };
}

function createThinkingCard(thinkingText, isThinking = false) {
 const card = el('div', undefined, 'chat-card-thinking');
 const details = el('details', undefined, 'chat-thinking-details');
 if (isThinking) details.setAttribute('open', '');

 const summary = el('summary', undefined, 'chat-thinking-summary');
 const iconWrap = el('span', undefined, 'thinking-brain-icon');
 iconWrap.innerHTML = ICONS.brain;
 const title = el('span', '深度思考分析', 'thinking-title');

 const badge = el('span', undefined, 'thinking-state-badge' + (isThinking ? ' running' : ''));
 if (isThinking) {
  badge.innerHTML = '<span class="thinking-spinner"></span> 正在深度思考…';
 } else {
  badge.textContent = `已完成思考 (${thinkingText ? thinkingText.length : 0} 字)`;
 }

 summary.append(iconWrap, title, badge);

 const content = el('div', undefined, 'chat-thinking-content markdown');
 if (thinkingText) {
  content.append(markdown(thinkingText));
 }
 details.append(summary, content);
 card.append(details);
 return card;
}

function handleLiveStreamEvent(ev, chatId) {
 const container = $('#chat-messages');
 if (!container || activeChatId !== chatId) return;
 const sequence = Number(ev.sequence);
 if (Number.isFinite(sequence)) chatLoadedEvents = mergeChatEvents(chatLoadedEvents, [{...ev, sequence}]);

 const scrollBox = $('#chat-scroll-container');
 const isAtBottom = scrollBox ? (scrollBox.scrollHeight - scrollBox.scrollTop - scrollBox.clientHeight < 120) : true;

 const removeThinking = () => {
  const thinking = container.querySelector('.chat-msg-row.assistant .thinking-bubble');
  if (thinking) {
   thinking.closest('.chat-msg-row.assistant')?.remove();
  }
 };

 if (ev.type === 'thinking_delta') {
  removeThinking();
  let liveThinkingCard = container.querySelector('[data-live-thinking="true"]');
  if (!liveThinkingCard) {
   liveThinkingCard = createThinkingCard(ev.payload?.text || '', true);
   liveThinkingCard.setAttribute('data-live-thinking', 'true');
   liveThinkingCard._rawThinking = ev.payload?.text || '';
   container.append(liveThinkingCard);
  } else {
   liveThinkingCard._rawThinking = (liveThinkingCard._rawThinking || '') + (ev.payload?.text || '');
   const content = liveThinkingCard.querySelector('.chat-thinking-content');
   if (content) {
    content.replaceChildren(markdown(liveThinkingCard._rawThinking));
   }
  }
 } else if (ev.type === 'text_delta') {
  removeThinking();
  const liveThinkingCard = container.querySelector('[data-live-thinking="true"]');
  if (liveThinkingCard) {
   liveThinkingCard.removeAttribute('data-live-thinking');
   const badge = liveThinkingCard.querySelector('.thinking-state-badge');
   if (badge) {
    badge.className = 'thinking-state-badge';
    badge.textContent = `已完成思考 (${(liveThinkingCard._rawThinking || '').length} 字)`;
   }
   const details = liveThinkingCard.querySelector('details');
   if (details) details.removeAttribute('open');
  }
  let liveCard = container.querySelector('[data-live-reply="true"]');
  if (!liveCard) {
   liveCard = el('div', undefined, 'chat-card-reply');
   liveCard.setAttribute('data-live-reply', 'true');
   const head = el('div', undefined, 'chat-reply-head');
   const avatar = el('span', 'S', 'chat-reply-avatar');
   const author = el('span', 'Specboard Agent', 'chat-reply-author');
   head.append(avatar, author);
   const body = el('div', undefined, 'chat-reply-markdown markdown');
   liveCard.append(head, body);
   liveCard._rawText = '';
   container.append(liveCard);
  }
  liveCard._rawText = (liveCard._rawText || '') + (ev.payload?.text || '');
  const body = liveCard.querySelector('.chat-reply-markdown');
  if (body) {
   body.replaceChildren(markdown(liveCard._rawText));
  }
 } else if (ev.type === 'tool_execution_start') {
  removeThinking();
  const liveThinkingCard = container.querySelector('[data-live-thinking="true"]');
  if (liveThinkingCard) {
   liveThinkingCard.removeAttribute('data-live-thinking');
   const badge = liveThinkingCard.querySelector('.thinking-state-badge');
   if (badge) {
    badge.className = 'thinking-state-badge';
    badge.textContent = `已完成思考 (${(liveThinkingCard._rawThinking || '').length} 字)`;
   }
   const details = liveThinkingCard.querySelector('details');
   if (details) details.removeAttribute('open');
  }
  const liveCard = container.querySelector('[data-live-reply="true"]');
  if (liveCard) {
   liveCard.removeAttribute('data-live-reply');
  }
  const toolCallId = ev.payload?.toolCallId || `tc_${Date.now()}`;
  const tc = {
   toolCallId,
   toolName: ev.payload?.toolName || 'tool',
   params: ev.payload?.args || ev.payload?.params || {},
   completed: false
  };
  const cardNode = createSingleToolCard(tc);
  cardNode.setAttribute('data-tool-call-id', toolCallId);
  container.append(cardNode);
 } else if (ev.type === 'tool_execution_end') {
  const toolCallId = ev.payload?.toolCallId;
  const cardNode = container.querySelector(`[data-tool-call-id="${toolCallId}"]`);
  if (cardNode) {
   const tc = {
    toolCallId,
    toolName: ev.payload?.toolName || 'tool',
    params: ev.payload?.args || ev.payload?.params || {},
    completed: true,
    isError: Boolean(ev.payload?.isError),
    durationMs: ev.payload?.durationMs,
    result: ev.payload?.result
   };
   const updated = createSingleToolCard(tc);
   updated.setAttribute('data-tool-call-id', toolCallId);
   cardNode.replaceWith(updated);
  }
 } else if (ev.type === 'run_complete' || ev.type === 'agent_settled') {
  const liveThinkingCard = container.querySelector('[data-live-thinking="true"]');
  if (liveThinkingCard) {
   liveThinkingCard.removeAttribute('data-live-thinking');
   const badge = liveThinkingCard.querySelector('.thinking-state-badge');
   if (badge) {
    badge.className = 'thinking-state-badge';
    badge.textContent = `已完成思考 (${(liveThinkingCard._rawThinking || '').length} 字)`;
   }
   const details = liveThinkingCard.querySelector('details');
   if (details) details.removeAttribute('open');
  }
  const liveCard = container.querySelector('[data-live-reply="true"]');
  if (liveCard) {
   liveCard.removeAttribute('data-live-reply');
  }
  removeThinking();
  api(`/api/v1/chats/${chatId}`).then(chat => {
   const badge = $('#chat-status-badge');
   if (badge) {
    badge.textContent = taskStatusLabel(chat);
    badge.className = 'badge ' + taskStatusClass(chat);
   }
   if (!['running', 'queued', 'claimed'].includes(chat.status)) {
    stopChatStream();
   }
  }).catch(() => {});
 }

 if (scrollBox && isAtBottom) scrollChatToBottom();
}

async function selectChat(chatId) {
 const generation = ++chatSelectionGeneration;
 chatSelectionPending = true;
 if (chatEventTimer) {
  clearInterval(chatEventTimer);
  chatEventTimer = null;
 }
 activeChatId = chatId;
 localStorage.setItem('specboard.activeChatId', chatId);
 setRoute(chatRoutePath(chatId));
 lastRenderedDigest = '';
 stopChatStream();
 resetChatClarification();
 resetChatHistory();
 renderChatList();
 const header = $('#chat-header');
 const emptyState = $('#chat-empty-state');
 const contextPill = $('#chat-context-pill');
 const activeTag = $('#chat-active-context-tag');
 if (header) {
  header.hidden = false;
  header.style.display = 'flex';
 }
 if (emptyState) {
  emptyState.hidden = true;
  emptyState.style.display = 'none';
 }
 if (contextPill) {
  contextPill.hidden = true;
  contextPill.style.display = 'none';
 }
 if (activeTag) {
  activeTag.hidden = false;
  activeTag.style.display = 'inline-block';
 }

 try {
  await refreshActiveChat(true);
  if (generation === chatSelectionGeneration) {
   scrollChatToBottom();
   chatEventTimer = setInterval(() => refreshActiveChat(false), 3000);
  }
 } finally {
  if (generation === chatSelectionGeneration) chatSelectionPending = false;
 }
}

function resetNewChat() {
 chatSelectionGeneration += 1;
 chatSelectionPending = false;
 activeChatId = null;
 localStorage.removeItem('specboard.activeChatId');
 setRoute('/chat');
 lastRenderedDigest = '';
 stopChatStream();
 resetChatClarification();
 resetChatHistory();
 if (chatEventTimer) {
  clearInterval(chatEventTimer);
  chatEventTimer = null;
 }
 renderChatList();
 const header = $('#chat-header');
 const emptyState = $('#chat-empty-state');
 const messagesBox = $('#chat-messages');
 const contextPill = $('#chat-context-pill');
 const activeTag = $('#chat-active-context-tag');
 if (header) {
  header.hidden = true;
  header.style.display = 'none';
 }
 if (emptyState) {
  emptyState.hidden = false;
  emptyState.style.display = 'flex';
 }
 if (messagesBox) messagesBox.replaceChildren();
 if (contextPill) {
  contextPill.hidden = false;
  contextPill.style.display = 'inline-flex';
 }
 if (activeTag) {
  activeTag.hidden = true;
  activeTag.style.display = 'none';
 }
 const projChip = $('#chat-project-chip');
 if (projChip) projChip.textContent = '';
 const badge = $('#chat-status-badge');
 if (badge) {
  badge.textContent = '';
  badge.className = 'badge';
 }
 const title = $('#chat-title');
 if (title) title.textContent = '';
 const input = $('#chat-input');
 if (input) {
  input.value = '';
  input.focus();
 }
}

async function refreshActiveChat(forceScroll = false) {
 if (!activeChatId || currentMode !== 'chat') return;
 if (chatSelectionPending && !forceScroll) return;
 const chatId = activeChatId;
 const generation = chatSelectionGeneration;
 try {
  const eventsPath = chatLoadedEvents.length > 0
   ? `/api/v1/tasks/${chatId}/events?after=${chatMaxSequence}&limit=500`
   : `/api/v1/tasks/${chatId}/events?limit=200`;
  const [chat, eventsRes, clarificationsRes] = await Promise.all([
   api(`/api/v1/chats/${chatId}`),
   api(eventsPath),
   api(`/api/v1/tasks/${chatId}/clarifications`)
  ]);
  if (activeChatId !== chatId || chat.id !== chatId || generation !== chatSelectionGeneration) return;

  const projChip = $('#chat-project-chip');
  if (projChip) {
   if (chat.project_name) {
    projChip.innerHTML = `${ICONS.repo}<span>${chat.project_name}</span>`;
   } else {
    projChip.innerHTML = `${ICONS.globe}<span>通用对话</span>`;
   }
  }
  const badge = $('#chat-status-badge');
  if (badge) {
   badge.textContent = taskStatusLabel(chat);
   badge.className = 'badge ' + taskStatusClass(chat);
  }
  const title = $('#chat-title');
  if (title) {
   title.textContent = chat.description || '会话';
  }
  const activeTag = $('#chat-active-context-tag');
  if (activeTag) {
   if (chat.project_name) {
    activeTag.innerHTML = `${ICONS.repo}<span>已绑定代码库: ${chat.project_name}</span>`;
   } else {
    activeTag.innerHTML = `${ICONS.globe}<span>无项目通用对话</span>`;
   }
  }

  const eventPage = Array.isArray(eventsRes) ? {items: eventsRes, hasMore: false} : (eventsRes || {});
  const eventsList = eventPage.items || eventPage.events || [];
  const wasEmpty = chatLoadedEvents.length === 0;
  chatLoadedEvents = mergeChatEvents(chatLoadedEvents, eventsList);
  if (wasEmpty) chatHistoryHasMore = Boolean(eventPage.hasMore);
  const maxSeqInList = eventsList.reduce((max, ev) => Math.max(max, Number(ev.sequence) || 0), 0);
  chatMaxSequence = Math.max(chatMaxSequence, maxSeqInList);
  activeChatTask = chat;
  renderChatHistoryBar();

  const clarificationsList = Array.isArray(clarificationsRes) ? clarificationsRes : (clarificationsRes?.items || []);
  const clarificationDigest = renderChatClarification(clarificationsList, chat);

  const lastEvent = chatLoadedEvents[chatLoadedEvents.length - 1];
  const lastEventKey = lastEvent ? `${lastEvent.sequence}_${lastEvent.type}_${JSON.stringify(lastEvent.payload).length}` : 'none';
  const currentDigest = `${chat.id}_${chat.status}_${chat.updated_at}_${chatLoadedEvents.length}_${lastEventKey}_${clarificationDigest}_${chatHistoryHasMore ? 'more' : 'done'}`;

  const scrollBox = $('#chat-scroll-container');
  const isAtBottom = scrollBox ? (scrollBox.scrollHeight - scrollBox.scrollTop - scrollBox.clientHeight < 80) : true;
  const previousScrollTop = scrollBox ? scrollBox.scrollTop : 0;

  if (currentDigest === lastRenderedDigest && !forceScroll) {
   return;
  }
  lastRenderedDigest = currentDigest;

  renderChatMessages(chatLoadedEvents, chat);

  const isWorking = ['running', 'queued', 'claimed'].includes(chat?.status);
  if (isWorking && !chatEventSource) {
   startChatStream(chat.id, chatMaxSequence);
  } else if (!isWorking && chatEventSource) {
   stopChatStream();
  }

  if (scrollBox) {
   if (forceScroll || isAtBottom) scrollChatToBottom();
   else scrollBox.scrollTop = previousScrollTop;
  }
 } catch (err) {}
}

function stripAnsi(str) {
 return typeof str === 'string' ? str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '') : '';
}

function extractToolResultText(result) {
 if (!result) return '';
 if (typeof result === 'string') return stripAnsi(result);
 if (result.structuredContent) {
  return stripAnsi(typeof result.structuredContent === 'string' ? result.structuredContent : JSON.stringify(result.structuredContent, null, 2));
 }
 if (Array.isArray(result.content)) {
  return stripAnsi(result.content.map(c => typeof c === 'string' ? c : (c.text || JSON.stringify(c, null, 2))).join('\n'));
 }
 if (result.text) return stripAnsi(result.text);
 if (result.stdout || result.stderr) {
  const parts = [];
  if (result.stdout) parts.push(result.stdout);
  if (result.stderr) parts.push(`[stderr]\n${result.stderr}`);
  return stripAnsi(parts.join('\n'));
 }
 return stripAnsi(JSON.stringify(result, null, 2));
}

function createSingleToolCard(tc) {
 const details = el('details', undefined, 'chat-tool-single-card');
 if (!tc.completed) details.setAttribute('open', '');

 const sum = el('summary', undefined, 'chat-tool-single-summary');
 const left = el('div', undefined, 'tool-summary-left');
 const right = el('div', undefined, 'tool-summary-right');

 const iconWrap = el('span', undefined, 'tool-icon-wrap');
 const badge = el('span', undefined, 'tool-type-badge');
 let displayTitle = tc.toolName;
 let keyArgText = '';

 const p = tc.params || {};

 if (tc.toolName === 'web_search') {
  iconWrap.innerHTML = ICONS.search;
  badge.innerHTML = `${ICONS.search}<span>联网检索</span>`;
  badge.className = 'tool-type-badge tool-badge-search';
  displayTitle = 'web_search';
  keyArgText = p.query ? `"${p.query}"` : '';
 } else if (tc.toolName === 'fetch_content') {
  iconWrap.innerHTML = ICONS.fetch;
  badge.innerHTML = `${ICONS.fetch}<span>网页阅读</span>`;
  badge.className = 'tool-type-badge tool-badge-fetch';
  displayTitle = 'fetch_content';
  keyArgText = p.url || '';
 } else if (['bash', 'sh', 'command', 'exec', 'run'].includes(tc.toolName)) {
  iconWrap.innerHTML = ICONS.terminal;
  badge.innerHTML = `${ICONS.terminal}<span>命令执行</span>`;
  badge.className = 'tool-type-badge tool-badge-cmd';
  displayTitle = tc.toolName;
  keyArgText = p.command || p.cmd || '';
 } else if (['read', 'grep', 'find', 'ls'].includes(tc.toolName)) {
  iconWrap.innerHTML = ICONS.terminal;
  badge.innerHTML = `${ICONS.terminal}<span>代码探索</span>`;
  badge.className = 'tool-type-badge tool-badge-code';
  displayTitle = tc.toolName;
  if (tc.toolName === 'read') {
   keyArgText = p.path || '';
  } else if (tc.toolName === 'ls') {
   keyArgText = p.path || '.';
  } else if (tc.toolName === 'grep') {
   keyArgText = p.pattern ? `"${p.pattern}"${p.path ? ` in ${p.path}` : ''}` : (p.path || '');
  } else if (tc.toolName === 'find') {
   keyArgText = p.pattern || p.path || '';
  }
 } else if (['write', 'edit'].includes(tc.toolName)) {
  iconWrap.innerHTML = ICONS.edit;
  badge.innerHTML = `${ICONS.edit}<span>${tc.toolName === 'write' ? '写入文件' : '代码编辑'}</span>`;
  badge.className = 'tool-type-badge tool-badge-file';
  displayTitle = tc.toolName;
  keyArgText = p.path || '';
 } else {
  iconWrap.innerHTML = ICONS.cog;
  badge.innerHTML = `${ICONS.cog}<span>${tc.toolName}</span>`;
  badge.className = 'tool-type-badge';
  displayTitle = tc.toolName;
  keyArgText = '';
 }

 const nameSpan = el('span', displayTitle, 'tool-fn-name');
 const argSpan = el('span', keyArgText, 'tool-key-arg');
 left.append(badge, nameSpan, argSpan);

 if (tc.durationMs) {
  const dur = el('span', `${tc.durationMs}ms`, 'tool-duration');
  right.append(dur);
 }
 const statusBadge = el('span', tc.completed ? (tc.isError ? '执行失败' : '执行完成') : '执行中…', 'tool-status-badge' + (tc.completed ? (tc.isError ? ' error' : ' success') : ' running'));
 right.append(statusBadge);

 sum.append(left, right);

 const body = el('div', undefined, 'chat-tool-single-body');

 // 1. LLM 调用参数 (Parameters)
 const argsSection = el('div', undefined, 'tool-body-section');
 const argsTitle = el('div', '调用参数 (Arguments)', 'tool-body-section-title');
 const argsPre = el('pre', JSON.stringify(tc.params || {}, null, 2), 'tool-code-block');
 argsSection.append(argsTitle, argsPre);
 body.append(argsSection);

 // 2. 工具执行结果 (Result / Output)
 if (tc.completed) {
  const resultSection = el('div', undefined, 'tool-body-section');
  const resultTitle = el('div', '执行结果 (Output)', 'tool-body-section-title');
  const rawText = extractToolResultText(tc.result);
  const output = truncateToolOutput(rawText);
  const resultText = output.truncated
   ? `${output.text}\n\n...[原始结果共 ${output.originalLength.toLocaleString()} 字符，已保留开头和结尾]...`
   : output.text;
  const resultPre = el('pre', resultText || '(空结果)', 'tool-code-block tool-result-block');
  const expandLabel = output.truncated ? '展开已截断输出' : '展开完整输出';
  const expand = el('button', expandLabel, 'tool-output-expand');
  expand.type = 'button';
  expand.setAttribute('aria-expanded', 'false');
  expand.onclick = () => {
   const expanded = resultPre.classList.toggle('is-expanded');
   expand.textContent = expanded ? '收起输出' : expandLabel;
   expand.setAttribute('aria-expanded', String(expanded));
  };
  resultSection.append(resultTitle, resultPre);
  if (output.originalLength > 2000) resultSection.append(expand);
  body.append(resultSection);
 }

 details.append(sum, body);
 return details;
}

function renderChatMessages(events, chat) {
 const container = $('#chat-messages');
 if (!container) return;
 container.replaceChildren();

 const renderedNodes = [];

 // 1. 会话首轮用户提问
 if (chat?.description) {
  const initialRow = el('div', undefined, 'chat-msg-row user');
  const bubble = el('div', undefined, 'chat-msg-bubble');
  bubble.textContent = chat.description;
  initialRow.append(bubble);
  renderedNodes.push(initialRow);
 }

 const isWorking = ['running', 'queued', 'claimed'].includes(chat?.status);
 const toolCardMap = new Map();
 let currentAssistantText = '';
 let currentThinkingText = '';

 const flushThinkingCard = () => {
  if (currentThinkingText.trim()) {
   const thinkingCard = createThinkingCard(currentThinkingText, false);
   renderedNodes.push(thinkingCard);
   currentThinkingText = '';
  }
 };

 const flushAssistantReply = () => {
  flushThinkingCard();
  if (currentAssistantText.trim()) {
   const replyCard = el('div', undefined, 'chat-card-reply');
   const head = el('div', undefined, 'chat-reply-head');
   const avatar = el('span', 'S', 'chat-reply-avatar');
   const author = el('span', 'Specboard Agent', 'chat-reply-author');
   head.append(avatar, author);

   const body = el('div', undefined, 'chat-reply-markdown markdown');
   body.append(markdown(currentAssistantText));
   replyCard.append(head, body);
   renderedNodes.push(replyCard);
   currentAssistantText = '';
  }
 };

 for (const ev of events) {
  if (ev.type === 'user_message') {
   flushAssistantReply();
   const text = ev.payload?.text || '';
   if (text && text !== chat?.description) {
    const row = el('div', undefined, 'chat-msg-row user');
    const bubble = el('div', undefined, 'chat-msg-bubble');
    bubble.textContent = text;
    row.append(bubble);
    renderedNodes.push(row);
   }
  } else if (ev.type === 'thinking_delta') {
   currentThinkingText += ev.payload?.text || '';
  } else if (ev.type === 'tool_execution_start') {
   flushAssistantReply();
   const toolCallId = ev.payload?.toolCallId || `tc_${renderedNodes.length}`;
   const tc = {
    toolCallId,
    toolName: ev.payload?.toolName || 'tool',
    params: ev.payload?.args || ev.payload?.params || {},
    completed: false
   };
   const cardNode = createSingleToolCard(tc);
   cardNode.setAttribute('data-tool-call-id', toolCallId);
   const nodeIndex = renderedNodes.length;
   toolCardMap.set(toolCallId, { tc, cardNode, nodeIndex });
   renderedNodes.push(cardNode);
  } else if (ev.type === 'tool_execution_end') {
   const toolCallId = ev.payload?.toolCallId;
   const entry = toolCardMap.get(toolCallId);
   if (entry) {
    entry.tc.completed = true;
    entry.tc.isError = Boolean(ev.payload?.isError);
    entry.tc.durationMs = ev.payload?.durationMs;
    entry.tc.result = ev.payload?.result;
    const updatedNode = createSingleToolCard(entry.tc);
    updatedNode.setAttribute('data-tool-call-id', toolCallId);
    if (entry.cardNode.parentNode) {
     entry.cardNode.replaceWith(updatedNode);
    }
    renderedNodes[entry.nodeIndex] = updatedNode;
    entry.cardNode = updatedNode;
   }
  } else if (ev.type === 'text_delta') {
   flushThinkingCard();
   currentAssistantText += ev.payload?.text || '';
  } else if (ev.type === 'run_complete') {
   if (!currentAssistantText && ev.payload?.summary) {
    currentAssistantText = ev.payload.summary;
   }
  }
 }

 if (currentThinkingText.trim() && isWorking && !currentAssistantText) {
  const liveThinking = createThinkingCard(currentThinkingText, true);
  renderedNodes.push(liveThinking);
 } else {
  flushAssistantReply();
 }

 if (isWorking && !currentAssistantText) {
  const thinkingRow = el('div', undefined, 'chat-msg-row assistant');
  const avatar = el('div', 'S', 'chat-msg-avatar');
  const body = el('div', undefined, 'chat-msg-body');
  const bubble = el('div', undefined, 'chat-msg-bubble thinking-bubble');
  bubble.innerHTML = '<span class="thinking-spinner"></span> 正在深度思考分析与执行检索，请稍候…';
  body.append(bubble);
  thinkingRow.append(avatar, body);
  renderedNodes.push(thinkingRow);
 }

 container.append(...renderedNodes);
}

async function initChatMode(targetChatId) {
 await loadChatProjects();
 await loadChatList();
 if (targetChatId !== undefined) {
  if (targetChatId) await selectChat(targetChatId);
  else resetNewChat();
  return;
 }
 const savedId = localStorage.getItem('specboard.activeChatId');
 if (savedId && chatConversations.some(c => c.id === savedId)) {
  await selectChat(savedId);
 } else if (chatConversations.length > 0) {
  await selectChat(chatConversations[0].id);
 } else {
  resetNewChat();
 }
}

$('#new-chat-btn')?.addEventListener('click', resetNewChat);

// Quick suggestion prompts click handling
document.querySelectorAll('.quick-prompt-card').forEach(btn => {
 btn.addEventListener('click', () => {
  const prompt = btn.getAttribute('data-prompt');
  const input = $('#chat-input');
  if (input && prompt) {
   input.value = prompt;
   input.focus();
  }
 });
});

const handleChatSubmit = async (e) => {
 if (e) e.preventDefault();
 const input = $('#chat-input');
 const msg = input?.value?.trim();
 if (!msg) return;
 if (activeChatClarification?.status === 'pending') {
  notice('请先回答上方的澄清问题，提交后会自动继续。');
  focusChatClarification();
  return;
 }
 const btn = $('#chat-send-btn');
 setButtonLoading(btn, true, '…');

 try {
  if (!activeChatId) {
   const contextSelect = $('#chat-project-context-select');
   const projectId = contextSelect?.value || null;
   const result = await api('/api/v1/chats', { projectId, message: msg });
   input.value = '';
   notice('新会话已开启');
   await loadChatList();
   await selectChat(result.id);
  } else {
   await api(`/api/v1/chats/${activeChatId}/messages`, { message: msg });
   input.value = '';
   await refreshActiveChat(true);
  }
 } catch (err) {
  if (err?.code === 'clarification_required') {
   notice('请先回答上方的澄清问题，提交后会自动继续。');
   await refreshActiveChat(true).catch(() => {});
   focusChatClarification();
  } else {
   notice(err.message || '发送失败');
  }
 } finally {
  setButtonLoading(btn, false);
  if (chatComposerLocked) btn.disabled = true;
 }
};

$('#chat-composer-form')?.addEventListener('submit', handleChatSubmit);
$('#chat-send-btn')?.addEventListener('click', (e) => {
 e.preventDefault();
 handleChatSubmit(e);
});

$('#chat-input')?.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' && !e.shiftKey) {
  e.preventDefault();
  handleChatSubmit(e);
 }
});

bindChatHistoryInteractions();

$('#chat-delete-btn')?.addEventListener('click', async () => {
 if (!activeChatId) return;
 if (!confirm('确定删除该会话记录吗？删除后不可恢复。')) return;
 try {
  await api(`/api/v1/chats/${activeChatId}`, {}, 'DELETE');
  notice('会话已删除');
  resetNewChat();
  await loadChatList();
 } catch (err) {
  notice(err.message || '删除会话失败');
 }
});

void applyRoute();

