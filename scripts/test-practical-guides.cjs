const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');const doc=p=>new JSDOM(read(p)).window.document;
const guides=JSON.parse(read('data/strategy-guides.json'));const hub=doc('guides/index.html');
for(const [slug,category] of [['ascendancy-trials','trials'],['permanent-rewards','campaign'],['budget-gear-crafting','crafting'],['pinnacle-bosses','progress']]){
 const g=guides.find(g=>g.slug===slug);assert(g);assert(g.actions.length===3);assert(g.sections.length>=4);assert(g.sources.length>=3);
 const d=doc(`guides/${slug}/index.html`);assert(hub.querySelector(`#${category} a[href="/guides/${slug}/"]`));
 assert.equal(d.querySelectorAll('h1').length,1);assert(d.querySelector('.next-box .related-links a'));
 assert.equal(new URL(d.querySelector('meta[property="og:image"]').content).pathname,g.ogImage);assert(fs.existsSync(path.join(root,g.ogImage)));
 assert(read('sitemap.xml').includes(`/guides/${slug}/</loc>`));
}
for(const [from,to] of [['trial-of-chaos','ascendancy-trials'],['act-1-walkthrough','permanent-rewards'],['equipment-basics','budget-gear-crafting'],['endgame-contents','pinnacle-bosses']])assert(doc(`guides/${from}/index.html`).querySelector(`a[href="/guides/${to}/"]`),`${from} -> ${to}`);
assert(doc('guides/equipment-basics/index.html').body.textContent.includes('ノーマルまたはマジック'));
assert(!read('sitemap.xml').includes('/tests/'));assert.equal(doc('tests/mobile.html').querySelector('meta[name=robots]').content,'noindex,nofollow');
console.log('PASS: trials/rewards/gear/boss articles, category and cross-links, explicit shared OG and current Alchemy text');
