import {ACTION_LIMIT,actionsKey,parseActions,changeActions,saveActions} from './my-build-actions-model.js?v=0f10b12102';

export function installBuildActions(section){
 if(!section)return {update(){}};
 const document=section.ownerDocument,window=document.defaultView,en=document.documentElement.lang==='en',t=(ja,english)=>en?english:ja;
 const find=selector=>section.querySelector(selector),make=(tag,text,className='')=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
 const form=find('form'),input=find('[data-actions-input]'),submit=find('[data-actions-submit]'),cancel=find('[data-actions-cancel]'),list=find('[data-actions-list]'),status=find('[data-actions-status]'),clear=find('[data-actions-clear]'),undo=find('[data-actions-undo]'),retry=find('[data-actions-retry]');
 const states=new Map();let active=null;
 const say=text=>{status.textContent=text;};
 const storage=()=>window.localStorage;
 function read(state){
  try{
   const raw=storage().getItem(state.key);
   if(!state.broken&&state.raw===raw)return false;
   const items=parseActions(raw);
   if(state.raw!==raw)state.undo=null;
   state.raw=raw;state.items=items;state.broken=false;
   if(state.editing&&!items.some(item=>item.id===state.editing)){
    state.editing=null;state.message=t('編集中の項目が別の画面で削除されました。入力内容は追加欄に残しています。','The item being edited was removed in another view. Your text is kept in the add field.');
   }
   return true;
  }catch{state.broken=true;state.message=t('この構成の項目を読み込めません。保存内容を保護するため、再読み込みするまで編集を止めています。','This list could not be read. Editing is paused to protect the stored data. Try reloading the list.');return true;}
 }
 function render(){
  if(!active)return;
  const state=active,done=state.items.filter(item=>item.done).length,full=state.items.length>=ACTION_LIMIT;
  const focused=document.activeElement,focusedRow=focused?.closest('.my-build-task'),focusedId=focusedRow?.dataset.id,focusedAction=focused?.dataset.action;
  find('[data-actions-count]').textContent=t(`${done}/${state.items.length} 完了`,`${done}/${state.items.length} done`);
  const rows=state.broken?[]:state.items.map(item=>{
   const row=make('li',undefined,'my-build-task'+(item.done?' is-done':'')),label=make('label',undefined,'my-build-task-check'),checkbox=make('input');
   row.dataset.id=item.id;
   checkbox.type='checkbox';checkbox.checked=item.done;checkbox.addEventListener('change',()=>mutate({type:'check',id:item.id,done:checkbox.checked}));
   label.append(checkbox,make('span',item.text));
   const actions=make('div',undefined,'my-build-task-buttons');
   for(const [type,title]of [['edit',t('編集','Edit')],['delete',t('削除','Delete')]]){
    const button=make('button',title);button.type='button';button.dataset.action=type;button.setAttribute('aria-label',`${title}: ${item.text}`);
    button.addEventListener('click',()=>{if(type==='delete')mutate({type,id:item.id});else{state.editing=item.id;state.draft=item.text;state.message='';render();input.focus();}});actions.append(button);
   }
   row.append(label,actions);return row;
  });
  list.replaceChildren(...rows);
  find('[data-actions-empty]').hidden=state.broken||!!state.items.length;
  input.value=state.draft;input.disabled=state.broken||(full&&!state.editing);
  submit.disabled=input.disabled;submit.textContent=state.editing?t('保存','Save'):t('追加','Add');
  find('[data-actions-label]').textContent=state.editing?t('項目を編集','Edit item'):t('やることを追加','Add a next step');
  cancel.hidden=!state.editing;clear.hidden=state.broken||!done;undo.hidden=state.broken||!state.undo;retry.hidden=!state.broken;
  find('[data-actions-limit]').hidden=state.broken||!full||!!state.editing;
  say(state.message||'');
  if(focusedRow&&list.contains(focusedRow)===false){
   const row=[...list.children].find(item=>item.dataset.id===focusedId);
   (row?.querySelector(focusedAction?`[data-action="${focusedAction}"]`:'input')||(!input.disabled?input:submit)).focus();
  }
 }
 function update(record){
  if(!record){active=null;return;}
  const key=actionsKey(record);let state=states.get(key);
  if(!state){state={key,raw:undefined,items:[],draft:'',editing:null,undo:null,broken:false,message:''};states.set(key,state);}
  const changed=read(state),switched=active!==state;active=state;
  if(changed||switched)render();
 }
 function mutate(action){
  const state=active;if(!state||state.broken)return;
  try{
   const next=changeActions(state.items,action),previous=state.items;
   state.raw=saveActions(storage(),state.key,state.raw,next);state.items=next;
   state.undo=['delete','clear'].includes(action.type)?previous:null;
   if(action.type==='add'||action.type==='edit'){state.draft='';state.editing=null;}
   if(state.editing&&!next.some(item=>item.id===state.editing))state.editing=null;
   state.message=action.type==='check'?t(action.done?'完了にしました。':'未完了に戻しました。',action.done?'Marked as done.':'Marked as to do.'):action.type==='delete'||action.type==='clear'?t('削除しました。「削除を戻す」で元に戻せます。','Removed. Use Undo removal to restore.'):action.type==='restore'?t('削除を戻しました。','Removal undone.'):t('保存しました。','Saved.');
   render();
   if(action.type==='add'||action.type==='edit')(input.disabled?list.querySelector('[data-action="edit"]'):input)?.focus();
   window.dispatchEvent(new window.CustomEvent('poe2:next-actions',{detail:{key:state.key}}));
  }catch(error){
   const messages={TEXT:t('1〜80文字で入力してください。','Enter 1–80 characters.'),LIMIT:t('保存できるのは3件までです。','You can keep up to three items.'),DUPLICATE:t('同じ内容の項目がすでにあります。','This item is already on the list.'),STALE:t('別の画面で更新されました。最新の一覧を表示しています。入力内容を確認して、もう一度保存してください。','This list changed in another view. Review the latest list and save your text again.')};
   if(error.message==='STALE')read(state);
   state.message=messages[error.message]||t('保存できませんでした。入力内容を残しています。ブラウザーの空き容量・保存設定を確認してから、もう一度お試しください。','Could not save. Your input is kept. Check available browser storage and try again.');render();input.focus();
  }
 }
 input.addEventListener('input',()=>{if(active)active.draft=input.value;});
 const newId=()=>window.crypto.randomUUID?.()||Array.from(window.crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
 form.addEventListener('submit',event=>{event.preventDefault();if(!active||submit.disabled)return;mutate({type:active.editing?'edit':'add',id:active.editing||newId(),text:input.value});});
 const cancelEdit=()=>{if(!active)return;active.editing=null;active.draft='';active.message='';render();input.focus();};
 cancel.addEventListener('click',cancelEdit);input.addEventListener('keydown',event=>{if(event.key==='Escape'&&active?.editing){event.preventDefault();cancelEdit();}});
 clear.addEventListener('click',()=>mutate({type:'clear'}));undo.addEventListener('click',()=>{if(active?.undo)mutate({type:'restore',items:active.undo});});
 retry.addEventListener('click',()=>{if(active){active.message='';read(active);render();}});
 window.addEventListener('storage',event=>{if(active&&(!event.key||event.key===active.key)){if(read(active))render();}});
 window.addEventListener('poe2:next-actions',event=>{if(active&&event.detail?.key===active.key&&read(active))render();});
 window.addEventListener('focus',()=>{if(active&&read(active))render();});
 return {update};
}
