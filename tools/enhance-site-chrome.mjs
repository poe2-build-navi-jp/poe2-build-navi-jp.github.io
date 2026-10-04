// Idempotent: gives every page the site icons (head) and the shared site footer
// (運営者情報・編集方針・プライバシー・利用規約) that the home and build pages already carry.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {insertBlock} from './block-order.mjs';
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
export const ICON_BLOCK='<!-- site-icon:start --><link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><!-- site-icon:end -->';
export const FOOTER='<footer class="site-footer"><div class="footer-row"><div class="footer-brand"><span class="brand-mark" aria-hidden="true">P2</span><span>POE2<br>ビルドナビ</span></div><nav class="footer-links" aria-label="サイト情報"><a href="/about/">運営者情報</a><a href="/editorial-policy/">編集方針</a><a href="/privacy/">プライバシー</a><a href="/terms/">利用規約</a></nav></div><p class="fine">Path of Exile 2 is a trademark of Grinding Gear Games. This site is not affiliated with or endorsed by Grinding Gear Games.</p></footer>';
let icons=0,footers=0;
for(const file of await htmlFiles(root)){
 const before=await readFile(file,'utf8');
 let html=before.replace(/<!-- site-icon:start -->[\s\S]*?<!-- site-icon:end -->/g,'').replace(/<!-- site-footer:start -->[\s\S]*?<!-- site-footer:end -->/g,'');
 if(!html.includes('</head>'))continue;
 html=insertBlock(html,'</head>','site-icon',ICON_BLOCK);icons++;
 // Pages generated with their own footer keep it; the rest get the shared one after </main>.
 if(!html.includes('<footer class="site-footer">')){
  const block=`<!-- site-footer:start -->${FOOTER}<!-- site-footer:end -->`;
  html=html.includes('</main>')?html.replace(/<\/main>(?![\s\S]*<\/main>)/,`</main>${block}`):html.replace('</body>',`${block}</body>`);
  footers++;
 }
 if(html!==before)await writeFile(file,html);
}
console.log(`Site chrome: icons on ${icons} pages, shared footer added to ${footers} pages`);
