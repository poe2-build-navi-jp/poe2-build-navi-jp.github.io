import {recordKey} from './my-build-home-model.js?v=4cc2349cc9';

export const ACTIONS_PREFIX='poe2-build-next-actions:v1:';
export const ACTION_LIMIT=3;
export const TEXT_LIMIT=80;
const fail=code=>{throw Error(code);};
export const actionsKey=record=>ACTIONS_PREFIX+recordKey(record);
export function actionText(value){
 if(typeof value!=='string')fail('TEXT');
 const text=value.trim();
 if(!text||[...text].length>TEXT_LIMIT||/[\u0000-\u001f\u007f]/.test(text))fail('TEXT');
 return text;
}
export function parseActions(raw){
 if(raw===null)return [];
 try{
  if(typeof raw!=='string'||raw.length>5000)fail('CORRUPT');
  const data=JSON.parse(raw);
  if(data?.version!==1||!Array.isArray(data.items)||data.items.length>ACTION_LIMIT)fail('CORRUPT');
  const ids=new Set(),texts=new Set();
  return data.items.map(item=>{
   if(!item||typeof item.id!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(item.id)||ids.has(item.id)||typeof item.done!=='boolean')fail('CORRUPT');
   const text=actionText(item.text);
   if(text!==item.text||texts.has(text))fail('CORRUPT');
   ids.add(item.id);texts.add(text);return {id:item.id,text,done:item.done};
  });
 }catch{fail('CORRUPT');}
}
export function changeActions(items,action){
 let next=items.map(item=>({...item}));
 const item=next.find(row=>row.id===action.id);
 if(action.type==='add'){
  if(next.length>=ACTION_LIMIT)fail('LIMIT');
  next.push({id:action.id,text:actionText(action.text),done:false});
 }else if(action.type==='clear')next=next.filter(row=>!row.done);
 else if(action.type==='restore')next=action.items;
 else{
  if(!item)fail('MISSING');
  if(action.type==='edit')item.text=actionText(action.text);
  else if(action.type==='check')item.done=!!action.done;
  else if(action.type==='delete')next=next.filter(row=>row.id!==action.id);
  else fail('ACTION');
 }
 if(new Set(next.map(row=>row.text)).size!==next.length)fail('DUPLICATE');
 return parseActions(JSON.stringify({version:1,items:next}));
}
// Compare immediately before the synchronous write; stale tabs cannot replace
// a newer list. This store is separate from calculator saves and target data.
export function saveActions(storage,key,expected,items){
 const raw=JSON.stringify({version:1,items});parseActions(raw);
 if(storage.getItem(key)!==expected)fail('STALE');
 storage.setItem(key,raw);return raw;
}
