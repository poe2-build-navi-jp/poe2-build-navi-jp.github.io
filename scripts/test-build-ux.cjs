// Test-only dependency: NODE_PATH pointing to an external jsdom installation.
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const dom=new JSDOM(fs.readFileSync('builds/index.html','utf8'),{runScripts:'outside-only',url:'https://poe2-build-navi-jp.github.io/builds/'});
const w=dom.window,d=w.document;
w.HTMLElement.prototype.scrollIntoView=function(){};
w.eval(fs.readFileSync('assets/catalog-static.js','utf8'));
const cards=[...d.querySelectorAll('.catalog-card')];
const visible=()=>cards.filter(c=>!c.hidden);
const choose=(id,value)=>{d.getElementById(id).value=value;d.getElementById(id).dispatchEvent(new w.Event('change'));};
assert.equal(cards.length,11);assert.equal(visible().length,11);
choose('filter-unlock','Lv40まで');assert.deepEqual(visible().map(c=>c.dataset.buildId).sort(),['druid-plant-oracle','ranger-ice-shot-deadeye','warrior-shield-wall-smith']);
choose('filter-style','召喚');assert.equal(visible().length,0);assert.equal(d.getElementById('filter-empty').hidden,false);
d.getElementById('relax-filter').click();assert.equal(visible().length,3);
d.getElementById('reset-filters').click();assert.equal(visible().length,11);
choose('filter-ssf','確認済のみ');assert(visible().every(c=>c.dataset.ssf==='true'));
d.getElementById('reset-filters').click();
const buttons=cards.map(c=>c.querySelector('[data-compare]'));
buttons.slice(0,3).forEach(b=>b.click());assert.equal(buttons[3].disabled,true);buttons[3].click();assert.equal(d.querySelectorAll('.ux-compare-card').length,3);
d.getElementById('show-compare').click();assert.equal(d.getElementById('build-comparison').hidden,false);assert.equal(d.activeElement.id,'build-comparison');
d.querySelector('.ux-compare-card button').click();assert.equal(buttons[3].disabled,false);assert.equal(d.querySelectorAll('.ux-compare-card').length,2);
assert([...d.querySelectorAll('.ux-compare-card a')].every(a=>a.search==='?level=1'&&a.hash==='#now'));
buttons.filter(b=>b.getAttribute('aria-pressed')==='true').forEach(b=>b.click());assert.equal(d.getElementById('show-compare').disabled,true);
const initial=new JSDOM(fs.readFileSync('builds/index.html','utf8')).window.document;
assert.equal(initial.querySelectorAll('.catalog-card').length,11);assert.equal(initial.getElementById('advanced-filters').hidden,true);
console.log('PASS: 11 static cards, unlock/SSF/style filters, zero results recovery, compare max 3, remove, focus, Lv1 links, JS-off content');
(async()=>{
 const data=JSON.parse(fs.readFileSync('data/builds.json','utf8'));
 const {rows}=await import('../tools/build-facts.mjs');
 const {validateRatings}=await import('../tools/build-ratings.mjs');
 const discovery=JSON.parse(fs.readFileSync('data/discovery.json','utf8'));
 for(const build of data){
  assert.deepEqual(validateRatings(build),[],`${build.id}: rating evidence`);
  const detailDoc=new JSDOM(fs.readFileSync(`builds/${build.classSlug}/${build.slug}/index.html`,'utf8')).window.document;
  assert.equal(detailDoc.getElementById('fact-grid').parentElement.parentElement.className,'build-hero-grid',`${build.id}: fact grid wrapper must be balanced`);
  assert.equal(detailDoc.getElementById('level-card').parentElement.className,'build-hero-grid',`${build.id}: level card must remain beside build facts`);
  const facts=rows(build,discovery);
  const p=`/builds/${build.classSlug}/${build.slug}/`;
  for(const page of ['builds/index.html','tier-list/index.html','league-starter/index.html']){
   const document=new JSDOM(fs.readFileSync(page,'utf8')).window.document;
   if(page!=='builds/index.html'&&!document.querySelector(`a[href="${p}"]`))continue;
   const card=[...document.querySelectorAll('article:not(.article-page)')].find(article=>article.querySelector(`a[href="${p}"]`)&&article.querySelector('.unified-facts'));
   assert(card,`${page}: card missing for ${build.id}`);
   const visible=[...card.querySelectorAll('.unified-facts div')].map(el=>[el.querySelector('dt').textContent,el.querySelector('dd').textContent]);
   assert.deepEqual(visible,facts,`${page}: inconsistent facts for ${build.id}`);
  }
 }
 const ice=data.find(b=>b.id==='ranger-ice-shot-deadeye');
 assert.match(rows(ice,discovery).find(([name])=>name==='主力スキル使用条件')[1],/Lv31.*レベル9/);
 assert.match(rows(ice,discovery).find(([name])=>name==='主力への切替目安')[1],/Lv31以降/);
 console.log('PASS: 11 builds share the same card facts and ratings on builds, Tier and starter; skill requirement differs from recommended switch');
 const html=fs.readFileSync('builds/ranger/ice-shot-deadeye/index.html','utf8');
 const detail=new JSDOM(html,{runScripts:'outside-only',url:'https://poe2-build-navi-jp.github.io/builds/ranger/ice-shot-deadeye/?level=37'});
 detail.window.fetch=async()=>({ok:true,json:async()=>data});
 detail.window.eval(fs.readFileSync('assets/detail.js','utf8'));
 await new Promise(r=>setTimeout(r,100));
 const dd=detail.window.document;
 assert.equal(dd.getElementById('level-input').value,'37');
 assert.equal(dd.querySelectorAll('[data-now-action]').length,3);
 assert([...dd.querySelectorAll('[data-now-action]')].every(e=>e.textContent.trim()));
 assert.equal(detail.window.localStorage.getItem('poe2:navi:quick-level'),'37');
 assert.equal(detail.window.localStorage.getItem('poe2:navi:lastViewedStage'),'3');
 dd.getElementById('level-plus').click();assert.equal(dd.getElementById('level-input').value,'38');
 assert.equal(dd.querySelectorAll('.static-roadmap details').length,8);
 console.log('PASS: Lv37 restores, three actions render, increment works, resume level/stage persists, 8 roadmap stages remain');
 const minion=new JSDOM(fs.readFileSync('builds/witch/minion-infernalist/index.html','utf8'),{runScripts:'outside-only',url:'https://poe2-build-navi-jp.github.io/builds/witch/minion-infernalist/?level=37'});
 minion.window.fetch=async()=>({ok:true,json:async()=>data});minion.window.eval(fs.readFileSync('assets/detail.js','utf8'));
 await new Promise(r=>setTimeout(r,60));
 const guidance=minion.window.document.getElementById('now-action-guidance');
 assert.equal(guidance.hidden,false);assert.match(guidance.textContent,/Act 3 - Vaal Guard Spectres/);
 assert.equal(guidance.querySelector('a').href,data.find(b=>b.id==='witch-minion-infernalist').sources[0].url);
 minion.window.document.getElementById('level-input').value='42';minion.window.document.getElementById('level-input').dispatchEvent(new minion.window.Event('input'));
 assert.equal(guidance.hidden,true);
 console.log('PASS: minion Lv37 shows precise guide section and link; unrelated stage hides it');
 async function home(storage){
  const page=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only',url:'https://poe2-build-navi-jp.github.io/'});
  Object.entries(storage).forEach(([key,value])=>page.window.localStorage.setItem(key,value));
  page.window.fetch=async(url)=>({ok:true,json:async()=>url.includes('classes.json')?JSON.parse(fs.readFileSync('data/classes.json','utf8')):url.includes('builds.json')?data:JSON.parse(fs.readFileSync('data/site.json','utf8'))});
  page.window.eval(fs.readFileSync('assets/app.js','utf8'));
  await new Promise(r=>setTimeout(r,60));
  return page.window.document.querySelector('.hero-actions a:last-child').href;
 }
 assert.equal(await home({}),'https://poe2-build-navi-jp.github.io/leveling/');
 assert.equal(await home({'poe2:navi:selected-build':'ranger-ice-shot-deadeye','poe2:navi:quick-level':'37'}),'https://poe2-build-navi-jp.github.io/builds/ranger/ice-shot-deadeye/?level=37#now');
 assert.equal(await home({'poe2:navi:selected-build':'removed-build','poe2:navi:quick-level':'37'}),'https://poe2-build-navi-jp.github.io/leveling/');
 assert.equal(await home({'poe2:navi:selected-build':'ranger-ice-shot-deadeye','poe2:navi:quick-level':'999'}),'https://poe2-build-navi-jp.github.io/leveling/');
 console.log('PASS: no history, valid Lv37 one-click resume, removed build and invalid level safely fall back');
})().catch(error=>{console.error(error);process.exitCode=1;});
