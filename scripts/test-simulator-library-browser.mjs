// Run in CI: real Chromium/WebKit, separate storage contexts and the deployed encrypted relay.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium,webkit} from 'playwright-core';
import {namedPlanKey} from '../assets/simulator-model.js';
const root=resolve(import.meta.dirname,'..'),output='/tmp/poe2-library-qa';await mkdir(output,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp'};
const server=createServer(async(req,res)=>{try{let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';const file=resolve(root,'.'+decodeURIComponent(p));if(!file.startsWith(root+'/'))throw Error('outside');const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(r=>server.listen(4173,'127.0.0.1',r));const base='http://127.0.0.1:4173';
const data=JSON.parse(await readFile(resolve(root,'data/simulator-examples.json'))),sample=structuredClone(data.examples.find(e=>e.id==='sample-mercenary-twister-gemling').saved);
const preset=sample.preset,key=namedPlanKey(preset),auto='poe2-simulator:v1:'+preset;
const alternate=structuredClone(sample);alternate.request.character.level=60;alternate.request.extra_modifiers=['+100 to maximum Life'];
sample.calculation={engine:'0.0.46',dataVersion:'0.5.4.0',guideRevision:'earlier-guide'};
const entries=[{id:'qa-current',name:'QA current',saved:sample},{id:'qa-upgrade',name:'QA upgrade',saved:alternate}];
const ready=page=>page.waitForFunction(()=>document.querySelector('#sim-stats')?.getAttribute('aria-busy')==='false'&&!!window.Poe2SimulatorLibrary,undefined,{timeout:60000});
const expanded=async(page,id)=>{if(!await page.locator('#'+id).evaluate(el=>el.open))await page.locator('#'+id+'>summary').click();};
const synced=page=>page.waitForFunction(()=>/件を同期済み|records synced/.test(document.querySelector('#sim-sync-status')?.textContent||''),undefined,{timeout:60000});
const report=[];
try{
 for(const [engine,type] of [[chromium,'chromium'],[webkit,'webkit']]){
  const browser=await engine.launch(),contexts=[],errors=[];let a,b;
  const context=async(width,seed)=>{
   const c=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500});contexts.push(c);
   if(seed)await c.addInitScript(values=>{if(location.origin==='http://127.0.0.1:4173'&&!sessionStorage.getItem('qa-seeded')){for(const [k,v]of Object.entries(values))localStorage.setItem(k,v);sessionStorage.setItem('qa-seeded','1');}},seed);
   const page=await c.newPage();page.on('pageerror',cause=>errors.push(cause.message));
   await page.route('**/*',route=>/google-analytics|googletagmanager|googlesyndication|doubleclick/.test(route.request().url())?route.abort():route.continue());return page;
  };
  try{
   a=await context(320,{[key]:JSON.stringify({version:1,plans:entries}),[auto]:JSON.stringify(sample)});
   await a.goto(base+'/simulator/?build='+preset);await ready(a);await expanded(a,'sim-workspace');
   if(type==='chromium'){
    const capacity=await a.evaluate(async()=>{
     const {IframeTransport}=await import('/assets/simulator-sync.js');
     const {newSyncCode,syncKeys,encryptVault,decryptVault}=await import('/assets/simulator-sync-crypto.js');
     const transport=new IframeTransport(),keys=await syncKeys(newSyncCode()),auth={room:keys.room,token:keys.token};
     const size=2*1024*1024-512,value={version:1,records:{},padding:'x'.repeat(size)};
     await transport.request('create',auth);
     try{
      const envelope=await encryptVault(value,keys);
      await transport.request('write',{...auth,revision:0,requestId:crypto.randomUUID(),...envelope});
      const response=await transport.request('read',auth),decoded=await decryptVault(response.envelope,keys);
      return {expected:size,actual:decoded.padding.length};
     }finally{await transport.request('revoke',auth);}
    });
    assert.equal(capacity.actual,capacity.expected,'a near-capacity snapshot must survive real encrypted storage');
   }
   await a.locator('#sim-compare-a').selectOption('qa-current');await a.locator('#sim-compare-b').selectOption('qa-upgrade');await a.locator('#sim-compare-enemy').selectOption('boss');
   await a.locator('#sim-compare-plans').click();await a.waitForFunction(()=>!!window.Poe2SimulatorLibrary?.read().comparison);
   await a.locator('#sim-journal-name').fill('QA fixed conditions');await a.locator('#sim-journal-save').click();
   await a.waitForFunction(()=>document.querySelector('#sim-journal-count').textContent==='1/40');
   const saved=await a.evaluate(()=>JSON.parse(localStorage.getItem('poe2-simulator:comparison-journal:v1')).records[0]);
   assert.equal(saved.source.a.request.character.level,80);assert.equal(saved.source.b.request.character.level,80);
   assert.equal(saved.source.enemy,'boss');assert.equal(saved.conditions.differences.length,0);
   assert.equal(saved.snapshot.rows.find(row=>row.id==='Life').delta,'+100');
   assert.equal(await a.evaluate(k=>JSON.parse(localStorage.getItem(k)).plans[1].saved.request.character.level,key),60,'level alignment cannot edit the original named save');
   await expanded(a,'sim-updates-panel');
   const updates=await a.locator('#sim-update-list').textContent();
   assert(updates.includes('クロスボウ'));assert(updates.includes('計算データが更新'));assert(updates.includes('育成ガイドが更新'));
   await a.locator('#sim-updates-seen').click();assert.equal(await a.locator('#sim-update-count').textContent(),'');
   await expanded(a,'sim-sync-panel');await a.locator('#sim-sync-create').click();await synced(a);
   await a.getByText('別の端末をつなぐ・復旧コード',{exact:true}).click();const code=await a.locator('#sim-sync-recovery').inputValue();assert.equal(code.length,43);
   await a.getByText('別の端末をつなぐ・復旧コード',{exact:true}).click();
   const own=structuredClone(sample);own.notes='SECOND DEVICE DRAFT';own.request.character.level=23;
   b=await context(1366,{[auto]:JSON.stringify(own)});await b.goto(base+'/simulator/?build='+preset);await ready(b);
   const draftBefore=await b.evaluate(k=>localStorage.getItem(k),auto);
   await expanded(b,'sim-sync-panel');await b.locator('#sim-sync-code').fill(code);await b.locator('#sim-sync-join').click();await synced(b);
   assert.equal(await b.evaluate(k=>localStorage.getItem(k),auto),draftBefore,'remote saves cannot replace the active draft');
   assert.equal(await b.evaluate(k=>JSON.parse(localStorage.getItem(k)).plans.length,key),2);
   assert.equal(await b.locator('#sim-journal-count').textContent(),'1/40');
   await expanded(b,'sim-journal-panel');await b.locator('.sim-journal-record>summary').click();
   await b.locator('[data-journal-open]').click();await ready(b);
   assert.equal(await b.evaluate(k=>localStorage.getItem(k),auto),draftBefore,'reopening an archived comparison preserves the active autosave');
   await b.goto(base+'/en/simulator/?build='+preset);await ready(b);await expanded(b,'sim-journal-panel');await b.locator('.sim-journal-record>summary').click();
   assert((await b.locator('#sim-journal-list').textContent()).includes('Maximum life'),'stored Japanese stat labels are localized when read in English');
   assert(!(await b.locator('#sim-library').textContent()).match(/[ぁ-んァ-ヶ一-龥]/),'English library chrome must be localized');
   const invalid=await context(390);await invalid.goto(base+'/simulator/');await expanded(invalid,'sim-sync-panel');
   await invalid.locator('#sim-sync-code').fill('A'.repeat(43));await invalid.locator('#sim-sync-join').click();await invalid.waitForFunction(()=>document.querySelector('#sim-sync-status').textContent.includes('接続コードが違う'));
   for(const [page,name]of [[a,'phone-ja'],[b,'desktop-en']]){
    await expanded(page,'sim-journal-panel');await page.locator('#sim-library').scrollIntoViewIfNeeded();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,`${type}/${name}: horizontal overflow`);
    await page.screenshot({path:resolve(output,`${type}-${name}.png`)});report.push(`${type}/${name}`);
   }
   // This vault contains only disposable, generated QA fixtures.
   await expanded(a,'sim-sync-panel');await a.getByText('全端末の同期を解除する',{exact:true}).click();await a.locator('#sim-sync-revoke').click();await a.locator('#sim-sync-revoke').click();
   await a.waitForFunction(()=>document.querySelector('#sim-sync-status').textContent.includes('無効化しました'));
   await expanded(b,'sim-sync-panel');await b.locator('#sim-sync-now').click();await b.waitForFunction(()=>document.querySelector('#sim-sync-status').textContent.includes('revoked'));
   assert.deepEqual(errors,[],`${type}: page errors`);
  }finally{for(const c of contexts)await c.close();await browser.close();}
 }
 console.log(`PASS: ${report.join(', ')}; fixed-condition journal, unchanged source saves, relevant/read notices, real encrypted cross-device sync, preserved drafts, English records, invalid-code rejection and revocation`);
}finally{await new Promise(r=>server.close(r));}
