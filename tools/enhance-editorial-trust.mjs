// Run after enhance-page-schema. Attribution and citations reflect visible content;
// this pass never changes publication, source-review or modification dates.
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parse} from 'parse5';
import {insertBlock} from './block-order.mjs';

const root = resolve(import.meta.dirname, '..');
const site = JSON.parse(await readFile(resolve(root, 'data/site.json'), 'utf8'));
const base = site.baseUrl;
const organization = {'@type':'Organization', '@id':`${base}/about/#organization`, name:site.operatorName, url:`${base}/about/`};
const website = {'@type':'WebSite', '@id':`${base}/#website`, name:site.siteName, url:`${base}/`, inLanguage:'ja', publisher:organization};
const paths = [...(await readFile(resolve(root, 'sitemap.xml'), 'utf8')).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname);
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
const attrs = node => Object.fromEntries((node.attrs || []).map(a => [a.name, a.value]));
const json = value => JSON.stringify(value).replaceAll('<', '\\u003c');
let articleCount = 0, citationCount = 0;

for (const path of paths) {
 const file = resolve(root, `.${path}index.html`);
 let html = await readFile(file, 'utf8');
 const original = html;
 html = html.replace(/<!-- editorial-credit:start -->[\s\S]*?<!-- editorial-credit:end -->/g, '')
  .replace(/<!-- identity-schema:start -->[\s\S]*?<!-- identity-schema:end -->/g, '');
 const nodes = [];
 const visit = node => {nodes.push(node); for (const child of node.childNodes || []) visit(child);};
 visit(parse(html, {sourceCodeLocationInfo:true}));
 const schemas = nodes.filter(n => n.tagName === 'script' && attrs(n).type === 'application/ld+json');
 const edits = [];
 let isArticle = false;
 const sources = new Set();
 for (const node of nodes.filter(n => n.tagName === 'a' && attrs(n).href)) {
  let parent = node.parentNode;
  while (parent && !/(?:^|\s)(?:sources|seo-sources|guide-evidence|guide-review-detail)(?:\s|$)/.test(attrs(parent).class || '')) parent = parent.parentNode;
  if (!parent) continue;
  const url = new URL(attrs(node).href, base);
  if (url.protocol === 'https:' && url.origin !== base) sources.add(url.href);
 }
 const update = value => {
  if (Array.isArray(value)) return value.forEach(update);
  if (!value || typeof value !== 'object') return;
  if (value['@graph']) update(value['@graph']);
  const types = [].concat(value['@type'] || []);
  if (types.includes('WebSite') && value.url === `${base}/`) Object.assign(value, website);
  if (!types.includes('Article')) return;
  isArticle = true;
  // Only normalize the known editorial organization; preserve other credited authors.
  if (value.author?.name === site.operatorName) value.author = {...value.author, ...organization};
  if ([site.siteName, site.operatorName].includes(value.publisher?.name)) value.publisher = {...value.publisher, ...organization};
  value.isPartOf = {'@id':website['@id']};
  const existing = value.citation ? [].concat(value.citation) : [];
  const urls = new Set(existing.map(c => typeof c === 'string' ? c : c.url));
  const added = [...sources].filter(url => !urls.has(url));
  if (added.length) value.citation = [...existing, ...added];
  citationCount += added.length;
 };
 for (const node of schemas) {
  const value = JSON.parse(text(node));
  const before = json(value);
  update(value);
  if (json(value) !== before) edits.push({start:node.sourceCodeLocation.startTag.endOffset, end:node.sourceCodeLocation.endTag.startOffset, value:json(value)});
 }
 if (isArticle) {
  articleCount++;
  const heading = nodes.find(n => n.tagName === 'h1');
  if (!heading) throw new Error(`Article without heading: ${path}`);
  const credit = `<!-- editorial-credit:start --><p class="editorial-credit">編集：<a href="/about/">${site.operatorName}</a><span aria-hidden="true"> · </span><a href="/editorial-policy/">情報源・確認方法</a></p><!-- editorial-credit:end -->`;
  // The search answer stays directly under the heading (enhance-guide-search-intents); the credit follows it.
  let at = heading.sourceCodeLocation.endOffset;
  const answerEnd = '<!-- guide-search-answer:end -->';
  if (html.startsWith('<!-- guide-search-answer:start -->', at) && html.indexOf(answerEnd, at) !== -1) at = html.indexOf(answerEnd, at) + answerEnd.length;
  edits.push({start:at, end:at, value:credit});
  if (!html.includes('/assets/article-trust.css')) {
   const at = html.indexOf('</head>');
   edits.push({start:at, end:at, value:'<link rel="stylesheet" href="/assets/article-trust.css">'});
  }
 }
 for (const edit of edits.sort((a,b) => b.start - a.start)) html = html.slice(0, edit.start) + edit.value + html.slice(edit.end);
 // Define shared identity once on the home page and on the visible operator profile.
 if (path === '/' || path === '/about/') {
  const hasWebsite = schemas.some(n => /"@type"\s*:\s*"WebSite"/.test(text(n)));
  const graph = [organization, ...(!hasWebsite ? [website] : [])];
  html = insertBlock(html, '</head>', 'identity-schema', `<!-- identity-schema:start --><script type="application/ld+json">${json({'@context':'https://schema.org','@graph':graph})}</script><!-- identity-schema:end -->`);
 }
 if (html !== original) await writeFile(file, html);
}
console.log(`Editorial trust: ${articleCount} article credits; ${citationCount} visible source citations added.`);
