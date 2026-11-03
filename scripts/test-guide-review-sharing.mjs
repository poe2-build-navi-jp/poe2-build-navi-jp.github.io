import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {guideReview,sourceDate} from '../tools/guide-review.mjs';
import {shareCard,shareResources} from '../tools/guide-sharing.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const site=JSON.parse(read('data/site.json'));
const original={slug:'example',version:'参照仕様0.5.0',checkedAt:'2026-10-12',updatedAt:'2026-11-03',scope:'当時確認した範囲',sources:[{checkedAt:'2026-10-01'}]};
const review=new JSDOM(guideReview(original,site)).window.document;
assert.equal(sourceDate(original),'2026-10-12');
assert.equal(sourceDate({sources:[{checkedAt:'2026-10-01'},{checkedAt:'2026-10-03'}]}),'2026-10-03');
assert.equal(sourceDate(undefined),undefined);
assert.equal(review.querySelector('time').dateTime,'2026-10-12');
assert(review.body.textContent.includes('仕様の再検証日ではありません'));
assert(review.body.textContent.includes('参照仕様0.5.0'));
assert.equal(original.checkedAt,'2026-10-12');
for(const g of JSON.parse(read('data/strategy-guides.json'))){
 const d=new JSDOM(read(`guides/${g.slug}/index.html`)).window.document;
 assert.equal(d.querySelectorAll('#verification-title').length,1,g.slug);
 assert.equal(d.querySelector('.guide-review-dates time').dateTime,sourceDate(g),g.slug);
 assert(d.querySelector('#sources'));
 assert.equal(d.querySelectorAll('link[href^="/assets/guide-verification.css"]').length,1);
}
for(const denied of [false,true]){
 const item=shareResources[0];const dom=new JSDOM(shareCard(item,site.baseUrl),{runScripts:'outside-only',url:site.baseUrl+item.href});
 let copied;
 Object.defineProperty(dom.window.navigator,'clipboard',{value:{writeText:async text=>{if(denied)throw Error('denied');copied=text;}}});
 dom.window.eval(read('assets/guide-share.js'));
 const d=dom.window.document,b=d.querySelector('[data-copy-guide]');assert(!b.hidden);b.click();
 await new Promise(resolve=>setTimeout(resolve,0));
 if(denied){assert(d.querySelector('details').open);assert.equal(d.activeElement,d.querySelector('input'));assert(d.querySelector('[role=status]').textContent.includes('選択'));}
 else{assert.equal(copied,site.baseUrl+item.href);assert(d.querySelector('[role=status]').textContent.includes('コピーしました'));}
 const intent=new URL(d.querySelector('a[href^="https://twitter.com/"]').href);assert.equal(intent.searchParams.get('url'),site.baseUrl+item.href);
}
console.log('PASS: source verification dates distinct from edits, 26 source panels, canonical sharing and clipboard permission fallback');
