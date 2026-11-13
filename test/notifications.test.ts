import {test} from 'node:test';
import assert from 'node:assert/strict';
import {consumeKey,createNotificationAdapter,createTaskObserver,notificationFor,notificationPayload,notificationTarget,permission} from '../public/notifications.js';
const id='11111111-1111-4111-8111-111111111111';
const base={id,stage:'Propose',version:1,status:'running',outcome_state:'executing',outcome_revision:1,updated_at:1,description:'token=secret-value private content'};
function storage(){const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>{data.set(k,v);}};}
function environment(){const notifications:any[]=[],calls:string[]=[];class N{static permission='default';static requestPermission=async()=>{calls.push('permission');N.permission='granted';return 'granted';};onclick:any;constructor(public title:string,public options:any){notifications.push(this);}close(){calls.push('close');}}
 return {env:{isSecureContext:true,Notification:N,focus:()=>calls.push('focus'),location:{origin:'http://localhost',assign:(url:string)=>calls.push(url)}},notifications,calls};}
test('permission is explicit, toggleable and gracefully handles unsupported/denied APIs',async()=>{
 const {env,calls,notifications}=environment(),adapter=createNotificationAdapter(env,storage());assert.equal(calls.length,0);assert.equal(adapter.notify('x',{}),null);await adapter.request();assert.equal(adapter.enabled(),true);assert.equal(adapter.permission(),'granted');adapter.notify('x',notificationPayload(base,'execution_blocked','http://localhost').options);notifications[0].onclick();assert.ok(calls.includes('focus'));assert.ok(calls.some(c=>c.startsWith('/?task='+id)));assert.equal(notificationPayload(base,'execution_blocked','http://localhost').options.icon,'/apple-touch-icon.png');assert.equal(adapter.notifyTest('http://localhost')!==null,true);adapter.disable();assert.equal(adapter.notify('x',{}),null);
 assert.equal(permission({isSecureContext:false}),'unsupported');const unsupported=createNotificationAdapter({isSecureContext:false});assert.equal(await unsupported.request(),'unsupported');env.Notification.permission='denied';assert.equal(await adapter.request(),'denied');env.Notification.permission='default';env.Notification.requestPermission=async()=>{throw new Error('blocked');};assert.equal(await adapter.request(),'default');
});
test('observer establishes baseline, detects waiting reason and isolates constructor failures',async()=>{
 const {env,notifications}=environment(),store=storage(),adapter=createNotificationAdapter(env,store);await adapter.request();const observer=createTaskObserver(adapter,'http://localhost');observer.observe([base]);assert.equal(notifications.length,0);observer.observe([{...base,outcome_state:'awaiting_proposal_approval',outcome_revision:2,updated_at:2}]);assert.equal(notifications.length,1);observer.observe([{...base,outcome_state:'clarifying',outcome_revision:3,updated_at:3}]);assert.equal(notifications.length,2);observer.observe([{...base,outcome_state:'clarifying',outcome_revision:3,updated_at:3}]);assert.equal(notifications.length,2);observer.reset();observer.observe([{...base,outcome_state:'recovering',outcome_revision:4,updated_at:4}]);assert.equal(notifications.length,2);observer.observe([{...base,outcome_state:'executing',outcome_revision:5,updated_at:5}]);observer.observe([{...base,outcome_state:'blocked',outcome_revision:6,updated_at:6}]);assert.equal(notifications.length,3);
 const restored=createNotificationAdapter(env,store);assert.equal(restored.consume([id,'Propose',1,6,6,'execution_blocked'].join(':')),false);
 const broken=createTaskObserver({enabled:()=>true,permission:()=>{throw new Error('unavailable');}});assert.doesNotThrow(()=>{broken.observe([base]);broken.observe([{...base,outcome_state:'blocked',outcome_revision:2}]);});
});
test('notifications are bounded, private, and navigate only to validated task targets',()=>{
 const store=storage();assert.equal(consumeKey('a',store),true);assert.equal(consumeKey('a',store),false);for(let i=0;i<250;i++)consumeKey(String(i),store);assert.equal(JSON.parse(store.getItem('specboard.browserNotificationKeys')||'[]').length,200);
 const payload=notificationPayload(base,'execution_blocked','http://localhost');assert.ok(!JSON.stringify(payload).includes('secret-value'));assert.ok(!JSON.stringify(payload).includes('private content'));assert.equal(notificationPayload(base,'unknown'),null);assert.equal(notificationTarget('?task=javascript:alert(1)'),null);assert.deepEqual(notificationTarget('?task='+id+'&stage=Apply'),{task:id,stage:'Apply'});assert.equal(notificationTarget('?task='+id+'&stage=invalid')?.stage,null);
 for(const [state,type]of [['blocked','execution_blocked'],['clarifying','clarification_required'],['awaiting_proposal_approval','proposal_approval_required'],['delivered','apply_delivered'],['archived','archive_completed']])assert.equal(notificationFor(base,{...base,outcome_state:state,outcome_revision:2,stage:state==='delivered'?'Apply':state==='archived'?'Archive':'Propose'}),type);assert.equal(notificationFor(base,{...base,outcome_state:'recovering',outcome_revision:2}),null);assert.equal(notificationFor(null,base),null);assert.equal(notificationFor(base,base),null);assert.equal(notificationFor(base,{...base,stage:'unknown',outcome_state:'blocked',outcome_revision:2}),null);assert.equal(notificationFor(base,{...base,stage:'MR',outcome_state:'delivered',outcome_revision:2}),'apply_delivered');assert.equal(notificationFor(base,{...base,stage:'MR',outcome_state:'blocked',outcome_revision:2}),'execution_blocked');

 // Explore clarification suppression test
 const exploreBase={...base,stage:'Explore',status:'running',outcome_state:'executing'};
 assert.equal(notificationFor(exploreBase,{...exploreBase,status:'waiting_input',outcome_state:'clarifying',outcome_revision:2,wait_reason:'clarification_required'}),'clarification_required');
 assert.equal(notificationFor(exploreBase,{...exploreBase,status:'waiting_input',outcome_state:'clarifying',outcome_revision:2,wait_reason:null}),null);
});
test('storage and BroadcastChannel failures do not break notifications',async()=>{
 const broken={getItem(){throw new Error('denied');},setItem(){throw new Error('full');}},channel:any={postMessage(){throw new Error('closed');}},fixture=environment();const adapter=createNotificationAdapter(fixture.env,broken,channel);await adapter.request();assert.ok(adapter.consume('one'));assert.equal(adapter.consume('one'),false);channel.onmessage({data:{type:'notification-key',key:'other'}});assert.equal(adapter.consume('other'),false);assert.doesNotThrow(()=>channel.onmessage({data:{type:'other'}}));
});

test('first observation notifies current actionable tasks exactly once', async () => {
 const {env,notifications}=environment(),store=storage(),adapter=createNotificationAdapter(env,store);
 await adapter.request();
 const observer=createTaskObserver(adapter,'http://localhost');
 observer.observe([{...base,stage:'Apply',outcome_state:'delivered',outcome_revision:2,updated_at:2}]);
 assert.equal(notifications.length,1,'first observation should notify a delivered task');
 observer.observe([{...base,stage:'Apply',outcome_state:'delivered',outcome_revision:2,updated_at:2}]);
 assert.equal(notifications.length,1,'unchanged task should not notify twice');
 observer.observe([]);
 observer.observe([{...base,stage:'Apply',outcome_state:'delivered',outcome_revision:2,updated_at:2}]);
 assert.equal(notifications.length,1,'re-entering the window should not re-notify after initialization');
 observer.reset();
 observer.observe([{...base,stage:'Apply',outcome_state:'blocked',outcome_revision:3,updated_at:3}]);
 assert.equal(notifications.length,2,'reset should establish a new initial notification');
});
