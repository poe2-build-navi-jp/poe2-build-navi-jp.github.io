const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const intents=JSON.parse(read('data/guide-search-intents.json')),site=JSON.parse(read('data/site.json')),dates=JSON.parse(read('data/page-dates.json'));
function schemas(doc){let out=[];function visit(n){if(Array.isArray(n))n.forEach(visit);else if(n&&typeof n==='object'){out.push(n);if(n['@graph'])visit(n['@graph']);}}for(const s of doc.querySelectorAll('script[type="application/ld+json"]'))visit(JSON.parse(s.textContent));return out;}
const strip=h=>h.replace(/<!-- guide-search-answer:start -->[\s\S]*?<!-- guide-search-answer:end -->/g,'');
(async()=>{
 const {enhanceHtml}=await import(pathToFileURL(path.join(root,'tools/enhance-guide-search-intents.mjs')));
 assert(intents.length>=18);assert.equal(new Set(intents.map(i=>i.primaryIntent)).size,intents.length);assert.equal(new Set(intents.map(i=>i.path)).size,intents.length);
 for(const i of intents){
  for(const key of ['slug','path','primaryIntent','title','h1','description','answer','boundary'])assert(i[key]?.trim(),`${i.slug}: ${key}`);
  assert(i.searchExamples.length);assert.equal(i.path,`/guides/${i.slug}/`);
  const before=read(i.path.slice(1)+'index.html'),after=enhanceHtml(before,i,site,dates[i.path]);
  assert.equal(enhanceHtml(after,i,site,dates[i.path]),after,`${i.slug}: idempotence`);
  const old=new JSDOM(strip(before)).window.document,d=new JSDOM(after).window.document;
  assert.equal(d.querySelector('title').textContent,i.title);assert.equal(d.querySelector('h1').textContent,i.h1);
  assert.equal(d.querySelector('meta[name="description"]').content,i.description);
  assert.equal(d.querySelector('meta[property="og:title"]').content,i.title);
  assert.equal(d.querySelector('meta[property="og:description"]').content,i.description);
  assert.equal(d.querySelectorAll('.guide-direct-answer').length,1);assert.equal(d.querySelector('.guide-direct-answer').textContent,i.answer);
  assert.equal(d.querySelector('h1').nextElementSibling.className,'guide-direct-answer');
  const all=schemas(d),prior=schemas(old),article=all.filter(s=>s['@type']==='Article');
  assert.equal(article.length,1);assert.equal(article[0].headline,i.h1);assert.equal(article[0].description,i.description);
  const previous=prior.find(s=>s['@type']==='Article');if(previous?.datePublished)assert.equal(article[0].datePublished,previous.datePublished);
  assert.deepEqual(all.filter(s=>s['@type']==='BreadcrumbList'),prior.filter(s=>s['@type']==='BreadcrumbList'));
  for(const selector of ['.lead','.sources','.source-list','.guide-meta','.update-strip','.article-toc','.strategy-section','.content-action'])assert.deepEqual([...d.querySelectorAll(selector)].map(e=>e.innerHTML),[...old.querySelectorAll(selector)].map(e=>e.innerHTML),`${i.slug}: preserve ${selector}`);
  for(const a of d.querySelectorAll('article a[href^="#"]'))assert(d.getElementById(a.hash.slice(1)),`${i.slug}: ${a.hash}`);
  if(process.argv.includes('--rendered'))assert.equal(before,after,`${i.slug}: run the enhancer after all generators`);
 }
 const fixture='<!doctype html><html lang="ja"><head><title>Original</title><script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[]}</script></head><body><article><h1>Original</h1><p>Existing body.</p></article></body></html>';
 const first=enhanceHtml(fixture,intents[0],site,{date:'2026-09-10'}),second=enhanceHtml(first,intents[0],site,{date:'2026-09-10'});
 assert.equal(first,second);const article=schemas(new JSDOM(first).window.document).find(s=>s['@type']==='Article');assert(!article.datePublished,'Never invent publication date from modification date');
 console.log(`PASS: ${intents.length} unique guide intents; metadata/Article alignment, direct answers, preserved bodies/TOCs/sources/publication dates, idempotence`+(process.argv.includes('--rendered')?', rendered HTML current':''));
})().catch(e=>{console.error(e);process.exitCode=1});
