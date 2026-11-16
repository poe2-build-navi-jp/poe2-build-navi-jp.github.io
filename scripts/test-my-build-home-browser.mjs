// Real browser checks for returning visitors; the home itself never needs WASM.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium,webkit} from 'playwright-core';
import {makeGoal,goalKey} from '../assets/simulator-goal-model.js';
import {namedPlanKey} from '../assets/simulator-model.js';
const root=resolve(import.meta.dirname,'..'),output='/tmp/poe2-my-build-home-qa';await mkdir(output,{recursive:true});
const examples=JSON.parse(await readFile(resolve(root,'data/simulator-examples.json'),'utf8')),index=JSON.parse(await readFile(resolve(root,'data/simulator-index.json'),'utf8'));
const preset='mercenary-twister-gemling',otherPreset='ranger-ice-shot-deadeye',auto='poe2-simulator:v1:'+preset;
const target=structuredClone(examples.examples.find(e=>e.id==='complete-'+preset).saved),working=structuredClone(target),other=structuredClone(examples.examples.find(e=>e.id==='complete-'+otherPreset).saved);
working.request.character.level=85;working.savedAt='2026-11-16T16:00:00Z';working.notes='PRIVATE HOME NOTES';working.request.items=working.request.items.filter(item=>item.slot!=='helmet');working.request.socket_groups[0].gems[0].level=1;
const remove=target.request.allocated_nodes.filter(id=>index.nodes[id]?.kind==='normal').slice(-2);working.request.allocated_nodes=working.request.allocated_nodes.filter(id=>!remove.includes(id));
target.savedAt='2026-11-16T14:00:00Z';other.savedAt='2026-11-16T15:00:00Z';other.request.character.level=83;
const name='<img src=x onerror=alert(1)>',goal=makeGoal({kind:'example',id:'home-goal',name:'Goal Lv100',saved:target},preset);
const values={[auto]:JSON.stringify(working),['poe2-simulator:v1:'+otherPreset]:JSON.stringify(other),[namedPlanKey(preset)]:JSON.stringify({version:1,plans:[{id:'home-named',name,saved:target}]}),[goalKey(preset)]:JSON.stringify(goal)};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
const server=createServer(async(req,res)=>{try{let path=new URL(req.url,'http://localhost').pathname;if(path.endsWith('/'))path+='index.html';const file=resolve(root,'.'+decodeURIComponent(path));if(!file.startsWith(root+'/'))throw Error('outside');res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port,reports=[];
const savedSnapshot=page=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(key=>/^poe2-simulator:(v1|plans:v1):|^poe2-simulator-goal:/.test(key)).map(key=>[key,localStorage.getItem(key)])));
try{for(const [type,browserName]of [[chromium,'chromium'],[webkit,'webkit']]){
 const browser=await type.launch();
 try{for(const [width,locale]of [[320,''],[390,''],[768,'/en'],[1366,'/en']]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<1000}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  const label=`${browserName}-${width}${locale?'-en':'-ja'}`,entry=base+(locale?locale+'/simulator/':'/');
  try{
   await page.goto(entry,{waitUntil:'domcontentloaded'});await page.locator('#my-build-home[data-installed]').waitFor({state:'attached'});
   assert.equal(await page.locator('#my-build-home').isVisible(),false,'new visitors keep the existing introduction');
   await context.addInitScript(({origin,values})=>{if(location.origin===origin&&!sessionStorage.getItem('home-fixture')){for(const [key,value]of Object.entries(values))localStorage.setItem(key,value);sessionStorage.setItem('home-fixture','true');}},{origin:base,values});
   await page.reload();await page.locator('#my-build-home').waitFor();await page.locator('.my-build-goal-counts dd').first().waitFor();
   assert.deepEqual(await page.locator('.my-build-goal-counts dd').allTextContents(),['1','2','1']);assert.equal(await page.locator('[data-my-build-level]').textContent(),'85');
   assert(!requests.some(url=>/\/simulator-engine\/|\/simulator-worker/.test(url)),'a returning-visitor home must not start the calculation engine');
   assert.deepEqual(await savedSnapshot(page),values,'displaying the dashboard is read-only');
   assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('#my-build-home').count(),1);
   const bounds=await page.locator('[data-my-build-resume]').boundingBox();assert(bounds.height>=48);assert(bounds.y<900,'continue action must be on the first phone screen');
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));
   const original=await savedSnapshot(page);
   const taskInput=page.locator('[data-actions-input]'),taskRows=page.locator('.my-build-task');
   const addTask=async text=>{await taskInput.fill(text);await page.locator('[data-actions-submit]').click();};
   await addTask('指輪を交換');await addTask('指輪を交換');assert.equal(await taskRows.count(),1,'reject duplicate next steps');
   await addTask('火耐性を75%にする');await addTask('<img src=x onerror=alert(1)>');assert.equal(await taskRows.count(),3);
   assert.equal(await taskRows.locator('img').count(),0);assert.equal(await taskInput.isDisabled(),true);
   await taskRows.nth(0).locator('input').check();assert.equal(await taskRows.nth(0).locator('input').isChecked(),true);
   await page.reload();await page.locator('#my-build-home').waitFor();assert.equal(await taskRows.count(),3);assert.equal(await taskRows.nth(0).locator('input').isChecked(),true,'completed steps persist');
   await taskRows.nth(1).locator('[data-action="edit"]').click();await taskInput.fill('冷気耐性を75%にする');await page.locator('[data-actions-submit]').click();assert((await taskRows.nth(1).textContent()).includes('冷気耐性'));
   await page.locator('[data-actions-clear]').click();assert.equal(await taskRows.count(),2);await page.locator('[data-actions-undo]').click();assert.equal(await taskRows.count(),3);
   await taskRows.nth(2).locator('[data-action="delete"]').click();assert.equal(await taskRows.count(),2);await page.locator('[data-actions-undo]').click();assert.equal(await taskRows.count(),3);
   const editBounds=await taskRows.nth(0).locator('[data-action="edit"]').boundingBox();assert(editBounds.width>=44&&editBounds.height>=44);
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'long task text must wrap at phone widths');
   await page.locator('#my-build-select').selectOption(preset+':named:home-named');await page.locator('#my-build-name').filter({hasText:name}).waitFor();
   assert.equal(await taskRows.count(),0,'a named save has its own next steps');await addTask('名前付き構成の次の目標');
   assert.equal(await page.locator('#my-build-name img').count(),0,'a private configuration name is text');assert.match(await page.locator('[data-my-build-resume]').getAttribute('href'),/saved=home-named/);
   await page.reload();await page.locator('#my-build-name').filter({hasText:name}).waitFor();assert.equal(await page.locator('#my-build-select').inputValue(),preset+':named:home-named','remember the chosen configuration');assert.equal(await taskRows.count(),1,'named-save tasks persist');
   await page.locator('#my-build-select').selectOption(otherPreset+':auto:');await page.locator('[data-my-build-level]').filter({hasText:'83'}).waitFor();assert.equal(await page.locator('.my-build-goal-counts').count(),0,'another build does not inherit a target');
   assert.equal(await taskRows.count(),0,'another preset cannot inherit tasks');await taskInput.fill('保存前の入力');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(150);assert.equal(await taskInput.inputValue(),'保存前の入力','dashboard refresh preserves typed text');
   await page.locator('#my-build-select').selectOption(preset+':auto:');await page.locator('.my-build-goal-counts dd').first().waitFor();
   assert.equal(await taskRows.count(),3);
   await page.locator('[data-my-build-actions]').scrollIntoViewIfNeeded();
   await page.screenshot({path:resolve(output,label+'-next-actions.jpg'),type:'jpeg',quality:85});
   await page.locator('#my-build-home').scrollIntoViewIfNeeded();
   await page.screenshot({path:resolve(output,label+'-home.jpg'),type:'jpeg',quality:85});
   assert.deepEqual(await savedSnapshot(page),original,'changing the displayed configuration cannot edit a save or goal');
   // An unavailable update/index endpoint cannot block the resume action.
   await page.route('**/data/saved-build-updates.json*',route=>route.fulfill({status:503,body:'QA unavailable'}));
   await page.route('**/data/simulator-index.json*',route=>route.fulfill({status:503,body:'QA unavailable'}));
   await page.reload();await page.locator('[data-my-build-retry]:visible').waitFor();assert.equal(await page.locator('[data-my-build-resume]').isVisible(),true);assert.deepEqual(await savedSnapshot(page),original);
   await page.unroute('**/data/saved-build-updates.json*');await page.unroute('**/data/simulator-index.json*');await page.locator('[data-my-build-retry]').click();await page.locator('.my-build-goal-counts dd').first().waitFor();
   await page.locator('[data-my-build-goal-open]').click();await page.locator('#sim-stats[aria-busy="false"]').waitFor({state:'attached',timeout:100000});
   await page.locator('#sim-goal-panel[open]').waitFor();assert.equal(await page.locator('#sim-goal-name').textContent(),goal.name);assert.equal(await page.locator('#sim-level').inputValue(),'85');
   assert.equal(await page.locator('#sim-error').isVisible(),false);assert.equal(await page.evaluate(key=>localStorage.getItem(key),goalKey(preset)),values[goalKey(preset)]);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),namedPlanKey(preset)),values[namedPlanKey(preset)]);
   await page.locator('#sim-change-build').click();await page.locator('#my-build-home').waitFor();await page.locator('[data-my-build-resume]').click();await page.locator('#sim-stats[aria-busy="false"]').waitFor({state:'attached',timeout:100000});assert.equal(await page.locator('#sim-level').inputValue(),'85','one tap resumes the correct applied draft');
   assert.deepEqual(errors,[]);assert(!requests.some(url=>url.includes('PRIVATE')||url.includes(encodeURIComponent(name))));
   reports.push({browser:browserName,width,locale:locale||'ja',noEngineOnHome:true,goals:[1,2,1],nextActions:'add/check/edit/clear/delete/undo/persist/isolate',resumeLevel:85,result:'PASS'});console.log(JSON.stringify(reports.at(-1)));
  }catch(error){await page.screenshot({path:resolve(output,label+'-failure.jpg'),type:'jpeg'}).catch(()=>{});throw error;}
  finally{await context.close();}
 }}finally{await browser.close();}
}}finally{await writeFile(resolve(output,'results.json'),JSON.stringify(reports,null,2));server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
console.log('PASS: empty/returning home, recent and named selection, three private next steps, completion/edit/removal/undo, persistent drafts, exact target gaps, failed requests, direct goal navigation, correct resumed level and no horizontal overflow in Chromium/WebKit at 320/390/768/1366px.');
