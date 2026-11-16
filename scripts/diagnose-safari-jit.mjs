// Temporary diagnosis: compare the unmodified production engine under JSC compiler tiers.
// This is not a production configuration and cannot be used as a passing regression gate.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {webkit} from 'playwright-core';
const root=resolve(import.meta.dirname,'..'),mode=process.env.JSC_MODE||'default';
const variants={default:{},bbq:{JSC_useOMGJIT:'false'},interpreter:{JSC_useOMGJIT:'false',JSC_useBBQJIT:'false'}};
if(!Object.hasOwn(variants,mode))throw Error('Unknown compiler mode');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'};
const server=createServer(async(req,res)=>{try{let path=new URL(req.url,'http://localhost').pathname;if(path.endsWith('/'))path+='index.html';const file=resolve(root,'.'+path);if(!file.startsWith(root+'/'))throw Error('outside');res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
const browser=await webkit.launch({env:{...process.env,...variants[mode]}}),reports=[];
console.log('DIAGNOSTIC',JSON.stringify({mode,platform:process.platform,arch:process.arch,webkit:browser.version(),options:variants[mode]}));
try{for(let index=0;index<16;index++){
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
