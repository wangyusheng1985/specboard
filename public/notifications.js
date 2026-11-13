const PREF='specboard.browserNotifications';
const KEY='specboard.browserNotificationKeys';
const MAX_KEYS=200;
const STAGES=['Explore','Propose','Apply','MR','Archive'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const notificationTypes={clarification_required:'需要回答',proposal_approval_required:'方案待确认',execution_blocked:'执行受阻',apply_delivered:'实现完成待审阅',archive_completed:'已手动归档'};
export function capability(env=globalThis){try{return !!env.isSecureContext&&typeof env.Notification==='function';}catch{return false;}}
export function permission(env=globalThis){try{return capability(env)?env.Notification.permission:'unsupported';}catch{return 'unsupported';}}
export function preference(storage){try{return storage.getItem(PREF)==='enabled'?'enabled':'disabled';}catch{return 'disabled';}}
export function setPreference(value,storage){try{storage.setItem(PREF,value);}catch{}}
export async function requestPermission(env=globalThis,storage){
 if(!capability(env))return 'unsupported';
 try{const current=permission(env);if(current==='denied')return current;const result=current==='granted'?current:await env.Notification.requestPermission();setPreference(result==='granted'?'enabled':'disabled',storage);return result;}catch{return 'default';}
}
function keys(storage){try{const value=JSON.parse(storage.getItem(KEY)||'[]');return Array.isArray(value)?value.filter(x=>typeof x==='string'&&x.length<400).slice(-MAX_KEYS):[];}catch{return [];}}
export function consumeKey(key,storage,channel){
 const current=keys(storage);if(current.includes(key))return false;current.push(key);
 try{storage.setItem(KEY,JSON.stringify(current.slice(-MAX_KEYS)));}catch{}
 try{channel?.postMessage({type:'notification-key',key});}catch{}
 return true;
}
function notificationType(task){
 if(!STAGES.includes(task?.stage))return null;
 if(task.outcome_state==='clarifying'){
  if(task.stage==='Explore'&&task.status==='waiting_input'&&task.wait_reason!=='clarification_required')return null;
  return 'clarification_required';
 }
 if(task.outcome_state==='awaiting_proposal_approval')return 'proposal_approval_required';
 if(task.outcome_state==='blocked')return 'execution_blocked';
 if(task.outcome_state==='delivered'&&(task.stage==='Apply'||task.stage==='MR'))return 'apply_delivered';
 if(task.outcome_state==='archived'&&task.stage==='Archive')return 'archive_completed';
 return null;
}
export function notificationFor(previous,current){
 if(!previous||!STAGES.includes(current?.stage))return null;
 const changed=previous.outcome_state!==current.outcome_state||previous.outcome_revision!==current.outcome_revision||previous.version!==current.version;
 return changed?notificationType(current):null;
}
export function initialNotification(current){
 return STAGES.includes(current?.stage)?notificationType(current):null;
}
export function notificationTarget(search){
 try{const params=new URLSearchParams(search),task=params.get('task'),stage=params.get('stage');if(!UUID.test(task||''))return null;return {task,stage:STAGES.includes(stage)?stage:null};}catch{return null;}
}
export function notificationKey(task,type){return [task.id,task.stage,task.version,task.outcome_revision||0,task.run_id||task.updated_at||task.stage_entered_at||'',type].join(':');}
export function notificationPayload(task,type,origin=''){
 if(!notificationTypes[type]||!UUID.test(task.id)||!STAGES.includes(task.stage))return null;
 // User-authored descriptions may contain arbitrary secrets: identify by project and short ID only.
 const name='任务 '+task.id.slice(0,8);
 const state=type==='clarification_required'?'需要你的回答':type==='proposal_approval_required'?'方案待确认':type==='execution_blocked'?'执行受阻':type==='apply_delivered'?'实现完成，等待审阅':'已手动归档';
 return {title:'Specboard · '+notificationTypes[type],options:{body:`${name} · ${task.stage} ${state}`,icon:'/apple-touch-icon.png',tag:`task:${task.id}:${type}`,data:{url:`${origin}/?task=${task.id}&stage=${task.stage}`}}};
}
function showBrowserNotification(env,title,options,onclick){
 const serviceWorker=env.navigator?.serviceWorker;
 if(serviceWorker?.getRegistration){
  try{
   serviceWorker.getRegistration().then(registration=>{
    if(registration?.showNotification)return registration.showNotification(title,options);
   }).catch(()=>{});
   return true;
  }catch{}
 }
 try{const notification=new env.Notification(title,options);if(onclick)notification.onclick=()=>onclick(notification);return true;}catch{return false;}
}
export function createNotificationAdapter(env=globalThis,storage,channel){
 // A browser grant is enough to enable notifications; only an explicit
 // in-app disable should keep them off.
 let explicit;try{explicit=storage?.getItem(PREF);}catch{}
 let enabled=explicit==='enabled'||(explicit!=='disabled'&&permission(env)==='granted');
 const seen=new Set(keys(storage));
 const previousHandler=channel?.onmessage;
 if(channel)channel.onmessage=event=>{const key=event.data?.key;if(event.data?.type==='notification-key'&&typeof key==='string'&&key.length<400){seen.add(key);while(seen.size>MAX_KEYS)seen.delete(seen.values().next().value);}previousHandler?.(event);};
 return {
  capability:()=>capability(env),permission:()=>permission(env),enabled:()=>enabled,preference:()=>enabled?'enabled':'disabled',
  request:async()=>{const result=await requestPermission(env,storage);enabled=result==='granted';return result;},
  disable:()=>{enabled=false;setPreference('disabled',storage);},
  consume:key=>{if(seen.has(key))return false;const fresh=consumeKey(key,storage,channel);seen.add(key);while(seen.size>MAX_KEYS)seen.delete(seen.values().next().value);return fresh;},
  notify:(title,options)=>{
   if(!enabled||permission(env)!=='granted')return false;
   return showBrowserNotification(env,title,options,notification=>{notification.close();env.focus?.();const target=notificationTarget(new URL(options.data.url,env.location.origin).search);if(target){env.location.assign('/?task='+target.task+'&stage='+target.stage);}});
  },
  notifyTest:(origin='')=>{
   if(permission(env)!=='granted')return false;
   return showBrowserNotification(env,'Specboard · 浏览器通知已就绪',{body:'当任务需要回答、方案待确认或交付完成时将在这里提醒你。',icon:'/apple-touch-icon.png',tag:'specboard:test',data:{url:`${origin}/`}},notification=>{notification.close();env.focus?.();});
  }
 };
}
export function createTaskObserver(adapter,origin=''){
 const snapshots=new Map();let initialized=false;
 return {reset(){snapshots.clear();initialized=false;},observe(tasks){const firstPass=!initialized;const visible=new Set(tasks.map(task=>task.id));for(const id of snapshots.keys())if(!visible.has(id))snapshots.delete(id);for(const task of tasks){const prior=snapshots.get(task.id);snapshots.set(task.id,{...task});while(snapshots.size>2000)snapshots.delete(snapshots.keys().next().value);try{const type=prior?notificationFor(prior,task):(firstPass?initialNotification(task):null);if(!type||!adapter.enabled()||adapter.permission()!=='granted')continue;const payload=notificationPayload(task,type,origin);if(payload&&adapter.consume(notificationKey(task,type)))adapter.notify(payload.title,payload.options);}catch{/* Notification failures must never interrupt task refresh. */}}initialized=true;}};
}
