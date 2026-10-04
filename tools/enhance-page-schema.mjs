// Idempotent: structured data for pages whose generators emit none.
// - BreadcrumbList from the visible breadcrumb on sitemap pages that have no BreadcrumbList yet.
// - Article on the beginner-guide chapters (data/guides.json) and DefinedTerm / DefinedTermSet
//   on the dictionary pages (data/dictionary.json).
// dateModified is the content date from data/page-dates.json, so run this after generate-sitemap.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {insertBlock} from './block-order.mjs';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const [site,guides,terms,pageDates]=await Promise.all(['site','guides','dictionary','page-dates'].map(n=>read(`data/${n}.json`).then(JSON.parse)));
const base=site.baseUrl;
// The guide chapters and dictionary pages were first published together (git: 2026-09-10).
const FIRST_PUBLISHED='2026-09-10';
const text=html=>html.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const org={"@type":"Organization",name:site.operatorName??site.siteName,url:`${base}/about/`};
const publisher={"@type":"Organization",name:site.siteName,url:`${base}/`};
const termSet={"@type":"DefinedTermSet",name:`${site.siteName} PoE2用語辞典`,url:`${base}/dictionary/`};
const sitemap=await read('sitemap.xml');
const paths=[...sitemap.matchAll(/<loc>https:\/\/poe2-build-navi-jp\.github\.io(\/[^<]*)<\/loc>/g)].map(m=>m[1]);
let count=0;
for(const path of paths){
 const file=`${path.slice(1)}index.html`;
 let html=(await read(file)).replace(/<!-- page-schema:start -->[\s\S]*?<!-- page-schema:end -->/g,'');
 const data=[];
 const meta=name=>html.match(new RegExp(`<meta (?:name|property)="${name}" content="([^"]*)"`))?.[1];
 const h1=text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]??'');
 const crumbs=html.match(/<nav class="breadcrumbs"[^>]*>\s*<ol>([\s\S]*?)<\/ol>/)?.[1];
 if(crumbs&&!html.includes('"BreadcrumbList"')){
  const items=[...crumbs.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(([,li])=>({name:text(li),href:li.match(/href="([^"]+)"/)?.[1]??path}));
  data.push({"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:items.map((item,i)=>({"@type":"ListItem",position:i+1,name:item.name,item:`${base}${item.href}`}))});
 }
 const guide=guides.find(g=>path===`/guides/${g.slug}/`);
 if(guide&&!html.includes('"@type":"Article"')){
  data.push({"@context":"https://schema.org","@type":"Article",headline:h1,description:meta('description'),inLanguage:'ja',datePublished:FIRST_PUBLISHED,dateModified:[FIRST_PUBLISHED,pageDates[path]?.date].filter(Boolean).sort().at(-1),mainEntityOfPage:`${base}${path}`,image:`${base}/images/poe2/og/poe2-${path.replace(/^\/|\/$/g,'').replaceAll('/','-')}-og.webp`, // Same file generate-og-images writes.
  author:org,publisher});
 }
 const term=terms.find(t=>path===`/dictionary/${t.slug}/`);
 if(term&&!html.includes('"DefinedTerm"'))data.push({"@context":"https://schema.org","@type":"DefinedTerm",name:term.term,description:term.oneLine,url:`${base}${path}`,inDefinedTermSet:termSet});
 if(path==='/dictionary/'&&!html.includes('"DefinedTermSet"'))data.push({"@context":"https://schema.org",...termSet,description:meta('description'),hasDefinedTerm:terms.map(t=>({"@type":"DefinedTerm",name:t.term,description:t.oneLine,url:`${base}/dictionary/${t.slug}/`}))});
 if(data.length){
  html=insertBlock(html,'</head>','page-schema',`<!-- page-schema:start -->${data.map(d=>`<script type="application/ld+json">${JSON.stringify(d).replaceAll('<','\\u003c')}</script>`).join('')}<!-- page-schema:end -->`);
  count++;
 }
 await writeFile(resolve(root,file),html);
}
console.log(`Page schema: ${count} pages`);
