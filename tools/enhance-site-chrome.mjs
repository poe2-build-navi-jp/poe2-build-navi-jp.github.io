import { applyMobileSummary } from './mobile-summary.mjs';
// Idempotent: gives every page the site icons (head) and the shared site footer
// (運営者情報・編集方針・プライバシー・利用規約) that the home and build pages already carry.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {insertBlock} from './block-order.mjs';
import {ICON_BLOCK,FOOTER} from './site-chrome.mjs';
const root=resolve(import.meta.dirname,'..');
const skip=new Set(['.git','node_modules','assets','data','images','scripts','tools','tests','company']);
async function htmlFiles(dir,out=[]){
 for(const e of await readdir(dir,{withFileTypes:true})){
  if(skip.has(e.name)||e.name.startsWith('.'))continue;
  const p=join(dir,e.name);
  if(e.isDirectory())await htmlFiles(p,out);
  else if(e.name.endsWith('.html'))out.push(p);
 }
 return out;
}
let icons=0,footers=0;
for(const file of await htmlFiles(root)){
 const before=await readFile(file,'utf8');
 let html=before.replace(/<!-- site-icon:start -->[\s\S]*?<!-- site-icon:end -->/g,'').replace(/<!-- site-footer:start -->[\s\S]*?<!-- site-footer:end -->/g,'');
 if(!html.includes('</head>'))continue;
 // Unified main menu: the same destinations, in the same order, with the same
 // labels on every page, so the header no longer changes from page to page.
 // Links a page already carries that are not in the canonical set (the community
 // pages' language switch, for example) are kept, just ahead of the search link.
 const NAV_JA=[['/guides/','攻略ガイド'],['/beginner-builds/','初心者おすすめ'],['/tier-list/','初心者Tier'],['/league-starter/','スターター'],['/builds/','ビルド一覧'],['/gear-check/','装備診断'],['/beginner-guide/','初心者ガイド'],['/leveling/','レベリング'],['/dictionary/','用語辞典'],['/search/','全体検索'],['/simulator/','シミュレーター'],['/simulator/#sim-resume','保存した構成']];
 const NAV_EN=[['/guides/','Guides (Japanese)'],['/beginner-builds/','Starter builds (Japanese)'],['/tier-list/','Beginner tier (Japanese)'],['/league-starter/','League starter (Japanese)'],['/builds/','Browse builds (Japanese)'],['/gear-check/','Gear check (Japanese)'],['/beginner-guide/','Beginner guide (Japanese)'],['/leveling/','Leveling (Japanese)'],['/dictionary/','Glossary (Japanese)'],['/search/','Site search (Japanese)'],['/en/simulator/','Simulator'],['/en/simulator/#sim-resume','Saved builds']];
 const ownPath=file===join(root,'index.html')?'/':'/'+file.slice(root.length+1).replace(/index\.html$/,'');
 const buildNav=existing=>{
  const canon=file.startsWith(join(root,'en')+'/')?NAV_EN:NAV_JA;
  const canonHrefs=new Set(canon.map(([href])=>href));
  const extras=[];
  for(const m of existing.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/g))
   if(!canonHrefs.has(m[1])&&!extras.some(([,href])=>href===m[1]))extras.push([m[0],m[1]]);
  const links=canon.map(([href,label])=>`<a href="${href}"${href===ownPath?' aria-current="page"':''}>${label}</a>`);
  const at=links.findIndex(link=>link.includes('href="/search/"'));
  return [...links.slice(0,at),...extras.map(([link])=>link),...links.slice(at)].join('');
 };
 if(/<nav\b[^>]*class="site-nav\b/.test(html)){
  html=html.replace(/(<nav\b[^>]*class="site-nav[^\"]*"[^>]*>)([\s\S]*?)(<\/nav>)/,(nav,start,links,end)=>`${start}${buildNav(links)}${end}`);
 } else {
  // Information pages also need an always-visible route back to the tools.
  html=html.replace(/(<header\b[^>]*class="site-header"[^>]*>[\s\S]*?)(<\/header>)/,(m,head,end)=>`${head}<nav class="site-nav page-nav" aria-label="メインメニュー">${buildNav('')}</nav>${end}`);
 }
 // English pages label the (Japanese-only) feed in English, as en/simulator does.
 const iconBlock=file.startsWith(join(root,'en')+'/')?ICON_BLOCK.replace('POE2ビルドナビの更新情報','POE2 Build Navi updates (Japanese)'):ICON_BLOCK;
 html=insertBlock(html,'</head>','site-icon',iconBlock);icons++;
 // Pages generated with their own copy of the footer get the current shared one (same markup);
 // the rest get it after </main>.
 html=html.replace(/(?<!<!-- site-footer:start -->)<footer class="site-footer">[\s\S]*?<\/footer>/,m=>m===FOOTER?m:FOOTER);
 if(!html.includes('<footer class="site-footer">')){
  const block=`<!-- site-footer:start -->${FOOTER}<!-- site-footer:end -->`;
  html=html.includes('</main>')?html.replace(/<\/main>(?![\s\S]*<\/main>)/,`</main>${block}`):html.replace('</body>',`${block}</body>`);
  footers++;
 }
 if(file===join(root,'index.html') || file===join(root,'beginner-builds/index.html')) html=applyMobileSummary(html,file===join(root,'beginner-builds/index.html'));
 if(html!==before)await writeFile(file,html);
}
console.log(`Site chrome: icons on ${icons} pages, shared footer added to ${footers} pages`);
