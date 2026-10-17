// /site-map/: every indexable page, grouped by section, linked from the shared footer so each page
// is at most two clicks from any other (helps crawlers find new pages). The list comes from the
// pages themselves (index robots + self canonical), not from sitemap.xml, so this can run before
// generate-sitemap and stays current in the same build.
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const site=JSON.parse(await readFile(resolve(root,'data/site.json'),'utf8'));
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const unesc=v=>String(v).replaceAll('&quot;','"').replaceAll('&gt;','>').replaceAll('&lt;','<').replaceAll('&amp;','&');
const skip=new Set(['.git','.github','node_modules','assets','data','images','scripts','tools','tests','company','docs','site-map']);
async function pages(dir,out=[]){
 for(const e of await readdir(dir,{withFileTypes:true})){
  if(skip.has(e.name)||e.name.startsWith('.'))continue;
  const p=join(dir,e.name);
  if(e.isDirectory())await pages(p,out);
  else if(e.name==='index.html')out.push(p);
 }
 return out;
}
const GROUPS=[
 ['ビルド',p=>p==='/builds/'||p.startsWith('/builds/')||p==='/best-builds/'||p==='/beginner-builds/'||p==='/tier-list/'||p==='/league-starter/'||p==='/leveling/'||p==='/rating-criteria/'],
 ['職業',p=>p.startsWith('/classes/')||p==='/class-check/'],
 ['攻略ガイド',p=>p.startsWith('/guides/')||p==='/beginner-guide/'||p==='/gear-check/'],
 ['スキル・装備',p=>p.startsWith('/skills/')||p.startsWith('/equipment/')],
 ['用語・索引',p=>p.startsWith('/dictionary/')||p==='/name-index/'||p==='/search/'],
 ['PoE2とは・1.0',p=>p==='/what-is-poe2/'||p.startsWith('/poe2-1-0/')],
 ['サイトについて',p=>['/','/about/','/editorial-policy/','/privacy/','/terms/'].includes(p)]
];
const entries=[];
for(const file of await pages(root)){
 const html=await readFile(file,'utf8');
 const path=`/${relative(root,file).replace(/index\.html$/,'')}`.replace(/\\/g,'/');
 if(!/<meta name="robots" content="index/.test(html))continue;
 if(!html.includes(`<link rel="canonical" href="${site.baseUrl}${path}">`))continue;
 const title=unesc(html.match(/<title>([^<]*)<\/title>/)?.[1]??path).replace(/｜POE2ビルドナビ$/,'');
 entries.push({path,title});
}
entries.sort((a,b)=>a.path.localeCompare(b.path));
const used=new Set();
const sections=GROUPS.map(([label,test])=>{const list=entries.filter(e=>!used.has(e.path)&&test(e.path));list.forEach(e=>used.add(e.path));return [label,list];});
const rest=entries.filter(e=>!used.has(e.path));
if(rest.length)sections.push(['その他',rest]);
const total=entries.length+1;
const url=`${site.baseUrl}/site-map/`;
const title='サイトマップ（全ページ一覧）｜POE2ビルドナビ';
const description=`POE2ビルドナビの全${total}ページの一覧。ビルド、職業、攻略ガイド、スキル・装備、用語辞典、PoE2とは・1.0の情報を種類別にまとめています。`;
const body=sections.filter(([,list])=>list.length).map(([label,list])=>`<section><h2>${esc(label)}（${list.length}ページ）</h2><ul class="site-map-list">${list.map(e=>`<li><a href="${esc(e.path)}">${esc(e.title)}</a></li>`).join('')}</ul></section>`).join('');
const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow"><meta name="google-adsense-account" content="ca-pub-7738997902416481"><link rel="canonical" href="${url}"><link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/mobile.css"><meta property="og:type" content="website"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="${esc(site.siteName)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><style>.site-map-list{columns:2 18rem;column-gap:2rem;padding-left:1.2rem}.site-map-list li{margin:.35rem 0;break-inside:avoid}</style></head><body><a class="skip-link" href="#main">本文へ移動</a><header class="site-header"><a class="brand" href="/" aria-label="POE2ビルドナビ ホーム"><span class="brand-mark" aria-hidden="true">P2</span><span>POE2<br>ビルドナビ</span></a></header><main id="main" class="legal-main"><p class="section-kicker">SITE MAP</p><h1>サイトマップ（全ページ一覧）</h1><p>POE2ビルドナビに掲載している全${total}ページを種類別にまとめています。目的のページが見つからないときは<a href="/search/">サイト内検索</a>も使えます。</p>${body}</main></body></html>\n`;
await mkdir(resolve(root,'site-map'),{recursive:true});
await writeFile(resolve(root,'site-map/index.html'),html);
console.log(`HTML sitemap: ${entries.length} pages`);
