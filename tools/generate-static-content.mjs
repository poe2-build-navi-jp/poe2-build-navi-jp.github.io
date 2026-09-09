import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const save=(p,t)=>writeFile(resolve(root,p),t);
const builds=JSON.parse(await read('data/builds.json')), classes=JSON.parse(await read('data/classes.json'));
const esc=v=>String(v??'確認中').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const url=b=>`/builds/${b.classSlug}/${b.slug}/`;
const list=vs=>vs.map(v=>`<li>${esc(v)}</li>`).join('');
const cards=builds.map(b=>`<article class="catalog-card" data-class="${esc(b.className)}"><div><p>${esc(b.className)} / ${esc(b.ascendancy)}</p><h2>${esc(b.name)}</h2><p>主力：${esc(b.mainSkill)}</p></div><div class="catalog-fit"><strong>${esc(b.audience)}</strong><p>特徴：${esc(b.strengths[0])}</p><p>弱点：${esc(b.weaknesses[0])}</p></div><p>操作：${esc(b.difficulty)}<br>予算：${esc(b.budget)}</p><a class="button" href="${url(b)}">Lv1から育てる</a></article>`).join('');
let catalog=await read('builds/index.html');
catalog=catalog.replace(/(<div id="build-list"[^>]*>)[\s\S]*?(<\/div><\/section><\/main>)/,`$1${cards}$2`).replaceAll('/assets/build-list.js','/assets/catalog-static.js').replaceAll('ビルド8選',`ビルド${builds.length}選`).replaceAll('各1件掲載','掲載').replaceAll('8職業を1件ずつ比較できる育成ナビ。','職業別に特徴と弱点を比較できる育成ナビ。').replace(/(<span id="result-count">).*?(<\/span>)/,`$1${builds.length}件$2`);
await save('builds/index.html',catalog);
const classCards=classes.map(c=>`<article class="class-card" data-class-slug="${c.slug}"><h3>${esc(c.name)}</h3><p class="class-tagline">${esc(c.tagline)}</p><p class="class-description">${esc(c.description)}</p><a class="button" href="/classes/${c.slug}/">この職業のビルドを見る</a></article>`).join('');
let home=await read('index.html');
home=home.replace(/(<div id="class-grid"[^>]*>)[\s\S]*?(<\/div><div class="class-helper">)/,`$1${classCards}$2`);
if(!home.includes('id="real-example"')){const b=builds[0];home=home.replace('</main>',`<section id="real-example" class="section"><h2>実際の案内例：Lv37</h2><p>${esc(b.name)}</p><ol>${list(b.levelingStages[3].nowActions)}</ol><a class="button" href="${url(b)}?level=37#now">この段階を見る</a></section></main>`);}
if(!home.includes('data-full-class-check'))home=home.replace('<div id="style-choices"','<a class="button" data-full-class-check href="/class-check/">4問の職業診断</a><div id="style-choices"');
await save('index.html',home);
await mkdir(resolve(root,'classes'),{recursive:true});
await save('classes/index.html',`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>POE2 職業一覧・育成ガイド</title><meta name="description" content="8職業の戦い方から育てるビルドを選びます。"><link rel="canonical" href="https://poe2-build-navi-jp.github.io/classes/"><link rel="stylesheet" href="/assets/styles.css?v=static-mobile-1"></head><body><main class="section section-dark"><a href="/">ホーム</a><h1>職業を選ぶ</h1><div class="class-card-grid">${classCards}</div></main></body></html>`);
for(const b of builds){
 let p=await read(`builds/${b.classSlug}/${b.slug}/index.html`);
 let actionIndex=0;
 p=p.replace(/(<span data-now-action>).*?(<\/span>)/g,(_,a,z)=>a+esc(b.levelingStages[0].nowActions[actionIndex++])+z);
 p=p.replace(/(<div id="fact-grid"[^>]*>).*?(<\/div>)/,`$1<div class="fact">対応パッチ：${esc(b.version)}</div><div class="fact">資料確認日：${esc(b.updatedAt)}</div>$2`);
 p=p.replace('一般的な確認項目（ビルド固有データ確認中）','掲載資料から整理した優先行動');
 p=p.replace(/(<ul id="strength-list"[^>]*>).*?(<\/ul>)/,`$1${list(b.strengths)}$2`).replace(/(<ul id="weakness-list"[^>]*>).*?(<\/ul>)/,`$1${list(b.weaknesses)}$2`);
 if(!p.includes('id="static-roadmap"'))p=p.replace('<section id="roadmap"',`<section id="static-roadmap"><h2>全8段階の育成手順</h2><p>対応パッチ ${esc(b.version)}・資料確認日 ${esc(b.updatedAt)}。固有名が未登録の項目は参考資料で確認してください。</p>${b.levelingStages.map(s=>`<details><summary>${esc(s.label)}</summary><ol>${list(s.nowActions)}</ol><dl>${[['主力',s.mainSkill],['サポート',s.supports],['パッシブ',s.passivePriority],['優先装備・能力',s.gearPriority],['交換候補',s.replaceGear],['注意点',s.caution],['移行条件',s.transitionCondition]].map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details>`).join('')}<h3>参考資料</h3><ul>${b.sources.map(s=>`<li><a href="${esc(s.url)}">${esc(s.name)}</a>・${esc(s.checkedAt)}</li>`).join('')}</ul><a href="/editorial-policy/">編集方針</a></section><section id="roadmap"`);
 await save(`builds/${b.classSlug}/${b.slug}/index.html`,p);
}
console.log(`Static content: ${builds.length} builds, ${classes.length} classes`);
async function enhance(dir=''){
 for(const entry of await readdir(resolve(root,dir),{withFileTypes:true})){
  if(entry.name.startsWith('.')||['_next','company','node_modules','tests','tools','scripts'].includes(entry.name))continue;
  const path=dir?`${dir}/${entry.name}`:entry.name;
  if(entry.isDirectory()){await enhance(path);continue;}
  if(!entry.name.endsWith('.html')||entry.name.startsWith('google'))continue;
  let html=await read(path);
  if(!html.includes('</head>'))continue;
  html=html.replace(/\/assets\/(styles\.css|app\.js|detail\.js|catalog-static\.js)(\?[^"']*)?/g,'/assets/$1?v=static-mobile-1');
  if(!html.includes('/assets/mobile.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/mobile.css?v=static-mobile-1"></head>');
  const title=html.match(/<title>(.*?)<\/title>/)?.[1];
  const desc=html.match(/name="description" content="([^"]*)"/)?.[1];
  const canonical=html.match(/rel="canonical" href="([^"]*)"/)?.[1];
  for(const [key,value] of [['og:title',title],['og:description',desc],['og:url',canonical]])if(value&&!html.includes(`property="${key}"`))html=html.replace('</head>',`<meta property="${key}" content="${value}"></head>`);
  if(!html.includes('name="twitter:card"'))html=html.replace('</head>','<meta name="twitter:card" content="summary"></head>');
  await save(path,html);
 }
}
await enhance();
