// Idempotent. Adds the "note" article box (data/note-paid.json) right after the page's hero
// (the first <section> in <main>, which holds the <h1> and the intro) on the listed pages,
// so the funnel is visible without scrolling to the end of the article.
// It runs after localize-japanese-names so the copy is exactly as written,
// and before generate-sitemap so a change to the box is recorded as a content change.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {insertBlock} from './block-order.mjs';
const root=resolve(import.meta.dirname,'..');
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const entries=JSON.parse(await readFile(resolve(root,'data/note-paid.json'),'utf8'));
const strip=html=>html.replace(/<!-- note-paid:start -->[\s\S]*?<!-- note-paid:end -->/g,'');
export const noteBlock=e=>`<!-- note-paid:start --><aside class="next-box note-paid" aria-label="${esc(e.title)}"><b>${esc(e.title)}</b><p>${esc(e.lead)}<a href="${esc(e.href)}" target="_blank" rel="noopener noreferrer">${esc(e.linkText)}</a></p></aside><!-- note-paid:end -->`;
// Index just past the first <section>...</section> inside <main> (the hero), or -1.
const heroEnd=html=>{
 const mainAt=html.indexOf('<main');
 if(mainAt===-1)return -1;
 const start=html.indexOf('<section',mainAt);
 if(start===-1)return -1;
 let depth=0;
 for(const m of html.slice(start).matchAll(/<section\b|<\/section>/g)){
  depth+=m[0]==='</section>'?-1:1;
  if(depth===0)return start+m.index+m[0].length;
 }
 return -1;
};
const seen=new Set();
for(const e of entries){
 if(!/^\/[a-z0-9/-]*\/$/.test(e.path)||seen.has(e.path))throw new Error(`note-paid: bad or duplicate path ${e.path}`);
 seen.add(e.path);
 const url=new URL(e.href);
 if(url.protocol!=='https:'||url.hostname!=='note.com')throw new Error(`note-paid: ${e.path} must link to https://note.com/`);
 for(const key of ['title','lead','linkText'])if(!String(e[key]||'').trim())throw new Error(`note-paid: ${e.path} needs ${key}`);
 const file=resolve(root,'.'+e.path,'index.html');
 const html=strip(await readFile(file,'utf8'));
 if(!html.includes('</main>'))throw new Error(`note-paid: ${e.path} has no </main>`);
 const at=heroEnd(html);
 const out=at===-1?insertBlock(html,'</main>','note-paid',noteBlock(e)):html.slice(0,at)+noteBlock(e)+html.slice(at);
 await writeFile(file,out);
}
console.log(`note links: ${entries.length} pages`);
