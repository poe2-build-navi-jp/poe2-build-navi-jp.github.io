import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {FOOTER,ICON_BLOCK} from './site-chrome.mjs';
const root=resolve(import.meta.dirname,'..');
const read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const entities=await read('data/core-entities.json'),builds=await read('data/builds.json'),site=await read('data/site.json');
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const path=e=>`/${e.kind==='skill'?'skills':'equipment'}/${e.slug}/`;
const image='/images/poe2/og/poe2-beginner-guide-og.webp';
const head=(title,description,url,schema)=>`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${url}"><meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${site.baseUrl}${image}"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/mobile.css"><link rel="stylesheet" href="/assets/strategy-articles.css">${ICON_BLOCK}<script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script></head><body><a class="skip-link" href="#main">本文へ移動</a><header class="site-header"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">P2</span><span>POE2<br>ビルドナビ</span></a><nav class="site-nav page-nav" aria-label="メインメニュー"><a href="/guides/">攻略ガイド</a><a href="/builds/">ビルド</a><a href="/leveling/">レベリング</a><a href="/search/">全体検索</a></nav></header><main id="main" class="page-main">`;
const crumb=(name,url,parentName,parentUrl)=>({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{name:'ホーム',item:site.baseUrl+'/'},{name:parentName,item:site.baseUrl+parentUrl},{name,item:url}].map((x,i)=>({'@type':'ListItem',position:i+1,...x}))});
for(const e of entities){
 if(!/^[a-z0-9-]+$/.test(e.slug)||!['skill','equipment'].includes(e.kind)||!e.sources?.length)throw Error('Invalid entity '+e.slug);
 const type=e.kind==='skill'?'スキル':'装備',parent=e.kind==='skill'?'/skills/':'/equipment/',url=site.baseUrl+path(e);
 const title=`PoE2 ${e.name}｜効果・必要条件・入手方法と採用ビルド`;
 const text=v=>esc(v).replace(/\[source:(\d+)\]/g,(_,n)=>{if(!e.sources[n-1])throw Error('Source '+e.slug);return `<sup><a href="#source-${n}" aria-label="資料${n}">[${n}]</a></sup>`});
 const selected=e.buildIds.map(id=>{const b=builds.find(b=>b.id===id&&b.status!=='draft');if(!b)throw Error('Build '+id);return b});
 const date=e.sources.map(s=>s.checkedAt).sort().at(-1);
 const schema=[{'@context':'https://schema.org','@type':'Article',headline:title,description:e.summary,inLanguage:'ja',mainEntityOfPage:url,image:site.baseUrl+image,datePublished:date,dateModified:date,author:{'@type':'Organization',name:site.operatorName,url:site.baseUrl+'/about/'},publisher:{'@type':'Organization',name:site.siteName,url:site.baseUrl+'/'}},crumb(e.name,url,type+'一覧',parent)];
 const sections=[['effect','効果・役割'],['requirements','使うための条件'],['acquisition','入手方法'],['cautions','採用前の注意']];
 let html=head(title,e.summary,url,schema)+`<nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li><a href="${parent}">${type}一覧</a></li><li>${esc(e.name)}</li></ol></nav><article class="article-page strategy-article"><h1>${esc(title)}</h1><p class="lead">${esc(e.summary)}</p><p>英語名：${esc(e.englishName)}${e.aliases?.length?` ／ 別名：${e.aliases.map(esc).join('・')}`:''}</p><p>資料確認 <time datetime="${date}">${date}</time> · <a href="#sources">確認範囲と出典</a></p><nav class="guide-toc" aria-label="この記事の目次"><ul>${sections.map(([id,label])=>`<li><a href="#${id}">${label}</a></li>`).join('')}<li><a href="#builds">採用ビルド</a></li></ul></nav>`;
 html+=sections.map(([id,label])=>`<section id="${id}" class="strategy-section"><h2>${label}</h2><ul>${e[id].map(v=>`<li>${text(v)}</li>`).join('')}</ul></section>`).join('');
 html+=`<section id="builds"><h2>掲載ビルドでの採用</h2><p>候補装備や途中の育成用スキルを含みます。全段階の必須品という意味ではありません。ビルド記事の現在Lvと切替条件を確認してください。</p><ul>${selected.map(b=>`<li><a href="/builds/${b.classSlug}/${b.slug}/">${esc(b.name)}</a>：<a href="/builds/${b.classSlug}/${b.slug}/#roadmap">現在Lvの育成手順</a></li>`).join('')}</ul></section><section id="sources" class="sources"><h2>出典・確認した範囲</h2><p>仕様は各資料の確認範囲に基づきます。数値や要求値がジェムレベル・アイテム個体で変わる場合は、実物の表示を優先してください。購入価格や入手を保証するものではありません。</p><ol>${e.sources.map((s,i)=>`<li id="source-${i+1}"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">資料${i+1}：${esc(s.name)}</a>（確認 ${esc(s.checkedAt)}）<p>${esc(s.supports)}</p></li>`).join('')}</ol></section><aside class="next-box"><h2>次に確認する</h2><div class="related-links"><a href="${parent}">${type}一覧</a><a href="/search/">名前から全体検索</a><a href="/guides/${e.kind==='skill'?'skill-gems':'budget-gear-crafting'}/">${e.kind==='skill'?'スキルジェムの基本':'装備の買い方・作り方'}</a></div></aside></article></main>${FOOTER}</body></html>`;
 await mkdir(resolve(root,path(e).slice(1)),{recursive:true});await writeFile(resolve(root,path(e).slice(1),'index.html'),html);
}
for(const kind of ['skill','equipment']){
 const name=kind==='skill'?'スキル':'装備',url=site.baseUrl+`/${kind==='skill'?'skills':'equipment'}/`,items=entities.filter(e=>e.kind===kind),title=`PoE2 ${name}一覧｜掲載ビルドで使う効果・条件・入手方法`;
 const schema=[{'@context':'https://schema.org','@type':'CollectionPage',name:title,url,mainEntity:{'@type':'ItemList',itemListElement:items.map((e,i)=>({'@type':'ListItem',position:i+1,name:e.name,url:site.baseUrl+path(e)}))}}];
 const html=head(title,`掲載ビルドで使う${name}を確認。効果、必要条件、入手方法から採用ビルドへ進めます。`,url,schema)+`<nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li>${name}一覧</li></ol></nav><article class="article-page"><h1>${title}</h1><p>掲載ビルドに登場する${name}から、確認できた${items.length}件を掲載しています。全${name}のデータベースではありません。</p><ul>${items.map(e=>`<li><h2><a href="${path(e)}">${esc(e.name)}（${esc(e.englishName)}）</a></h2><p>${esc(e.summary)}</p></li>`).join('')}</ul><p><a href="/search/">攻略・ビルドもまとめて探す</a> · <a href="/name-index/">ボス・クエスト・NPCの名前索引</a></p></article></main>${FOOTER}</body></html>`;
 await mkdir(resolve(root,kind==='skill'?'skills':'equipment'),{recursive:true});await writeFile(resolve(root,kind==='skill'?'skills':'equipment','index.html'),html);
}
// Add reciprocal, compact references without changing the build's current-level navigation.
for(const b of builds.filter(b=>b.status!=='draft')){
 const relevant=entities.filter(e=>e.buildIds.includes(b.id));if(!relevant.length)continue;
 const file=resolve(root,`builds/${b.classSlug}/${b.slug}/index.html`);let html=await readFile(file,'utf8');
 html=html.replace(/<!-- entity-links:start -->[\s\S]*?<!-- entity-links:end -->/g,'');
 const block=`<!-- entity-links:start --><section class="content-section" id="skill-equipment-reference"><h2>スキル・装備の効果と入手方法</h2><ul>${relevant.map(e=>`<li><a href="${path(e)}">${esc(e.name)}（${esc(e.englishName)}）</a></li>`).join('')}</ul></section><!-- entity-links:end -->`;
 html=html.replace('</main>',block+'</main>');await writeFile(file,html);
}
console.log(`Generated ${entities.length} skill/equipment references and two indexes.`);
for(const [slug,label,href] of [['skill-gems','掲載ビルドの主要スキルを調べる','/skills/'],['equipment-basics','掲載ビルドの装備を調べる','/equipment/']]){
 const file=resolve(root,`guides/${slug}/index.html`);let html=await readFile(file,'utf8');html=html.replace(/<!-- entity-reference:start -->[\s\S]*?<!-- entity-reference:end -->/g,'');const block=`<!-- entity-reference:start --><p><a href="${href}">${label}：効果・条件・入手方法</a></p><!-- entity-reference:end -->`;html=html.replace('</article>',block+'</article>');await writeFile(file,html);
}
