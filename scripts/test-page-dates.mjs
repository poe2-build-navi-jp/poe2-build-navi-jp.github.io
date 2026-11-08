import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {JSDOM} from 'jsdom';
import {contentHash,legacyContentHash,recordPageDate} from '../tools/page-content.mjs';
import {synchronizePageDate} from '../tools/page-date-signals.mjs';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
const html='<html><head><title>Guide</title><meta name="description" content="Useful guide"></head><body><main><h1>Guide</h1><p>Body text</p><a href="/old/">Read more</a><img src="/old.svg" alt="Guide"></main></body></html>';
const old={hash:legacyContentHash(html),date:'2026-01-01'};
const migrated=recordPageDate(html,old,'2026-02-01');
assert.equal(migrated.date,old.date,'Fingerprint migration must not freshen unchanged pages');
assert.equal(migrated.hashVersion,2);
assert.equal(recordPageDate(html,migrated,'2026-03-01').date,old.date,'Unchanged rebuild preserves date');
for(const changed of [html.replace('/old/','/new/'),html.replace('/old.svg','/new.svg'),html.replace('Useful guide','Improved guide'),html.replace('Body text','Changed text')])assert.equal(recordPageDate(changed,migrated,'2026-02-01').date,'2026-02-01');
assert.equal(legacyContentHash(html.replace('/old/','/new/')),legacyContentHash(html),'Reproduces former URL-only update blind spot');
const options={date:'2026-01-01',url:'https://example.com/guide/',title:'Guide',today:'2026-02-01'};
const synced=synchronizePageDate(html,options);
assert.equal(contentHash(synced),contentHash(html),'Date label/schema/CSS must not create a new content date');
assert.equal(synchronizePageDate(synced,options),synced,'Date pass must be idempotent');
const article='<script type="application/ld+json">'+JSON.stringify({'@type':'Article',datePublished:'2025-12-01',dateModified:'2025-12-01'})+'</script>';
const credited=html.replace('</head>',article+'</head>').replace('</h1>','</h1><!-- editorial-credit:start --><p class="editorial-credit">Editor</p><!-- editorial-credit:end -->');
const result=synchronizePageDate(credited,options),doc=new JSDOM(result).window.document;
assert.equal(JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent).datePublished,'2025-12-01');
assert.equal(doc.querySelectorAll('.page-updated').length,1);
assert.equal(synchronizePageDate(result,options),result);
assert.throws(()=>synchronizePageDate(html,{...options,date:'2026-03-01'}),/Future/);
assert.throws(()=>synchronizePageDate(html,{...options,date:'2026-02-30'}),/Invalid/);
const flatten=v=>Array.isArray(v)?v.flatMap(flatten):[v,...v?.['@graph']?flatten(v['@graph']):[]];
const dates=JSON.parse(await read('data/page-dates.json'));
const entries=[...(await read('sitemap.xml')).matchAll(/<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)];
let articles=0;
for(const [,url,lastmod] of entries){
 const path=new URL(url).pathname,body=await read(`.${path}index.html`),d=new JSDOM(body).window.document;
 assert.equal(lastmod,dates[path].date,path);
 assert(lastmod<=today,path);
 assert.equal(dates[path].hash,contentHash(body),`Ledger drift: ${path}`);
 assert.equal(d.querySelectorAll('.page-updated time[datetime]').length,1,path);
 const visible=d.querySelector('.page-updated time');assert.equal(visible.dateTime,lastmod,path);assert.equal(visible.textContent,lastmod,path);
 assert(!visible.closest('[hidden],details:not([open])'),`Hidden page date: ${path}`);
 const pageSchemas=[...d.querySelectorAll('script[type="application/ld+json"]')].flatMap(s=>flatten(JSON.parse(s.textContent))).filter(s=>['Article','WebPage','CollectionPage','FAQPage'].includes(s?.['@type']));
 assert(pageSchemas.length,`Missing page entity: ${path}`);
 for(const s of pageSchemas){assert.equal(s.dateModified,lastmod,path);if(s.datePublished)assert(s.datePublished.slice(0,10)<=lastmod,path);if(s['@type']==='Article')articles++;}
}
// Regeneration must not advance any dates or change the finished HTML. Only run
// inexpensive finishing passes here; body/source generators are tested separately.
const snapshots=await Promise.all(entries.map(async ([,u])=>[new URL(u).pathname,await read(`.${new URL(u).pathname}index.html`)]));
const ledger=await read('data/page-dates.json'),sitemap=await read('sitemap.xml');
for(const tool of ['generate-sitemap','enhance-page-schema','enhance-editorial-trust','inject-analytics','sync-asset-versions'])execFileSync(process.execPath,[`tools/${tool}.mjs`],{cwd:root,stdio:'pipe'});
assert.equal(await read('data/page-dates.json'),ledger,'Unchanged rebuild advanced ledger dates');assert.equal(await read('sitemap.xml'),sitemap);
for(const [path,body] of snapshots)assert.equal(await read(`.${path}index.html`),body,`Non-idempotent date signal: ${path}`);
console.log(`PASS: ${entries.length} page dates agree across visible HTML, schema and sitemap; ${articles} Articles; no future dates; publication dates preserved; URL/image/description edits tracked; unchanged regeneration stable.`);
