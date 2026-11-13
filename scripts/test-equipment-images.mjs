import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {Worker} from 'node:worker_threads';
import {JSDOM} from 'jsdom';
import {equipmentImages} from '../assets/equipment-image-data.js';
import {createEquipmentMatcher,equipmentTextIdentity} from '../assets/equipment-image-matcher.js';
import {installEquipmentImages} from '../assets/equipment-images.js';
const root=resolve(import.meta.dirname,'..'),read=p=>readFile(resolve(root,p),'utf8');
const matcher=createEquipmentMatcher(equipmentImages),catalog=JSON.parse(await read('data/equipment-images.json'));
const sheets=new Map();
for(const entry of catalog.entries){
 const [file,id]=entry.src.split('#');
 if(!sheets.has(file)){const svg=await read(file.slice(1));sheets.set(file,new Map([...svg.matchAll(/<view id="([^"]+)"[^>]*\/><image[^>]*base64,([^"]+)"/g)].map(m=>[m[1],Buffer.from(m[2],'base64')])));}
 const bytes=sheets.get(file).get(id);assert(bytes,entry.id);assert.equal(bytes.subarray(8,12).toString(),'WEBP',entry.id);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.id);
 assert(/^https:\/\/(?:cdn\.poe2db\.tw|web\.poecdn\.com)\//.test(entry.source),entry.id);
}
const worker=new Worker(new URL('./fixtures/simulator-worker-node.mjs',import.meta.url),{execArgv:[]});
try{
 const engine=await new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',m=>{if(m.id===1)m.error?reject(Error(m.error)):resolve(m.result);});worker.postMessage({id:1,action:'boot'});});
 for(const unique of engine.uniques)assert(matcher.lookup(unique.name,unique.bases[0]?.name),unique.name);
 for(const base of JSON.parse(await read('data/simulator-equipment.json')).bases)assert.equal(matcher.lookup(base.name)?.kind,'base',base.name);
}finally{await worker.terminate();}
assert.equal(matcher.matches('メイジブラッド（Mageblood）').length,1);
assert.equal(matcher.matches('Gold Ring').length,0,'Generic bases must not annotate ordinary prose');
const identity=equipmentTextIdentity('Rarity: UNIQUE\nGuiding Palm\nShrine Sceptre\nVariant: Fire\nVariant: Cold\nVariant: Lightning\nSelected Variant: 2');
assert.equal(matcher.lookup(identity.name,identity.base,identity.variant).name,'Guiding Palm of the Eye');
assert.equal(matcher.lookup('Guiding Palm','Shrine Sceptre','Fire').name,'Guiding Palm of the Heart');
const paths=[];async function walk(dir=''){for(const entry of await readdir(resolve(root,dir),{withFileTypes:true})){if(entry.name.startsWith('.')||['assets','images','data','tools','scripts','docs','company','tests','node_modules','dist'].includes(entry.name))continue;const p=dir+entry.name;if(entry.isDirectory())await walk(p+'/');else if(entry.name.endsWith('.html'))paths.push(p);}}
await walk();let icons=0;
for(const p of paths){const dom=new JSDOM(await read(p)),d=dom.window.document;for(const img of d.querySelectorAll('img.equipment-icon')){assert(img.closest('.equipment-name,[data-equipment-selected]'),p);assert.equal(img.alt,'');assert.equal(img.getAttribute('aria-hidden'),'true');assert(!img.closest('nav,select,textarea,blockquote,#source-list'),p);assert(catalog.entries.some(e=>e.src===img.getAttribute('src')),p);icons++;}assert.equal(d.querySelectorAll('.equipment-name .equipment-name,.skill-name .equipment-name,.equipment-name .skill-name').length,0,p);dom.window.close();}
const dom=new JSDOM('<html lang="ja"><main><p>メイジブラッド（Mageblood）</p><button id="slot" data-equipment-selected="Mageblood"><small>装備名</small></button><button data-equipment-mode="unique" aria-pressed="true">Unique</button><select id="sim-unique"><option value="a" data-equipment-name="Mageblood">Mageblood</option><option value="b" data-equipment-name="Headhunter">Headhunter</option></select><textarea id="sim-item-text"></textarea><figure id="sim-equipment-preview" data-equipment-selected="" data-equipment-preview hidden><figcaption></figcaption></figure><blockquote>Mageblood</blockquote></main></html>',{pretendToBeVisual:true});
const d=dom.window.document,observer=installEquipmentImages(d);assert.equal(d.querySelectorAll('.equipment-name').length,1);assert(d.querySelector('#slot>.equipment-icon'));
const preview=d.getElementById('sim-equipment-preview');assert.equal(preview.hidden,false);assert.equal(preview.querySelector('img').getAttribute('src'),matcher.lookup('Mageblood').src);
d.getElementById('sim-unique').value='b';d.getElementById('sim-unique').dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert.equal(preview.querySelector('img').getAttribute('src'),matcher.lookup('Headhunter').src);
d.getElementById('slot').dataset.equipmentSelected='Headhunter';await new Promise(r=>dom.window.requestAnimationFrame(()=>dom.window.requestAnimationFrame(r)));
assert.equal(d.querySelector('#slot>img').getAttribute('src'),matcher.lookup('Headhunter').src);assert.equal(d.querySelectorAll('#slot>img').length,1);assert.equal(d.getElementById('sim-item-text').value,'');assert.equal(d.querySelectorAll('blockquote img,select img,textarea img').length,0);
observer.disconnect();dom.window.close();
console.log(`PASS: ${catalog.entries.length} exact equipment images in ${sheets.size} sheets; ${icons} static references; all engine items/bases; variants, live previews, protected inputs and duplicate prevention.`);
