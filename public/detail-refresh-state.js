export class DetailRefreshState{
 #sequence=0;#taskId=null;#snapshot=null;
 begin(taskId,root){if(this.#taskId!==taskId){this.#taskId=taskId;this.#snapshot=null;}this.capture(root);return ++this.#sequence;}
 current(sequence,taskId,open=true){return sequence===this.#sequence&&taskId===this.#taskId&&open;}
 close(){this.#sequence++;this.#taskId=null;this.#snapshot=null;}
 capture(root){if(!root)return;const values={};for(const input of root.querySelectorAll?.('[data-detail-input]')||[]){const key=input.dataset.detailInput;if(key)values[key]={value:input.value,checked:input.checked};}const expanded=[];for(const details of root.querySelectorAll?.('[data-detail-state]')||[]){if(details.open)expanded.push(details.dataset.detailState);}const active=globalThis.document?.activeElement;this.#snapshot={values,expanded,scrollTop:root.scrollTop||0,focusKey:active?.closest?.('[data-detail-input]')?.dataset.detailInput||active?.dataset?.detailFocus||null};}
 restore(root){const snapshot=this.#snapshot;if(!root||!snapshot)return;for(const input of root.querySelectorAll?.('[data-detail-input]')||[]){const saved=snapshot.values[input.dataset.detailInput];if(saved&&!input.dataset.detailDirty){if('value'in saved)input.value=saved.value;if(input.type==='checkbox')input.checked=saved.checked;}}for(const details of root.querySelectorAll?.('[data-detail-state]')||[])details.open=snapshot.expanded.includes(details.dataset.detailState);root.scrollTop=snapshot.scrollTop||0;if(snapshot.focusKey){const target=root.querySelector?.(`[data-detail-input="${CSS.escape(snapshot.focusKey)}"],[data-detail-focus="${CSS.escape(snapshot.focusKey)}"]`);target?.focus?.({preventScroll:true});}}
 markDirty(input){if(input?.dataset)input.dataset.detailDirty='true';}
 clearDirty(key,root){const input=root?.querySelector?.(`[data-detail-input="${CSS.escape(key)}"]`);if(input)delete input.dataset.detailDirty;if(this.#snapshot?.values)delete this.#snapshot.values[key];}
}
