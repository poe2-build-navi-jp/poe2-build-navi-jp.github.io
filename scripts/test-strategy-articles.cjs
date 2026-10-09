const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const guides=JSON.parse(read('data/strategy-guides.json'));const sitemap=read('sitemap.xml');
assert(guides.length>=5);assert.equal(new Set(guides.map(g=>g.slug)).size,guides.length);
for(const g of guides){
 const html=read(`guides/${g.slug}/index.html`),d=new JSDOM(html).window.document;
 assert.equal(d.querySelectorAll('h1').length,1);
 assert.equal(d.querySelector('link[rel=canonical]').href,`https://poe2-build-navi-jp.github.io/guides/${g.slug}/`);
 assert.equal(d.querySelectorAll('.content-action li').length,3);
 assert(d.querySelectorAll('.strategy-section').length>=4);
 assert(d.querySelectorAll('#sources li').length>=1);
 for(const a of d.querySelectorAll('a[href^="#"]')) assert(d.getElementById(a.hash.slice(1)),`${g.slug}: missing ${a.hash}`);
 for(const a of d.querySelectorAll('a[href^="/"]')){const p=a.getAttribute('href').split(/[?#]/)[0];assert(fs.existsSync(path.join(root,p,'index.html')),`${g.slug}: missing route ${p}`);}
 for(const s of g.sources){assert(['www.pathofexile.com','pathofexile.com','www.poe2wiki.net','poe2wiki.net','poe2db.tw','www.poe-vault.com','game8.co','www.gamerguides.com','www.pcgamesn.com'].includes(new URL(s.url).hostname),`${g.slug}: source must be reviewed official or named reference`);assert(/^\d{4}-\d{2}-\d{2}$/.test(s.checkedAt));}
 assert(sitemap.includes(`/guides/${g.slug}/</loc>`));
 assert(!html.includes('[source:'),'Source markers must render into links');
 const schema=[...d.querySelectorAll('script[type="application/ld+json"]')].flatMap(s=>JSON.parse(s.textContent));
 assert.equal(schema.filter(s=>s['@type']==='Article').length,1);
 assert(schema.some(s=>s['@type']==='BreadcrumbList'));
 assert(schema.find(s=>s['@type']==='Article').datePublished <= schema.find(s=>s['@type']==='Article').dateModified);
 assert(d.querySelector('.trouble-guides a[href="/guides/"]'));
 assert(d.querySelector('.sources').textContent.includes('確認'));
}
console.log(`PASS: ${guides.length} source-backed strategy articles, citations, TOCs, canonical, sitemap, schema, next routes`);
