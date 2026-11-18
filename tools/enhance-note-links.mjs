// Idempotent. Adds the "note" article box (data/note-paid.json) at the end of <main> on the listed
// pages, after the 1.0 box. It runs after localize-japanese-names so the copy is exactly as written,
// and before generate-sitemap so a change to the box is recorded as a content change.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {insertBlock} from './block-order.mjs';
const root=resolve(import.meta.dirname,'..');
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const entries=JSON.parse(await readFile(resolve(root,'data/note-paid.json'),'utf8'));
const strip=html=>html.replace(/<!-- note-paid:start -->[\s\S]*?<!-- note-paid:end -->/g,'');
export const noteBlock=e=>`<!-- note-paid:start --><aside class="next-box note-paid" aria-label="${esc(e.title)}"><b>${esc(e.title)}</b><p>${esc(e.lead)}<a href="${esc(e.href)}" target="_blank" rel="noopener noreferrer">${esc(e.linkText)}</a></p></aside><!-- note-paid:end -->`;
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
 await writeFile(file,insertBlock(html,'</main>','note-paid',noteBlock(e)));
}
console.log(`note links: ${entries.length} pages`);
