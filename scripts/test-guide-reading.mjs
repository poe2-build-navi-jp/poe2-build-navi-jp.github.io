import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyGuideReadingLayout} from '../tools/guide-reading-layout.mjs';
const fixture='<!doctype html><html><head><title>Example</title><link rel="canonical" href="/guides/future-guide/"></head><body class="example"><article><h1>新しい攻略</h1><p>出典と確認範囲はそのまま。</p></article></body></html>';
const result=applyGuideReadingLayout(fixture);
assert.equal(applyGuideReadingLayout(result),result,'Repeated generation stays idempotent');
assert(result.includes('class="guide-reading example"'));
assert.equal(result.replace('<link rel="stylesheet" href="/assets/guide-reading.css">','').replace('guide-reading ',''),fixture,'Presentation does not change facts or metadata');
const generator=readFileSync(new URL('../tools/generate-strategy-articles.mjs',import.meta.url),'utf8');
assert(generator.includes("writeFile(resolve(root,'guides',g.slug,'index.html'),applyGuideReadingLayout(html))"),'Every strategy guide receives reading layout before SEO registration');
for(const g of JSON.parse(readFileSync(new URL('../data/strategy-guides.json',import.meta.url)))){
 const html=readFileSync(new URL(`../guides/${g.slug}/index.html`,import.meta.url),'utf8');
 assert(html.includes('guide-reading.css')&&html.includes('class="guide-reading'),'Rendered strategy inherits shared layout');
}
console.log('PASS: shared article layout, idempotence, facts/metadata preservation and generator inheritance');
