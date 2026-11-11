import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const guides=JSON.parse(readFileSync('data/strategy-guides.json'));
const g=guides.find(g=>g.slug==='endgame-items');
const html=readFileSync('guides/endgame-items/index.html','utf8');
for(const id of ['lineage-supports','rakiatas-flow','lineage-farming','lineage-anomaly','lineage-boss-drops','lineage-global','lineage-unconfirmed','lineage-trade']){
 assert(g.sections.some(s=>s.id===id));assert(html.includes(`id="${id}"`));
}
const farming=JSON.stringify(g.sections.find(s=>s.id==='lineage-farming'));
assert(farming.includes('受けるダメージも35％低下'));
assert(farming.includes('ラキアタそのもの15％'));
assert(farming.includes('エリアLv75以上'));
assert(farming.includes('ピナクル限定'));
for(const m of JSON.stringify(g).matchAll(/\[source:(\d+)\]/g))assert(g.sources[Number(m[1])-1]);
assert(g.sections.find(s=>s.id==='lineage-unconfirmed').paragraphs.join('').includes('空白だけで一般ドロップ・未実装と判断しません'));
console.log('PASS: lineage acquisition, uncertainty, source references and Jado downside');
