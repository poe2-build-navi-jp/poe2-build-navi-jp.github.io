import {readFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
const builds=JSON.parse(await read('data/builds.json'));
const home=await read('index.html'),catalog=await read('builds/index.html');
assert.equal((home.match(/data-class-slug=/g)||[]).length,8);
assert.equal((catalog.match(/class="catalog-card"/g)||[]).length,builds.length);
for(const b of builds){assert(catalog.includes(b.name));const page=await read(`builds/${b.classSlug}/${b.slug}/index.html`);assert.equal((page.match(/<details>/g)||[]).length,8);for(const s of b.levelingStages)assert(page.includes(s.nowActions[0].replaceAll('&','&amp;')));}
const sitemap=await read('sitemap.xml');
let count=0;
for(const [,url] of sitemap.matchAll(/<loc>(.*?)<\/loc>/g)){
 const path=new URL(url).pathname;const file=path.endsWith('/')?`${path.slice(1)}index.html`:path.slice(1);await access(new URL(file,root));
 const page=await read(file);
 assert(page.includes(`rel="canonical" href="${url}"`),`canonical: ${file}`);
 for(const [,href] of page.matchAll(/(?:href|src)="(\/[^"?#]*)(?:[?#][^"]*)?"/g)){const target=href.endsWith('/')?`${href.slice(1)}index.html`:href.slice(1);await access(new URL(target,root));}
 count++;
}
console.log(`PASS: static content and local links on ${count} sitemap pages`);
