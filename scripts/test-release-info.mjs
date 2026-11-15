// Announced content must remain separate from the live build/calculation version.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const pages=JSON.parse(await read('data/seo-pages.json'));
const hub=new JSDOM(await read('poe2-1-0/index.html')).window.document;
for(const slug of ['shadow','duelist','campaign','conquerors-of-wraeclast','balance-changes','exilecon-2026','build-status']){
 const path=`/poe2-1-0/${slug}/`;
 const source=pages.find(p=>p.path===path);assert(source,path);
 const d=new JSDOM(await read(path.slice(1)+'index.html')).window.document;
 assert.equal(d.querySelectorAll('h1').length,1,path);
 assert(d.querySelector('main').textContent.includes('対象：1.0発表情報（公開前）'),path+' version label');
 assert(!/発表内容：ExileConの後に追記|アセンダンシーの名前と内容/.test(d.querySelector('main').textContent),path+' stale reveal');
 for(const a of d.querySelectorAll('main a[href^="/poe2-1-0/"]'))await read(a.getAttribute('href').slice(1).split('#')[0]+'index.html');
 assert(source.sources.some(s=>s.checkedAt==='2026-11-15'&&s.url.includes('pathofexile.com')),path+' primary evidence');
 assert(hub.querySelector(`a[href="${path}"]`)||slug==='exilecon-2026',path+' hub link');
 const image=d.querySelector('meta[property="og:image"]').content;await readFile(new URL('../'+new URL(image).pathname.slice(1),import.meta.url));
}
const duelist=pages.find(p=>p.path==='/poe2-1-0/duelist/');
assert(JSON.stringify(duelist).includes('Master-at-Arms'));assert(JSON.stringify(duelist).includes('Knight'));
const text=hub.querySelector('main').textContent;assert(text.includes('Shadow'));assert(text.includes('0.5.5'));assert(text.includes('未検証'));
const search=await read('search/index.html');assert(search.includes('/poe2-1-0/shadow/'));assert(search.includes('シャドウ'));
const builds=JSON.parse(await read('data/builds.json'));assert(builds.every(b=>b.version==='0.5.5'),'No reveal-only build upgrades');
console.log('PASS: 1.0 evidence, navigation, version separation, search and OG assets');
