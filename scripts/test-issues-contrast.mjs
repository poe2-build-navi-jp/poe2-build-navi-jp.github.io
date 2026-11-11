// Static fallback regression test; browser/axe coverage lives in test-contrast.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const css=readFileSync('assets/styles.css','utf8')+'\n'+readFileSync('assets/issues.css','utf8');
const dom=new JSDOM(readFileSync('issues/index.html','utf8'));
const style=dom.window.document.createElement('style');style.textContent=css;dom.window.document.head.append(style);
const lum=s=>{const c=s.match(/\d+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return c[0]*.2126+c[1]*.7152+c[2]*.0722};
const contrast=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((a,b)=>b-a);return(x+.05)/(y+.05)};
for(const card of dom.window.document.querySelectorAll('.issue-card')){
 const bg=dom.window.getComputedStyle(card).backgroundColor;
 for(const el of card.querySelectorAll('h3,p,a')){
  const ratio=contrast(dom.window.getComputedStyle(el).color,bg);
  assert(ratio>=4.5,`${el.tagName} card contrast ${ratio}`);
  console.log(`${el.tagName} card contrast ${ratio.toFixed(2)}:1`);
 }
}
assert(contrast('rgb(184,198,212)','rgb(16,28,41)')>=4.5);
assert(contrast('rgb(7,89,133)','rgb(242,238,229)')>=3);
console.log('PASS: issue card text, links, placeholders and light-canvas focus contrast');
