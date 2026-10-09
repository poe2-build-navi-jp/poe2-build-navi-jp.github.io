// Generated from shared editorial data. Run after article generators.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {FOOTER,ICON_BLOCK} from './site-chrome.mjs';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const save=(p,s)=>writeFile(resolve(root,p),s);
const [site,guides,pages]=await Promise.all(['site','guides','seo-pages'].map(async n=>JSON.parse(await read(`data/${n}.json`))));
const intents=JSON.parse(await read('data/guide-search-intents.json'));
let extra=[];
try {const data=JSON.parse(await read('data/strategy-guides.json'));extra=Array.isArray(data)?data:data.guides;if(!Array.isArray(extra))throw new Error('strategy-guides must contain a guides array');} catch(e){if(e.code!=='ENOENT')throw e;}
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const base=site.baseUrl;
const groups=[
 {id:'problems',label:'困りごと',title:'困りごとを解決する',intro:'いま止まっている理由から、確認する順番を探します。',slugs:['why-i-die','increase-damage','mana-problem','cant-beat-boss','slow-mapping','gear-upgrade']},
 {id:'basics',label:'スキル・装備',title:'スキル・装備の基本',intro:'ジェム・パッシブ・装備の条件を整理します。',slugs:['skill-gems','support-gems','passive-tree','equipment-basics','resistance']},
 {id:'campaign',label:'キャンペーン',title:'キャンペーンの進め方',intro:'進行の区切りと、先へ進む前の確認ポイント。',slugs:[]},
 {id:'trials',label:'試練・転職',title:'試練の進め方',intro:'挑戦前の準備と、報酬条件を確認します。',slugs:[]},
 {id:'crafting',label:'通貨・クラフト',title:'通貨と装備づくり',intro:'素材を使う前に、装備更新の目的を決めます。',slugs:[]},
 {id:'progress',label:'エンドゲーム',title:'キャンペーン後・エンドゲーム',intro:'Mappingの準備から、個別コンテンツの入口へ。',slugs:['after-campaign','mapping']},
 {id:'updates',label:'更新・パッチ',title:'アップデートを確認する',intro:'公式の変更内容と、自分のビルドへの影響を分けて読みます。',slugs:[]}
];
const defaults={'campaign-progression':'campaign','trial-of-chaos':'trials','atlas-progression':'progress','waystones-tablets':'progress','campaign-route':'campaign','ascendancy-trials':'trials','currency-crafting':'crafting','atlas-waystones':'progress','expedition':'progress','patch-notes-guide':'updates'};
const seen=new Set(groups.flatMap(g=>g.slugs));
for(const g of extra){if(!g.slug||seen.has(g.slug))continue;const id=defaults[g.slug]||({endgame:'progress'}[g.category]||g.category);const group=groups.find(x=>x.id===id)||groups.find(x=>x.id==='basics');group.slugs.push(g.slug);seen.add(g.slug);}
const activeGroups=groups.filter(g=>g.slugs.length).sort((a,b)=>(a.id==='campaign'?-1:b.id==='campaign'?1:0));
const campaign=activeGroups.find(g=>g.id==='campaign');
if(campaign){const order=['act-1-walkthrough','act-2-walkthrough','act-3-walkthrough'];campaign.slugs.sort((a,b)=>(order.includes(a)?order.indexOf(a):99)-(order.includes(b)?order.indexOf(b):99));}
const entry=slug=>{
 const path=`/guides/${slug}/`,g=extra.find(x=>x.slug===slug)||guides.find(x=>x.slug===slug),p=pages.find(x=>x.path===path);
 if(!g&&!p)throw new Error(`Guide missing from shared data: ${path}`);
 const intent=intents.find(i=>i.path===path);
 return {path,title:intent?.h1?.replace(/^PoE2\s*/, '')||g?.title||p.h1,summary:intent?.description||g?.summary||p?.description,keywords:[...(g?.keywords||[]),...(intent?.searchExamples||[])]};
};
const total=seen.size;
const sections=activeGroups.map((group,index)=>`<section class="guide-group" id="${group.id}" data-guide-group="${group.id}" aria-labelledby="${group.id}-title"><div class="guide-section-heading"><div><p class="guide-eyebrow">${String(index+1).padStart(2,'0')} / ${esc(group.label)}</p><h2 id="${group.id}-title">${group.title}</h2><p>${group.intro}</p></div><span class="guide-section-count" data-group-count>${group.slugs.length}記事</span></div><div class="content-grid">${group.slugs.map(slug=>{const g=entry(slug);return `<a class="content-card" href="${g.path}" data-guide-card data-category="${group.id}" data-search="${esc([g.title,g.summary,group.label,...(Array.isArray(g.keywords)?g.keywords:[g.keywords])].join(' '))}"><small>${esc(group.label)}</small><strong>${esc(g.title)}</strong><span>${esc(g.summary)}</span><span class="guide-card-action" aria-hidden="true">攻略を読む <b>→</b></span></a>`;}).join('')}</div></section>`).join('');
const title='PoE2攻略ガイド｜キャンペーン・試練・装備・エンドゲーム';
const description='PoE2の日本語攻略ガイド。キャンペーン、試練、エンドゲームと育成中の困りごとから記事を探せます。記事検索とカテゴリで必要な攻略へ。';
const image=`${base}/images/poe2/og/poe2-beginner-guide-og.webp`;
const schema=[{'@context':'https://schema.org','@type':'CollectionPage',name:title,description,url:`${base}/guides/`,inLanguage:'ja',image,mainEntity:{'@type':'ItemList',itemListElement:activeGroups.flatMap(x=>x.slugs).map((slug,i)=>({'@type':'ListItem',position:i+1,name:entry(slug).title,url:`${base}${entry(slug).path}`}))}},{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'ホーム',item:`${base}/`},{'@type':'ListItem',position:2,name:'攻略ガイド',item:`${base}/guides/`}]}];
const header='<header class="site-header"><a class="brand" href="/" aria-label="POE2ビルドナビ ホーム"><span class="brand-mark" aria-hidden="true">P2</span><span>POE2<br>ビルドナビ</span></a><nav class="site-nav page-nav" aria-label="メインメニュー"><a href="/guides/" aria-current="page">攻略ガイド</a><a href="/beginner-builds/">初心者おすすめ</a><a href="/builds/">ビルド</a><a href="/leveling/">レベリング</a><a href="/beginner-guide/">初心者ガイド</a></nav></header>';
const route=slug=>seen.has(slug)?entry(slug).path:'/beginner-guide/';
const roadmap=[['01','始める','職業とビルドを決める','/beginner-guide/'],['02','育てる','キャンペーンを進める',route(seen.has('act-1-walkthrough')?'act-1-walkthrough':seen.has('campaign-progression')?'campaign-progression':'campaign-route')],['03','整える','試練・装備を確認する',route(seen.has('trial-of-chaos')?'trial-of-chaos':'ascendancy-trials')],['04','広げる','エンドゲームへ進む','/guides/after-campaign/']];
const actLinks=[['act-1-walkthrough','Act1'],['act-2-walkthrough','Act2'],['act-3-walkthrough','Act3']].filter(([slug])=>seen.has(slug));
const featured=actLinks.length?`<div class="guide-featured"><span>CAMPAIGN</span><div>${actLinks.map(([slug,label])=>`<a href="/guides/${slug}/">${label}攻略 →</a>`).join(' ／ ')}</div></div>`:'';
const patch=site.latestPatch?`<p class="guide-patch"><span class="guide-status-dot" aria-hidden="true"></span><b>公式パッチ ${esc(site.latestPatch)}</b><span>資料確認：${esc(site.latestPatchCheckedAt||'未記載')}</span>${site.latestPatchSource?`<a href="${esc(site.latestPatchSource)}" target="_blank" rel="noopener noreferrer">公式情報 ↗<span class="guide-sr-only">（新しいタブ）</span></a>`:''}</p>`:'';
await mkdir(resolve(root,'guides'),{recursive:true});
await save('guides/index.html',`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${description}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="google-adsense-account" content="ca-pub-7738997902416481"><link rel="canonical" href="${base}/guides/"><meta property="og:type" content="website"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="${esc(site.siteName)}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${base}/guides/"><meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="PoE2初心者向けビルド・育成ガイド"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/mobile.css"><link rel="stylesheet" href="/assets/guide-hub.css">${ICON_BLOCK}<script defer src="/assets/guide-hub.js"></script><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7738997902416481" crossorigin="anonymous"></script><script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script></head><body class="guide-hub"><a class="skip-link" href="#main">本文へ移動</a>${header}<main id="main" class="page-main"><nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li>攻略ガイド</li></ol></nav><article class="article-page wide-article"><header class="guide-hero"><div><p class="section-kicker">PATH OF EXILE 2 / GUIDE INDEX</p><h1>PoE2攻略ガイド</h1><p class="lead">いま知りたい攻略へ、<br class="guide-mobile-break">迷わず進もう。</p><p class="guide-hero-description">キャンペーン・試練・エンドゲームの進め方と、育成の疑問を確認。</p></div><a class="guide-level-entry" href="/leveling/"><span>育成中の人はこちら</span><strong>今のLvでやること <b aria-hidden="true">↗</b></strong><small>職業・ビルド・現在Lvから確認</small></a></header>${patch}${featured}<details class="guide-roadmap"><summary><span id="roadmap-title">はじめての攻略ルート</span><span class="guide-roadmap-hint">4つのステップを見る</span></summary><ol>${roadmap.map(([n,label,desc,url])=>`<li><a href="${url}"><span>${n}</span><div><strong>${label}</strong><small>${desc}</small></div><b aria-hidden="true">→</b></a></li>`).join('')}</ol></details><section class="guide-directory" aria-labelledby="directory-title"><div class="guide-directory-title"><h2 id="directory-title">攻略記事を探す</h2><span>${total}記事</span></div><div class="guide-filter-panel" data-guide-controls hidden><label for="guide-search">キーワードで検索</label><div class="guide-search-row"><input type="search" id="guide-search" placeholder="例：ボス、耐性、ジェム" autocomplete="off" aria-controls="guide-results"><button type="button" data-guide-reset>リセット</button></div><div class="guide-chips" role="group" aria-label="記事のカテゴリで絞り込む"><button type="button" data-filter="all" aria-pressed="true">すべて <span>${total}</span></button>${activeGroups.map(g=>`<button type="button" data-filter="${g.id}" aria-pressed="false">${g.label} <span>${g.slugs.length}</span></button>`).join('')}</div><p class="guide-result-status" role="status" aria-live="polite" aria-atomic="true" data-guide-status>${total}件の記事を表示</p></div><nav class="guide-category-nav" aria-label="攻略カテゴリ">${activeGroups.map(g=>`<a href="#${g.id}">${g.label}<span aria-hidden="true">↓</span></a>`).join('')}</nav><noscript><p class="guide-no-script">カテゴリのリンクから移動できます。すべての記事を下に掲載しています。</p></noscript><div id="guide-results">${sections}</div><div class="guide-empty" data-guide-empty hidden><h3>一致する記事がありません</h3><p>短い言葉に変えるか、カテゴリの絞り込みを解除してください。</p><button type="button" data-guide-reset>すべての記事に戻す</button></div></section><aside class="guide-bottom"><div><p class="guide-eyebrow">NEXT STEP</p><h2>攻略を読んだら、自分のビルドへ。</h2><p>確認したことを、スキル・装備・パッシブの育成手順に当てはめましょう。</p></div><div><a class="button" href="/leveling/">現在Lvから今やることを見る</a><a class="button button-ghost" href="/builds/">使っているビルドを探す</a></div></aside><details class="guide-sources"><summary>掲載環境・情報源について</summary><p>掲載環境：${esc(site.siteVersion)}。各攻略の仕様・情報源・確認日は、リンク先の記事で確認してください。一覧の更新日を全記事の再検証日として扱いません。</p>${site.latestPatchImpact?`<p>${esc(site.latestPatchImpact)}</p>`:''}<p><a href="/editorial-policy/">編集方針・情報の確認方法</a> / <a href="/poe2-1-0/">正式リリースの情報</a></p></details></article></main>${FOOTER}</body></html>`);
// Small contextual entrances. Re-running after page generation restores them without duplicates.
const marker=/<!-- strategy-link:start -->[\s\S]*?<!-- strategy-link:end -->/g;
const wrap=html=>`<!-- strategy-link:start -->${html}<!-- strategy-link:end -->`;
let home=await read('index.html');
const homeLink=wrap('<p class="hero-intro"><a class="button-secondary" href="/guides/">PoE2攻略ガイドを見る</a><br>火力不足・すぐ死ぬ・装備・Mappingのガイドはこちら。</p>');
// Preserve the existing entrance location, including the mobile progressive-disclosure layout.
if(home.includes('<!-- strategy-link:start -->')) home=home.replace(marker,()=>homeLink);
else {
 const anchor=/<div class="hero-actions"[^>]*>[\s\S]*?<\/div>/;
 if(!anchor.test(home))throw new Error('Homepage hero actions changed');
 home=home.replace(anchor,actions=>`${actions}${homeLink}`);
}
await save('index.html',home);
for(const file of ['beginner-guide/index.html',...groups.flatMap(x=>x.slugs).map(slug=>`guides/${slug}/index.html`)]){
 let html=(await read(file)).replace(marker,'');
 const link=wrap('<p class="trouble-guides"><a href="/guides/">困りごと・育成段階から攻略を探す</a></p>');
 if(file==='beginner-guide/index.html')html=html.replace('<h1>PoE2初心者向けおすすめビルド・育成ガイド</h1>',`<h1>PoE2初心者向けおすすめビルド・育成ガイド</h1>${link}`);
 else {const end=html.lastIndexOf('</article>');if(end<0)throw new Error(`Article missing: ${file}`);html=html.slice(0,end)+link+html.slice(end);}
 await save(file,html);
}
console.log('Generated /guides/ and contextual links; existing guide content and build navigation preserved.');
