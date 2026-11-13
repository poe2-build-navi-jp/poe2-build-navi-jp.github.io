// Add real skill icons to visible names, preserving all existing text, links and form values.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import {createSkillMatcher,skillTextHtml,skipSkillElement} from '../assets/skill-icon-matcher.js';
import {insertBlock} from './block-order.mjs';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const catalog=JSON.parse(await read('data/skill-icons.json'));
const names=JSON.parse(await read('data/japanese-names.json')).names;
const entries=catalog.entries.map(({id,name,names:aliases,support,src})=>{
  const base=name.replace(/ I$/,'');
  const extra=name!==base?[base,names[base]?.ja].filter(Boolean):[];
  if(name==='Bind Spectre')extra.push('Spectre','スペクター');
  return {id,name,names:[...new Set([...aliases,...extra])],support,src};
});
const data='// Generated from data/skill-icons.json. Game artwork © Grinding Gear Games.\nexport const skillIcons='+JSON.stringify(entries)+';\n';
await writeFile(resolve(root,'assets/skill-icon-data.js'),data);
// Module imports have their own content hashes; HTML asset versions are finalized later.
let runtime=await read('assets/skill-icons.js');
for(const name of ['skill-icon-data.js','skill-icon-matcher.js']) {
 const hash=createHash('sha256').update(await read('assets/'+name)).digest('hex').slice(0,10);
 runtime=runtime.replace(new RegExp(`(\\./${name.replaceAll('.','\\.')})(?:\\?v=[a-f0-9]+)?`,'g'),`$1?v=${hash}`);
}
await writeFile(resolve(root,'assets/skill-icons.js'),runtime);
const matcher=createSkillMatcher(entries);
async function* files(dir=root) {
 for(const entry of await readdir(dir,{withFileTypes:true})) {
  if(entry.name.startsWith('.')||['node_modules','tools','scripts','docs','company','assets','images','data','tests','dist'].includes(entry.name))continue;
  const path=resolve(dir,entry.name);
  if(entry.isDirectory())yield* files(path);
  else if(entry.name.endsWith('.html'))yield path;
 }
}
let pages=0,icons=0;
for await(const file of files()) {
 let html=(await readFile(file,'utf8')).replace(/<!-- skill-icons:start -->[\s\S]*?<!-- skill-icons:end -->/g,'');
 if(!/<main\b/.test(html)||!html.includes('</head>'))continue;
 html=html.replace(/<span class="skill-name" data-skill-icon="[^"]+"><img\b[^>]*>([\s\S]*?)<\/span>/g,'$1');
 const edits=[];
 function visit(node,inside=false) {
  const attrs=Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));
  if(skipSkillElement(node.tagName,attrs))return;
  inside ||= node.tagName==='main';
  if(inside&&node.nodeName==='#text'&&node.sourceCodeLocation) {
   const matches=matcher.matches(node.value);
   if(matches.length) {
    edits.push({start:node.sourceCodeLocation.startOffset,end:node.sourceCodeLocation.endOffset,html:skillTextHtml(node.value,matcher)});
    icons+=matches.length;
   }
  }
  for(const child of node.childNodes||[])visit(child,inside);
 }
 visit(parse(html,{sourceCodeLocationInfo:true}));
 for(const edit of edits.reverse())html=html.slice(0,edit.start)+edit.html+html.slice(edit.end);
 html=insertBlock(html,'</head>','skill-icons','<!-- skill-icons:start --><link rel="stylesheet" href="/assets/skill-icons.css"><script type="module" src="/assets/skill-icons.js"></script><!-- skill-icons:end -->');
 const before=await readFile(file,'utf8');
 if(html!==before)await writeFile(file,html);
 pages++;
}
console.log(`Skill icons: ${entries.length} matched catalog entries; ${icons} new inline names on ${pages} pages.`);
