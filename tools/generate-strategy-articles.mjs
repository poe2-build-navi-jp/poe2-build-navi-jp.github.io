// Source-backed strategy articles, intentionally separate from the nine beginner chapters.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {FOOTER,ICON_BLOCK} from './site-chrome.mjs';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const guides=JSON.parse(await read('data/strategy-guides.json'));
const site=JSON.parse(await read('data/site.json'));
const builds=JSON.parse(await read('data/builds.json'));
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const refs=(section,guide)=>(section.sourceRefs||[]).length?`<p class="guide-evidence">根拠：${section.sourceRefs.map(n=>{if(!guide.sources[n-1])throw Error(`${guide.slug}: missing source ${n}`);return `<a href="#source-${n}">資料${n}</a>`;}).join('・')}</p>`:'';
const text=s=>esc(s).replace(/\[source:(\d+)\]/g,(_,n)=>`<sup><a href="#source-${n}" aria-label="資料${n}">[${n}]</a></sup>`);
const gearSummary=(section,guide)=>section.gearSummary?`<ul class="unique-gear-summary">${guide.sections.filter(s=>s.buildId).map(s=>`<li><h3><a href="#${esc(s.id)}">${esc(s.heading.replace('のおすすめユニーク装備',''))}</a></h3><p class="unique-summary-names">代表候補：${s.gearOptions.slice(0,2).map(o=>esc(o.nameJa||o.name)).join(' / ')}</p><p>${text(s.quickAnswer)}</p>${refs(s,guide)}</li>`).join('')}</ul>`:'';
const gearHtml=(section,guide)=>(section.gearOptions||[]).map(option=>{
 for(const key of ['name','slot','phase','purpose','conditions','tradeoff','rareAlternative','basis'])if(!option[key]?.trim())throw Error(`${guide.slug}: incomplete gear option ${key}`);
 if(!option.sourceRefs?.length)throw Error(`${guide.slug}: gear option needs sources`);
 const name=option.nameJa?`${esc(option.nameJa)}<span class="unique-gear-name-en" lang="en">${esc(option.name)}</span>`:esc(option.name);
 return `<article class="unique-gear-card"><h3>${name}</h3><p class="unique-gear-context">${esc(option.slot)} / ${esc(option.phase)}</p><p class="unique-gear-basis">${esc(option.basis)}</p><dl>${[['用途',option.purpose],['採用条件',option.conditions],['弱点・交換で失うもの',option.tradeoff],['レア装備などの代替',option.rareAlternative]].map(([label,value])=>`<div><dt>${label}</dt><dd>${text(value)}</dd></div>`).join('')}</dl>${refs(option,guide)}</article>`;
}).join('');
const buildReturn=section=>{
 if(!section.buildId)return '';
 const b=builds.find(b=>b.id===section.buildId);if(!b)throw Error(`Unknown gear build: ${section.buildId}`);
 return `<p><a class="button-secondary" href="/builds/${esc(b.classSlug)}/${esc(b.slug)}/#level-card">${esc(b.name)}の現在Lv・育成手順へ</a></p>`;
};
const nav='<header class="site-header"><a class="brand" href="/" aria-label="POE2ビルドナビ ホーム"><span class="brand-mark" aria-hidden="true">P2</span><span>POE2<br>ビルドナビ</span></a><nav class="site-nav page-nav" aria-label="メインメニュー"><a href="/guides/">攻略ガイド</a><a href="/beginner-builds/">初心者おすすめ</a><a href="/builds/">ビルド</a><a href="/leveling/">レベリング</a><a href="/beginner-guide/">初心者ガイド</a></nav></header>';
for(const g of guides){
 if(!/^[a-z0-9-]+$/.test(g.slug)||g.actions.length!==3||g.sections.length<4||!g.sources.length)throw Error(`Incomplete article: ${g.slug}`);
 const url=`${site.baseUrl}/guides/${g.slug}/`,image=`${site.baseUrl}${g.ogImage||'/images/poe2/og/poe2-beginner-guide-og.webp'}`;
 const date=g.checkedAt||g.sources.map(s=>s.checkedAt).sort().at(-1);
 const schema=[{'@context':'https://schema.org','@type':'Article',headline:g.title,description:g.summary,inLanguage:'ja',datePublished:g.publishedAt||date,dateModified:g.updatedAt||date,mainEntityOfPage:url,image,author:{'@type':'Organization',name:site.operatorName,url:`${site.baseUrl}/about/`},publisher:{'@type':'Organization',name:site.siteName,url:`${site.baseUrl}/`}}, {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'ホーム',item:`${site.baseUrl}/`},{'@type':'ListItem',position:2,name:'攻略ガイド',item:`${site.baseUrl}/guides/`},{'@type':'ListItem',position:3,name:g.title,item:url}]}];
 if(g.structuredCitations)Object.assign(schema[0],{citation:[...new Set(g.sources.map(source=>source.url))],about:{'@type':'VideoGame',name:'Path of Exile 2'},keywords:g.keywords.join(', ')});
 const sections=g.sections.map((s,i)=>`<section id="${esc(s.id||`section-${i+1}`)}" class="strategy-section"><h2>${esc(s.heading)}</h2>${(s.paragraphs||[]).map(p=>`<p>${text(p)}</p>`).join('')}${s.bullets?.length?`<ul>${s.bullets.map(b=>`<li>${text(b)}</li>`).join('')}</ul>`:''}${s.steps?.length?`<ol>${s.steps.map(b=>`<li>${text(b)}</li>`).join('')}</ol>`:''}${gearSummary(s,g)}${gearHtml(s,g)}${refs(s,g)}${buildReturn(s)}</section>`).join('');
 const related=g.related||[];
 const tocList=`<ol>${g.sections.map((s,i)=>`<li><a href="#${esc(s.id||`section-${i+1}`)}">${esc(s.heading)}</a></li>`).join('')}</ol>`;
 const toc=g.sections.length>8?`<details class="guide-toc"><summary>${esc(g.tocLabel||'目次を開く：進行ルート・ボス対策')}</summary><nav aria-label="この記事の目次">${tocList}</nav></details>`:`<nav class="guide-toc" aria-label="この記事の目次"><h2>この記事で分かること</h2>${tocList}</nav>`;

 const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PoE2 ${esc(g.title)}｜攻略ガイド</title><meta name="description" content="${esc(g.metaDescription||g.summary)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="google-adsense-account" content="ca-pub-7738997902416481"><link rel="canonical" href="${url}"><meta property="og:type" content="article"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="${esc(site.siteName)}"><meta property="og:title" content="PoE2 ${esc(g.title)}"><meta property="og:description" content="${esc(g.summary)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="PoE2攻略・育成ガイド"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/mobile.css"><link rel="stylesheet" href="/assets/strategy-articles.css">${g.sections.some(s=>s.gearOptions?.length)?'<link rel="stylesheet" href="/assets/unique-gear.css">':''}${ICON_BLOCK}<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7738997902416481" crossorigin="anonymous"></script><script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script></head><body><a class="skip-link" href="#main">本文へ移動</a>${nav}<main id="main" class="page-main"><nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li><a href="/guides/">攻略ガイド</a></li><li>${esc(g.title)}</li></ol></nav><article class="article-page strategy-article"><p class="section-kicker">POE2 / STRATEGY GUIDE</p><h1>${esc(g.title)}</h1><p class="lead">${esc(g.summary)}</p><div class="guide-meta"><span>対象：${esc(g.version||'0.5.5')}</span><span>資料確認 <time datetime="${date}">${date}</time></span><a href="#sources">出典・確認範囲</a></div><section class="content-action"><h2>まずやること3つ</h2><ol>${g.actions.map((a,i)=>`<li><b>${i+1}</b><span>${esc(a)}</span></li>`).join('')}</ol></section>${g.showEditorialNote?`<p class="unique-gear-editorial">編集：<a href="/about/">${esc(site.operatorName)}</a>。装備・原典の照合日：${date}。<a href="/editorial-policy/">情報の確認方法</a>。原典採用品・原典の候補・効果から検討する候補を区別しています。</p>`:''}${toc}${g.intro?`<p>${esc(g.intro)}</p>`:''}${sections}${g.faq?.length?`<section class="guide-faq"><h2>よくある質問</h2>${g.faq.map(f=>`<details><summary>${esc(f.question)}</summary><p>${text(f.answer)}</p></details>`).join('')}</section>`:''}<section class="sources" id="sources"><h2>出典・確認した範囲</h2><p>${esc(g.scope||'公式パッチノートで確認できる仕様と、そこから整理した攻略上の確認手順を掲載しています。操作の提案は編集上の整理であり、実測した効率や報酬を保証するものではありません。')}</p><ol class="source-list">${g.sources.map((s,i)=>`<li id="source-${i+1}"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">資料${i+1}：${esc(s.name)}</a>${s.japaneseUrl?` <a href="${esc(s.japaneseUrl)}" target="_blank" rel="noopener noreferrer">日本語名を確認</a>`:''}<span>確認日 ${esc(s.checkedAt)}</span>${s.supports?`<p>${esc(s.supports)}</p>`:''}</li>`).join('')}</ol><p>Early Accessのため仕様変更があります。記載とゲーム内表示が異なる場合は、最新の公式告知とゲーム内表示を確認してください。</p></section><aside class="next-box"><h2>次に読む攻略</h2><div class="related-links">${related.map(l=>`<a href="${esc(l.href)}">${esc(l.label)}</a>`).join('')}</div><p><a class="button" href="/leveling/">現在Lvの育成へ戻る</a></p></aside></article></main>${FOOTER}</body></html>`;
 await mkdir(resolve(root,'guides',g.slug),{recursive:true});await writeFile(resolve(root,'guides',g.slug,'index.html'),html);
}
console.log(`Generated ${guides.length} source-backed strategy articles.`);
// Contextual routes from existing beginner/troubleshooting articles, with no rewritten facts.
const connections={
 'after-campaign':['interlude-walkthrough','endgame-contents','atlas-progression','waystones-tablets'],
 mapping:['endgame-contents','endgame-items','atlas-progression','waystones-tablets','expedition'],
 'cant-beat-boss':['pinnacle-bosses','campaign-progression','ascendancy-trials','trial-of-chaos'],
 'why-i-die':['trial-of-chaos','waystones-tablets'],
 'slow-mapping':['waystones-tablets','atlas-progression'],
 'equipment-basics':['budget-gear-crafting','expedition'],
 'gear-upgrade':['budget-gear-crafting']
};
for(const [slug,targets] of Object.entries(connections)){
 const file=`guides/${slug}/index.html`;let html=await read(file);
 const entries=targets.map(slug=>guides.find(g=>g.slug===slug)).filter(Boolean);
 if(!entries.length)continue;
 html=html.replace(/<!-- strategy-related:start -->[\s\S]*?<!-- strategy-related:end -->/g,'');
 const block=`<!-- strategy-related:start --><aside class="next-box"><h2>関連する実践攻略</h2><div class="related-links">${entries.map(g=>`<a href="/guides/${g.slug}/">${esc(g.title)}</a>`).join('')}</div></aside><!-- strategy-related:end -->`;
 const end=html.lastIndexOf('</article>');if(end<0)throw Error(`Missing article ${slug}`);
 html=html.slice(0,end)+block+html.slice(end);await writeFile(resolve(root,file),html);
}

// Restore one contextual route per existing build; leveling data and review dates stay untouched.
const gearGuide=guides.find(g=>g.slug==='unique-gear');
if(gearGuide)for(const section of gearGuide.sections.filter(s=>s.buildId)){
 const b=builds.find(b=>b.id===section.buildId),file=`builds/${b.classSlug}/${b.slug}/index.html`;
 let html=(await read(file)).replace(/<!-- unique-gear-route:start -->[\s\S]*?<!-- unique-gear-route:end -->/g,'');
 const heading=/<h2 id="build-guides-title">[\s\S]*?<\/h2>/;
 if(!heading.test(html))throw Error(`Missing gear guide placement: ${b.id}`);
 html=html.replace(heading,h=>`${h}<!-- unique-gear-route:start --><p><a href="/guides/unique-gear/#${esc(b.id)}">${esc(b.name)}のユニーク装備・採用条件を比較する</a></p><!-- unique-gear-route:end -->`);
 await writeFile(resolve(root,file),html);
}
