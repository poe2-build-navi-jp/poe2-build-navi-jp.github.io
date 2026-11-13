import assert from 'node:assert/strict';
import {readFile,access,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {JSDOM} from 'jsdom';
import {skillIcons} from '../assets/skill-icon-data.js';
import {createSkillMatcher} from '../assets/skill-icon-matcher.js';
import {installSkillIcons} from '../assets/skill-icons.js';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const matcher=createSkillMatcher(skillIcons);
assert.equal(matcher.matches('ツイスター（Twister）').length,1);
for(const pair of ['ツイスター(Twister)','ツイスター ( Twister )','Twister（ツイスター）','Twister (ツイスター)','憤怒(Rage)'])assert.equal(matcher.matches(pair).length,1,pair);
for(const name of ["Ahn's Citadel", "Kelari's Judgment", "Navira's Well"])assert(matcher.lookup(name),name);
assert.equal(matcher.matches('Whirling Assault / Spark').length,2);
assert.equal(matcher.matches('ツイスターリング https://test.example/Twister Twister.webp').length,0);
assert.equal(matcher.matches('憤怒の状態 / Rage generation').length,0);
assert.equal(matcher.matches('憤怒（Rage）').length,1);
const catalog=JSON.parse(await read('data/skill-icons.json'));
const sheets=new Map();
for(const entry of catalog.entries) {
 const [file,id]=entry.src.split('#');
 if(!sheets.has(file))sheets.set(file,await read(file.slice(1)));
 const svg=sheets.get(file),views=[...svg.matchAll(/<view id="([^"]+)"[^>]*\/><image[^>]*base64,([^"]+)"/g)];
 const view=views.find(m=>m[1]===id);assert(view,entry.id);
 const bytes=Buffer.from(view[2],'base64');
 assert.equal(bytes.subarray(8,12).toString(),'WEBP',entry.id);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.id);
 assert(!/rolldodge|unknown/i.test(entry.source),entry.id);
}
const paths=[];
async function walk(dir='') {
 for(const entry of await readdir(resolve(root,dir),{withFileTypes:true})) {
  if(entry.name.startsWith('.')||['assets','images','data','tools','scripts','docs','company','tests','node_modules','dist'].includes(entry.name))continue;
  const path=dir+entry.name;
  if(entry.isDirectory())await walk(path+'/');else if(entry.name.endsWith('.html'))paths.push(path);
 }
}
await walk();let icons=0;
for(const path of paths) {
 const doc=new JSDOM(await read(path)).window.document;
 for(const img of doc.querySelectorAll('img.skill-icon')) {
  assert(img.closest('.skill-name'),path);assert.equal(img.alt,'');assert.equal(img.getAttribute('aria-hidden'),'true');
  assert(!img.closest('head,script,nav,select,textarea,#source-list,[contenteditable]'),path);
  await access(resolve(root,img.getAttribute('src').slice(1).split('#')[0]));icons++;
 }
 assert.equal(doc.querySelectorAll('.skill-name .skill-name').length,0,path);
}
// Dynamic names and selected gems update without touching options, edit fields or source quotes.
const dom=new JSDOM('<main><p id="name">ツイスター（Twister）</p><p id="next"></p><textarea>Twister</textarea><select><option>Twister</option></select><section id="source-list">Twister</section></main>',{pretendToBeVisual:true});
const d=dom.window.document,observer=installSkillIcons(d);
assert.equal(d.querySelectorAll('.skill-name').length,1);
d.querySelector('#name').textContent='スパーク（Spark）';
d.querySelector('#next').innerHTML='<span class="skill-select-field" data-skill-selected="Twister"><select><option>Twister</option></select></span>';
await new Promise(resolve=>dom.window.requestAnimationFrame(()=>dom.window.requestAnimationFrame(resolve)));
assert.equal(d.querySelector('#name .skill-name').dataset.skillIcon,'Spark');
assert(d.querySelector('[data-skill-selected]>.skill-icon'));
assert.equal(d.querySelectorAll('select img,textarea img,#source-list img,.skill-name .skill-name').length,0);
observer.disconnect();dom.window.close();
console.log(`PASS: ${catalog.entries.length} verified original icons in ${sheets.size} sheets; ${icons} static labels, dynamic updates, exact matches and protected inputs/sources.`);
