import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { contentHash } from "./page-content.mjs";
const root=resolve(import.meta.dirname,"..");
const [builds,classes,guides,terms,seoPages,site]=await Promise.all(["builds","classes","guides","dictionary","seo-pages","site"].map(name=>readFile(resolve(root,`data/${name}.json`),"utf8").then(JSON.parse)));
const strategyGuides=JSON.parse(await readFile(resolve(root,"data/strategy-guides.json"),"utf8"));
const coreEntities=JSON.parse(await readFile(resolve(root,'data/core-entities.json'),'utf8'));
const base=site.baseUrl;
const defaultDate=site.lastUpdated;
const changedDate=site.latestPatchCheckedAt;
const indexableBuilds=builds.filter(x=>x.status==="verified");
const buildLastmod=new Map(indexableBuilds.map(build=>[
  `/builds/${build.classSlug}/${build.slug}/`,
  [changedDate,build.updatedAt,...(build.changeHistory||[]).map(entry=>entry.date)].filter(Boolean).sort().at(-1)
]));
const noindex=new Set(JSON.parse(await readFile(resolve(root,"data/noindex.json"),"utf8")).paths);
const urls=[...new Set(["/","/search/","/name-index/","/skills/","/equipment/",...coreEntities.map(e=>`/${e.kind==='skill'?'skills':'equipment'}/${e.slug}/`),"/builds/","/classes/","/leveling/","/gear-check/","/class-check/","/beginner-guide/","/beginner-builds/","/guides/","/dictionary/","/tier-list/","/league-starter/","/best-builds/","/poe2-1-0/","/about/","/editorial-policy/","/rating-criteria/","/privacy/","/terms/","/site-map/",...classes.map(x=>`/classes/${x.slug}/`),...indexableBuilds.map(x=>`/builds/${x.classSlug}/${x.slug}/`),...guides.map(x=>`/guides/${x.slug}/`),...strategyGuides.map(x=>`/guides/${x.slug}/`),...terms.map(x=>`/dictionary/${x.slug}/`),...seoPages.map(x=>x.path)])].filter(path=>!noindex.has(path));
const changedPaths=new Set(["/","/leveling/","/tier-list/","/league-starter/","/best-builds/","/poe2-1-0/",...classes.map(x=>`/classes/${x.slug}/`),...indexableBuilds.map(x=>`/builds/${x.classSlug}/${x.slug}/`)]);
const {ROADMAP_BUILD_IDS}=await import("./roadmap-builds.mjs");
const priorityBuildIds=new Set(ROADMAP_BUILD_IDS);
const imageMap=new Map([
  ["/tier-list/",["/images/poe2/guides/poe2-beginner-build-tier.svg","PoE2初心者向けビルドTier比較"]],
  ["/league-starter/",["/images/poe2/guides/poe2-league-starter-builds.svg","PoE2リーグスターター比較"]],
  ["/leveling/",["/images/poe2/guides/poe2-leveling-guide.svg","PoE2レベリングガイド"]],
  ["/classes/",["/images/poe2/guides/poe2-recommended-classes.svg","PoE2おすすめクラス・職業"]],
  ...classes.map(item=>[`/classes/${item.slug}/`,[`/images/poe2/classes/poe2-${item.slug}.svg`,`Path of Exile 2 ${item.name}`]]),
  ...indexableBuilds.filter(item=>priorityBuildIds.has(item.id)).map(item=>[`/builds/${item.classSlug}/${item.slug}/`,[`/images/poe2/builds/poe2-${item.slug}-leveling-roadmap.svg`,`PoE2 ${item.name}の育成ロードマップ`]])
]);
const strategyImages=new Map(strategyGuides.map(g=>[`/guides/${g.slug}/`,[...new Set([g.heroVisual,...g.sections.map(s=>s.visual)].filter(Boolean).map(v=>v.src))]]));
// lastmod also follows the page's own content: data/page-dates.json keeps a fingerprint of each
// page's main content and the date it last changed. Run this after the enhancers.
const today=process.env.SITEMAP_DATE||new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"});
const datesFile=resolve(root,"data/page-dates.json");
const oldDates=JSON.parse(await readFile(datesFile,"utf8").catch(()=>"{}"));
const pageDates={};
for(const path of urls){
  const hash=contentHash(await readFile(resolve(root,`${path.slice(1)}index.html`),"utf8"));
  pageDates[path]=oldDates[path]?.hash===hash?oldDates[path]:{hash,date:today};
}
await writeFile(datesFile,`${JSON.stringify(pageDates,null,1)}\n`);
const lastmod=path=>[buildLastmod.get(path)||(changedPaths.has(path)?changedDate:defaultDate),pageDates[path].date].sort().at(-1);
const xmlEscape=value=>String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.map((path,i)=>{const image=imageMap.get(path);return `  <url><loc>${base}${path}</loc><lastmod>${lastmod(path)}</lastmod><priority>${i===0?"1.0":path==="/best-builds/"||path.startsWith("/builds/")||path.startsWith("/classes/")?"0.9":"0.7"}</priority>${image?`<image:image><image:loc>${base}${image[0]}</image:loc></image:image>`:""}${(strategyImages.get(path)||[]).map(src=>`<image:image><image:loc>${base}${xmlEscape(src)}</image:loc></image:image>`).join("")}</url>`}).join("\n")}\n</urlset>\n`;
await writeFile(resolve(root,"sitemap.xml"),xml);
// Two more ways for crawlers to find every page besides sitemap.xml: a plain-text URL list (also a
// valid sitemap format) and an Atom feed of the most recently changed pages, which search engines
// fetch often. robots.txt keeps its single Sitemap line; these are submitted separately.
await writeFile(resolve(root,"sitemap.txt"),urls.map(path=>`${base}${path}`).join("\n")+"\n");
const pageMeta=async path=>{const html=await readFile(resolve(root,`${path.slice(1)}index.html`),"utf8");const unesc=v=>v.replaceAll("&quot;",'"').replaceAll("&gt;",">").replaceAll("&lt;","<").replaceAll("&amp;","&");return {title:unesc(html.match(/<title>([^<]*)<\/title>/)?.[1]||path),summary:unesc(html.match(/<meta name="description" content="([^"]*)"/)?.[1]||"")};};
const recent=urls.map((path,i)=>({path,i,date:lastmod(path)})).sort((a,b)=>b.date.localeCompare(a.date)||a.i-b.i).slice(0,50);
const entries=[];
for(const {path,date} of recent){const {title,summary}=await pageMeta(path);entries.push(`  <entry><title>${xmlEscape(title)}</title><link href="${base}${path}"/><id>${base}${path}</id><updated>${date}T00:00:00+09:00</updated><summary>${xmlEscape(summary)}</summary></entry>`);}
const feed=`<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ja">\n  <title>${xmlEscape(site.siteName)}の更新情報</title>\n  <link href="${base}/"/>\n  <link rel="self" href="${base}/feed.xml"/>\n  <id>${base}/feed.xml</id>\n  <updated>${recent[0].date}T00:00:00+09:00</updated>\n  <author><name>${xmlEscape(site.operatorName)}</name></author>\n${entries.join("\n")}\n</feed>\n`;
await writeFile(resolve(root,"feed.xml"),feed);
console.log(`Generated sitemap with ${urls.length} URLs, sitemap.txt and an Atom feed of ${entries.length} recent pages.`);
