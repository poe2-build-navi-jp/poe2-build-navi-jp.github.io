// Small SVG image sheets retain the original WebP bytes and exact per-skill views.
// One sheet is cached across its icons; there is no external image dependency.
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const file=resolve(root,'data/skill-icons.json');
const catalog=JSON.parse(await readFile(file,'utf8'));
catalog.entries=[...new Map([...catalog.entries].reverse().map(entry=>[entry.id,entry])).values()].sort((a,b)=>a.id.localeCompare(b.id));
const cache=resolve(root,'tools/.skill-icon-cache');
await mkdir(cache,{recursive:true});
const size=16;
const unpacked=catalog.entries.filter(entry=>entry.src.endsWith('.webp'));
let sheet=1+Math.max(-1,...catalog.entries.map(entry=>Number(entry.src.match(/\/icons-(\d+)\.svg#/)?.[1]??-1)));
for(let offset=0;offset<unpacked.length;offset+=size) {
 const entries=unpacked.slice(offset,offset+size);
 const filename=`icons-${String(sheet++).padStart(2,'0')}.svg`;
 let svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="64" height="64" viewBox="0 0 64 64">';
 for(let i=0;i<entries.length;i++) {
  const entry=entries[i],original=resolve(root,entry.src.slice(1));
  const bytes=await readFile(original).catch(()=>readFile(resolve(cache,basename(original)))),id=`icon-${i}`;
  svg+=`<view id="${id}" viewBox="0 ${i*64} 64 64"/><image x="0" y="${i*64}" width="64" height="64" preserveAspectRatio="xMidYMid meet" xlink:href="data:image/webp;base64,${bytes.toString('base64')}"/>`;
  entry.src=`/images/poe2/skills/${filename}#${id}`;
  await rename(original,resolve(cache,basename(original))).catch(error=>{if(error.code!=='ENOENT')throw error;});
 }
 await writeFile(resolve(root,'images/poe2/skills',filename),svg+'</svg>\n');
}
await writeFile(file,JSON.stringify(catalog,null,2)+'\n');
console.log(`Packed ${unpacked.length} new original icons into ${Math.ceil(unpacked.length/size)} sheets; existing sheet URLs preserved.`);
