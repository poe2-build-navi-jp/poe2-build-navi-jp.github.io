import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const guides=JSON.parse(readFileSync('data/strategy-guides.json','utf8'));
for(const slug of ['atlas-progression','atlas-passive-trees']){
 const guide=guides.find(g=>g.slug===slug);
 const section=guide.sections.find(s=>s.id==='all-atlas-points');
 assert(section);
 const copy=JSON.stringify(section);
 for(const term of ['3回','非クエスト版','Map所有者','クエスト版','専用ポイント','灰のアービター'])assert(copy.includes(term),term);
 for(const [,n] of copy.matchAll(/\[source:(\d+)\]/g))assert.equal(guide.sources[+n-1].url,'https://www.pathofexile.com/forum/view-thread/4000864');
 const html=readFileSync(`guides/${slug}/index.html`,'utf8');
 assert(html.includes('id="all-atlas-points"'));
 assert(html.includes('3回という累計回数が条件ではありません'));
}
console.log('Atlas completion conditions: passed');
