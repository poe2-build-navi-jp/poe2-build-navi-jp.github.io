import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {inspectEquipmentPhoto,equipmentPhotoText} from '../assets/simulator-photo-model.js';
import {createWorker,PSM} from 'tesseract.js';
import {createPhotoReader} from '../assets/simulator-photo-ocr.js';
const root=new URL('../',import.meta.url),catalog=JSON.parse(await readFile(new URL('data/simulator-equipment.json',root)));
// Regression: closing during model initialization must release the raw worker,
// reject the pending read and allow a fresh reader after a network failure.
const rawWorkers=[];
globalThis.location={origin:'https://test.invalid'};
globalThis.Worker=class{constructor(){this.terminated=0;rawWorkers.push(this);}postMessage(){}terminate(){this.terminated++;}};
const boot=createPhotoReader('jpn');boot.terminate();await assert.rejects(boot.ready,/cancelled/);assert.equal(rawWorkers[0].terminated,1);
const failedBoot=createPhotoReader('eng');rawWorkers[1].onerror();await assert.rejects(failedBoot.ready,/worker/);assert.equal(rawWorkers[1].terminated,1);
delete globalThis.Worker;delete globalThis.location;
const base=catalog.bases.find(b=>b.name==='Rusted Greathelm');
for(const def of catalog.modifiers){
 const text=def.template.replace(/\{(\d+)\}/g,(_,i)=>def.default[+i]);
 const r=inspectEquipmentPhoto(text,catalog);assert.equal(r.modifiers.length,1,text);assert.deepEqual(r.modifiers[0].values,def.default);
}
const parsed=inspectEquipmentPhoto('錆びたグレートヘルム\n品質: +20%\nアイテムレベル: 80\n最大ライフ +123\n火耐性 +35%\n移動スピードが25%増加する\n10から20の火ダメージを追加する\nアーマー: 900\n最大ライフェ +999\n特殊効果が発動',catalog);
assert.equal(parsed.baseId,base.id);assert.equal(parsed.quality,'20');assert.equal(parsed.level,'80');
assert.deepEqual(parsed.modifiers.map(m=>[m.id,m.values]),[['life',[123]],['fire_res',[35]],['move_speed',[25]],['fire_flat',[10,20]]]);
assert.equal(parsed.properties.length,1);assert(parsed.unresolved.includes('最大ライフェ +999'));
for(const bad of ['最大ライフ +1O0','最大ライフ -200','+100001 to maximum Life','Adds 30 to 10 Fire Damage','+3596 to Fire Resistance'])assert.equal(inspectEquipmentPhoto(bad,catalog).modifiers.length,0,bad);
assert.equal(inspectEquipmentPhoto('Rustcd Greathelm',catalog).baseId,'','do not guess a visually similar base');
const item=equipmentPhotoText({...parsed,name:'Photo <test>',rarity:'RARE'},catalog);
assert(item.includes('+123 to maximum Life'));assert(!item.includes('999'));assert(!item.includes('900'));
assert.throws(()=>equipmentPhotoText({...parsed,baseId:'wrong',name:'A'},catalog),/base/);
assert.throws(()=>equipmentPhotoText({...parsed,quality:'31',name:'A'},catalog),/value/);
assert.throws(()=>equipmentPhotoText({...parsed,name:'A\nB'},catalog),/name/);
assert.throws(()=>inspectEquipmentPhoto('a'.repeat(20001),catalog),/text-size/);
for(const locale of ['','en/']){
 const doc=new JSDOM(await readFile(new URL(locale+'simulator/index.html',root),'utf8')).window.document;
 assert.equal(doc.querySelectorAll('#sim-photo-dialog').length,1);assert.equal(doc.querySelector('#sim-photo-capture').getAttribute('capture'),'environment');
 assert.equal(doc.querySelector('#sim-photo-file').getAttribute('capture'),null);assert.equal(doc.querySelector('#sim-photo-stage').disabled,true);
 assert(doc.querySelector('script[src*="simulator-photo.js?v="]'));assert(doc.querySelector('#sim-photo-dialog textarea[maxlength="20000"]'));
}
const manifest=JSON.parse(await readFile(new URL('assets/equipment-ocr/v7/manifest.json',root)));
for(const f of manifest.files){const bytes=await readFile(new URL('assets/equipment-ocr/v7/'+f.file,root));assert.equal(bytes.length,f.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256);}
// These are actual raster images, not mocked OCR responses. Japanese misreads stay
// unresolved rather than being "corrected" into plausible numeric modifiers.
for(const lang of ['jpn','eng']){
 const worker=await createWorker(lang,1,{langPath:new URL('assets/equipment-ocr/v7/',root).pathname,cacheMethod:'none'});
 try{
  await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK});
  const {data}=await worker.recognize(new URL('scripts/fixtures/equipment-photo/'+lang+'.png',root).pathname);
  const r=inspectEquipmentPhoto(data.text,catalog);assert.equal(r.baseId,base.id);assert.equal(r.quality,'20');assert.equal(r.level,'80');
  assert(r.modifiers.some(m=>m.id==='armour_pct'&&m.values[0]===50));
  assert(r.modifiers.some(m=>m.id===(lang==='eng'?'fire_res':'cold_res')&&m.values[0]===(lang==='eng'?35:27)));
  if(lang==='eng')assert(r.modifiers.some(m=>m.id==='life'&&m.values[0]===123));
  assert(!r.modifiers.some(m=>m.id==='life'&&m.values[0]!==123));
  console.log('PASS: actual '+lang+' OCR, exact base/quality/level and numeric modifier candidates');
 }finally{await worker.terminate();}
}
console.log('PASS: 35 modifier templates, conservative unresolved text, no guessed bases/numbers, totals excluded, bounded input and vendored asset integrity');
