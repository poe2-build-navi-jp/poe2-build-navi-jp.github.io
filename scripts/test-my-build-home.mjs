import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {HOME_KEY,SEEN_KEY,readHomeRecords,selectHomeRecord,resumeHref,readHomeGoal,summarizeHomeGoal,homeNotices,readSeen} from '../assets/my-build-home-model.js';
import {installMyBuildHome} from '../assets/my-build-home.js';
import {makeGoal,goalKey} from '../assets/simulator-goal-model.js';
import {namedPlanKey} from '../assets/simulator-model.js';
import {myBuildHomeMarkup} from '../tools/my-build-home-layout.mjs';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const [presets,enPresets,examples,index]=await Promise.all(['data/simulator-presets.json','data/simulator-presets-en.json','data/simulator-examples.json','data/simulator-index.json'].map(read));
const a=presets.find(p=>p.id==='mercenary-twister-gemling'),b=presets.find(p=>p.id==='ranger-ice-shot-deadeye');
const target=structuredClone(examples.examples.find(e=>e.id==='complete-'+a.id).saved),working=structuredClone(target),other=structuredClone(examples.examples.find(e=>e.id==='complete-'+b.id).saved);
working.request.character.level=85;working.savedAt='2026-11-16T16:00:00Z';working.notes='PRIVATE NOTES SHOULD NEVER LEAVE THE DEVICE';
working.request.items=working.request.items.filter(item=>item.slot!=='helmet');working.request.socket_groups[0].gems[0].level=1;
const removed=target.request.allocated_nodes.filter(id=>index.nodes[id]?.kind==='normal').slice(-2);assert.equal(removed.length,2);working.request.allocated_nodes=working.request.allocated_nodes.filter(id=>!removed.includes(id));
other.savedAt='2026-11-16T15:00:00Z';other.request.character.level=83;
const named=structuredClone(target);named.savedAt='2026-11-16T14:00:00Z';
const unsafeName='<img src=x onerror=alert(1)>',goal=makeGoal({kind:'example',id:'goal-a',name:'PRIVATE GOAL NAME',saved:target},a.id);
const noticeCatalog={version:1,engine:target.engine,dataVersion:'0.5.5.5',guideRevisions:{},notices:[
 {id:'for-a',revision:2,presets:[a.id],title:{ja:'Aの変更',en:'Changes for A'},date:'2026-11-16',href:'/poe2-1-0/build-status/'},
 {id:'for-b',revision:1,presets:[b.id],title:{ja:'Bの変更',en:'Changes for B'},date:'2026-11-16',href:'/guides/'},
 {id:'unsafe',revision:1,presets:[a.id],title:{ja:'外部',en:'Outside'},href:'javascript:alert(1)'},
]};
const entries={
 ['poe2-simulator:v1:'+a.id]:JSON.stringify(working),['poe2-simulator:v1:'+b.id]:JSON.stringify(other),
 [namedPlanKey(a.id)]:JSON.stringify({version:1,plans:[{id:'named-a',name:unsafeName,saved:named},{id:'invalid id',name:'Broken',saved:named}]}),
 [goalKey(a.id)]:JSON.stringify(goal),
};
const fakeStorage={getItem:key=>entries[key]??null};
const before=JSON.stringify(entries),state=readHomeRecords(fakeStorage,presets);
assert.equal(state.records.length,3);assert.equal(state.problems.length,1,'a broken entry must leave other saves available');assert.equal(JSON.stringify(entries),before);
assert.equal(selectHomeRecord(state.records,null).preset,a.id);assert.equal(selectHomeRecord(state.records,'broken-json').kind,'auto');
const namedRecord=state.records.find(row=>row.id==='named-a');assert.equal(selectHomeRecord(state.records,JSON.stringify({version:1,key:namedRecord.key})).id,'named-a');
assert.equal(selectHomeRecord(state.records,JSON.stringify({version:1,key:'deleted-save'})).kind,'auto');
assert.match(resumeHref(namedRecord,true,'goal'),/^\/en\/simulator\/\?build=mercenary-twister-gemling&saved=named-a&home=goal#sim-goal-panel$/);
const current=state.records.find(row=>row.kind==='auto'&&row.preset===a.id);
const summary=summarizeHomeGoal(current,readHomeGoal(fakeStorage,current),index);
assert.equal(summary.gems,1);assert.equal(summary.equipment,1);assert.equal(summary.passives,2);assert.equal(summary.current,85);assert.equal(summary.target,100);
assert.equal(summarizeHomeGoal(current,goal,{...index,treeVersion:'other-version'}).passives,null,'a different tree must never report zero missing passives');
assert.equal(summarizeHomeGoal(current,goal,{...index,treeVersion:'other-version'}).unverified,true);
assert.equal(readHomeGoal(fakeStorage,state.records.find(row=>row.preset===b.id)),null);
assert.deepEqual(homeNotices(noticeCatalog,current).map(n=>n.id),['for-a']);assert.equal(homeNotices(noticeCatalog,current,{'for-a':2})[0].unread,false);
assert.throws(()=>readSeen('{broken'));assert.equal(JSON.stringify(entries),before);

const snapshot=storage=>Object.fromEntries(Array.from({length:storage.length},(_,i)=>{const key=storage.key(i);return [key,storage.getItem(key)];}));
function fixture(en=false,values=entries,{offline=false,gate=null}={}){
 const catalog=en?enPresets:presets,dom=new JSDOM(`<html lang="${en?'en':'ja'}"><main>${myBuildHomeMarkup(catalog,en)}<h1>Existing introduction</h1></main></html>`,{url:'https://poe2-build-navi-jp.github.io/'+(en?'en/simulator/':''),pretendToBeVisual:true});
 const w=dom.window,d=w.document,requests=[],analytics=[];w.structuredClone=structuredClone;w.HTMLElement.prototype.scrollIntoView=function(){};
 for(const [key,value]of Object.entries(values))w.localStorage.setItem(key,value);
 w.Worker=class{constructor(){throw Error('Home must not boot the calculation engine');}};
 w.gtag=(...event)=>analytics.push(event);
 w.fetch=async(url,options)=>{requests.push({url,credentials:options.credentials});if(offline)throw Error('offline');if(url.includes('simulator-index')){if(gate)await gate;return new Response(JSON.stringify(index));}return new Response(JSON.stringify(noticeCatalog));};
 return {dom,w,d,requests,analytics};
}
for(const en of [false,true]){
 const f=fixture(en),{w,d}=f,original=snapshot(w.localStorage);
 try{
  const home=installMyBuildHome(d);await home.ready;
  assert.equal(d.querySelector('#my-build-home').hidden,false);assert.equal(d.querySelector('[data-my-build-level]').textContent,'85');
  assert.deepEqual([...d.querySelectorAll('.my-build-goal-counts dd')].map(e=>e.textContent),['1','2','1']);
  assert.equal(d.querySelector('#my-build-name').querySelector('img'),null);assert.equal(d.querySelectorAll('.my-build-notices a').length,1);
  assert.deepEqual(snapshot(w.localStorage),original,'viewing the home cannot mutate saves, goals, or seen status');
  const picker=d.querySelector('#my-build-select');picker.value=namedRecord.key;picker.dispatchEvent(new w.Event('change'));await home.refresh();
  assert.equal(d.querySelector('#my-build-name').textContent,unsafeName);assert.equal(d.querySelector('#my-build-name img'),null);assert.match(d.querySelector('[data-my-build-resume]').getAttribute('href'),/saved=named-a/);
  assert.equal(d.querySelector('[data-my-build-level]').textContent,'100');assert.deepEqual([...d.querySelectorAll('.my-build-goal-counts dd')].map(e=>e.textContent),['0','0','0']);
  const link=d.querySelector('[data-my-build-resume]');link.addEventListener('click',event=>event.preventDefault());link.click();
  assert.equal(f.analytics.filter(e=>e[1]==='my_build_home_resume').length,1);
  assert(!JSON.stringify(f.analytics).includes('PRIVATE'));assert(!JSON.stringify(f.analytics).includes(unsafeName));
  const bRecord=state.records.find(row=>row.preset===b.id);picker.value=bRecord.key;picker.dispatchEvent(new w.Event('change'));await home.refresh();
  assert.match(d.querySelector('[data-my-build-goal]').textContent,en?/Set a target/:/目標を設定/);assert.match(d.querySelector('.my-build-notices').textContent,en?/Changes for B/:/Bの変更/);
  d.querySelector('[data-my-build-seen]').click();await home.refresh();assert.equal(JSON.parse(w.localStorage.getItem(SEEN_KEY))['for-b'],1);
  assert.equal(d.querySelector('[data-my-build-seen]').hidden,true);
  for(const [key,value]of Object.entries(original))assert.equal(w.localStorage.getItem(key),value,'home actions preserve the original save and goal bytes');
  assert(f.requests.every(request=>request.url.startsWith('/data/')&&request.credentials==='omit'));
 }finally{f.dom.window.close();}
}
// An out-of-order target fetch may not replace the newly selected build’s summary.
let release;const gate=new Promise(resolve=>release=resolve),race=fixture(false,entries,{gate});
try{const home=installMyBuildHome(race.d);await new Promise(resolve=>setTimeout(resolve,0));const picker=race.d.querySelector('#my-build-select');picker.value=state.records.find(row=>row.preset===b.id).key;picker.dispatchEvent(new race.w.Event('change'));release();await home.ready;await home.refresh();assert.equal(race.d.querySelector('[data-my-build-level]').textContent,'83');assert(!race.d.querySelector('[data-my-build-goal]').textContent.includes('PRIVATE GOAL'));}finally{race.dom.window.close();}
const offline=fixture(false,entries,{offline:true});try{const home=installMyBuildHome(offline.d);await home.ready;assert.equal(offline.d.querySelector('[data-my-build-resume]').getAttribute('href'),resumeHref(current));assert.equal(offline.d.querySelector('[data-my-build-retry]').hidden,false);assert.equal(offline.d.querySelector('[data-my-build-level]').textContent,'85');}finally{offline.dom.window.close();}
const empty=fixture(false,{});try{await installMyBuildHome(empty.d).ready;assert.equal(empty.d.querySelector('#my-build-home').hidden,true);assert.equal(empty.requests.length,0);assert.equal(empty.w.localStorage.length,0);}finally{empty.dom.window.close();}
const blocked=fixture(false,{});try{Object.defineProperty(blocked.w,'localStorage',{get(){throw Error('blocked');}});await installMyBuildHome(blocked.d).ready;assert.match(blocked.d.querySelector('[data-my-build-warning]').textContent,/保存を確認できません/);assert.equal(blocked.d.querySelector('h1').textContent,'Existing introduction');}finally{blocked.dom.window.close();}
console.log('PASS: private read-only home, isolated corrupt saves, recent/pinned selection, named-save links, exact goal gaps, unknown tree safeguards, relevant/unread notices, safe text, no engine, offline continuation, stale fetch isolation, and JA/EN rendering.');
