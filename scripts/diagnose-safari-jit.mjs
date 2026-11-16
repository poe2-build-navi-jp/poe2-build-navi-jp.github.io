// Temporary diagnosis: compare the unmodified production engine under JSC compiler tiers.
// This is not a production configuration and cannot be used as a passing regression gate.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {webkit} from 'playwright-core';
import {newPlan} from '../assets/simulator-model.js';
const root=resolve(import.meta.dirname,'..'),mode=process.env.JSC_MODE||'default';
const variant=process.env.WASM_VARIANT||'original';
const passes={optimize:['-O2'],coalesce:['--coalesce-locals'],flatten:['--flatten']};
if(variant!=='original'){
 if(!passes[variant])throw Error('Unknown variant');
 const directory=resolve(root,'assets/simulator-engine/v0.0.46'),runtime=JSON.parse(await readFile(resolve(directory,'runtime.json')));
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const unpack=async bundle=>{const bytes=Buffer.concat(await Promise.all(bundle.parts.map(async part=>{const b=await readFile(resolve(directory,part.file));if(hash(b)!==part.sha256)throw Error('Source integrity');return b;})));if(hash(bytes)!==bundle.sha256)throw Error('Bundle integrity');return gunzipSync(bytes);};
 const original=await unpack(runtime.wasm),temp=await mkdtemp(resolve(tmpdir(),'poe2-codegen-'));
 let changed;
 try{await writeFile(resolve(temp,'original.wasm'),original);execFileSync(process.env.WASM_OPT,[...passes[variant],'--enable-bulk-memory','--enable-reference-types','--enable-multivalue','--enable-sign-ext','--enable-nontrapping-float-to-int',resolve(temp,'original.wasm'),'-o',resolve(temp,'changed.wasm')]);changed=await readFile(resolve(temp,'changed.wasm'));}finally{await rm(temp,{recursive:true,force:true});}
 const pack=JSON.parse(await unpack(runtime.data)),engines=[];
 for(const [index,bytes]of [original,changed].entries()){
  const engine=await import(new URL('../assets/simulator-engine/v0.0.46/pobr_wasm.js?parity='+index,import.meta.url));await engine.default({module_or_path:bytes});
  for(const[path,text]of Object.entries(pack.files))engine.stageDataFile(path,text);engine.initStagedData();engines.push(engine);
 }
 const canonical=value=>JSON.stringify(value,Object.keys(value).sort());
 const presets=JSON.parse(await readFile(resolve(root,'data/simulator-presets.json'))),examples=JSON.parse(await readFile(resolve(root,'data/simulator-examples.json'))).examples,gems=JSON.parse(engines[0].gemCatalogJson());
 for(const request of [...presets.map(p=>newPlan(p,gems)),...examples.map(e=>e.saved.request)]){
  const json=JSON.stringify({...request,items:(request.items||[]).map(i=>i.slot==='body'?{...i,slot:'bodyarmour'}:i)});
  const actual=JSON.parse(engines[1].calculateBuildJson(json)),expected=JSON.parse(engines[0].calculateBuildJson(json));
  const {isDeepStrictEqual}=await import('node:util');if(!isDeepStrictEqual(actual,expected))throw Error('Calculation parity failed');
 }
 const bytes=gzipSync(changed),parts=[];
 for(let offset=0,index=0;offset<bytes.length;offset+=524288,index++){const file=`diagnostic-${variant}-${index}.bin`,chunk=bytes.subarray(offset,offset+524288);await writeFile(resolve(directory,file),chunk);parts.push({file,bytes:chunk.length,sha256:hash(chunk)});}
 runtime.wasm={parts,bytes:bytes.length,sha256:hash(bytes)};await writeFile(resolve(directory,'runtime.json'),JSON.stringify(runtime));
 console.log('VARIANT',JSON.stringify({variant,passes:passes[variant],wasmSha:hash(changed),bytes:changed.length,exactCalculations:presets.length+examples.length}));
}
const variants={default:{},bbq:{JSC_useOMGJIT:'false'},interpreter:{JSC_useOMGJIT:'false',JSC_useBBQJIT:'false'}};
if(!Object.hasOwn(variants,mode))throw Error('Unknown compiler mode');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'};
const server=createServer(async(req,res)=>{try{let path=new URL(req.url,'http://localhost').pathname;if(path.endsWith('/'))path+='index.html';const file=resolve(root,'.'+path);if(!file.startsWith(root+'/'))throw Error('outside');res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
const browser=await webkit.launch({env:{...process.env,...variants[mode]}}),reports=[];
console.log('DIAGNOSTIC',JSON.stringify({mode,variant,platform:process.platform,arch:process.arch,webkit:browser.version(),options:variants[mode]}));
try{for(let index=0;index<(variant==='original'?16:32);index++){
 const locale=index%2?'/en':'',context=await browser.newContext({viewport:{width:index%2?1366:320,height:900}}),page=await context.newPage();
 page.on('console',message=>{if(message.type()==='error'||message.text().startsWith('MEMORY_'))console.log('CONSOLE '+message.text());});
 await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!=='http://127.0.0.1:4173')return route.abort();if(/^\/assets\/simulator-worker(?:-en)?\.js$/.test(url.pathname)){
  let body=await readFile(resolve(root,'.'+url.pathname),'utf8');
  if(!body.includes('engine.initSync({module:await wasm.arrayBuffer()});')||!body.includes('engine.initStagedData();'))throw Error('Instrumentation anchor missing');
  body=body.replace('engine.initSync({module:await wasm.arrayBuffer()});',"const wasmSnapshot=engine.initSync({module:await wasm.arrayBuffer()});console.log('MEMORY_INIT '+JSON.stringify({bytes:wasmSnapshot.memory.buffer.byteLength,sha:await digest(new Uint8Array(wasmSnapshot.memory.buffer))}));");
  body=body.replace('engine.initStagedData();',"console.log('MEMORY_STAGED '+JSON.stringify({bytes:wasmSnapshot.memory.buffer.byteLength,sha:await digest(new Uint8Array(wasmSnapshot.memory.buffer))}));engine.initStagedData();");
  body=body.replace('postMessage({id,error:message});',"console.error('TRACE '+error.stack);postMessage({id,error:message});");
  return route.fulfill({status:200,contentType:'text/javascript',body});}return route.continue();});
 try{for(const load of ['cold','reload']){
  const started=Date.now();let error='';
  try{if(load==='cold')await page.goto('http://127.0.0.1:4173'+locale+'/simulator/?build=mercenary-twister-gemling',{waitUntil:'domcontentloaded'});else await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!document.querySelector('#sim-error')?.hidden||(document.querySelector('#sim-stats')?.getAttribute('aria-busy')==='false'&&document.querySelectorAll('#sim-stats .sim-stat b').length===14),undefined,{timeout:60000});
   if(await page.locator('#sim-error').isVisible())throw Error(await page.locator('#sim-error').textContent());
  }catch(cause){error=cause.message;}
  reports.push({mode,index,locale:locale||'ja',load,milliseconds:Date.now()-started,error});console.log(JSON.stringify(reports.at(-1)));if(error)break;
 }}finally{await context.close();}
}}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
console.log('DIAGNOSTIC SUMMARY',JSON.stringify({mode,attempts:reports.length,failures:reports.filter(report=>report.error).length}));
