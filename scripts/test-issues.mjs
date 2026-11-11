import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const html=readFileSync('issues/index.html','utf8'),js=readFileSync('assets/issues.js','utf8');
const dom=new JSDOM(html,{url:'https://poe2-build-navi-jp.github.io/issues/',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.eval(js);
d.querySelector('[name=summary]').value='<script>alert(1)</script>';
d.querySelector('[name=steps]').value='1. 再現する';
const form=d.getElementById('issue-form');form.dispatchEvent(new w.Event('submit',{cancelable:true}));
assert.equal(d.getElementById('report-output').hidden,false);
assert.match(d.getElementById('report-text').value,/<script>alert/);
assert.equal(d.querySelector('#report-output script'),null);
assert.match(d.getElementById('report-status').textContent,/送信されていません/);
form.dispatchEvent(new w.Event('submit',{cancelable:true}));
assert.equal(d.querySelectorAll('#report-output').length,1);
form.reset();assert.equal(d.getElementById('report-text').value,'');assert.equal(d.getElementById('report-output').hidden,true);
assert(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage/.test(js));
assert.match(html,/公式一覧に掲載/);assert.match(html,/修正済み/);assert.match(html,/プレイヤー報告・未確認/);
for(const p of ['index.html','simulator/index.html','leveling/index.html']){const doc=new JSDOM(readFileSync(p,'utf8')).window.document;assert.equal(doc.querySelectorAll('footer a[href="/issues/"]').length,1);assert.equal(doc.querySelectorAll('.site-nav a[href="/issues/"]').length,0);}
console.log('Issues: draft/reset/repeat/privacy/status/footer-only checks passed');

assert.equal(d.querySelectorAll('a[href="https://gemnao.pages.dev/games/path-of-exile-2/not-launching"]').length,1);
