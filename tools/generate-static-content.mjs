import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const save=(p,t)=>writeFile(resolve(root,p),t);
const allBuilds=JSON.parse(await read('data/builds.json')), builds=allBuilds.filter(b=>b.status!=="draft"), classes=JSON.parse(await read('data/classes.json')), site=JSON.parse(await read('data/site.json'));
const esc=v=>String(v??'確認中').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const url=b=>`/builds/${b.classSlug}/${b.slug}/`;
const list=vs=>vs.map(v=>`<li>${esc(v)}</li>`).join('');
const ssf=b=>b.reviewedFacts?.ssfNote||(b.ssf===true?'確認済み':b.ssf===false?'非対応':'未確認');
const cards=builds.map(b=>`<article class="catalog-card" data-class="${esc(b.className)}"><div><p>${esc(b.className)} / ${esc(b.ascendancy)}</p><h2>${esc(b.name)}</h2><p>主力：${esc(b.mainSkill)}</p></div><div class="catalog-fit"><strong>おすすめ：${esc(b.audience)}</strong><p>弱点：${esc(b.weaknesses[0])}</p></div><dl><div><dt>操作</dt><dd>${esc(b.difficulty)}</dd></div><div><dt>SSF</dt><dd>${ssf(b)}</dd></div><div><dt>対応</dt><dd>${esc(b.version)}</dd></div></dl><a class="button" href="${url(b)}">Lv1から育てる</a></article>`).join('');
let catalog=await read('builds/index.html');
catalog=catalog.replace(/(<div id="build-list"[^>]*>)[\s\S]*?(<\/div><\/section><\/main>)/,`$1${cards}$2`).replaceAll('/assets/build-list.js','/assets/catalog-static.js').replace(/<title>.*?<\/title>/,'<title>PoE2 0.5.5 職業別おすすめビルド一覧｜初心者向け育成ナビ</title>').replace(/<meta name="description" content="[^"]*">/,'<meta name="description" content="PoE2 0.5.5対応。職業・主力スキル・操作・SSF・弱点からおすすめビルドを比較し、個別ページで現在Lvから育成手順を確認できます。">').replace(/<meta property="og:title" content="[^"]*">/,'<meta property="og:title" content="PoE2 0.5.5 職業別おすすめビルド一覧">').replace(/<meta property="og:description" content="[^"]*">/,'<meta property="og:description" content="職業・主力スキル・操作・SSF・弱点から、0.5.5対応ビルドを比較できます。">').replaceAll('ビルド8選',`ビルド${builds.length}選`).replaceAll('各1件掲載','掲載').replaceAll('8職業を1件ずつ比較できる育成ナビ。','職業別に特徴と弱点を比較できる育成ナビ。').replace(/(<span id="result-count">).*?(<\/span>)/,`$1${builds.length}件$2`).replace(/<p class="budget-policy">[\s\S]*?<\/p>/,'').replace('<p class="filter-note">','<p class="budget-policy">装備価格はリーグ時期で変動するため、固定相場は掲載していません。</p><p class="filter-note">').replace(/<h1>職業から育てるビルドを選ぶ<\/h1>/,'<h1>PoE2 0.5.5 職業別ビルド一覧</h1>');
await save('builds/index.html',catalog);
const classCards=classes.map(c=>`<article class="class-card" data-class-slug="${c.slug}"><h3>${esc(c.name)}</h3><p class="class-tagline">${esc(c.tagline)}</p><a class="button" href="/classes/${c.slug}/">この職業のビルドを見る</a></article>`).join('');
let home=await read('index.html');
home=home.replace(/(<div id="class-grid"[^>]*>)[\s\S]*?(<\/div><div class="class-helper">)/,`$1${classCards}$2`);
if(!home.includes('id="real-example"')){const b=builds[0];home=home.replace('</main>',`<section id="real-example" class="section"><h2>実際の案内例：Lv37</h2><p>${esc(b.name)}</p><ol>${list(b.levelingStages[3].nowActions)}</ol><a class="button" href="${url(b)}?level=37#now">この段階を見る</a></section></main>`);}
if(!home.includes('data-full-class-check'))home=home.replace('<div id="style-choices"','<a class="button" data-full-class-check href="/class-check/">4問の職業診断</a><div id="style-choices"');
await save('index.html',home);
await mkdir(resolve(root,'classes'),{recursive:true});
const classChoices = [["遠距離", "レンジャー", "弓で距離を取りながら戦いたい人向け。"], ["召喚", "ウィッチ", "仲間へ攻撃を任せ、回避へ集中したい人向け。"], ["近接・機動力", "モンク", "移動しながら近接攻撃を続けたい人向け。"], ["耐久重視", "ウォリアー", "盾を使い、守りを意識して進めたい人向け。"]].map(([label,name,summary])=>{const c=classes.find(x=>x.name===name);return `<article class="purpose-card"><p class="section-kicker">${label}</p><h2>${name}</h2><p>${summary}</p><a class="button" href="/classes/${c.slug}/">${name}のビルドを見る</a></article>`}).join('');
const breadcrumb=JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":"https://poe2-build-navi-jp.github.io/"},{"@type":"ListItem","position":2,"name":"おすすめクラス・職業","item":"https://poe2-build-navi-jp.github.io/classes/"}]}).replaceAll('<','\\u003c');
await save('classes/index.html',`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PoE2おすすめクラス・職業｜初心者向け選び方</title><meta name="description" content="PoE2初心者向けにおすすめクラス・職業を戦い方別に案内。4問診断から各職業のビルドと序盤育成へ進めます。"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="https://poe2-build-navi-jp.github.io/classes/"><meta property="og:type" content="website"><meta property="og:title" content="PoE2おすすめクラス・職業｜初心者向け選び方"><meta property="og:description" content="戦い方からクラスを選び、掲載ビルドと序盤育成へ進めます。"><meta property="og:url" content="https://poe2-build-navi-jp.github.io/classes/"><meta name="twitter:card" content="summary"><link rel="stylesheet" href="/assets/styles.css?v=discovery-2"><link rel="stylesheet" href="/assets/mobile.css?v=discovery-2"><script type="application/ld+json">${breadcrumb}</script></head><body><header class="site-header"><a class="brand" href="/"><span class="brand-mark">P2</span><span>POE2<br>ビルドナビ</span></a><nav class="site-nav page-nav"><a href="/tier-list/">Tier</a><a href="/league-starter/">スターター</a><a href="/builds/">ビルド</a><a href="/beginner-guide/">初心者ガイド</a></nav></header><main class="page-main"><nav class="breadcrumbs"><ol><li><a href="/">ホーム</a></li><li>おすすめクラス・職業</li></ol></nav><section class="page-hero"><p class="section-kicker">CHOOSE A CLASS</p><h1>PoE2おすすめクラス・職業｜初心者向け選び方</h1><p>強さの順位ではなく、遠距離・召喚・近接・耐久など、続けやすい戦い方から選びます。</p><div class="update-strip"><span>対応環境：${esc(site.siteVersion)}</span><span><a href="${esc(site.latestPatchSource)}" target="_blank" rel="noopener noreferrer">最新確認：${esc(site.latestPatch)}</a></span><span>最終確認：${esc(site.latestPatchCheckedAt)}</span></div></section><article class="article-page wide-article"><section class="content-action choice-summary"><h2>結論だけ知りたい人向け</h2><div class="purpose-grid">${classChoices}</div><div class="section-cta"><a class="button" href="/class-check/">4問で自分に合う職業を見る</a><a class="button-secondary" href="/beginner-guide/">初心者向けビルドを見る</a><a class="button-secondary" href="/best-builds/">目的別おすすめを見る</a></div></section><section><h2>PoE2の8職業から選ぶ</h2><p>職業ページでは特徴、初心者向けか、掲載中ビルド、Lv1〜30の育成手順を確認できます。</p><div class="class-card-grid class-directory">${classCards}</div></section><aside class="next-box"><b>職業を決めた後</b><p>職業 → ビルド → 現在Lvの順に選ぶと、「今やること3つ」へ進めます。</p><a class="button" href="/leveling/">現在Lvから育成を見る</a></aside></article></main></body></html>`);
for(const b of builds){
 let p=await read(`builds/${b.classSlug}/${b.slug}/index.html`);
 let actionIndex=0;
 p=p.replace(/(<span data-now-action>).*?(<\/span>)/g,(_,a,z)=>a+esc(b.levelingStages[0].nowActions[actionIndex++])+z);
 p=p.replace('一般的な確認項目（ビルド固有データ確認中）','掲載資料から整理した優先行動');
 p=p.replace(/(<ul id="strength-list"[^>]*>).*?(<\/ul>)/,`$1${list(b.strengths)}$2`).replace(/(<ul id="weakness-list"[^>]*>).*?(<\/ul>)/,`$1${list(b.weaknesses)}$2`);
 await save(`builds/${b.classSlug}/${b.slug}/index.html`,p);
}
console.log(`Static content: ${builds.length} builds, ${classes.length} classes`);
async function enhance(dir=''){
 for(const entry of await readdir(resolve(root,dir),{withFileTypes:true})){
  if(entry.name.startsWith('.')||['company','node_modules','tests','tools','scripts'].includes(entry.name))continue;
  const path=dir?`${dir}/${entry.name}`:entry.name;
  if(entry.isDirectory()){await enhance(path);continue;}
  if(!entry.name.endsWith('.html')||entry.name.startsWith('google'))continue;
  let html=await read(path);
  if(!html.includes('</head>'))continue;
  html=html.replace(/\/assets\/(styles\.css|mobile\.css|app\.js|detail\.js|catalog-static\.js|gear-check\.js)(\?[^"']*)?/g,'/assets/$1?v=discovery-2');
  if(!html.includes('/assets/mobile.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/mobile.css?v=discovery-2"></head>');
  const title=html.match(/<title>(.*?)<\/title>/)?.[1];
  const desc=html.match(/name="description" content="([^"]*)"/)?.[1];
  const canonical=html.match(/rel="canonical" href="([^"]*)"/)?.[1];
  for(const [key,value] of [['og:title',title],['og:description',desc],['og:url',canonical]])if(value&&!html.includes(`property="${key}"`))html=html.replace('</head>',`<meta property="${key}" content="${value}"></head>`);
  if(!html.includes('name="twitter:card"'))html=html.replace('</head>','<meta name="twitter:card" content="summary"></head>');
  await save(path,html);
 }
}
await enhance();
