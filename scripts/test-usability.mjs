import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Worker} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
import {JSDOM,VirtualConsole} from 'jsdom';
import {installSiteUsability,readLibrary,readingPath} from '../assets/site-usability.js';
import {installSimulatorUsability} from '../assets/simulator-usability.js';
import {installSimulatorFlow} from '../assets/simulator-flow.js';
import {searchEquipment,openEquipmentPicker} from '../assets/simulator-equipment-picker.js';
import {equipmentIcons} from '../assets/equipment-icon-data.js';
import * as model from '../assets/simulator-model.js';
const root=resolve(import.meta.dirname,'..'),read=p=>readFile(resolve(root,p),'utf8');
function dialogs(window){window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};window.HTMLElement.prototype.scrollIntoView=function(){};}
const origin='https://poe2-build-navi-jp.github.io';
assert.equal(readingPath('javascript:alert(1)',origin),null);assert.equal(readingPath('//evil.example/',origin),null);
assert.deepEqual(readLibrary('{bad json',origin),{favorites:[],recent:[]});
assert.equal(readLibrary(JSON.stringify({favorites:[{path:'//evil.example/',title:'bad'},{path:'/guides/mana-problem/',title:'Safe'},{path:'/guides/mana-problem/',title:'duplicate'}]}),origin).favorites.length,1);
const article=new JSDOM(await read('equipment/the-taming/index.html'),{url:origin+'/equipment/the-taming/',pretendToBeVisual:true});dialogs(article.window);
try{
 const d=article.window.document;installSiteUsability(d);
 const search=d.querySelector('[data-site-tools] form');assert.equal(search.getAttribute('action'),'/search/');assert.equal(search.method,'get');assert.equal(search.querySelector('input').name,'q');
 const save=d.querySelector('[data-reading-save]');save.click();assert.equal(save.getAttribute('aria-pressed'),'true');
 d.querySelector('[data-reading-open]').click();assert(d.querySelector('dialog').open);assert(d.querySelector('[data-reading-list="favorites"] a').textContent.includes('テイミング'));assert.equal(d.querySelector('[data-reading-list="recent"] a').getAttribute('href'),'/equipment/the-taming/');
 d.querySelector('[data-reading-close]').click();assert.equal(d.activeElement,d.querySelector('[data-reading-open]'));
 save.click();assert.equal(save.getAttribute('aria-pressed'),'false');
 let legacy=0;const menu=d.querySelector('.menu-button');menu.addEventListener('click',()=>legacy++);menu.click();assert.equal(menu.getAttribute('aria-expanded'),'true');assert.equal(legacy,0);
 d.dispatchEvent(new article.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(menu.getAttribute('aria-expanded'),'false');assert.equal(d.activeElement,menu);
 d.dispatchEvent(new article.window.KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true,cancelable:true}));assert.equal(d.activeElement,d.querySelector('#site-quick-query'));
}finally{article.window.close();}
const taming=equipmentIcons.find(e=>e.name==='The Taming'),astro=equipmentIcons.find(e=>e.name==='Astramentis');
const options=[{value:String(taming.uniqueId),label:'テイミング'},{value:String(astro.uniqueId),label:'アストラメンティス'}];
assert.equal(searchEquipment(options,'ていみんぐ','unique')[0].image.name,'The Taming');assert.equal(searchEquipment(options,'ASTRAMENTIS','unique').length,1);
const chooser=new JSDOM('<main><button id="open">Open</button></main>',{url:origin,pretendToBeVisual:true});dialogs(chooser.window);
try{let chosen;const d=chooser.window.document;openEquipmentPicker({document:d,options,kind:'unique',onSelect:v=>chosen=v,returnFocus:d.querySelector('button')});assert(d.querySelector('dialog').open);assert.equal(d.querySelectorAll('[data-equipment-choice]').length,2);d.querySelector(`[data-equipment-choice="${taming.uniqueId}"]`).click();assert.equal(chosen,String(taming.uniqueId));assert.equal(d.activeElement,d.querySelector('#open'));}finally{chooser.window.close();}

// Exercise the real simulator and engine, including responses that arrive after
// switching slots or typing a replacement draft. No change is saved by a picker.
const native=new Worker(new URL('./fixtures/simulator-worker-node.mjs',import.meta.url),{execArgv:[]});
let sequence=0;const tasks=new Map();native.on('message',m=>{if(m.progress)return;const task=tasks.get(m.id);if(!task)return;tasks.delete(m.id);m.error?task.reject(Error(m.error)):task.resolve(m.result);});native.on('error',error=>{for(const task of tasks.values())task.reject(error);});
const rpc=(action,payload)=>new Promise((resolve,reject)=>{const id=++sequence;tasks.set(id,{resolve,reject});native.postMessage({id,action,payload});});
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',error=>{if(!error.message.includes('navigation'))errors.push(error.message);});
const dom=new JSDOM(await read('simulator/index.html'),{url:origin+'/simulator/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window,d=w.document;dialogs(w);Object.assign(w,model,{structuredClone,DecompressionStream,WebAssembly});
w.fetch=async url=>new Response(await read(new URL(String(url),origin).pathname.slice(1)));
let holdUnique=false,releaseUnique,runtimeTraps=1,workerStarts=0;const workerInstances=[];
w.Worker=class{constructor(){workerStarts++;workerInstances.push(this);}postMessage({id,action,payload}){if(action==='calculate'&&runtimeTraps>0){runtimeTraps--;queueMicrotask(()=>this.onmessage?.({data:{id,error:'QA trapped calculation',errorCode:'ENGINE_STARTUP_FAILURE'}}));return;}rpc(action,payload).then(result=>{const deliver=()=>this.onmessage?.({data:{id,result}});if(action==='unique'&&holdUnique){holdUnique=false;releaseUnique=deliver;}else deliver();},error=>this.onmessage?.({data:{id,error:error.message}}));}};
let code=await read('assets/simulator.js');code=code.replace(/^import[^\n]+\n/,'').replaceAll('import.meta.url',JSON.stringify(pathToFileURL(resolve(root,'assets/simulator.js')).href));
const wait=async predicate=>{const until=Date.now()+30000;while(!predicate()){if(Date.now()>until)throw Error('Timeout: '+d.getElementById('sim-error').textContent+' / '+d.querySelector('#sim-editor-draft-status')?.textContent);await new Promise(r=>setTimeout(r,20));}};
const click=selector=>{const e=d.querySelector(selector);assert(e,selector);e.click();};
const change=(selector,value,type='change')=>{const e=d.querySelector(selector);assert(e,selector);e.value=value;e.dispatchEvent(new w.Event(type,{bubbles:true}));};
const ready=()=>d.querySelector('#sim-stats').getAttribute('aria-busy')==='false'&&!!d.querySelector('.sim-stat');
const saved=()=>model.parseSave(w.localStorage.getItem('poe2-simulator:v1:mercenary-twister-gemling'));
try{
 await w.eval(`(async()=>{${code}\n})()`);installSimulatorUsability(d);installSimulatorFlow(d);
 assert(d.querySelector('.sim-choice-title').compareDocumentPosition(d.querySelector('.sim-first-guide'))&w.Node.DOCUMENT_POSITION_FOLLOWING);
 change('#sim-build-search','ついすたー','input');assert.equal(d.querySelectorAll('[data-preset]:not([hidden])').length,2);
 change('#sim-class-filter','Mercenary');assert.equal(d.querySelectorAll('[data-preset]:not([hidden])').length,1);
 change('#sim-build-search','no-match-123','input');assert.equal(d.querySelector('#sim-build-empty').hidden,false);click('#sim-build-reset');assert.equal(d.querySelectorAll('[data-preset]:not([hidden])').length,19);
 click('[data-preset="mercenary-twister-gemling"]');await wait(ready);const before=JSON.stringify(saved().request.items);
 assert.equal(workerStarts,2,'a trapped first calculation must use a fresh worker');
 const staleWorkerError=new w.Event('error',{cancelable:true});workerInstances[0].onerror(staleWorkerError);assert.equal(staleWorkerError.defaultPrevented,true,'handled errors from terminated workers must not bubble to the current page');assert.equal(d.querySelector('#sim-error').hidden,true);assert.equal(workerStarts,2);
 const untouched=w.localStorage.getItem('poe2-simulator:v1:mercenary-twister-gemling');
 click('#sim-flow-summary-toggle');assert.equal(d.querySelector('#sim-flow-summary-toggle').getAttribute('aria-expanded'),'true');click('#sim-flow-summary-toggle');
 for(const id of ['sim-flow-photo','sim-flow-candidate','sim-flow-rare-options','sim-flow-item-results']){click('#'+id+'>summary');click('#'+id+'>summary');}
 assert.equal(w.localStorage.getItem('poe2-simulator:v1:mercenary-twister-gemling'),untouched,'opening secondary controls must not apply or save a draft');
 click('#sim-view-results');assert.equal(d.querySelector('.sim-layout').dataset.view,'results');assert.equal(d.querySelector('#sim-view-results').getAttribute('aria-pressed'),'true');
 click('#sim-flow-back');assert.equal(d.querySelector('.sim-layout').dataset.view,'editing');assert.equal(w.localStorage.getItem('poe2-simulator:v1:mercenary-twister-gemling'),untouched);
 click('#sim-flow-utilities');assert.equal(d.querySelector('#sim-flow-utilities').getAttribute('aria-expanded'),'true');click('#sim-flow-utilities');
 assert(d.querySelector('.sim-layout').compareDocumentPosition(d.querySelector('#sim-workspace'))&w.Node.DOCUMENT_POSITION_FOLLOWING);
 click('[data-slot="amulet"]');await new Promise(r=>w.requestAnimationFrame(r));change('#sim-unique-search','Ast','input');change('#sim-unique',String(astro.uniqueId));d.querySelector('#sim-unique').closest('label').nextElementSibling.click();await wait(()=>d.querySelector('#sim-equipment-picker')?.open);click('[data-equipment-close]');assert.equal(d.querySelector('#sim-unique-search').value,'Ast');assert.equal(d.querySelector('#sim-unique').value,String(astro.uniqueId));d.querySelector('#sim-unique').closest('label').nextElementSibling.click();await wait(()=>d.querySelector('#sim-equipment-picker')?.open);
 change('#sim-equipment-search','あすとらめんてぃす','input');click(`[data-equipment-choice="${astro.uniqueId}"]`);await wait(()=>d.querySelector('#sim-item-text').value.includes('アストラメンティス'));
 assert.equal(JSON.stringify(saved().request.items),before);assert.equal(d.querySelector('#sim-editor-draft-status').dataset.dirty,'true');click('#sim-item-apply');await wait(ready);assert(saved().request.items.some(item=>item.text.includes('Astramentis')));
 click('#sim-item-back');click('[data-slot="helmet"]');click('[data-equipment-mode="rare"]');click('[data-rare-quick="life"]');await wait(()=>d.querySelectorAll('[data-rare-row]').length===1);click('[data-rare-quick="life"]');await wait(()=>d.activeElement?.hasAttribute('data-rare-value'));assert.equal(d.querySelectorAll('[data-rare-row]').length,1);click('[data-rare-quick="all_res"]');await wait(()=>d.querySelectorAll('[data-rare-row]').length===2);click('#sim-item-reset');await wait(()=>d.querySelector('[data-equipment-mode="unique"]').getAttribute('aria-pressed')==='true');assert.equal(d.querySelector('#sim-item-text').value,'');
 click('#sim-item-back');click('[data-slot="amulet"]');change('#sim-unique',String(astro.uniqueId));holdUnique=true;releaseUnique=null;click('#sim-unique-draft');await wait(()=>releaseUnique);click('#sim-item-back');click('[data-slot="belt"]');await wait(()=>d.querySelector('#sim-slot-title').textContent==='ベルト');releaseUnique();await new Promise(r=>setTimeout(r,40));assert.equal(d.querySelector('#sim-item-text').value,'','stale unique cannot fill another slot');
 const headhunter=[...d.querySelector('#sim-unique').options].find(option=>option.textContent.includes('ヘッドハンター'));change('#sim-unique',headhunter.value);holdUnique=true;releaseUnique=null;click('#sim-unique-draft');await wait(()=>releaseUnique);change('#sim-item-text','Typed replacement draft','input');releaseUnique();await new Promise(r=>setTimeout(r,40));assert.equal(d.querySelector('#sim-item-text').value,'Typed replacement draft','stale unique cannot overwrite newer typing');
 runtimeTraps=4;const startsBefore=workerStarts;change('#sim-level','81');await wait(()=>!d.querySelector('#sim-error').hidden);
 assert.equal(runtimeTraps,0);assert.equal(workerStarts-startsBefore,3,'four failed calculation attempts stop after three new workers');
 assert.equal(saved().request.character.level,81,'keep the latest applied request after an exhausted recovery');
 assert.equal(d.querySelector('#sim-item-text').value,'Typed replacement draft','engine recovery cannot replace an unapplied draft');
 click('#sim-engine-retry');await wait(()=>ready()&&d.querySelector('#sim-error').hidden);
 assert.equal(workerStarts-startsBefore,4,'manual retry must replace the final trapped worker');assert.equal(saved().request.character.level,81);
 assert.equal(d.querySelector('#sim-item-text').value,'Typed replacement draft');
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: search, reading list, bilingual equipment input, staged drafts, first-calculation recovery, bounded trapped calculations, fresh-worker manual retry and retained requests/drafts.');
}finally{dom.window.close();await native.terminate();}
