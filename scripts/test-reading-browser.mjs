// Safari regression: prose must use the card width, even when there is no horizontal overflow.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {webkit} from 'playwright-core';
const root=resolve(import.meta.dirname,'..'),output='/tmp/poe2-reading-qa';await mkdir(output,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp'};
const server=createServer(async(req,res)=>{try{let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';const file=resolve(root,'.'+decodeURIComponent(p));if(!file.startsWith(root+'/'))throw Error('outside root');const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,report=[];let browser;
try{
 browser=await webkit.launch();
 for(const width of [320,390,402,768,1366]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<900});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  for(const path of ['/poe2-1-0/','/poe2-1-0/duelist/','/poe2-1-0/shadow/','/guides/unique-gear/','/classes/warrior/']){
   await page.goto(base+path,{waitUntil:'domcontentloaded'});await page.locator('main h1').waitFor();
   const layout=await page.evaluate(()=>{
    const prose=[...document.querySelectorAll('.content-action>ul>li')].filter(li=>li.textContent.trim().length>35).map(li=>{const range=document.createRange();range.selectNodeContents(li);return {text:li.textContent.trim().slice(0,70),width:li.getBoundingClientRect().width,textWidth:Math.max(0,...[...range.getClientRects()].map(r=>r.width)),display:getComputedStyle(li).display};});
    const steps=[...document.querySelectorAll('.content-action .action-steps>li')].map(li=>{const style=getComputedStyle(li);return {display:style.display,columns:style.gridTemplateColumns};});
    return {overflow:document.documentElement.scrollWidth>innerWidth+1,prose,steps};
   });
   assert(!layout.overflow,`${path}/${width}: horizontal overflow`);
   for(const li of layout.prose){assert.equal(li.display,'list-item',`${path}/${width}: prose must not be a grid`);assert(li.textWidth>=Math.min(li.width*.7,240),`${path}/${width}: text squeezed into a narrow column: ${JSON.stringify(li)}`);}
   for(const step of layout.steps)assert.equal(step.display,'grid',`${path}/${width}: labeled steps keep their layout`);
   const name=path.replaceAll('/','-');await page.screenshot({path:resolve(output,`${width}${name}.jpg`),type:'jpeg',quality:80});
   if(path==='/poe2-1-0/'){
    await page.locator('.content-action>ul').first().scrollIntoViewIfNeeded();await page.screenshot({path:resolve(output,`${width}-release-bullets.jpg`),type:'jpeg',quality:85});
   }
   report.push({width,path,...layout});
  }
  assert.deepEqual(errors,[],`${width}: page errors`);await context.close();
 }
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(`PASS: ${report.length} WebKit views at 320/390/402/768/1366px; prose uses full width, labeled steps retain layout; no overflow or page errors`);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
