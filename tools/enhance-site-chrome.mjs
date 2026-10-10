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
 html=html.replace(/(<nav\b[^>]*class="site-nav[^\"]*"[^>]*>)([\s\S]*?)(<\/nav>)/,(nav,start,links,end)=>
  links.includes('href="/guides/"')?nav:`${start}<a href="/guides/"${file===join(root,'guides/index.html')?' aria-current="page"':''}>攻略ガイド</a>${links}${end}`);
 html=html.replace(/(<nav\b[^>]*class="site-nav[^\"]*"[^>]*>)([\s\S]*?)(<\/nav>)/,(nav,start,links,end)=>{
  links=links.replace(/<a\b[^>]*href="\/beginner-builds\/"[^>]*>[\s\S]*?<\/a>/g,'');
  const link=`<a href="/beginner-builds/"${file===join(root,'beginner-builds/index.html')?' aria-current="page"':''}>初心者おすすめ</a>`;
  return `${start}${links.replace(/(<a\b[^>]*href="\/guides\/"[^>]*>[\s\S]*?<\/a>)/,`$1${link}`)}${end}`;
 });
 html=html.replace(/(<nav\b[^>]*class="site-nav[^\"]*"[^>]*>)([\s\S]*?)(<\/nav>)/,(nav,start,links,end)=>links.includes('href="/search/"')?nav:`${start}${links}<a href="/search/"${file===join(root,'search/index.html')?' aria-current="page"':''}>全体検索</a>${end}`);
 html=insertBlock(html,'</head>','site-icon',ICON_BLOCK);icons++;
 // Pages generated with their own footer keep it; the rest get the shared one after </main>.
 if(!html.includes('<footer class="site-footer">')){
  const block=`<!-- site-footer:start -->${FOOTER}<!-- site-footer:end -->`;
  html=html.includes('</main>')?html.replace(/<\/main>(?![\s\S]*<\/main>)/,`</main>${block}`):html.replace('</body>',`${block}</body>`);
  footers++;
 }
 if(file===join(root,'index.html') || file===join(root,'beginner-builds/index.html')) html=applyMobileSummary(html,file===join(root,'beginner-builds/index.html'));
 if(html!==before)await writeFile(file,html);
}
console.log(`Site chrome: icons on ${icons} pages, shared footer added to ${footers} pages`);
