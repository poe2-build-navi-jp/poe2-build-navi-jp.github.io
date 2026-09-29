// Text contrast (WCAG AA) on every sitemap page + 404, at desktop and phone widths.
// Needs dev dependencies (npm install) and a local Chromium; run with `npm run test:contrast`.
// axe covers solid backgrounds; the second pass walks ancestors so text over gradients is checked too.
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname,normalize} from 'node:path';
import {createRequire} from 'node:module';
import {chromium} from 'playwright-core';
const root=resolve(import.meta.dirname,'..');
const axeSource=await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'),'utf8');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.xml':'application/xml'};
const server=createServer(async(req,res)=>{
 let path=normalize(decodeURIComponent(new URL(req.url,'http://x').pathname)).replace(/^(\.\.[/\\])+/,'');
 if(path.endsWith('/'))path+='index.html';
 try{const body=await readFile(resolve(root,'.'+path));res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream'});res.end(body);}
 catch{res.writeHead(404);res.end();}
}).listen(0);
const base=`http://localhost:${server.address().port}`;
const sitemap=await readFile(resolve(root,'sitemap.xml'),'utf8');
const paths=[...sitemap.matchAll(/<loc>https:\/\/poe2-build-navi-jp\.github\.io([^<]*)<\/loc>/g)].map(m=>m[1]).concat('/404.html');
const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
const failures=[];
for(const width of [1280,375]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route(/^https?:\/\/(?!localhost)/,route=>route.abort());
 for(const path of paths){
  await page.goto(base+path,{waitUntil:'load'});
  await page.addScriptTag({content:axeSource});
  const found=await page.evaluate(async()=>{
   const out=[];
   const r=await window.axe.run(document,{runOnly:['color-contrast']});
   for(const v of r.violations)for(const n of v.nodes){const d=n.any[0]?.data||{};out.push(`${n.target.join(' ')}: ${d.fgColor} on ${d.bgColor} = ${d.contrastRatio}`);}
   const rgb=c=>c.match(/[\d.]+/g).map(Number);
   const lum=c=>{const [r,g,b]=rgb(c).map(x=>{x/=255;return x<=.03928?x/12.92:((x+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b};
   const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05)};
   for(const el of document.querySelectorAll('body *')){
    if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
    const cs=getComputedStyle(el);if(cs.visibility==='hidden'||!el.getClientRects().length)continue;
    let stops=null;
    for(let a=el;a;a=a.parentElement){const s=getComputedStyle(a);
     if(/gradient/.test(s.backgroundImage)){stops=(s.backgroundImage.match(/rgba?\([^)]*\)/g)||[]).filter(c=>(rgb(c)[3]??1)===1);if(stops.length)break;stops=null;}
     const c=s.backgroundColor;if(c&&(rgb(c)[3]??1)===1){stops=null;break;}}
    if(!stops)continue; // Solid backgrounds are covered by axe above.
    const big=parseFloat(cs.fontSize)>=24||(parseFloat(cs.fontSize)>=18.66&&+cs.fontWeight>=700);
    const worst=Math.min(...stops.map(s=>ratio(cs.color,s)));
    if(worst<(big?3:4.5))out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}: ${cs.color} on gradient = ${worst.toFixed(2)}`);
   }
   return out;
  });
  for(const f of found)failures.push(`${width}px ${path} ${f}`);
 }
 await page.close();
}
await browser.close();server.close();
if(failures.length){console.error(failures.slice(0,40).map(f=>`FAIL: ${f}`).join('\n'));if(failures.length>40)console.error(`…and ${failures.length-40} more`);process.exit(1);}
console.log(`PASS: text contrast on ${paths.length} pages at 1280px and 375px`);
