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
// Translate standalone interface labels, leaving source titles, identifiers and English pages intact.
const uiLabels = new Map(Object.entries({
 'Tier':'初心者Tier', 'SSF':'SSF（ソロ・自力入手）', 'SSF：':'SSF（ソロ・自力入手）：',
 'DPS':'DPS（毎秒ダメージ）', 'Spirit':'スピリット（Spirit）',
 'Mapping':'マップ周回（Mapping）', 'Endgame':'エンドゲーム（Endgame）',
 'Early Endgame':'エンドゲーム序盤（Early Endgame）',
 'Act 1':'アクト1（Act 1）', 'Act 2':'アクト2（Act 2）', 'Act 3':'アクト3（Act 3）', 'Act 4':'アクト4（Act 4）',
 'POE2 / STRATEGY GUIDE':'POE2／攻略ガイド', 'POE2 / PLAY RECORD':'POE2／プレイ記録',
 'DICTIONARY':'用語辞典', 'BEGINNER GUIDE':'初心者ガイド', 'BEGINNER BUILDS':'初心者向けビルド',
 'MY PROGRESS':'自分の進行状況', 'TROUBLE CHECK':'困ったときの確認', 'LEVELING ROADMAP':'育成の進め方',
 'SOURCE EVIDENCE':'出典と確認の根拠', 'CHOOSE A BUILD':'ビルドを選ぶ',
 'STEP 2 / CHOOSE A BUILD':'手順2／ビルドを選ぶ', 'BEST BUILDS BY PURPOSE':'目的別のおすすめビルド',
 'LEAGUE STARTER':'リーグ開始時のビルド', 'GEAR CHECK':'装備の確認', 'CLASS CHECK':'職業診断',
 'Path of Exile 2 is a trademark of Grinding Gear Games. This site is not affiliated with or endorsed by Grinding Gear Games.':'Path of Exile 2はGrinding Gear Gamesの商標です。当サイトは非公式の攻略サイトで、同社との提携・公認はありません。 Path of Exile 2 is a trademark of Grinding Gear Games. This site is not affiliated with or endorsed by Grinding Gear Games.',
 'SKILL':'スキル', 'GEAR':'装備', 'PASSIVE':'パッシブ', 'DEFENCE':'防御', 'ENDGAME':'エンドゲーム'
}));
const textContent=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).filter(c=>inline.has(c.nodeName)).map(textContent).join('');
function neighbors(node){
 const parent=node.parentNode;
 const siblings=parent?.childNodes||[];
 const i=siblings.indexOf(node);
 const nearby=(a)=>a.map(c=>inline.has(c.nodeName)?textContent(c):'\n').join('');
 return [nearby(siblings.slice(0,i)).slice(-90),nearby(siblings.slice(i+1)).slice(0,90)];
}
function editsFor(html, applyUi = true){
 const edits=[];
 const doc=parse(html,{sourceCodeLocationInfo:true});
 const visit=n=>{
  const attrs=Object.fromEntries((n.attrs||[]).map(({name,value})=>[name,value]));
  if(noTranslate.has(n.nodeName)||attrs.lang==='en'||attrs.translate==='no'||skipId.has(attrs.id)||
     (attrs.id||'').startsWith('source-')||attrs['aria-labelledby']==='sources-title'||
     (attrs.class||'').split(/\s+/).some(c=>skipClass.has(c)))return;
  if(n.nodeName==='#text'&&n.sourceCodeLocation){
   const [before,after]=neighbors(n);
   const label=applyUi && uiLabels.get(n.value.trim());
   const next=label ? n.value.replace(n.value.trim(),label) : formatJapaneseNames(n.value,before,after);
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
 const next=editsFor(original, !relative(root,path).startsWith('simulator/'));
 if(next.count){
  changed++;count+=next.count;
  if(dry)console.log(relative(root,path),next.count);
  else await writeFile(path,next.html);
 }
}
console.log(`Japanese names: ${pages} HTML pages checked, ${changed} pages with ${count} edited text blocks.`);
