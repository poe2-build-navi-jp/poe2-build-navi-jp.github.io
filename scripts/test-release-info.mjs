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
 const faq=[...d.querySelectorAll('script[type="application/ld+json"]')].map(s=>JSON.parse(s.textContent)).flat().filter(s=>s['@type']==='FAQPage');
 if(source.faq?.length){assert.equal(faq.length,1,path+' FAQ schema after reading-layout regeneration');assert.equal(faq[0].mainEntity.length,source.faq.length,path+' FAQ questions');}
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
assert(text.includes('2026年12月12日（日本時間）'),'Use GGG localized release date');
const release=pages.find(p=>p.path==='/poe2-1-0/release-date/');assert(release.answer.includes('12月12日'));assert(release.answer.includes('PST'));
assert(!JSON.stringify(release.faq).includes('日本時間の日付は未確定'));
assert(JSON.stringify(duelist.sections).includes('後日追加'));assert(JSON.stringify(duelist.answer).includes('資料間'));
const shadow=pages.find(p=>p.path==='/poe2-1-0/shadow/');assert(JSON.stringify(shadow).includes('インフィルトレーター'));
const balance=pages.find(p=>p.path==='/poe2-1-0/balance-changes/');for(const term of ['穢れた血','チャユラの門弟','インファーナルハウンド'])assert(JSON.stringify(balance).includes(term));
const mac=pages.find(p=>p.path==='/poe2-1-0/system-requirements/');assert(JSON.stringify(mac.sections).includes('M2'));assert(JSON.stringify(mac.sections).includes('M1 Pro'));assert(!JSON.stringify(mac.sections).includes('正式版1.0でのMac対応は公式発表を確認してから追記'));
for(const li of hub.querySelectorAll('.content-action>ul>li'))assert(!li.classList.contains('action-step'));
assert(hub.querySelector('.content-action>ol.action-steps'),'Only labeled ordered steps opt in to grid');
console.log('PASS: official Japanese names, localized release date, conflicting evidence, Mac announcement, navigation and version separation');
