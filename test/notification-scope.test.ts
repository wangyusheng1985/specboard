import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNotificationAdapter,createTaskObserver} from '../public/notifications.js';
const base={id:'11111111-1111-4111-8111-111111111111',stage:'Propose',version:1,status:'running',outcome_state:'executing',outcome_revision:1,updated_at:1};
function storage(){const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)||null,setItem:(key:string,value:string)=>{data.set(key,value);}};}
function environment(){const notifications:any[]=[];class N{static permission='granted';constructor(title:string,options:any){notifications.push({title,options});}}return {env:{isSecureContext:true,Notification:N},notifications};}
test('Top X snapshots drop tasks outside scope and establish re-entry baselines',async()=>{
 const {env,notifications}=environment(),adapter=createNotificationAdapter(env,storage());await adapter.request();const observer=createTaskObserver(adapter,'http://localhost');
 observer.observe([base]);observer.observe([]);observer.observe([{...base,outcome_state:'blocked',outcome_revision:2,updated_at:2}]);assert.equal(notifications.length,0);
 observer.observe([{...base,outcome_state:'executing',outcome_revision:3,updated_at:3}]);observer.observe([{...base,stage:'Apply',outcome_state:'blocked',outcome_revision:4,updated_at:4}]);assert.equal(notifications.length,1);
 const older={...base,id:'22222222-2222-4222-8222-222222222222',outcome_state:'blocked',outcome_revision:4};observer.observe([{...base,stage:'Apply',outcome_state:'blocked',outcome_revision:4,updated_at:4},older]);assert.equal(notifications.length,1);
 observer.observe([{...base,stage:'Apply',outcome_state:'blocked',outcome_revision:4,updated_at:4},{...older,outcome_state:'executing',outcome_revision:5}]);observer.observe([{...base,stage:'Apply',outcome_state:'blocked',outcome_revision:4,updated_at:4},{...older,outcome_state:'blocked',outcome_revision:6,updated_at:5}]);assert.equal(notifications.length,2);
});
