import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {equipmentIcons} from '../assets/equipment-icon-data.js';
import {createEquipmentMatcher} from '../assets/equipment-icon-matcher.js';
import {installEquipmentIcons} from '../assets/equipment-icons.js';
const root=resolve(import.meta.dirname,'..'),read=p=>readFile(resolve(root,p),'utf8');
const matcher=createEquipmentMatcher(equipmentIcons);
for(const value of ['テイミング（The Taming）','The Taming (テイミング)','ヘッドハンター','石無しの指輪'])assert(matcher.lookup(value)||matcher.matches(value).length,value);
assert.equal(matcher.matches('ヘッドハンターリング https://example.test/The_Taming The Taming.webp').length,0);
assert.equal(matcher.fromItemText('Rarity: UNIQUE\nThe Taming\nTwo-Stone Ring\n--------\nHeadhunter').name,'The Taming');
assert.equal(matcher.fromItemText('Rarity: RARE\nMy hood\nCovert Hood\n--------\nThe Taming').name,'Covert Hood');
assert.equal(matcher.fromItemText('Rarity: RARE\nUnknown item\n--------\nThe Taming'),undefined);
const catalog=JSON.parse(await read('data/equipment-icons.json'));
assert.equal(catalog.unresolved.length,0);
assert.equal(catalog.entries.filter(entry=>entry.kind==='unique').length,435);
assert.equal(catalog.entries.filter(entry=>entry.kind==='base').length,331);
const sheets=new Map();
assert.equal(new Set(catalog.entries.map(entry=>entry.id)).size,catalog.entries.length);
for(const entry of catalog.entries) {
 const [file,id]=entry.src.split('#');
 if(!sheets.has(file))sheets.set(file,await read(file.slice(1)));
 const view=[...sheets.get(file).matchAll(/<view id="([^"]+)"[^>]*\/><image[^>]*base64,([^"]+)"/g)].find(match=>match[1]===id);
 assert(view,entry.id);
 assert.equal(createHash('sha256').update(Buffer.from(view[2],'base64')).digest('hex'),entry.sha256,entry.id);
 assert(!/unknown|placeholder|rolldodge/i.test(entry.source),entry.id);
}
for(const base of JSON.parse(await read('data/simulator-equipment.json')).bases)assert(matcher.base(base.id),base.name);
for(const base of ['Ruby','Emerald','Sapphire']) {
 const entry=matcher.fromItemText(`Rarity: UNIQUE\nGrand Spectrum\n${base}\n--------`);
 assert.equal(entry.itemBase,base);assert(catalog.entries.find(item=>item.id===entry.id).source.includes('GrandSpectrum_'+base));
}
for(const [element,name]of [['Fire','Heart'],['Ice','Eye'],['Lightning','Mind']])assert.equal(matcher.fromItemText(`Rarity: UNIQUE\nGuiding Palm\nShrine Sceptre\n--------\nGrants Skill: Level 10 Purity of ${element}`).name,'Guiding Palm of the '+name);
for(const entity of JSON.parse(await read('data/core-entities.json')).filter(entry=>entry.kind==='equipment')) {
 assert(matcher.lookup(entity.englishName),entity.englishName);
 const d=new JSDOM(await read(`equipment/${entity.slug}/index.html`)).window.document;
 assert(d.querySelector('main .equipment-icon'),entity.slug);
}
const taming=equipmentIcons.find(entry=>entry.name==='The Taming'),headhunter=equipmentIcons.find(entry=>entry.name==='Headhunter');
const dom=new JSDOM(`<main><p id="name">テイミング（The Taming）</p><p id="next"></p><textarea>The Taming</textarea><select><option>The Taming</option></select><section id="source-list">The Taming</section><button data-equipment-text="Rarity: UNIQUE&#10;Headhunter&#10;Heavy Belt">Belt</button><label>Unique<select id="sim-unique"><option value="">Choose</option><option value="${taming.uniqueId}">テイミング</option><option value="${headhunter.uniqueId}">Headhunter</option></select></label><label>Base<select id="sim-rare-base"></select></label></main>`,{pretendToBeVisual:true});
const d=dom.window.document,observer=installEquipmentIcons(d),tick=()=>new Promise(resolve=>dom.window.requestAnimationFrame(()=>dom.window.requestAnimationFrame(resolve)));
assert.equal(d.querySelectorAll('#name .equipment-icon').length,1);
assert(d.querySelector('button[data-equipment-text]>.equipment-icon'));
const field=d.querySelector('#sim-unique');field.value=String(taming.uniqueId);field.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
assert.equal(field.parentElement.querySelector('img').getAttribute('src'),matcher.lookup('The Taming').src);
field.value=String(headhunter.uniqueId);field.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
assert.equal(field.parentElement.querySelector('img').getAttribute('src'),matcher.lookup('Headhunter').src);
field.value='';field.dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert.equal(field.parentElement.querySelector('img'),null);
d.querySelector('#next').textContent='ヘッドハンター';await tick();assert(d.querySelector('#next .equipment-icon'));
const slot=d.querySelector('button');slot.dataset.equipmentText='';await tick();assert.equal(slot.querySelector('img'),null);
assert.equal(d.querySelectorAll('select img,textarea img,#source-list img,.equipment-name .equipment-name,.skill-name .equipment-name').length,0);
assert.equal(d.querySelector('textarea').value,'The Taming');
observer.disconnect();dom.window.close();
let pages=0,icons=0;
async function walk(dir='') {
 for(const entry of await readdir(resolve(root,dir),{withFileTypes:true})) {
  if(entry.name.startsWith('.')||['assets','images','data','tools','scripts','docs','company','tests','node_modules','dist'].includes(entry.name))continue;
  const path=dir+entry.name;
  if(entry.isDirectory()){await walk(path+'/');continue;}
  if(!entry.name.endsWith('.html'))continue;
  const doc=new JSDOM(await read(path)).window.document;
  for(const img of doc.querySelectorAll('img.equipment-icon')) {
   assert(img.closest('.equipment-name'),path);
   assert(!img.closest('nav,textarea,select,button,#source-list,[contenteditable]'),path);
   assert.equal(img.alt,'');assert.equal(img.getAttribute('aria-hidden'),'true');
   await access(resolve(root,img.getAttribute('src').slice(1).split('#')[0]));icons++;
  }
  assert.equal(doc.querySelectorAll('.equipment-name .equipment-name,.skill-name .equipment-name,.equipment-name .skill-name').length,0,path);pages++;
 }
}
await walk();
console.log(`PASS: ${catalog.entries.length} equipment records, ${sheets.size} local sheets, ${icons} labels on ${pages} pages; dynamic equipment, selectors and protected inputs.`);
