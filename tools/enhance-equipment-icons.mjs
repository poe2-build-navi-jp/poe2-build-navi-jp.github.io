// Render equipment art beside exact names and wire dynamic simulator previews.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import {createEquipmentMatcher,equipmentTextHtml,skipEquipmentElement} from '../assets/equipment-icon-matcher.js';
import {insertBlock} from './block-order.mjs';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const catalog=JSON.parse(await read('data/equipment-icons.json'));
const entries=catalog.entries.map(({id,name,names,kind,baseId,uniqueId,itemBase,src})=>({id,name,names,kind,...(baseId?{baseId}:{}),...(uniqueId!==undefined?{uniqueId,itemBase}:{}),src}));
await writeFile(resolve(root,'assets/equipment-icon-data.js'),'// Imported game artwork © Grinding Gear Games; see data/equipment-icons.json.\nexport const equipmentIcons='+JSON.stringify(entries)+';\n');
const cached=new Map(await Promise.all(['skill-icon-matcher.js','equipment-icon-data.js','equipment-icon-matcher.js'].map(async name=>[name,await read('assets/'+name)])));
for(const file of ['equipment-icon-matcher.js','equipment-icons.js']) {
 let code=await read('assets/'+file);
 code=code.replace(/(\.\/(?:skill-icon-matcher|equipment-icon-data|equipment-icon-matcher)\.js)(?:\?v=[a-f0-9]+)?/g,(_,path)=>{
  const name=path.slice(2),hash=createHash('sha256').update(cached.get(name)).digest('hex').slice(0,10);return path+'?v='+hash;
 });
 await writeFile(resolve(root,'assets/'+file),code);
 cached.set(file,code);
}
const matcher=createEquipmentMatcher(entries);
async function* files(dir=root) {
 for(const entry of await readdir(dir,{withFileTypes:true})) {
  if(entry.name.startsWith('.')||['node_modules','tools','scripts','docs','company','assets','images','data','tests','dist'].includes(entry.name))continue;
  const path=resolve(dir,entry.name);
  if(entry.isDirectory())yield* files(path);else if(entry.name.endsWith('.html'))yield path;
 }
}
let pages=0,icons=0;
for await(const file of files()) {
 const before=await readFile(file,'utf8');
 let html=before.replace(/<!-- equipment-icons:start -->[\s\S]*?<!-- equipment-icons:end -->/g,'')
   .replace(/<span class="equipment-name" data-equipment-icon="[^"]+"><img\b[^>]*>([\s\S]*?)<\/span>/g,'$1');
 if(!/<main\b/.test(html)||!html.includes('</head>'))continue;
 const edits=[];
 function visit(node,inside=false) {
  const attrs=Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));
  if(skipEquipmentElement(node.tagName,attrs))return;
  inside ||= node.tagName==='main';
  if(inside&&node.nodeName==='#text'&&node.sourceCodeLocation) {
   const matches=matcher.matches(node.value);
   if(matches.length){edits.push({start:node.sourceCodeLocation.startOffset,end:node.sourceCodeLocation.endOffset,html:equipmentTextHtml(node.value,matcher)});icons+=matches.length;}
  }
  for(const child of node.childNodes||[])visit(child,inside);
 }
 visit(parse(html,{sourceCodeLocationInfo:true}));
 for(const edit of edits.reverse())html=html.slice(0,edit.start)+edit.html+html.slice(edit.end);
 if(edits.length||html.includes('id="sim-slots"')) {
  html=insertBlock(html,'</head>','equipment-icons','<!-- equipment-icons:start --><link rel="stylesheet" href="/assets/equipment-icons.css"><script type="module" src="/assets/equipment-icons.js"></script><!-- equipment-icons:end -->');
  pages++;
 }
 if(html!==before)await writeFile(file,html);
}
console.log(`Equipment images: ${entries.length} catalog records, ${icons} inline names on ${pages} pages.`);
