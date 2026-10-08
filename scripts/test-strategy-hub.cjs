const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const dom=new JSDOM(read('guides/index.html'));
const doc=dom.window.document;
assert.equal(doc.querySelectorAll('h1').length,1);
assert.equal(doc.querySelector('link[rel="canonical"]').href,'https://poe2-build-navi-jp.github.io/guides/');
const cards=[...doc.querySelectorAll('.content-card')];
assert.equal(cards.length,13);
assert.equal(new Set(cards.map(a=>a.href)).size,13);
for(const a of cards){assert(a.querySelector('strong').textContent.trim());assert(a.querySelector('span').textContent.trim());const p=a.getAttribute('href');assert(fs.existsSync(path.join(root,p,'index.html')),p);const guide=read(`${p.slice(1)}index.html`);assert.equal((guide.match(/<!-- strategy-link:start -->/g)||[]).length,1);}
assert.equal(doc.querySelectorAll('a[href="/leveling/"]').length,3);
for(const a of doc.querySelectorAll('nav[aria-label="攻略カテゴリ"] a'))assert(doc.querySelector(a.getAttribute('href')));
const data=[...doc.querySelectorAll('script[type="application/ld+json"]')].flatMap(s=>JSON.parse(s.textContent));
const collection=data.find(s=>s['@type']==='CollectionPage');
assert.equal(collection.mainEntity.itemListElement.length,cards.length);
assert(read('sitemap.xml').includes('<loc>https://poe2-build-navi-jp.github.io/guides/</loc>'));
assert(read('index.html').includes('PoE2攻略を困りごとから探す'));
assert(read('beginner-guide/index.html').includes('href="/guides/"'));
assert(!doc.querySelector('form')); // Reuse the existing leveling form rather than duplicating it.
console.log('PASS: 13 JS-off guide cards, existing routes, category anchors, return links, CollectionPage and sitemap');
