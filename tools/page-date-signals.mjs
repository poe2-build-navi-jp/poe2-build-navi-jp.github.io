// All outward-facing page dates use the recorded content date. Source review and
// publication dates describe different events and must not be rewritten here.
import {parse} from 'parse5';
import {insertBlock} from './block-order.mjs';
const json=v=>JSON.stringify(v).replaceAll('<','\\u003c');
const PAGE_TYPES=new Set(['Article','BlogPosting','NewsArticle','WebPage','CollectionPage','FAQPage','AboutPage','ContactPage','ProfilePage','SearchResultsPage','ItemPage']);
export function synchronizePageDate(original,{date,url,title,today}) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error(`Invalid content date: ${url}`);
 if(today && date>today)throw Error(`Future content date: ${url}`);
 const english=/<html[^>]+lang="en"/.test(original);
 const dateLabel=english?'Updated: ':'ページ更新：';
 let html=original.replace(/<span class="page-updated">[\s\S]*?<\/time><\/span>/g,'').replace(/<!-- page-updated:start -->[\s\S]*?<!-- page-updated:end -->/g,'').replace(/<!-- page-date-schema:start -->[\s\S]*?<!-- page-date-schema:end -->/g,'');
 if(!html.includes('/assets/page-dates.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/page-dates.css"></head>');
 let pageEntity=false;
 function update(v) {
  if(Array.isArray(v))return v.forEach(update);
  if(!v||typeof v!=='object')return;
  if(v['@graph'])update(v['@graph']);
  if(![].concat(v['@type']||[]).some(t=>PAGE_TYPES.has(t)))return;
  const own=v.url||(typeof v.mainEntityOfPage==='string'?v.mainEntityOfPage:v.mainEntityOfPage?.['@id']);
  if(own && own.split('#')[0]!==url)return;
  if(v.datePublished?.slice(0,10)>date)throw Error(`Content date before publication: ${url}`);
  pageEntity=true;v.dateModified=date;
 }
 // Preserve all page markup and only replace JSON bodies, not entire HTML documents.
 const nodes=[];const walk=n=>{nodes.push(n);(n.childNodes||[]).forEach(walk);};walk(parse(html,{sourceCodeLocationInfo:true}));
 const edits=[];
 for(const n of nodes.filter(n=>n.tagName==='script'&&n.attrs.some(a=>a.name==='type'&&a.value==='application/ld+json'))) {
  const value=JSON.parse(n.childNodes.map(n=>n.value||'').join(''));update(value);
  edits.push({start:n.sourceCodeLocation.startTag.endOffset,end:n.sourceCodeLocation.endTag.startOffset,value:json(value)});
 }
 for(const e of edits.sort((a,b)=>b.start-a.start))html=html.slice(0,e.start)+e.value+html.slice(e.end);
 if(!pageEntity)html=insertBlock(html,'</head>','page-date-schema',`<!-- page-date-schema:start --><script type="application/ld+json">${json({'@context':'https://schema.org','@type':'WebPage','@id':url+'#webpage',url,name:title,inLanguage:english?'en':'ja',dateModified:date})}</script><!-- page-date-schema:end -->`);
 const label=`<span class="page-updated">${dateLabel}<time datetime="${date}">${date}</time></span>`;
 if(html.includes('<!-- editorial-credit:start -->')) {
  html=html.replace(/(<!-- editorial-credit:start -->[\s\S]*?)(<\/p><!-- editorial-credit:end -->)/,`$1${label}$2`);
 } else {
  html=html.replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>)/,`$1<!-- page-updated:start --><p class="page-updated">${dateLabel}<time datetime="${date}">${date}</time></p><!-- page-updated:end -->`);
 }

 return html;
}
