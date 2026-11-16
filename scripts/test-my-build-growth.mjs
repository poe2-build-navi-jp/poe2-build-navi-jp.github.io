import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {GROWTH_STATS,growthKey,parseGrowth,makeGrowth,appendGrowth,growthDifference,saveGrowth} from '../assets/my-build-growth-model.js';
import {installGrowthHistory,installGrowthEditor} from '../assets/my-build-growth.js';
import {growthMarkup} from '../tools/my-build-growth-layout.mjs';
const a='mercenary-twister-gemling',b='ranger-ice-shot-deadeye',examples=JSON.parse(await readFile(new URL('../data/simulator-examples.json',import.meta.url),'utf8'));
const saved=examples.examples.find(row=>row.id==='complete-'+a).saved;
const data={saved:structuredClone(saved),runtime:{release:'0.0.46',dataVersion:'0.5.5.5'},values:{CombinedDPS:null,Life:2100,EnergyShield:400,Armour:0,FireResist:70,ColdResist:75,LightningResist:75,ChaosResist:-20},warning:false};
data.saved.request.character.level=85;
const meta={id:'first',at:'2026-11-17T00:00:00Z'},first=makeGrowth(data,'最初の記録',meta),up=structuredClone(data);up.saved.request.character.level=86;up.values.Life+=100;up.values.FireResist=75;
const second=makeGrowth(up,'指輪交換後',{...meta,id:'second',at:'2026-11-18T00:00:00Z'}),raw=records=>JSON.stringify({version:1,records});
assert.deepEqual(parseGrowth(null,a),[]);assert.equal(first.values.CombinedDPS,null);
assert.equal(growthDifference(second,first).deltas.Life,100);assert.equal(growthDifference(second,first).deltas.FireResist,5);assert.equal(growthDifference(second,first).deltas.CombinedDPS,null);
assert.equal(growthDifference(second,first).deltas.Armour,0,'a real zero must not be treated as missing');
for(const key of ['data','engine','mainSkill','config','weaponSet','tree']){const changed=structuredClone(second);changed.conditions[key]=key==='weaponSet'?2:changed.conditions[key]+' different';assert(growthDifference(changed,first).differences.includes(key));assert.equal(growthDifference(changed,first).deltas.Life,null);}
assert.equal(growthDifference({...second,warning:true},first).deltas.Life,null,'diagnostic records cannot masquerade as clean improvement');
assert.throws(()=>appendGrowth([first],{...first,id:'duplicate'}),/GROWTH_DUPLICATE/);
const thirty=Array.from({length:30},(_,i)=>({...first,id:'record-'+i,level:i+1}));assert.equal(parseGrowth(raw(thirty),a).length,30);assert.throws(()=>appendGrowth(thirty,second),/GROWTH_CAPACITY/);
for(const value of ['bad',raw([{...first,preset:b}]),raw([{...first,values:{...first.values,Life:'100'}}]),raw([first,first]),raw([{...first,at:'bad'}])])assert.throws(()=>parseGrowth(value,a),/GROWTH_FORMAT/);
const store=new Map(),storage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)};saveGrowth(storage,a,null,[first]);assert.throws(()=>saveGrowth(storage,a,null,[second]),/GROWTH_STALE/);assert.equal(store.get(growthKey(a)),raw([first]));

for(const en of [false,true]){
 const dom=new JSDOM(`<html lang="${en?'en':'ja'}"><div id="sim-workbench"><div id="sim-stats" aria-busy="false"></div>${growthMarkup(en,true)}</div>${growthMarkup(en)}</html>`,{url:'https://poe2-build-navi-jp.github.io/simulator/',pretendToBeVisual:true});
 const w=dom.window,d=w.document,homeSection=d.querySelector('#my-build-growth'),editorSection=d.querySelector('#sim-growth-panel'),home=installGrowthHistory(homeSection);
 let current=structuredClone(data),preset=a;
 w.Poe2SimulatorLibrary={read:()=>({preset}),growthData:()=>current};
 w.localStorage.setItem('poe2-simulator:v1:private','PRIVATE SAVE');w.localStorage.setItem('poe2-simulator-goal:v1:private','PRIVATE GOAL');
 try{
  home.update(a);const editor=installGrowthEditor(d),input=editorSection.querySelector('[data-growth-label]'),button=editorSection.querySelector('[data-growth-save]');
  assert.equal(w.localStorage.length,2,'reading history is read-only');assert.equal(button.disabled,false);
  input.value='<img src=x onerror=alert(1)>';button.click();assert.equal(parseGrowth(w.localStorage.getItem(growthKey(a)),a).length,1);assert.equal(homeSection.querySelector('img'),null);assert.equal(editorSection.querySelector('img'),null);
  current=up;input.value='指輪交換後';button.click();assert.equal(parseGrowth(w.localStorage.getItem(growthKey(a)),a).length,2);assert.match(homeSection.textContent,/\+100/);assert.match(homeSection.textContent,/Lv85 → Lv86/);
  button.click();assert.equal(parseGrowth(w.localStorage.getItem(growthKey(a)),a).length,2);assert.match(editorSection.querySelector('[data-growth-status]').textContent,en?/match the last record/:/直前と同じ/);
  homeSection.querySelector('[data-growth-delete]').click();assert.equal(parseGrowth(w.localStorage.getItem(growthKey(a)),a).length,1);homeSection.querySelector('[data-growth-undo]').click();assert.equal(parseGrowth(w.localStorage.getItem(growthKey(a)),a).length,2);
  home.update(b);assert.match(homeSection.textContent,en?/No records yet/:/まだ記録はありません/);home.update(a);assert.match(homeSection.textContent,/\+100/);
  // Newer records with different calculation settings show values without deltas.
  current=structuredClone(up);current.values.Life+=50;current.saved.request.config_inputs={...current.saved.request.config_inputs,conditionEnemyBoss:true};button.click();assert.equal(homeSection.querySelectorAll('.growth-delta').length,0);assert.match(homeSection.textContent,en?/Conditions differ/:/条件が異なる/);
  const old=w.localStorage.getItem(growthKey(a));w.localStorage.setItem(growthKey(a),raw([second,first]));current=structuredClone(up);current.values.Life+=300;input.value='競合時の入力';editor.history.add(current,input.value);assert.equal(w.localStorage.getItem(growthKey(a)),raw([second,first]));assert.equal(input.value,'競合時の入力');assert.match(editorSection.querySelector('[data-growth-status]').textContent,en?/changed in another view/:/別の画面で履歴/);
  // A quota failure retains both old records and input.
  const local=w.localStorage;Object.defineProperty(w,'localStorage',{configurable:true,value:{getItem:key=>local.getItem(key),setItem(){throw Error('quota');}}});button.click();assert.equal(input.value,'競合時の入力');assert.equal(local.getItem(growthKey(a)),raw([second,first]));Object.defineProperty(w,'localStorage',{configurable:true,value:local});
  local.setItem(growthKey(a),'broken');home.update(a);assert.equal(local.getItem(growthKey(a)),'broken');assert.equal(homeSection.querySelector('[data-growth-retry]').hidden,false);assert.equal(homeSection.querySelectorAll('[data-growth-delete]').length,0);home.update(b);assert.match(homeSection.textContent,en?/No records yet/:/まだ記録はありません/);
  assert.equal(local.getItem('poe2-simulator:v1:private'),'PRIVATE SAVE');assert.equal(local.getItem('poe2-simulator-goal:v1:private'),'PRIVATE GOAL');
  current=null;editor.refresh();assert.equal(button.disabled,true,'no incomplete/stale calculation can be recorded');
  editor.observer.disconnect();assert(old.includes('指輪交換後'));assert.equal(GROWTH_STATS.length,8);
 }finally{dom.window.close();}
}
console.log('PASS: frozen growth values, real/missing zero distinction, fair-condition deltas, diagnostics, 30-record capacity, duplicate prevention, private notes, cross-build isolation, removal/undo, storage conflicts, quota protection and JA/EN history.');
