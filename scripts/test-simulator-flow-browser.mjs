// Real calculations and retained drafts across the compact editor/results navigation.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium,webkit} from 'playwright-core';
const root=resolve(import.meta.dirname,'..'),output='/tmp/poe2-flow-qa';await mkdir(output,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
const server=createServer(async(req,res)=>{try{let path=new URL(req.url,'http://localhost').pathname;if(path.endsWith('/'))path+='index.html';const file=resolve(root,'.'+path);if(!file.startsWith(root+'/'))throw Error('outside');res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port,reports=[];
try{for(const [type,name]of [[chromium,'chromium'],[webkit,'webkit']]){
 const browser=await type.launch();
 try{for(const [width,locale]of [[320,''],[390,''],[768,'/en'],[1366,'/en']]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<500,hasTouch:width<1000}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  try{
   await page.goto(base+locale+'/simulator/?build=mercenary-twister-gemling',{waitUntil:'domcontentloaded'});
   await page.locator('#sim-flow-save-status').waitFor();await page.locator('#sim-stats[aria-busy="false"] .sim-stat').first().waitFor({timeout:60000});
   assert.equal(await page.locator('#sim-error').isVisible(),false);
   const measure=async()=>page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,nav:document.querySelector('.sim-flow-nav').getBoundingClientRect().toJSON(),editor:document.querySelector('#sim-item-list-title').getBoundingClientRect().toJSON(),apply:document.querySelector('#sim-item-apply').getBoundingClientRect().toJSON(),tools:document.querySelector('.sim-flow-tools').getBoundingClientRect().toJSON()}));
   const first=await measure();assert.equal(first.overflow,false);assert(first.nav.height>=44);assert(first.nav.top<430,'navigation must appear before optional tools');assert(first.editor.top<720,'editing must be reachable in the first screen');assert(first.tools.top>first.editor.top);
   assert.equal(await page.locator('#sim-slots button:visible').count(),10);await page.locator('#sim-flow-utilities').click();assert.equal(await page.locator('#sim-slots button:visible').count(),15);await page.locator('#sim-flow-utilities').click();
   const before=await page.locator('#sim-stats .sim-stat b').allTextContents(),key='poe2-simulator:v1:mercenary-twister-gemling';
   await page.locator('[data-slot="helmet"]').click();await page.locator('[data-equipment-mode="paste"]').click();
   assert.equal(await page.locator('#sim-item-text').isVisible(),true);
   const draft='Rarity: Rare\nFlow QA\nLeather Cap\n--------\n+123 to maximum Life';await page.locator('#sim-item-text').fill(draft);
   const saved=await page.evaluate(key=>localStorage.getItem(key),key);
   await page.locator('#sim-view-results').click();assert.equal(await page.locator('.sim-editor').isVisible(),false);assert.equal(await page.locator('#sim-results-panel').isVisible(),true);assert.deepEqual(await page.locator('#sim-stats .sim-stat b').allTextContents(),before);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved,'view switches cannot save an unconfirmed item');
   await page.locator('#sim-flow-back').click();assert.equal(await page.locator('#sim-item-text').inputValue(),draft);assert.equal(await page.locator('#sim-item-text').isVisible(),true,'return to the same open draft');
   await page.locator('#sim-item-apply').click();await page.locator('#sim-stats[aria-busy="false"]').waitFor();
   const applied=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key));assert(applied.request.items.some(item=>item.slot==='helmet'&&item.text.includes('123')));
   const after=await page.locator('#sim-stats .sim-stat b').allTextContents();assert.equal(Number(after[1].replaceAll(',',''))-Number(before[1].replaceAll(',','')),123);
   await page.locator('#sim-view-results').click();await page.screenshot({path:resolve(output,`${name}-${width}-results.jpg`),type:'jpeg',quality:85});
   await page.locator('[data-tab="skills"]').click();assert.equal(await page.locator('#sim-skills').isVisible(),true);assert.equal(await page.locator('#sim-view-results').getAttribute('aria-pressed'),'false');
   await page.locator('[data-tab="items"]').click();await page.locator('#sim-item-back').click();
   await page.locator('.sim-flow-file-menu>summary').click();assert.equal(await page.locator('#sim-download').isVisible(),true);assert.equal(await page.locator('#sim-file').isEnabled(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('.sim-flow-file-menu').evaluate(element=>element.open),false);
   await page.locator('#sim-flow-saved').click();assert.equal(await page.locator('#sim-workspace').evaluate(element=>element.open),true);await page.locator('#sim-plan-name').fill('Flow QA saved build');await page.locator('#sim-plan-create').click();await page.locator('#sim-plan-status').filter({hasText:locale?'saved':'保存'}).waitFor();
   await page.locator('#sim-history-undo').click();await page.locator('#sim-stats[aria-busy="false"]').waitFor();assert.deepEqual(await page.locator('#sim-stats .sim-stat b').allTextContents(),before,'undo must retain the existing history behavior');
   await page.locator('[data-tab="items"]').click();await page.screenshot({path:resolve(output,`${name}-${width}-editor.jpg`),type:'jpeg',quality:85});
   assert.equal((await measure()).overflow,false);assert.deepEqual(errors,[]);
   reports.push({browser:name,width,locale:locale||'ja',first,result:'PASS'});console.log(JSON.stringify(reports.at(-1)));
  }finally{await context.close();}
 }}finally{await browser.close();}
}}finally{await writeFile(resolve(output,'results.json'),JSON.stringify(reports,null,2));server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
console.log('PASS: first-screen editing, 5-view navigation, retained drafts, exact real-engine Life change, autosave, history, file controls and named saves at 320/390/768/1366px in Chromium and WebKit');
