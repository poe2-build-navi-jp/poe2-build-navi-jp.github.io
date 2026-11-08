// Fingerprint of what a reader sees in a page's main content. Shared boxes that change on every
// page at once (1.0 link box, version notice) and markup/asset versions are left out, so the
// sitemap lastmod moves only when the page itself changes.
import {createHash} from 'node:crypto';
import {parseFragment,parse} from 'parse5';
export function contentText(html){
 const main=html.match(/<main[\s\S]*<\/main>/)?.[0]??html.match(/<body[\s\S]*<\/body>/)?.[0]??html;
 return main
  .replace(/<!-- (one-link|version-notice|editorial-credit|page-updated):start -->[\s\S]*?<!-- \1:end -->/g,'')
  .replace(/<(script|style)[\s\S]*?<\/\1>/g,'')
  .replace(/<[^>]+>/g,' ')
  .replace(/&[a-z]+;|&#\d+;/g,m=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"'}[m]??m))
  .replace(/\s+/g,' ').trim();
}
const digest=value=>createHash('sha256').update(value).digest('hex').slice(0,16);
export const legacyContentHash=html=>digest(contentText(html));
export function contentHash(html) {
 const clean=html.replace(/<!-- (one-link|version-notice|editorial-credit|page-updated):start -->[\s\S]*?<!-- \1:end -->/g,'');
 const main=clean.match(/<main[\s\S]*<\/main>/)?.[0]||clean.match(/<body[\s\S]*<\/body>/)?.[0]||clean;
 const links=[];const visit=n=>{const attrs=Object.fromEntries((n.attrs||[]).map(a=>[a.name,a.value]));
  const keys=n.tagName==='a'?['href']:['img','source','video','audio'].includes(n.tagName)?['src','srcset','alt','poster']:[];
  if(keys.length)links.push([n.tagName,...keys.map(k=>attrs[k]||'')]);(n.childNodes||[]).forEach(visit);
 };visit(parseFragment(main));
 const metadata=[];const head=n=>{const a=Object.fromEntries((n.attrs||[]).map(x=>[x.name,x.value]));
  if(n.tagName==='title')metadata.push(['title',(n.childNodes||[]).map(x=>x.value||'').join('')]);
  if(n.tagName==='meta'&&a.name==='description')metadata.push(['description',a.content]);
  if(n.tagName==='link'&&a.rel==='canonical')metadata.push(['canonical',a.href]);(n.childNodes||[]).forEach(head);
 };head(parse(clean));
 return digest(JSON.stringify({text:contentText(html),links,metadata}));
}
export function recordPageDate(html,previous,today) {
 const hash=contentHash(html);
 const same=previous?.hashVersion===2?previous.hash===hash:previous?.hash===legacyContentHash(html);
 return {hash,date:same?previous.date:today,hashVersion:2};
}
