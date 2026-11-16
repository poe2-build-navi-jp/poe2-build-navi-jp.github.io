// Real browser execution belongs to GitHub Actions, including Safari's WebKit.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium,webkit} from 'playwright-core';
const root=resolve(import.meta.dirname,'..'),output='/tmp/poe2-photo-qa';await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{try{
 let path=new URL(req.url,'http://localhost').pathname;if(path.endsWith('/'))path+='index.html';const file=resolve(root,'.'+decodeURIComponent(path));if(!file.startsWith(root+'/'))throw Error('outside');
 res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream'});res.end(await readFile(file));
}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(r=>server.listen(4173,'127.0.0.1',r));const base='http://127.0.0.1:4173',reports=[];
const ready=page=>page.waitForFunction(()=>document.querySelector('#sim-stats')?.getAttribute('aria-busy')==='false'&&!!window.Poe2SimulatorLibrary?.goalData(),undefined,{timeout:120000});
const plan=page=>page.evaluate(()=>{const v=window.Poe2SimulatorLibrary.goalData().current;delete v.savedAt;return JSON.stringify(v);});
try{
 for(const [engine,name] of [[chromium,'chromium'],[webkit,'webkit']])for(const [width,locale,lang] of [[320,'','jpn'],[1366,'/en','eng']]){
  const browser=await engine.launch(),context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500}),page=await context.newPage(),errors=[],posts=[],failed=[];
  let injectFailure=name==='chromium'&&width===320;
  const label=`${name}-${width}-${lang}`;
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')posts.push(r.url());});page.on('response',r=>{if(r.url().includes('/equipment-ocr/')&&!r.ok()&&!(injectFailure&&r.status()===503&&r.url().endsWith('/jpn.traineddata.gz')))failed.push([r.status(),r.url()]);});
  await page.route('**/*',r=>/google-analytics|googletagmanager|googlesyndication|doubleclick/.test(r.request().url())?r.abort():r.continue());
  try{
   await page.goto(base+locale+'/simulator/?build=mercenary-twister-gemling');await ready(page);await page.locator('[data-tab="items"]').click();await page.locator('[data-slot="helmet"]').click();
   const before=await plan(page),auto=await page.evaluate(()=>localStorage.getItem('poe2-simulator:v1:mercenary-twister-gemling'));
   // The camera control uses the capture input, while PC screenshots use a normal chooser.
   const chooserEvent=page.waitForEvent('filechooser');await page.locator(width<500?'#sim-photo-camera':'#sim-photo-select').click();
   const chooser=await chooserEvent;assert.equal(await chooser.element().getAttribute('capture'),width<500?'environment':null);
   await chooser.setFiles(resolve(root,`scripts/fixtures/equipment-photo/${lang}.png`));await page.locator('#sim-photo-read').waitFor({state:'visible'});
   if(injectFailure){
    await page.route('**/equipment-ocr/v7/jpn.traineddata.gz',route=>route.fulfill({status:503,body:'QA temporary failure'}),{times:1});
    await page.locator('#sim-photo-read').click();
    await page.waitForFunction(()=>/読み取れません/.test(document.querySelector('#sim-photo-status').textContent)&&!document.querySelector('#sim-photo-read').disabled,undefined,{timeout:45000});
    assert.equal(await plan(page),before);injectFailure=false;
   }
   await page.locator('#sim-photo-read').click();
   await page.waitForFunction(()=>!document.querySelector('#sim-photo-review').hidden||/Could not|読み取れません/.test(document.querySelector('#sim-photo-status').textContent),undefined,{timeout:160000});
   assert.equal(await page.locator('#sim-photo-review').isVisible(),true,await page.locator('#sim-photo-status').textContent());
   const actual=await page.locator('#sim-photo-options').textContent();assert.match(actual,/50% increased Armour/);
   if(lang==='eng')assert.match(actual,/\+35% to Fire Resistance/);
   else {
    // Raster resampling can change which Japanese glyph is misread. Require two
    // exact candidates and retain the remaining line for explicit correction.
    assert(/\+123 to maximum Life|\+27% to Cold Resistance/.test(actual));
    if(!actual.includes('+27% to Cold Resistance')||!actual.includes('+123 to maximum Life'))assert((await page.locator('#sim-photo-unresolved').textContent()).trim());
   }
   assert.equal(await plan(page),before);assert.equal(await page.evaluate(()=>localStorage.getItem('poe2-simulator:v1:mercenary-twister-gemling')),auto);
   // Correction is explicit and reparsed, never an automatic numeric guess.
   await page.locator('#sim-photo-text').fill(lang==='jpn'?'錆びたグレートヘルム\n最大ライフ +123\n冷気耐性 +27%\n特殊効果の確認が必要':'Rusted Greathelm\n+123 to maximum Life\n+35% to Fire Resistance\nUnresolved special effect');
   assert.match(await page.locator('#sim-photo-unresolved').textContent(),lang==='jpn'?/特殊効果/:/Unresolved/);
   assert.equal(await page.locator('#sim-photo-stage').isDisabled(),true);
   await page.locator('#sim-photo-base').selectOption('Metadata/Items/Armours/Helmets/FourHelmetStr1');
   await page.locator('#sim-photo-name').fill('Photo QA');await page.locator('#sim-photo-confirmed').check();
   await page.screenshot({path:output+'/'+label+'-review.png',fullPage:false});
   assert(await page.locator('#sim-photo-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'dialog has no horizontal overflow');
   await page.locator('#sim-photo-stage').click();assert.equal(await page.locator('#sim-photo-dialog').isVisible(),false);assert.equal(await plan(page),before);
   assert.match(await page.locator('#sim-item-text').inputValue(),/123/);
   await page.locator('#sim-item-apply').click();
   await page.waitForFunction(()=>!document.querySelector('#sim-error').hidden||window.Poe2SimulatorLibrary.goalData().current.request.items.some(i=>i.slot==='helmet'&&i.text.includes('+123 to maximum Life')));
   assert.equal(await page.locator('#sim-error').isVisible(),false);
   await ready(page);
   assert(await page.evaluate(()=>window.Poe2SimulatorLibrary.goalData().current.request.items.some(i=>i.slot==='helmet'&&i.text.includes('+123 to maximum Life'))));
   await page.locator('#sim-history-undo').click();await page.waitForFunction(()=>document.querySelector('#sim-stats').getAttribute('aria-busy')==='false'&&!window.Poe2SimulatorLibrary.goalData().current.request.items.some(i=>i.slot==='helmet'));assert.equal(await plan(page),before);
   // Closing and a failed image do not remove or replace the equipped item.
   await page.locator('[data-slot="helmet"]').click();
   const retry=page.waitForEvent('filechooser');await page.locator('#sim-photo-select').click();const input=await retry;
   await input.setFiles({name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
   await page.waitForFunction(()=>/Cannot open|画像を開けません/.test(document.querySelector('#sim-photo-status').textContent));
   await page.locator('#sim-photo-close').click();assert.equal(await plan(page),before);
   assert.deepEqual(failed,[]);assert.deepEqual(posts,[],'OCR does not upload the photo or send API writes');assert.deepEqual(errors,[]);
   reports.push({browser:name,width,lang,ocr:true,review:true,apply:true,undo:true,failedImage:true,noUploads:true});console.log('PASS '+label);
  }catch(error){await page.screenshot({path:output+'/'+label+'-failure.png',fullPage:true}).catch(()=>{});throw error;}
  finally{await browser.close();}
 }
 await writeFile(output+'/report.json',JSON.stringify(reports,null,2));
}finally{await new Promise(r=>server.close(r));}
