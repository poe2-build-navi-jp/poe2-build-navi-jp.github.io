// Generates a Japanese 1200x630 OG image (WebP) for every sitemap page that has no
// image-seo block, and injects og:image / twitter:card meta between og-image markers.
// Requires the dev dependency playwright-core and a local Chromium
// (PLAYWRIGHT_BROWSERS_PATH, or CHROMIUM_PATH). Text comes from each page's own <title>.
// Idempotent: an image file is only rewritten when its encoded bytes change.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright-core';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const site=JSON.parse(await read('data/site.json'));
const builds=JSON.parse(await read('data/builds.json'));
const base=site.baseUrl;
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const unesc=v=>String(v).replaceAll('&quot;','"').replaceAll('&gt;','>').replaceAll('&lt;','<').replaceAll('&amp;','&');

const category=path=>path.startsWith('builds/')?'BUILD':path.startsWith('guides/')?'GUIDE':path.startsWith('dictionary/')?'DICTIONARY':path.startsWith('poe2-1-0/')?'POE2 1.0':/^(about|privacy|terms|editorial-policy|rating-criteria)\//.test(path)?'SITE':'POE2 BUILD NAVI';
const imageName=path=>{
 const build=builds.find(b=>path===`builds/${b.classSlug}/${b.slug}/`);
 if(build)return `poe2-${build.slug}-og.webp`;
 return `poe2-${path.replace(/\/$/,'').replaceAll('/','-')||'home'}-og.webp`;
};

const sitemap=await read('sitemap.xml');
const paths=[...sitemap.matchAll(/<loc>https:\/\/poe2-build-navi-jp\.github\.io\/([^<]*)<\/loc>/g)].map(m=>m[1]);
const pages=[];
for(const path of paths){
 const file=`${path}index.html`;
 const html=await read(file);
 if(html.includes('<!-- image-seo:start -->'))continue; // Handled by enhance-image-seo.mjs.
 let [heading,sub='']=unesc(html.match(/<title>([^<]*)<\/title>/)[1]).split('｜').map(v=>v.trim());
 // Long question titles: keep the question large and move the answer to the subtitle.
 const q=heading.indexOf('？');
 if(heading.length>20&&q>0&&q<heading.length-1){sub=heading.slice(q+1);heading=heading.slice(0,q+1);}
 const build=builds.find(b=>path===`builds/${b.classSlug}/${b.slug}/`);
 const subtitle=build?`${build.className} / ${build.ascendancy}\nLv1〜Endgame育成`:sub.replace(/POE2ビルドナビ/,'').trim();
 pages.push({path,file,heading,subtitle,category:category(path),image:`/images/poe2/og/${imageName(path)}`,alt:`${heading}${subtitle?`｜${subtitle.replace('\n','　')}`:''}`});
}

const template=p=>`<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}html,body{width:1200px;height:630px}
body{position:relative;overflow:hidden;background:linear-gradient(135deg,#101827,#242037);color:#fff;font-family:"IPAPGothic","IPAGothic","Noto Sans CJK JP",sans-serif}
.c1{position:absolute;right:-230px;top:-250px;width:640px;height:640px;border-radius:50%;background:#2b2033}
.arc{position:absolute;right:90px;bottom:120px;width:340px;height:170px;border:12px solid #d4a95d;border-bottom:0;border-radius:170px 170px 0 0;opacity:.85}
.arc.s{right:150px;bottom:120px;width:220px;height:110px;opacity:.6}
.brand{position:absolute;left:70px;top:58px;font:700 28px/1 "DejaVu Sans",sans-serif;letter-spacing:.08em;color:#d4a95d}
.chip{position:absolute;left:70px;top:110px;padding:8px 16px;border:2px solid #d4a95d;color:#d4a95d;font:700 22px/1 "DejaVu Sans",sans-serif;letter-spacing:.06em}
.box{position:absolute;left:70px;top:176px;width:690px;height:300px;display:flex;flex-direction:column;justify-content:center;gap:22px}
h1{font-size:64px;line-height:1.28;font-weight:700;word-break:auto-phrase;overflow-wrap:anywhere}
p{font-size:30px;line-height:1.4;color:#cbd5e1}
.foot{position:absolute;left:70px;bottom:52px;display:flex;align-items:center;gap:22px}
.patch{padding:14px 28px;border-radius:36px;background:#d4a95d;color:#101827;font:700 24px/1 "DejaVu Sans",sans-serif}
.site{font-size:24px;color:#9fb0c3}
</style></head><body><div class="c1"></div><div class="arc"></div><div class="arc s"></div>
<div class="brand">POE2 BUILD NAVI</div><div class="chip">${esc(p.category)}</div>
<div class="box"><h1>${esc(p.heading)}</h1>${p.subtitle?`<p>${esc(p.subtitle).replace('\n','<br>')}</p>`:''}</div>
<div class="foot"><span class="patch">PATCH ${esc(site.siteVersion)}</span><span class="site">POE2ビルドナビ｜日本語ビルド育成ナビ</span></div>
<script>const h=document.querySelector('h1'),box=document.querySelector('.box');let s=64;while(box.scrollHeight>box.clientHeight&&s>34){s-=2;h.style.fontSize=s+'px';}</script></body></html>`;

const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
const page=await browser.newPage({viewport:{width:1200,height:630}});
await mkdir(resolve(root,'images/poe2/og'),{recursive:true});
let written=0;
for(const p of pages){
 await page.setContent(template(p),{waitUntil:'load'});
 const png=await page.screenshot({type:'png'});
 const dataUrl=await page.evaluate(async src=>{const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=1200;c.height=630;c.getContext('2d').drawImage(img,0,0);return c.toDataURL('image/webp',0.82);},`data:image/png;base64,${png.toString('base64')}`);
 if(!dataUrl.startsWith('data:image/webp'))throw new Error('Chromium could not encode WebP');
 const webp=Buffer.from(dataUrl.split(',')[1],'base64');
 const target=resolve(root,p.image.slice(1));
 const old=await readFile(target).catch(()=>null);
 if(!old||!old.equals(webp)){await writeFile(target,webp);written++;}
}
await browser.close();

for(const p of pages){
 let html=await read(p.file);
 html=html.replace(/<!-- og-image:start -->[\s\S]*?<!-- og-image:end -->/g,'')
  .replace(/<meta name="twitter:card" content="[^"]*">/g,'')
  .replace(/<meta property="og:image(?::[a-z]+)?" content="[^"]*">/g,'');
 const abs=`${base}${p.image}`;
 const meta=`<!-- og-image:start --><meta property="og:image" content="${abs}"><meta property="og:image:type" content="image/webp"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(p.alt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${abs}"><!-- og-image:end -->`;
 html=html.replace('</head>',`${meta}</head>`);
 await writeFile(resolve(root,p.file),html);
}
console.log(`OG images: ${pages.length} pages, ${written} images written`);
