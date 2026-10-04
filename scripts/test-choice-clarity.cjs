const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const read=path=>fs.readFileSync(path,'utf8');
const builds=JSON.parse(read('data/builds.json'));
const shield=builds.find(b=>b.id==='warrior-shield-wall-smith');
const home=new JSDOM(read('index.html'),{url:'https://poe2-build-navi-jp.github.io/'}).window.document;
const quick=[...home.querySelectorAll('#purpose-picks .purpose-card')];
assert.equal(quick.length,5);
assert.match(quick[0].querySelector('.quick-choice-facts').textContent,/Act 3とLv67前後で召喚対象を切替/);
for(const card of quick){
 assert.deepEqual([...card.querySelectorAll('.quick-choice-facts dt')].map(n=>n.textContent),['向いている人','弱点','切替時期']);
 assert.equal(card.querySelector('details').open,false);
 assert.equal(card.querySelectorAll('details').length,1);
 assert.equal(card.querySelector('.unified-facts').closest('details'),card.querySelector('details'));
 assert.equal(card.querySelectorAll(':scope > a.button').length,1);
}
assert(!read('assets/build-ux.css').includes('.purpose-card .unified-facts>div:nth-child'));
const changes=[...home.querySelectorAll('#recent-changes > ul > li')];
const expected=builds.flatMap(b=>(b.changeHistory||[]).map(r=>({b,...r}))).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
assert.equal(changes.length,3);
changes.forEach((li,i)=>{assert(li.textContent.includes(expected[i].summary));assert.equal(li.querySelector('time').dateTime,expected[i].date);assert.equal(li.querySelector('a').hash,'#update-history');});
assert(changes.some(li=>li.textContent.includes(expected[0].date)));
assert.equal(home.querySelector('#recent-changes details').open,false);
const page=new JSDOM(read('builds/index.html'),{runScripts:'outside-only',url:'https://poe2-build-navi-jp.github.io/builds/'}),w=page.window,d=w.document;
w.HTMLElement.prototype.scrollIntoView=function(){};
w.eval(read('assets/catalog-static.js'));
const buttons=[...d.querySelectorAll('[data-compare]')];
const shieldButton=buttons.find(b=>b.dataset.compare===shield.id);
shieldButton.click();buttons.find(b=>b!==shieldButton).click();
for(const card of d.querySelectorAll('.ux-compare-card')){
 assert.deepEqual([...card.querySelectorAll('.comparison-priority dt')].map(n=>n.textContent),['切替時期','操作','装備・使用条件','SSF','弱点']);
 assert.equal(card.querySelector('details').open,false);
 assert(!card.querySelector('.comparison-priority').textContent.includes('対応パッチ'));
}
assert.match(d.querySelector('#comparison-shared').textContent,/対応パッチ.*0\.5\.5/);
assert(d.querySelectorAll('.comparison-difference').length>0);
const shieldCard=[...d.querySelectorAll('.ux-compare-card')].find(c=>c.textContent.includes(shield.name));
assert.match(shieldCard.querySelector('.comparison-priority').textContent,/Lv22.*筋力41.*盾/);
assert(!shieldCard.textContent.includes('正確な解禁条件は未確認'));
d.querySelector('.ux-compare-card button').click();assert.equal(d.querySelector('#comparison-shared'),null);
buttons.filter(b=>b.getAttribute('aria-pressed')==='true').forEach(b=>b.click());assert.equal(d.querySelector('#comparison-shared'),null);
for(const path of ['builds/index.html','classes/warrior/index.html','beginner-guide/index.html','builds/warrior/shield-wall-smith/index.html']){
 assert(!read(path).includes('Lv22で装備できる'),path);
 assert(read(path).includes('筋力41'),path);
}
assert.equal(shield.updatedAt,'2026-09-07','Do not change the full leveling review date');
console.log('PASS: compact five choices, collapsed sources, five comparison priorities, shared facts, distinct Shield Wall requirements, real latest change reasons');
