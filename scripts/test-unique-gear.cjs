const fs=require('node:fs');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const read=p=>fs.readFileSync(p,'utf8');
const builds=JSON.parse(read('data/builds.json')).filter(b=>b.status!=='draft');
const guide=JSON.parse(read('data/strategy-guides.json')).find(g=>g.slug==='unique-gear');
const sections=guide.sections.filter(s=>s.buildId);
assert.deepEqual(sections.map(s=>s.buildId).sort(),builds.map(b=>b.id).sort());
assert.equal(new Set(sections.map(s=>s.buildId)).size,12);
const doc=new JSDOM(read('guides/unique-gear/index.html')).window.document;
const options=sections.flatMap(s=>s.gearOptions);
assert.equal(doc.querySelectorAll('.unique-gear-card').length,options.length);
for(const section of sections){
 assert(doc.getElementById(section.buildId));
 for(const option of section.gearOptions){
  for(const key of ['name','slot','phase','purpose','conditions','tradeoff','rareAlternative','basis'])assert(option[key]?.trim());
  const refs=option.sourceRefs.map(n=>guide.sources[n-1]);
  assert(refs.every(Boolean));
  assert(refs.some(s=>new URL(s.url).hostname==='poe2db.tw'),'Every option has an item-effect reference');
  assert(refs.some(s=>new URL(s.url).hostname!=='poe2db.tw'),'Every option has a build-context reference');
 }
 const b=builds.find(b=>b.id===section.buildId);
 const detail=new JSDOM(read(`builds/${b.classSlug}/${b.slug}/index.html`)).window.document;
 assert.equal(detail.querySelectorAll(`a[href="/guides/unique-gear/#${b.id}"]`).length,1);
 assert(doc.querySelector(`a[href="/builds/${b.classSlug}/${b.slug}/#level-card"]`));
 assert(detail.querySelector('#level-card'));
}
const get=(id,name)=>sections.find(s=>s.buildId===id).gearOptions.find(o=>o.name.includes(name));
assert.match(get('mercenary-twister-gemling','The Taming').slot,/指輪/);
assert.match(get('mercenary-twister-gemling','Darkness').conditions,/胴扱い/);
assert.match(get('witch-minion-infernalist','Darkness').conditions,/兜扱い/);
assert.match(get('witch-minion-infernalist','Bones').purpose,/アンデッド/);
assert.match(get('sorceress-sand-fire','Enfolding').basis,/採用未確認/);
assert.match(get('mercenary-grenade-gemling','Redemption').tradeoff,/会心ダメージ.*なし/);
assert.match(get('druid-plant-oracle','Nightscale').tradeoff,/マナ再生できない/);
assert.match(get('druid-plant-oracle','Heroic').phase,/Mirror Tier/);
assert.match(get('sorceress-spark-stormweaver','Maligaro').conditions,/250%/);
assert.match(get('huntress-twister-spirit-walker','Skysliver').phase,/セット1/);
assert(guide.sections.find(s=>s.id==='avoid-mistakes').paragraphs.some(p=>p.includes('Olroth')&&p.includes('採用しません')));
assert.equal(doc.querySelector('link[rel=canonical]').href,'https://poe2-build-navi-jp.github.io/guides/unique-gear/');
assert(read('sitemap.xml').includes('/guides/unique-gear/</loc>'));
for(const a of doc.querySelectorAll('a[href^="#"]'))assert(doc.getElementById(a.hash.slice(1)),a.hash);
assert(!doc.querySelector('table'),'Comparison stays readable as vertical cards on phones');
const schema=[...doc.querySelectorAll('script[type="application/ld+json"]')].flatMap(s=>JSON.parse(s.textContent));
assert.equal(schema.filter(s=>s['@type']==='Article').length,1);
assert.equal(schema.find(s=>s['@type']==='Article').dateModified,'2026-10-12');
assert.equal(schema.find(s=>s['@type']==='Article').image,doc.querySelector('meta[property="og:image"]').content);
console.log(`PASS: ${sections.length} builds, ${options.length} source-backed gear cards, correct slots/variants, conditional adoption, preserved Lv routes, canonical and dated schema`);
