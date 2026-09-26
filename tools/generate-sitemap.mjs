import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const root=resolve(import.meta.dirname,"..");
const [builds,classes,guides,terms,seoPages,site]=await Promise.all(["builds","classes","guides","dictionary","seo-pages","site"].map(name=>readFile(resolve(root,`data/${name}.json`),"utf8").then(JSON.parse)));
const base=site.baseUrl;
const defaultDate=site.lastUpdated;
const changedDate=site.latestPatchCheckedAt;
const indexableBuilds=builds.filter(x=>x.status==="verified");
const urls=[...new Set(["/","/builds/","/classes/","/leveling/","/gear-check/","/class-check/","/beginner-guide/","/guides/beginner-build/","/dictionary/","/tier-list/","/league-starter/","/best-builds/","/poe2-1-0/","/about/","/editorial-policy/","/privacy/","/terms/",...classes.map(x=>`/classes/${x.slug}/`),...indexableBuilds.map(x=>`/builds/${x.classSlug}/${x.slug}/`),...guides.map(x=>`/guides/${x.slug}/`),...terms.map(x=>`/dictionary/${x.slug}/`),...seoPages.map(x=>x.path)])];
const changedPaths=new Set(["/","/leveling/","/tier-list/","/league-starter/","/best-builds/","/poe2-1-0/",...classes.map(x=>`/classes/${x.slug}/`),...indexableBuilds.map(x=>`/builds/${x.classSlug}/${x.slug}/`)]);
const priorityBuildIds=new Set(["ranger-ice-shot-deadeye","witch-minion-infernalist","warrior-shield-wall-smith","monk-whirling-assault","witch-ed-contagion-lich"]);
const imageMap=new Map([
  ["/",["/images/poe2/guides/poe2-beginner-recommended-builds.svg","PoE2初心者向けおすすめビルド比較"]],
  ["/tier-list/",["/images/poe2/guides/poe2-beginner-build-tier.svg","PoE2初心者向けビルドTier比較"]],
  ["/league-starter/",["/images/poe2/guides/poe2-league-starter-builds.svg","PoE2リーグスターター比較"]],
  ["/leveling/",["/images/poe2/guides/poe2-leveling-guide.svg","PoE2レベリングガイド"]],
  ["/classes/",["/images/poe2/guides/poe2-recommended-classes.svg","PoE2おすすめクラス・職業"]],
  ...classes.map(item=>[`/classes/${item.slug}/`,[`/images/poe2/classes/poe2-${item.slug}.svg`,`Path of Exile 2 ${item.name}`]]),
  ...indexableBuilds.filter(item=>priorityBuildIds.has(item.id)).map(item=>[`/builds/${item.classSlug}/${item.slug}/`,[`/images/poe2/builds/poe2-${item.slug}-leveling-roadmap.svg`,`PoE2 ${item.name}の育成ロードマップ`]])
]);
const xmlEscape=value=>String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.map((path,i)=>{const image=imageMap.get(path);return `  <url><loc>${base}${path}</loc><lastmod>${changedPaths.has(path)?changedDate:defaultDate}</lastmod><priority>${i===0?"1.0":path==="/best-builds/"||path.startsWith("/builds/")||path.startsWith("/classes/")?"0.9":"0.7"}</priority>${image?`<image:image><image:loc>${base}${image[0]}</image:loc><image:title>${xmlEscape(image[1])}</image:title></image:image>`:""}</url>`}).join("\n")}\n</urlset>\n`;
await writeFile(resolve(root,"sitemap.xml"),xml);
console.log(`Generated sitemap with ${urls.length} URLs.`);
