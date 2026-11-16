import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {ACTIONS_PREFIX,actionsKey,actionText,parseActions,changeActions,saveActions} from '../assets/my-build-actions-model.js';
import {installBuildActions} from '../assets/my-build-actions.js';
import {myBuildHomeMarkup} from '../tools/my-build-home-layout.mjs';

const a={preset:'mercenary-twister-gemling',kind:'auto',id:''},named={...a,kind:'named',id:'named-a'},b={preset:'ranger-ice-shot-deadeye',kind:'auto',id:''};
const entry=(id,text,done=false)=>({id,text,done}),raw=items=>JSON.stringify({version:1,items}),error=(fn,code)=>assert.throws(fn,e=>e.message===code);
assert.deepEqual(parseActions(null),[]);assert.equal(actionText('  指輪を交換  '),'指輪を交換');
for(const text of ['', ' '.repeat(3),'a'.repeat(81),'abc\ndef'])error(()=>actionText(text),'TEXT');
assert.equal([...actionText('😀'.repeat(80))].length,80);
for(const value of ['bad',raw([entry('x','')]),raw([entry('x','a'),entry('x','b')]),raw([entry('x','a'),entry('y','a')]),JSON.stringify({version:2,items:[]}),raw([entry('x','a','false')])])error(()=>parseActions(value),'CORRUPT');
let items=[];for(let i=0;i<3;i++)items=changeActions(items,{type:'add',id:'id-'+i,text:'Task '+i});
error(()=>changeActions(items,{type:'add',id:'id-3',text:'Task 3'}),'LIMIT');
error(()=>changeActions(items,{type:'edit',id:'id-2',text:'Task 1'}),'DUPLICATE');
assert.equal(changeActions(items,{type:'check',id:'id-0',done:true})[0].done,true);assert.equal(items[0].done,false);
const memory=new Map(),storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)};
saveActions(storage,actionsKey(a),null,items);error(()=>saveActions(storage,actionsKey(a),null,[]),'STALE');
assert.equal(memory.get(actionsKey(a)),raw(items));assert.notEqual(actionsKey(a),actionsKey(named));assert.notEqual(actionsKey(a),actionsKey(b));

function fixture(en=false,values={}){
 const dom=new JSDOM(`<html lang="${en?'en':'ja'}">${myBuildHomeMarkup([],en)}</html>`,{url:'https://poe2-build-navi-jp.github.io/',pretendToBeVisual:true}),w=dom.window,d=w.document;
 for(const [key,value]of Object.entries(values))w.localStorage.setItem(key,value);
 const section=d.querySelector('[data-my-build-actions]'),controller=installBuildActions(section),find=selector=>section.querySelector(selector);
 controller.update(a);
 const type=text=>{find('[data-actions-input]').value=text;find('[data-actions-input]').dispatchEvent(new w.Event('input',{bubbles:true}));};
 const add=text=>{type(text);find('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
 const rows=()=>[...find('[data-actions-list]').children],stored=record=>parseActions(w.localStorage.getItem(actionsKey(record)));
 return {dom,w,d,find,controller,type,add,rows,stored};
}
for(const en of [false,true]){
 const originals={'poe2-simulator:v1:unchanged':'PRIVATE SAVE','poe2-simulator-goal:v1:unchanged':'PRIVATE GOAL'},f=fixture(en,originals);
 try{
  const {w,d,find,controller,type,add,rows,stored}=f;
  assert.equal(w.localStorage.length,2,'reading cannot create an empty task store');
  add('  指輪を交換  ');add('火耐性を75%にする');add('<img src=x onerror=alert(1)>');
  assert.equal(rows().length,3);assert.equal(rows()[2].querySelector('img'),null);assert.equal(find('[data-actions-input]').disabled,true);
  assert.equal(stored(a)[0].text,'指輪を交換');assert.equal(find('[data-actions-limit]').hidden,false);
  // Keyboard focus stays on the toggled checkbox after rendering.
  const checkbox=rows()[0].querySelector('input');checkbox.focus();checkbox.click();assert.equal(stored(a)[0].done,true);assert.equal(d.activeElement,rows()[0].querySelector('input'));
  assert.match(find('[data-actions-count]').textContent,/1\/3/);
  rows()[1].querySelector('[data-action="edit"]').click();type('冷気耐性を75%にする');find('form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  assert.equal(stored(a)[1].text,'冷気耐性を75%にする');
  find('[data-actions-clear]').click();assert.equal(stored(a).length,2);find('[data-actions-undo]').click();assert.equal(stored(a).length,3);assert.equal(stored(a)[0].done,true);
  rows()[2].querySelector('[data-action="delete"]').click();assert.equal(stored(a).length,2);find('[data-actions-undo]').click();assert.equal(stored(a).length,3);
  // Switching and frequent dashboard refreshes keep each configuration's draft.
  controller.update(named);assert.equal(rows().length,0);type('下書きを保持');controller.update(named);assert.equal(find('[data-actions-input]').value,'下書きを保持');
  controller.update(b);add('Bだけの項目');controller.update(named);assert.equal(find('[data-actions-input]').value,'下書きを保持');add('名前付きだけ');
  controller.update(a);assert.equal(rows().length,3);assert.equal(stored(named)[0].text,'名前付きだけ');assert.equal(stored(b)[0].text,'Bだけの項目');
  // A second view's write is never silently replaced by a stale form submission.
  controller.update(b);type('保存する入力');w.localStorage.setItem(actionsKey(b),raw([entry('other','別の画面の項目')]));
  find('form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(stored(b).length,1);assert.equal(find('[data-actions-input]').value,'保存する入力');assert.match(find('[data-actions-status]').textContent,en?/changed in another view/:/別の画面で更新/);
  find('form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(stored(b).length,2);
  // External deletes retain text currently being edited as an add draft.
  rows()[0].querySelector('[data-action="edit"]').click();type('編集内容を保持');w.localStorage.setItem(actionsKey(b),raw([]));w.dispatchEvent(new w.StorageEvent('storage',{key:actionsKey(b)}));
  assert.equal(find('[data-actions-input]').value,'編集内容を保持');assert.equal(find('[data-actions-cancel]').hidden,true);
  add('');assert.match(find('[data-actions-status]').textContent,/80/);assert.equal(stored(b).length,0);
  add('重複');add('重複');assert.equal(stored(b).length,1);assert.match(find('[data-actions-status]').textContent,en?/already/:/すでに/);
  // Unsuccessful writes preserve the form and old data.
  const originalStorage=w.localStorage,before=originalStorage.getItem(actionsKey(b));
  Object.defineProperty(w,'localStorage',{configurable:true,value:{getItem:key=>originalStorage.getItem(key),setItem(){throw Error('quota');}}});
  add('容量エラー時の入力');assert.equal(find('[data-actions-input]').value,'容量エラー時の入力');assert.equal(originalStorage.getItem(actionsKey(b)),before);
  Object.defineProperty(w,'localStorage',{configurable:true,value:originalStorage});
  // Malformed task data stays intact and cannot disable the other builds.
  w.localStorage.setItem(actionsKey(b),'broken');controller.update(b);assert.equal(find('[data-actions-submit]').disabled,true);assert.equal(w.localStorage.getItem(actionsKey(b)),'broken');assert.equal(find('[data-actions-retry]').hidden,false);
  controller.update(a);assert.equal(rows().length,3);controller.update(b);w.localStorage.setItem(actionsKey(b),raw([]));find('[data-actions-retry]').click();assert.equal(find('[data-actions-submit]').disabled,false);
  for(const [key,value]of Object.entries(originals))assert.equal(w.localStorage.getItem(key),value);
  assert([...Array(w.localStorage.length)].map((_,i)=>w.localStorage.key(i)).every(key=>key in originals||key.startsWith(ACTIONS_PREFIX)));
  const reloaded=fixture(en,Object.fromEntries([...Array(w.localStorage.length)].map((_,i)=>{const key=w.localStorage.key(i);return [key,w.localStorage.getItem(key)];})));
  try{assert.equal(reloaded.rows().length,3);assert.equal(reloaded.stored(a)[0].done,true);}finally{reloaded.dom.window.close();}
 }finally{f.dom.window.close();}
}
console.log('PASS: three-item limit, validation, per-configuration persistence, safe text, completion, editing, removal/undo, keyboard focus, drafts, cross-view conflicts, write failure and corrupt-data isolation in Japanese and English.');
