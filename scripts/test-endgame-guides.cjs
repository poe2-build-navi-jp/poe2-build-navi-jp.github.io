const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');const doc=p=>new JSDOM(read(p)).window.document;
const data=JSON.parse(read('data/strategy-guides.json'));const hub=doc('guides/index.html');
for(const slug of ['endgame-contents','endgame-items','atlas-passive-trees']){
 const g=data.find(g=>g.slug===slug);assert(g,'Source data');assert(g.sections.length>=5);assert(g.sources.length>=3);const d=doc(`guides/${slug}/index.html`);
 assert.equal(d.querySelectorAll('h1').length,1);assert.equal(d.querySelectorAll('.content-action li').length,3);
 assert(hub.querySelector(`#progress a[data-guide-card][href="/guides/${slug}/"]`),'Endgame card');
 assert(d.querySelector('a[href="/guides/"]'),'Return to hub');assert(d.querySelector('.next-box .related-links a'),'Related reading');
 assert(read('sitemap.xml').includes(`/guides/${slug}/</loc>`));
}
assert(doc('guides/after-campaign/index.html').querySelector('a[href="/guides/endgame-contents/"]'));
assert(doc('guides/atlas-progression/index.html').querySelector('a[href="/guides/atlas-passive-trees/"]'));
assert(doc('guides/waystones-tablets/index.html').querySelector('a[href="/guides/endgame-items/"]'));
assert(doc('guides/interlude-walkthrough/index.html').querySelector('a[href="/guides/endgame-contents/"]'));
assert.equal(doc('tests/mobile.html').querySelector('meta[name=robots]').content,'noindex,nofollow');assert(!read('sitemap.xml').includes('/tests/'));
console.log('PASS: three distinct endgame articles, hub category, existing guide connections, sitemap and QA noindex');
