// Real viewport checks for local development or CI. Uses a clean browser context.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright-core';
const root=resolve(import.meta.dirname,'..'),output=process.env.UX_QA_OUTPUT||'/tmp/poe2-usability-qa';
await mkdir(output,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.bin':'application/octet-stream','.webp':'image/webp','.png':'image/png'};
const server=createServer(async(request,response)=>{
 try{let pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);if(pathname.endsWith('/'))pathname+='index.html';const path=resolve(root,'.'+pathname);if(!path.startsWith(root+'/'))throw Error('outside root');const bytes=await readFile(path);response.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});response.end(bytes);}catch{response.writeHead(404);response.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,reports=[];
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 for(const width of [360,390,768,1366]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<=768}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  const check=async name=>{
   const layout=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,dialogs:[...document.querySelectorAll('dialog[open]')].map(dialog=>{const box=dialog.getBoundingClientRect();return {left:box.left,right:box.right,top:box.top,bottom:box.bottom};})}));
   assert(!layout.overflow,`${width}/${name}: horizontal overflow`);
   const prose=await page.locator('.content-action>ul>li').evaluateAll(items=>items.filter(li=>li.textContent.trim().length>35).map(li=>{const range=document.createRange();range.selectNodeContents(li);return {width:li.getBoundingClientRect().width,textWidth:Math.max(0,...[...range.getClientRects()].map(r=>r.width)),display:getComputedStyle(li).display};}));
   for(const li of prose){assert.equal(li.display,'list-item',`${width}/${name}: prose must not be a grid`);assert(li.textWidth>=Math.min(li.width*.7,240),`${width}/${name}: prose squeezed into a narrow column`);}

   for(const box of layout.dialogs)assert(box.left>=0&&box.right<=layout.width+1&&box.top>=0&&box.bottom<=900,`${width}/${name}: dialog outside viewport`);
   await page.screenshot({path:resolve(output,`${width}-${name}.jpg`),type:'jpeg',quality:80});reports.push({width,name,...layout});
  };
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});await page.locator('[data-reading-open]').waitFor();await check('home');
  if(width<=768){await page.locator('.menu-button').click();assert.equal(await page.locator('.menu-button').getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('.menu-button').getAttribute('aria-expanded'),'false');}
  await page.locator('#site-quick-query').fill('テイミング');await page.locator('.site-tools form button').click();await page.waitForURL('**/search/?q=*');assert.equal(new URL(page.url()).searchParams.get('q'),'テイミング');
  await page.goto(base+'/equipment/the-taming/',{waitUntil:'domcontentloaded'});await page.locator('[data-reading-save]').click();assert.equal(await page.locator('[data-reading-save]').getAttribute('aria-pressed'),'true');await page.locator('[data-reading-open]').click();await check('reading-list');assert.equal(await page.locator('[data-reading-list="favorites"] a').count(),1);await page.locator('[data-reading-close]').click();
  // Release news uses existing article/table styles and must fit the same viewports.
  for(const slug of ['', 'shadow/', 'duelist/', 'campaign/', 'conquerors-of-wraeclast/', 'balance-changes/', 'exilecon-2026/']){
   await page.goto(base+'/poe2-1-0/'+slug,{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('main h1').count(),1);
   await check('release-'+(slug.replaceAll('/','')||'hub'));
  }
  for(const locale of ['', '/en']){
   const suffix=locale?'-en':'';await page.goto(base+locale+'/simulator/',{waitUntil:'domcontentloaded'});
   await page.locator('#sim-build-search').fill('Spark');assert.equal(await page.locator('[data-preset]:visible').count(),1);await page.locator('#sim-build-reset').click();assert.equal(await page.locator('[data-preset]:visible').count(),13);await check('chooser'+suffix);
   await page.locator('[data-preset="mercenary-twister-gemling"]').click();await page.locator('.sim-stat').first().waitFor({state:'attached',timeout:60000});await page.locator('[data-slot="ring1"]').click();await page.locator('#sim-unique-editor .sim-equipment-find').click();
   await page.locator('#sim-equipment-search').fill('The Taming');await page.locator('[data-equipment-choice]').first().waitFor();assert.equal(await page.locator('[data-equipment-choice]').count(),1);await check('equipment-picker'+suffix);
   await page.locator('[data-equipment-choice]').click();await page.waitForFunction(()=>document.querySelector('#sim-item-text').value.length>10);await page.locator('#sim-item-apply').click();await page.locator('#sim-stats[aria-busy="false"]').waitFor({state:'attached'});await check('item-editor'+suffix);
   await page.locator('#sim-item-back').click();await page.locator('[data-slot="helmet"]').click();await page.locator('[data-equipment-mode="rare"]').click();await page.locator('[data-rare-quick="life"]').click();await page.locator('[data-rare-quick="all_res"]').click();assert.equal(await page.locator('[data-rare-row]').count(),2);await check('rare-editor'+suffix);
   await page.locator('#sim-item-reset').click();await page.locator('#sim-item-back').click();await page.locator('[data-slot="ring1"]>.equipment-icon').waitFor();
   await page.locator('[data-tab="tree"]').click();await page.locator('#sim-tree-nodes circle[data-passive-icon]').first().waitFor();
   assert.equal(await page.locator('#sim-tree-nodes circle[data-passive-icon]').count(),await page.locator('#sim-tree-nodes circle').count());
   const art=await page.locator('#sim-passive-sheet').getAttribute('href');assert(art.startsWith('/images/poe2/passives/'));
   assert((await page.request.get(base+art)).ok(),'local passive art must load');
   if(!await page.locator('#sim-tree-settings').evaluate(element=>element.open))await page.locator('#sim-tree-settings>summary').click();
   await page.locator('#sim-node-search').fill('59779');await page.locator('#sim-node-search-results .sim-passive-icon').waitFor();
   assert.equal(await page.locator('#sim-node-search-results .sim-passive-icon').count(),1);await check('passive-search'+suffix);await page.locator('#sim-node-search').fill('');
   await page.locator('#sim-node-catalog summary').click();assert.equal(await page.locator('#sim-node-catalog-list .sim-passive-icon').count(),30);await check('passive-catalog'+suffix);
   await page.locator('#sim-node-catalog-list button').first().click();await page.locator('#sim-node-detail .sim-passive-icon').waitFor();await check('passive-detail'+suffix);
   if(await page.locator('#sim-tree-open').isVisible())await page.locator('#sim-tree-open').click();
   if(await page.locator('#sim-tree-hide-node').isVisible())await page.locator('#sim-tree-hide-node').click();
   await check('passive-tree'+suffix);await page.locator('#sim-tree-close').click();
  }
  assert.deepEqual(errors,[],`${width}: page errors`);await context.close();
 }
 await writeFile(resolve(output,'report.json'),JSON.stringify(reports,null,2)+'\n');
 console.log(`PASS: ${reports.length} Chromium views at 360/390/768/1366px; search, reading list, menu, JA/EN chooser, image picker, apply, rare edits, reset, passive tree/catalog/detail artwork; no overflow or page errors.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
