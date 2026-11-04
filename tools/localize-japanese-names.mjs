// Annotate visible names without reserializing markup, changing URLs, or translating copy values.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {relative,resolve} from 'node:path';
import {parse} from 'parse5';
import {formatJapaneseNames,root} from './japanese-names.mjs';

const noTranslate=new Set(['head','script','style','svg','math','pre','code','textarea','noscript','template','blockquote','q','cite']);
const skipId=new Set(['sources','source-list']);
const skipClass=new Set(['unique-gear-trade-row','unique-gear-name-en','guide-share-box','source-link','rating-quote']);
const inline=new Set(['a','b','strong','em','small','span','sup','abbr','mark','i','u','#text']);
const escapeText=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const textContent=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).filter(c=>inline.has(c.nodeName)).map(textContent).join('');
function neighbors(node){
 const parent=node.parentNode;
 const siblings=parent?.childNodes||[];
 const i=siblings.indexOf(node);
 const nearby=(a)=>a.map(c=>inline.has(c.nodeName)?textContent(c):'\n').join('');
 return [nearby(siblings.slice(0,i)).slice(-90),nearby(siblings.slice(i+1)).slice(0,90)];
}
function editsFor(html){
 const edits=[];
 const doc=parse(html,{sourceCodeLocationInfo:true});
 const visit=n=>{
  const attrs=Object.fromEntries((n.attrs||[]).map(({name,value})=>[name,value]));
  if(noTranslate.has(n.nodeName)||attrs.lang==='en'||attrs.translate==='no'||skipId.has(attrs.id)||
     (attrs.id||'').startsWith('source-')||attrs['aria-labelledby']==='sources-title'||
     (attrs.class||'').split(/\s+/).some(c=>skipClass.has(c)))return;
  if(n.nodeName==='#text'&&n.sourceCodeLocation){
   const [before,after]=neighbors(n);
   const next=formatJapaneseNames(n.value,before,after);
   if(next!==n.value)edits.push([n.sourceCodeLocation.startOffset,n.sourceCodeLocation.endOffset,escapeText(next)]);
  }
  for(const c of n.childNodes||[])visit(c);
 };
 visit(doc);
 let next=html;
 for(const [start,end,value] of edits.reverse())next=next.slice(0,start)+value+next.slice(end);
 return {html:next,count:edits.length};
}
async function* htmlFiles(dir){
 for(const e of await readdir(dir,{withFileTypes:true})){
  if(e.name.startsWith('.')||['node_modules','data','docs','tools','scripts','assets','images','tests'].includes(e.name))continue;
  const path=resolve(dir,e.name);
  if(e.isDirectory())yield* htmlFiles(path);
  else if(e.isFile()&&e.name.endsWith('.html'))yield path;
 }
}
const dry=process.argv.includes('--check');
let pages=0,changed=0,count=0;
for await(const path of htmlFiles(root)){
 pages++;
 const original=await readFile(path,'utf8');
 const next=editsFor(original);
 if(next.count){
  changed++;count+=next.count;
  if(dry)console.log(relative(root,path),next.count);
  else await writeFile(path,next.html);
 }
}
console.log(`Japanese names: ${pages} HTML pages checked, ${changed} pages with ${count} edited text blocks.`);
