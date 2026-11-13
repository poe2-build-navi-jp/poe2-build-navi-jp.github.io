import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const base='https://poe2-build-navi-jp.github.io';
const ja=new JSDOM(await read('simulator/index.html'),{url:base+'/simulator/'}).window.document;
const en=new JSDOM(await read('en/simulator/index.html'),{url:base+'/en/simulator/'}).window.document;
assert.equal(en.documentElement.lang,'en');
assert.match(en.title,/PoE2|Path of Exile 2/);assert.match(en.title,/Simulator|Planner/);
assert(en.querySelector('meta[name="description"]').content.length>60);
assert.equal(en.querySelectorAll('h1').length,1);
for(const [doc,path] of [[ja,'/simulator/'],[en,'/en/simulator/']]){
 assert.equal(doc.querySelector('link[rel="canonical"]').href,base+path);
 assert.equal(doc.querySelector('link[hreflang="en"]').href,base+'/en/simulator/');
 assert.equal(doc.querySelector('link[hreflang="ja"]').href,base+'/simulator/');
 assert.match(doc.querySelector('meta[name="robots"]').content,/index,follow/);
}
assert(en.querySelector('a[href="/simulator/"]'));
assert(ja.querySelector('a[href="/en/simulator/"]'));
for(const el of ja.querySelectorAll('[id^="sim-"]'))assert(en.getElementById(el.id),'Missing English control: '+el.id);
assert.equal(en.querySelectorAll('[data-preset]').length,12);
assert(en.querySelector('script[src*="simulator-en.js"]'));
assert((await read('en/simulator/index.html')).includes("gtag('set','page_location',location.origin+location.pathname)"),'Do not send shared builds to analytics');
assert((await read('sitemap.xml')).includes(base+'/en/simulator/'));
assert((await read('sitemap.txt')).includes(base+'/en/simulator/'));
assert((await read('tools/build-steps.mjs')).includes('generate-simulator-english'));
assert(!/MutationObserver/.test(await read('assets/simulator-en.js')),'Do not translate arbitrary DOM/user content');
console.log('PASS: English canonical, reciprocal hreflang, indexable static content, language links, controls, sitemap and reproducible build');

// JSON comes before JS in the fingerprint matcher so .json is never truncated to .js.
const runtime=await read('assets/simulator-en.js');
for(const catalog of ['presets','examples','equipment','routes']){
 assert.match(runtime,new RegExp('simulator-'+catalog+'-en\\.json\\?v=[a-f0-9]{10}'),'Versioned English '+catalog+' data');
}
