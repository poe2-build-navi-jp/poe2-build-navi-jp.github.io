import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import {createEquipmentMatcher,equipmentTextHtml,skipEquipmentElement} from '../assets/equipment-image-matcher.js';
import {insertBlock} from './block-order.mjs';
const root=resolve(import.meta.dirname,'..'),read=p=>readFile(resolve(root,p),'utf8');
const catalog=JSON.parse(await read('data/equipment-images.json'));
const entries=catalog.entries.map(({id,name,names,baseNames,kind,src,prose,imageTitle})=>({id,name,names,baseNames,kind,src,...(prose===false?{prose:false}:{}),...(imageTitle?{imageTitle}:{})}));
await writeFile(resolve(root,'assets/equipment-image-data.js'),'// Game inventory artwork © Grinding Gear Games. Generated from the verified catalog.\nexport const equipmentImages='+JSON.stringify(entries)+';\n');
for(const [file,dependencies] of [['equipment-image-matcher.js',['skill-icon-matcher.js']],['equipment-images.js',['equipment-image-data.js','equipment-image-matcher.js']]]){
 let code=await read('assets/'+file);
 for(const name of dependencies){const hash=createHash('sha256').update(await read('assets/'+name)).digest('hex').slice(0,10);code=code.replace(new RegExp(`(\\./${name.replaceAll('.','\\.')})(?:\\?v=[a-f0-9]+)?`,'g'),`$1?v=${hash}`);}
 await writeFile(resolve(root,'assets/'+file),code);
}
const matcher=createEquipmentMatcher(entries);
async function* files(dir=root){for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.name.startsWith('.')||['node_modules','tools','scripts','docs','company','assets','images','data','tests','dist'].includes(entry.name))continue;const p=resolve(dir,entry.name);if(entry.isDirectory())yield* files(p);else if(entry.name.endsWith('.html'))yield p;}}
let pages=0,icons=0;
for await(const file of files()){
 const before=await readFile(file,'utf8');let html=before.replace(/<!-- equipment-images:start -->[\s\S]*?<!-- equipment-images:end -->/g,'').replace(/<span class="equipment-name" data-equipment-image="[^"]+"><img\b[^>]*>([\s\S]*?)<\/span>/g,'$1');
 if(!/<main\b/.test(html)||!html.includes('</head>'))continue;
 const edits=[];
 function visit(node,inside=false){const attrs=Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));if(skipEquipmentElement(node.tagName,attrs))return;inside ||= node.tagName==='main';if(inside&&node.nodeName==='#text'&&node.sourceCodeLocation){const matches=matcher.matches(node.value);if(matches.length){edits.push({start:node.sourceCodeLocation.startOffset,end:node.sourceCodeLocation.endOffset,html:equipmentTextHtml(node.value,matcher)});icons+=matches.length;}}for(const child of node.childNodes||[])visit(child,inside);}
 visit(parse(html,{sourceCodeLocationInfo:true}));for(const edit of edits.reverse())html=html.slice(0,edit.start)+edit.html+html.slice(edit.end);
 html=insertBlock(html,'</head>','equipment-images','<!-- equipment-images:start --><link rel="stylesheet" href="/assets/equipment-images.css"><script type="module" src="/assets/equipment-images.js"></script><!-- equipment-images:end -->');
 if(html!==before)await writeFile(file,html);pages++;
}
console.log(`Equipment images: ${entries.length} catalog entries; ${icons} named references on ${pages} pages.`);
