// CI only: inject real worker-start failures, then verify automatic recovery and its limit.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium,webkit} from 'playwright-core';
import {namedPlanKey,makeSave} from '../assets/simulator-model.js';
const root=resolve(import.meta.dirname,'..');
const input=JSON.parse(await readFile(resolve(root,'data/simulator-examples.json'))).examples.find(e=>e.id==='complete-mercenary-twister-gemling').saved;
const sample=makeSave(input.preset,input.request,input.questPoints,'Recovery QA: keep this draft',input.equipmentDrafts,input.weaponSets,input.origin);
const auto='poe2-simulator:v1:'+sample.preset,key=namedPlanKey(sample.preset),saved=JSON.stringify(sample),named=JSON.stringify({version:1,plans:[{id:'recovery-qa',name:'Recovery QA',saved:sample}]});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'};
const server=createServer(async(req,res)=>{try{let path=new URL(req.url,'http://localhost').pathname;if(path.endsWith('/'))path+='index.html';const file=resolve(root,'.'+path);if(!file.startsWith(root+'/'))throw Error('outside');res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
const reference=new Map();
try{for(const[type,name]of [[chromium,'chromium'],[webkit,'webkit']]){
 const browser=await type.launch();
 try{for(const locale of ['', '/en'])for(const mode of ['transient','exhausted','integrity']){
  const context=await browser.newContext({viewport:{width:320,height:900},isMobile:true,hasTouch:true});
  await context.addInitScript(({auto,key,saved,named})=>{if(location.origin==='http://127.0.0.1:4173'){localStorage.setItem(auto,saved);localStorage.setItem(key,named);}}, {auto,key,saved,named});
  let starts=0,allowReal=false;const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!=='http://127.0.0.1:4173')return route.abort();
   if(/^\/assets\/simulator-worker(?:-en)?\.js$/.test(url.pathname)){
    starts++;
    const inject=!allowReal&&(mode==='exhausted'||mode==='integrity'||starts<=2);
    if(inject)return route.fulfill({status:200,contentType:'text/javascript',body:`self.onmessage=({data})=>postMessage({id:data.id,error:'QA startup failure',${mode==='integrity'?'':"errorCode:'ENGINE_STARTUP_FAILURE'"}});`});
   }
   return route.continue();
  });
  const ready=async()=>{await page.waitForFunction(()=>!document.querySelector('#sim-error')?.hidden||(document.querySelector('#sim-stats')?.getAttribute('aria-busy')==='false'&&!!window.Poe2SimulatorLibrary?.goalData()),undefined,{timeout:100000});assert.equal(await page.locator('#sim-error').isVisible(),false,await page.locator('#sim-error').textContent());};
  try{
   await page.goto('http://127.0.0.1:4173'+locale+'/simulator/?build='+sample.preset,{waitUntil:'domcontentloaded'});
   if(mode!=='transient'){
    await page.locator('#sim-error').waitFor({state:'visible'});assert.equal(starts,mode==='exhausted'?4:1,'retryable failures stop at four; integrity errors must not loop');
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),auto),saved,'a failed boot cannot overwrite the saved draft');
    assert.equal(await page.locator('#sim-engine-retry').isEnabled(),true);
    allowReal=true;await page.locator('#sim-engine-retry').click();
   }
   await ready();
   assert(starts>=(mode==='transient'?3:mode==='exhausted'?5:2));
   assert(starts<=(mode==='transient'?4:mode==='exhausted'?8:5),'each user request has a separate, bounded startup budget');
   const stats=await page.locator('#sim-stats .sim-stat b').allTextContents();assert.equal(stats.length,14);
   if(!reference.has(locale))reference.set(locale,stats);assert.deepEqual(stats,reference.get(locale),'recovered calculations match a successful real engine');
   const{savedAt:before,...original}=JSON.parse(saved),{savedAt:after,...current}=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),auto));assert.deepEqual(current,original);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),named);assert.deepEqual(errors,[]);
   console.log(JSON.stringify({browser:name,locale:locale||'ja',case:mode,engineStarts:starts,result:'PASS'}));
  }finally{await context.close();}
 }}finally{await browser.close();}
}}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
console.log('PASS: automatic fresh-worker recovery, bounded permanent failures, non-retryable integrity errors, manual retry, unchanged calculations and retained saves');
