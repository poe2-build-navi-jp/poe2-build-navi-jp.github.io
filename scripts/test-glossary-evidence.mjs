import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const terms=JSON.parse(read('data/dictionary.json'));
assert.equal(terms.length,13);
for(const term of terms){
 const d=new JSDOM(read(`dictionary/${term.slug}/index.html`)).window.document;
 const block=d.querySelector('.term-provenance');assert(block,term.slug);
 assert.equal(block.querySelectorAll('dt').length,3);
 for(const field of ['method','scope','unknown'])assert(block.textContent.includes(term.provenance[field]));
 assert(d.querySelector('.term-lead').compareDocumentPosition(d.querySelector('.term-action'))&4);
 assert(d.querySelector('.term-action').compareDocumentPosition(block)&4);
 assert(block.compareDocumentPosition(d.querySelector('#term-sources'))&4);
 assert.equal(d.querySelectorAll('#term-evidence-title').length,1);
 assert.equal(d.querySelectorAll('#term-sources').length,1);
 assert(!d.body.textContent.includes('数値や仕様はPath of Exile 2 0.5.5時点'));
 assert(d.querySelector('link[href^="/assets/guide-verification.css"]'));
 for(const source of term.sources)assert(d.querySelector('#term-sources').textContent.includes(source.checkedAt));
}
const builds=JSON.parse(read('data/builds.json'));
assert.equal(builds.length,12);
for(const b of builds){
 const d=new JSDOM(read(`builds/${b.classSlug}/${b.slug}/index.html`)).window.document;
 assert(b.ratingEvidence && b.changeHistory.length && b.version);
 assert(d.body.textContent.includes('同一条件の性能測定ではありません'));
 assert(/未確認|再確認|再検証/.test(d.body.textContent));
 assert(!d.querySelector('.term-provenance'));
}
const entities=JSON.parse(read('data/core-entities.json'));assert.equal(entities.length,25);
for(const e of entities){assert(e.cautions.length);for(const s of e.sources)assert(s.supports && s.checkedAt);}
console.log('PASS: thirteen term-specific source scopes, retained source dates, action order; twelve build and twenty-five entity evidence structures');
