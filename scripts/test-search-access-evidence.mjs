import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const robots=read('robots.txt');
const groups=[];let current;
for(const raw of robots.split('\n')){const line=raw.split('#')[0].trim();const m=line.match(/^(User-agent|Allow|Disallow):\s*(.*)$/i);if(!m)continue;if(m[1].toLowerCase()==='user-agent'){current={agent:m[2].toLowerCase(),rules:[]};groups.push(current);}else{assert(current);current.rules.push({allow:m[1].toLowerCase()==='allow',path:m[2]});}}
const allowed=(agent,path)=>{const group=groups.find(g=>g.agent===agent.toLowerCase())||groups.find(g=>g.agent==='*');const rules=group.rules.filter(r=>r.path&&path.startsWith(r.path)).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));return rules[0]?.allow??true;};
const excluded=['/company/','/docs/','/tools/','/scripts/','/tests/','/.github/','/.claude/','/NOTE_CONTENT_MAP.md','/ASSET_SOURCES.md','/package.json','/package-lock.json'];
for(const agent of ['Googlebot','bingbot','OAI-SearchBot','OtherBot']){
 for(const path of ['/','/guides/tier-16-waystones/','/images/poe2/tier-16-waystones/tier16-tooltip.webp','/assets/styles.css'])assert(allowed(agent,path),`${agent} ${path}`);
 for(const path of excluded)assert(!allowed(agent,path),`${agent} ${path}`);
}
assert(groups.some(g=>g.agent==='oai-searchbot'));
for(const path of ['/','/guides/','/images/poe2/a.webp',...excluded])assert(!allowed('GPTBot',path));
assert.equal((robots.match(/^Sitemap:/gm)||[]).length,1);
const guides=JSON.parse(read('data/strategy-guides.json'));
const targets=['atlas-progression','waystones-tablets','arbiter-of-divinity','mageblood-legacies','tier-16-waystones'];
assert.deepEqual(guides.filter(g=>g.verification).map(g=>g.slug).sort(),targets.slice().sort());
for(const g of guides){const d=new JSDOM(read(`guides/${g.slug}/index.html`)).window.document;const block=d.querySelector('.guide-verification');assert.equal(!!block,targets.includes(g.slug));if(!block)continue;
 assert.equal(block.querySelectorAll('dt').length,3);
 for(const key of ['method','confirmed','unverified'])assert(block.textContent.includes(g.verification[key]));
 assert(d.querySelector('.guide-direct-answer'));
 assert(d.querySelector('.content-action').compareDocumentPosition(block)&4);
 assert(block.compareDocumentPosition(d.querySelector('#sources'))&4);
 assert.equal(d.querySelectorAll('#verification-title').length,1);
 assert(d.querySelector('.guide-meta').textContent.includes(g.version));
 for(const source of g.sources)assert(d.querySelector('#sources').textContent.includes(source.checkedAt));
}
assert.equal(new JSDOM(read('guides/arbiter-of-divinity/index.html')).window.document.querySelectorAll('.guide-record-image').length,15);
assert.equal(new JSDOM(read('guides/tier-16-waystones/index.html')).window.document.querySelectorAll('.guide-record-image').length,1);
console.log('PASS: crawler access matrix, retained exclusions, five scoped evidence blocks and published screenshots');
