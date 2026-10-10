// Runs the page enhancers in several different orders on throwaway copies of the site and
// checks that every HTML file ends up byte-identical. Needs dev dependencies and a local
// Chromium (generate-og-images); run with `npm run test:order`.
import {cp,mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const tools=['enhance-practical-help','enhance-page-schema','enhance-site-chrome','enhance-image-seo','enhance-ratings','enhance-build-ux','enhance-version-notice','enhance-one-hub','enhance-term-links','generate-og-images','inject-analytics'];
const orders=[tools,[...tools].reverse(),['inject-analytics','enhance-practical-help','enhance-page-schema','generate-og-images','enhance-site-chrome','enhance-term-links','enhance-one-hub','enhance-build-ux','enhance-image-seo','enhance-version-notice','enhance-ratings'],['enhance-one-hub','enhance-build-ux','enhance-site-chrome','enhance-page-schema','inject-analytics','enhance-practical-help','enhance-ratings','generate-og-images','enhance-image-seo','enhance-term-links','enhance-version-notice']];
const skip=new Set(['.git','node_modules']);
async function htmlHashes(dir,base=dir,out=new Map()){
 for(const e of await readdir(dir,{withFileTypes:true})){
  if(skip.has(e.name))continue;
  const p=join(dir,e.name);
  if(e.isDirectory())await htmlHashes(p,base,out);
  else if(e.name.endsWith('.html'))out.set(p.slice(base.length+1),createHash('sha256').update(await readFile(p)).digest('hex'));
 }
 return out;
}
const results=[];
for(const order of orders){
 const dir=await mkdtemp(join(tmpdir(),'poe2-order-'));
 await cp(root,dir,{recursive:true,filter:src=>!/[\\/](\.git|node_modules)$/.test(src)});
 await cp(join(root,'node_modules'),join(dir,'node_modules'),{recursive:true}).catch(()=>{});
 for(const tool of [...order,'sync-asset-versions'])execFileSync('node',[join(dir,'tools',`${tool}.mjs`)],{cwd:dir,stdio:'ignore',env:process.env});
 results.push([order.join(' > '),await htmlHashes(dir)]);
 await rm(dir,{recursive:true,force:true});
}
const [firstOrder,first]=results[0];
const failures=[];
for(const [order,hashes] of results.slice(1))for(const [file,hash] of first)if(hashes.get(file)!==hash)failures.push(`${file}: differs between "${firstOrder}" and "${order}"`);
if(failures.length){console.error(failures.slice(0,30).map(f=>`FAIL: ${f}`).join('\n'));process.exit(1);}
console.log(`PASS: ${first.size} HTML files identical across ${orders.length} enhancer orders`);
