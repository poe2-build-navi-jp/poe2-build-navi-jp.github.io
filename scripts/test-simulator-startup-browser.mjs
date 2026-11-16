// CI only: no test retries. Count the bounded recovery performed by the production frontend.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium,webkit} from 'playwright-core';
import {namedPlanKey,makeSave} from '../assets/simulator-model.js';
const root=resolve(import.meta.dirname,'..'),output='/tmp/poe2-startup-qa';await mkdir(output,{recursive:true});
const input=JSON.parse(await readFile(resolve(root,'data/simulator-examples.json'))).examples.find(value=>value.id==='complete-mercenary-twister-gemling').saved;
const sample=makeSave(input.preset,input.request,input.questPoints,input.notes,input.equipmentDrafts,input.weaponSets,input.origin);
sample.notes='STARTUP QA: retain this private draft';
const auto='poe2-simulator:v1:'+sample.preset,key=namedPlanKey(sample.preset),saved=JSON.stringify(sample),named=JSON.stringify({version:1,plans:[{id:'startup-qa',name:'Startup QA',saved:sample}]});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.webp':'image/webp'};
const server=createServer(async(req,res)=>{try{
 let path=new URL(req.url,'http://localhost').pathname;if(path.endsWith('/'))path+='index.html';
 const file=resolve(root,'.'+decodeURIComponent(path));if(!file.startsWith(root+'/'))throw Error('outside');
 const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(bytes);
}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
const reports=[],reference=new Map();
try{
 for(const [type,name,count] of [[chromium,'chromium',2],[webkit,'webkit',16]])for(const mode of ['baseline','fixed']){
  const browser=await type.launch();
  try{for(let index=0;index<count;index++){
   const locale=index%2?'/en':'',width=index%2?1366:320;
   const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500});
   await context.addInitScript(({auto,key,saved,named})=>{if(location.origin==='http://127.0.0.1:4173'&&!sessionStorage.getItem('startup-seed')){
    localStorage.setItem(auto,saved);localStorage.setItem(key,named);sessionStorage.setItem('startup-seed','1');}}, {auto,key,saved,named});
   const page=await context.newPage(),errors=[];let legacyLoads=0,workerLoads=0;page.on('pageerror',error=>errors.push(error.message));
   page.on('console',message=>{if(message.type()==='error'||message.text().startsWith('STARTUP_TRACE '))console.log('BROWSER_CONSOLE '+message.text());});
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='http://127.0.0.1:4173')return route.abort();
    if(mode==='baseline'&&/^\/assets\/simulator(?:-en)?\.js$/.test(url.pathname)){
      const source=(await readFile(resolve(root,'.'+url.pathname),'utf8')).replaceAll('attempt<4','attempt<1').replaceAll('attempt===3','attempt===0');
      return route.fulfill({status:200,contentType:'text/javascript',body:source});
    }
    if(mode==='baseline'&&url.pathname==='/assets/simulator-engine-loader.js'){
      legacyLoads++;return route.fulfill({status:200,contentType:'text/javascript',body:await readFile(resolve(root,'scripts/fixtures/simulator-engine-legacy-staging.js'),'utf8')});
    }
    if(/^\/assets\/simulator-worker(?:-en)?\.js$/.test(url.pathname)){
      workerLoads++;
      let source=await readFile(resolve(root,'.'+url.pathname),'utf8');
      if(mode==='baseline')source=source.replace('await engine.default({module_or_path:await wasm.arrayBuffer()});','engine.initSync({module:await wasm.arrayBuffer()});');
      return route.fulfill({status:200,contentType:'text/javascript',body:source});
    }
    return route.continue();
   });
   try{for(const load of ['cold','reload']){
    const started=Date.now(),beforeLoads=workerLoads;let error='';
    try{
     if(load==='cold')await page.goto('http://127.0.0.1:4173'+locale+'/simulator/?build='+sample.preset,{waitUntil:'domcontentloaded'});else await page.reload({waitUntil:'domcontentloaded'});
     await page.waitForFunction(()=>!document.querySelector('#sim-error')?.hidden||(document.querySelector('#sim-stats')?.getAttribute('aria-busy')==='false'&&!!window.Poe2SimulatorLibrary?.goalData()),undefined,{timeout:100000});
     if(await page.locator('#sim-error').isVisible())throw Error(await page.locator('#sim-error').textContent());
     if(mode==='baseline')assert(legacyLoads>0,'the control must actually load the original staging code');
     assert(workerLoads-beforeLoads>=1&&workerLoads-beforeLoads<=(mode==='baseline'?1:16),'boot and calculation recovery each have a bounded four-attempt budget');
     const numbers=await page.locator('#sim-stats .sim-stat b').allTextContents();assert.equal(numbers.length,14);assert.notEqual(numbers[1],'—');
     if(!reference.has(locale))reference.set(locale,numbers);
     assert.deepEqual(numbers,reference.get(locale),'loader changes cannot alter calculation results');
     const {savedAt:originalDate,...original}=JSON.parse(saved),{savedAt:currentDate,...current}=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),auto));
     assert.deepEqual(current,original,'startup/reload can refresh the save timestamp but cannot change build inputs');
     assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),named,'startup/reload cannot alter named saves');
     assert.deepEqual(errors,[]);
    }catch(cause){error=cause.message;}
    reports.push({browser:name,mode,index,locale:locale||'ja',width,load,milliseconds:Date.now()-started,engineStarts:workerLoads-beforeLoads,error});
    console.log(JSON.stringify(reports.at(-1)));
    if(error){await page.screenshot({path:resolve(output,`${name}-${mode}-${index}-${load}-failure.png`)}).catch(()=>{});if(mode==='fixed')throw Error(`${name}/${index}/${load}: ${error}`);break;}
   }}finally{await context.close();}
  }}finally{await browser.close();}
 }
 const summary=reports.reduce((out,row)=>{const key=row.browser+'/'+row.mode;out[key]??={attempts:0,failures:0};out[key].attempts++;out[key].failures+=!!row.error;return out;},{});
 console.log('STARTUP SUMMARY',JSON.stringify(summary));
 assert.equal(summary['webkit/fixed'].attempts,32);assert.equal(summary['webkit/fixed'].failures,0);
}finally{await writeFile(resolve(output,'results.json'),JSON.stringify(reports,null,2));server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
