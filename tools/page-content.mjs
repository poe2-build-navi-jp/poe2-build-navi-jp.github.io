// Fingerprint of what a reader sees in a page's main content. Shared boxes that change on every
// page at once (1.0 link box, version notice) and markup/asset versions are left out, so the
// sitemap lastmod moves only when the page itself changes.
import {createHash} from 'node:crypto';
export function contentText(html){
 const main=html.match(/<main[\s\S]*<\/main>/)?.[0]??html.match(/<body[\s\S]*<\/body>/)?.[0]??html;
 return main
  .replace(/<!-- (one-link|version-notice):start -->[\s\S]*?<!-- \1:end -->/g,'')
  .replace(/<(script|style)[\s\S]*?<\/\1>/g,'')
  .replace(/<[^>]+>/g,' ')
  .replace(/&[a-z]+;|&#\d+;/g,m=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"'}[m]??m))
  .replace(/\s+/g,' ').trim();
}
export const contentHash=html=>createHash('sha256').update(contentText(html)).digest('hex').slice(0,16);
