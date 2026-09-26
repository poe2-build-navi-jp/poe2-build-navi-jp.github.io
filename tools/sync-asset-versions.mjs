// Run last: rewrites every /assets/*.css|js reference in the site HTML to ?v=<content hash>,
// so each page busts the cache exactly when the file changes. Generators may emit any ?v=.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const ignored=new Set(['.git','company','node_modules','scripts','tests','tools']);
const hashes=new Map();
for(const name of await readdir(resolve(root,'assets'))){
 if(/\.(css|js)$/.test(name))hashes.set(name,createHash('sha256').update(await readFile(resolve(root,'assets',name))).digest('hex').slice(0,10));
}
const assetRef=/\/assets\/([A-Za-z0-9_-]+\.(?:css|js))(?:\?v=[^"'\s)>]*)?/g;
let changed=0,pages=0;
async function walk(dir=''){
 for(const entry of await readdir(resolve(root,dir),{withFileTypes:true})){
  if(entry.name.startsWith('.')||ignored.has(entry.name))continue;
  const path=dir?`${dir}/${entry.name}`:entry.name;
  if(entry.isDirectory()){await walk(path);continue;}
  if(!entry.name.endsWith('.html'))continue;
  const html=await readFile(resolve(root,path),'utf8');
  const next=html.replace(assetRef,(match,name)=>hashes.has(name)?`/assets/${name}?v=${hashes.get(name)}`:match);
  pages++;
  if(next!==html){await writeFile(resolve(root,path),next);changed++;}
 }
}
await walk();
console.log(`Asset versions: ${hashes.size} files, ${changed}/${pages} pages updated`);
