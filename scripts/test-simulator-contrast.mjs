import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const dom=new JSDOM(readFileSync('simulator/index.html','utf8')),d=dom.window.document,w=dom.window;
const style=d.createElement('style');style.textContent=readFileSync('assets/styles.css','utf8')+'\n'+readFileSync('assets/simulator.css','utf8');d.head.append(style);
d.getElementById('sim-build-warnings').innerHTML='<a href="/guides/resistance/">耐性を補う装備の選び方</a>';
function variable(el,name){for(let p=el;p;p=p.parentElement){const value=w.getComputedStyle(p).getPropertyValue(name).trim();if(value)return value;}throw Error('Missing color variable '+name);}
function resolveColor(el,value){return value.replace(/var\((--[\w-]+)\)/g,(_,name)=>resolveColor(el,variable(el,name)));}
function rgba(el,value){value=resolveColor(el,value.trim());if(/^#/.test(value)){let h=value.slice(1);if(h.length===3)h=h.split('').map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)).concat(h.length===8?parseInt(h.slice(6),16)/255:1);}if(value==='transparent')return[0,0,0,0];const parts=value.match(/[\d.]+/g)?.map(Number);assert(parts?.length>=3,'Unsupported color '+value);return parts;}
function foreground(el){const value=w.getComputedStyle(el).color;if(!value||value==='inherit')return foreground(el.parentElement);return rgba(el,value);}
const blend=(a,b)=>{const t=a[3]??1;return[0,1,2].map(i=>a[i]*t+b[i]*(1-t)).concat(1);};
function background(el){const ancestors=[];for(let p=el;p;p=p.parentElement)ancestors.unshift(p);return ancestors.reduce((bg,p)=>blend(rgba(p,w.getComputedStyle(p).background.startsWith('var(')?w.getComputedStyle(p).background:w.getComputedStyle(p).backgroundColor),bg),[255,255,255,1]);}
const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const checks=['.sim-first-guide h2','.sim-first-guide li','.sim-first-guide b','.sim-first-guide p','.sim-first-guide .sim-muted','.sim-first-guide .sim-file-button','.sim-results .sim-checks .sim-muted','#sim-build-warnings a','#sim-guide-link'];
for(const selector of checks){for(const el of d.querySelectorAll(selector)){const bg=background(el),fg=blend(foreground(el),bg),a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert(ratio>=4.5,`${selector}: ${ratio.toFixed(2)}:1`);console.log(`${selector}: ${ratio.toFixed(2)}:1`);}}
assert(checks.every(s=>d.querySelector(s)),'All intended surfaces must be present');
console.log('PASS: dark introduction, list markers, light call-to-action, nested light checks, explanatory links, and dark sidebar keep readable foregrounds');
dom.window.close();
