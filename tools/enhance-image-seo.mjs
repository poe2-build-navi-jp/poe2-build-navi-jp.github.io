import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const base = "https://poe2-build-navi-jp.github.io";
const builds = JSON.parse(await readFile(resolve(root, "data/builds.json"), "utf8"));
const classes = JSON.parse(await readFile(resolve(root, "data/classes.json"), "utf8"));
const priority = new Set(["ranger-ice-shot-deadeye","witch-minion-infernalist","warrior-shield-wall-smith","monk-whirling-assault","witch-ed-contagion-lich"]);
const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;");

const pages = [
  {file:"index.html",path:"/",image:"/images/poe2/guides/poe2-beginner-recommended-builds.svg",og:"/images/poe2/og/poe2-recommended-builds-og.webp",alt:"PoE2初心者向けおすすめビルド比較",caption:"遠距離・耐久・ミニオン・DoTから選ぶ、初心者向けおすすめビルド早見図",boundary:'</section><section id="choose-class"'},
  {file:"tier-list/index.html",path:"/tier-list/",image:"/images/poe2/guides/poe2-beginner-build-tier.svg",og:"/images/poe2/og/poe2-build-tier-og.webp",alt:"PoE2初心者向けビルドTier比較",caption:"育てやすさ・操作・切替条件を基準にした初心者向けビルドTier",article:true},
  {file:"league-starter/index.html",path:"/league-starter/",image:"/images/poe2/guides/poe2-league-starter-builds.svg",og:"/images/poe2/og/poe2-league-starter-og.webp",alt:"PoE2リーグスターターと序盤おすすめビルド比較",caption:"序盤の育てやすさから選ぶPoE2リーグスターター早見図",article:true},
  {file:"leveling/index.html",path:"/leveling/",image:"/images/poe2/guides/poe2-leveling-guide.svg",og:"/images/poe2/og/poe2-leveling-og.webp",alt:"PoE2レベリングで現在Lvから今やること3つを確認する流れ",caption:"職業とビルドを選び、現在Lvから今やること3つへ進むレベリング手順",article:true},
  {file:"classes/index.html",path:"/classes/",image:"/images/poe2/guides/poe2-recommended-classes.svg",og:"/images/poe2/og/poe2-classes-og.webp",alt:"PoE2初心者向けおすすめクラスと職業の選び方",caption:"遠距離・召喚・近接・耐久から選ぶおすすめクラス早見図",article:true}
];
for (const item of classes) pages.push({file:`classes/${item.slug}/index.html`,path:`/classes/${item.slug}/`,image:`/images/poe2/classes/poe2-${item.slug}.svg`,og:`/images/poe2/og/poe2-${item.slug}-og.webp`,alt:`Path of Exile 2 ${item.name}`,caption:`${item.name}の戦い方と掲載ビルドを確認するための独自クラス図解`,classHero:true});
for (const build of builds.filter((item)=>priority.has(item.id))) pages.push({file:`builds/${build.classSlug}/${build.slug}/index.html`,path:`/builds/${build.classSlug}/${build.slug}/`,image:`/images/poe2/builds/poe2-${build.slug}-leveling-roadmap.svg`,og:`/images/poe2/og/poe2-${build.slug}-og.webp`,alt:`PoE2 ${build.name}のLv1からEndgameまでの育成ロードマップ`,caption:`${build.name}のLv1〜Endgame育成ロードマップ`,build:true,height:840});

// Read actual dimensions; mobile compositions keep text readable without horizontal scrolling.
for (const page of pages) {
  const svg = await readFile(resolve(root, page.image.slice(1)), "utf8");
  const dimensions = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  page.width = Number(dimensions?.[1] || 1200);
  page.height = Number(dimensions?.[2] || page.height || 630);
  if (page.build || page.path === "/leveling/") {
    page.mobile = page.image.replace(".svg", "-mobile.svg");
    const mobileSvg = await readFile(resolve(root, page.mobile.slice(1)), "utf8");
    page.mobileHeight = Number(mobileSvg.match(/viewBox="0 0 720 (\d+)"/)[1]);
  }
}
const figure = (page) => `<!-- image-visual:start --><figure class="seo-visual">${page.mobile ? `<picture><source media="(max-width: 600px)" srcset="${page.mobile}" width="720" height="${page.mobileHeight}">` : ""}<img src="${page.image}" width="${page.width}" height="${page.height}" loading="lazy" decoding="async" alt="${esc(page.alt)}">${page.mobile ? "</picture>" : ""}<figcaption>${esc(page.caption)}${page.build ? "。各段階の最優先行動を抜粋。スキル・装備の詳しい条件は下の育成手順で確認してください。" : ""}</figcaption></figure><!-- image-visual:end -->`;


for (const page of pages) {
  const location = resolve(root,page.file);
  let html = await readFile(location,"utf8");
  html = html.replace(/<!-- image-visual:start -->[\s\S]*?<!-- image-visual:end -->/g,"").replace(/<!-- image-seo:start -->[\s\S]*?<!-- image-seo:end -->/g,"");
  html = html.replace(/<meta name="twitter:card" content="[^"]*">/g,"").replace(/<meta name="robots" content="index,follow">/, '<meta name="robots" content="index,follow,max-image-preview:large">');
  html = html.replace(/\n[ \t]+\n/g,"\n");
  const absolute = `${base}${page.image}`;
  const absoluteOg = `${base}${page.og}`;
  const schema = JSON.stringify({"@context":"https://schema.org","@type":"WebPage","url":`${base}${page.path}`,"image":[absolute],"primaryImageOfPage":{"@type":"ImageObject","contentUrl":absolute,"caption":page.caption}}).replaceAll("<","\\u003c");
  const meta = `<!-- image-seo:start --><meta property="og:image" content="${absoluteOg}"><meta property="og:image:type" content="image/webp"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(page.alt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${absoluteOg}"><script type="application/ld+json">${schema}</script><!-- image-seo:end -->`;
  html = html.replace('</head>',`${meta}</head>`);
  if (page.boundary && html.includes(page.boundary)) html = html.replace(page.boundary,`</section>${figure(page)}<section id="choose-class"`);
  else if (page.classHero) html = html.replace(/(<section class="class-page-hero"[\s\S]*?<div class="status-note">[\s\S]*?<\/div>)(<\/section>)/,`$1${figure(page)}$2`);
  else if (page.build) html = html.replace('<section id="roadmap"',`${figure(page)}<section id="roadmap"`);
  else if (page.article) html = html.replace(/(<article class="article-page[^>]*>)/,`$1${figure(page)}`);
  await writeFile(location,html);
}

console.log(`Enhanced ${pages.length} pages with crawlable images, OGP and image structured data.`);
