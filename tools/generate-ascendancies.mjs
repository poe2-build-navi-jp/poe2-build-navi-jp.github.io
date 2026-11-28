// Ascendancy hub (/ascendancies/) and one page per ascendancy, from data/ascendancies.json.
// Node names/effects are from PoE2DB's Japanese pages (unofficial game data); tiers from Maxroll and PathofExile.gg.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {FOOTER,ICON_BLOCK} from './site-chrome.mjs';
const root=resolve(import.meta.dirname,'..');
const read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const [data,builds,classes,site]=await Promise.all(['data/ascendancies.json','data/builds.json','data/classes.json','data/site.json'].map(read));
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const image='/images/poe2/og/poe2-beginner-guide-og.webp';
// The version the tiers and nodes were checked for (not the live game version): after 1.0 the titles must not claim 1.0 data.
const version=data.version;
if(!version)throw Error('data/ascendancies.json: version missing');
const checked=data.checkedAt;
const head=(title,description,url,schema)=>`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${url}"><meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${site.baseUrl}${image}"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/mobile.css"><link rel="stylesheet" href="/assets/strategy-articles.css">${ICON_BLOCK}<script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script></head><body><a class="skip-link" href="#main">本文へ移動</a><header class="site-header"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">P2</span><span>POE2<br>ビルドナビ</span></a><nav class="site-nav page-nav" aria-label="メインメニュー"><a href="/guides/">攻略ガイド</a><a href="/builds/">ビルド</a><a href="/leveling/">レベリング</a><a href="/search/">全体検索</a></nav></header><main id="main" class="page-main">`;
const crumbs=items=>({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:items.map(([name,item],i)=>({'@type':'ListItem',position:i+1,name,item}))});
const TIERS=['S','A','B','C','D'];
const list=data.ascendancies;
if(list.length!==22)throw Error('Expected 22 ascendancies');
for(const a of list){
 if(!/^[a-z0-9-]+$/.test(a.slug)||a.nodes.length<6||!TIERS.includes(a.maxrollTier)||!TIERS.includes(a.pathofexileggTier))throw Error('Invalid ascendancy '+a.slug);
 if(!classes.some(c=>c.slug===a.classSlug))throw Error('Unknown class '+a.classSlug);
 for(const id of a.siteBuildIds)if(!builds.some(b=>b.id===id&&b.status==='verified'))throw Error('Build '+id);
}
const label=a=>a.alias?`${a.name}（${a.alias}）`:a.name;
const path=a=>`/ascendancies/${a.slug}/`;
const siteBuilds=a=>a.siteBuildIds.map(id=>builds.find(b=>b.id===id));
const buildLink=b=>`<a href="/builds/${b.classSlug}/${b.slug}/">${esc(b.name)}</a>`;
const sources=a=>[
 {name:`PoE2DB日本語版：${a.name}（${a.englishName}）のノード（非公式ゲームデータ）`,url:a.poe2db,supports:'日本語のノード名と効果の要約。'},
 {name:`Maxroll：League Starter Ascendancy Tier List（${version}）`,url:data.sources.maxrollAscendancy,supports:'リーグスタートでのアセンダンシー評価（S〜D）。'},
 {name:`Maxroll：League Starter Build Tier List（${version}、2026年11月3日更新）`,url:data.sources.maxrollBuilds,supports:'このアセンダンシーを使うビルドの評価。'},
 {name:'PathofExile.gg：Path of Exile 2 Class and Ascendancy Tier List（0.5、2026年6月22日）',url:data.sources.pathofexilegg,supports:'別サイトでのアセンダンシー評価（比較用）。'}
];
const en=v=>`<span class="name-en" lang="en">${esc(v)}</span>`;
const tierBadge=t=>`<b>${t}</b>`;

for(const a of list){
 const url=site.baseUrl+path(a);
 const cls=classes.find(c=>c.slug===a.classSlug);
 const own=siteBuilds(a);
 const siblings=list.filter(x=>x.classSlug===a.classSlug&&x.slug!==a.slug);
 const title=`PoE2 ${a.name}（${a.englishName}）｜特徴・主なノード・おすすめビルド（${version}）`;
 const description=`PoE2のアセンダンシー「${a.name}」（${cls.name}）の特徴と主なノード6つ、MaxrollのTier評価${a.maxrollTier}・PathofExile.ggの評価${a.pathofexileggTier}、このアセンダンシーを使うビルドをまとめています。`;
 const schema=[{'@context':'https://schema.org','@type':'Article',headline:title,description,inLanguage:'ja',mainEntityOfPage:url,image:site.baseUrl+image,datePublished:checked,dateModified:checked,author:{'@type':'Organization',name:site.operatorName,url:site.baseUrl+'/about/'},publisher:{'@type':'Organization',name:site.siteName,url:site.baseUrl+'/'}},crumbs([['ホーム',site.baseUrl+'/'],['アセンダンシー一覧',site.baseUrl+'/ascendancies/'],[a.name,url]])];
 const src=sources(a);
 const cite=n=>`<sup><a href="#source-${n}" aria-label="資料${n}">[${n}]</a></sup>`;
 const toc=[['overview','どんなアセンダンシーか'],['tier','Tier評価'],['nodes','主なノード'],['builds','おすすめビルド'],['acquire','取得方法と注意'],['sources','出典・確認した範囲']];
 const html=head(title,description,url,schema)+`<nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li><a href="/ascendancies/">アセンダンシー一覧</a></li><li>${esc(a.name)}</li></ol></nav><article class="article-page strategy-article"><h1>PoE2 ${esc(a.name)}（${en(a.englishName)}）｜特徴・主なノード・おすすめビルド（${version}）</h1><p class="lead">${esc(a.name)}は${esc(cls.name)}のアセンダンシー（上位職）です。${esc(a.theme)}</p><p>英語名：${en(a.englishName)}${a.alias?` ／ 別の表記：${esc(a.alias)}`:''} ／ 職業：<a href="/classes/${cls.slug}/">${esc(cls.name)}</a></p><p>資料確認 <time datetime="${checked}">${checked}</time> · <a href="#sources">確認範囲と出典</a></p><nav class="guide-toc" aria-label="この記事の目次"><ul>${toc.map(([id,l])=>`<li><a href="#${id}">${l}</a></li>`).join('')}</ul></nav>`
 +`<section id="overview" class="strategy-section"><h2>どんなアセンダンシーか</h2><p>${esc(a.theme)}${cite(1)}</p><p>${esc(cls.name)}にはほかに${siblings.map(s=>`<a href="${path(s)}">${esc(s.name)}</a>`).join('・')}があります。同じ職業でも、選ぶアセンダンシーで得意な戦い方が変わります。</p></section>`
 +`<section id="tier" class="strategy-section"><h2>Tier評価（${version}）</h2><div class="table-scroll"><table class="entity-stages"><thead><tr><th scope="col">評価元</th><th scope="col">評価</th><th scope="col">対象</th></tr></thead><tbody><tr><th scope="row">Maxroll${cite(2)}</th><td data-label="評価">${tierBadge(a.maxrollTier)}</td><td data-label="対象">${version}のリーグスタート</td></tr><tr><th scope="row">PathofExile.gg${cite(4)}</th><td data-label="評価">${tierBadge(a.pathofexileggTier)}</td><td data-label="対象">0.5時点のクラス・アセンダンシー評価</td></tr></tbody></table></div><p>評価は各サイトの意見で、公式の強さ順ではありません。${a.maxrollTier!==a.pathofexileggTier?'2つのサイトで評価が分かれています。評価時期と前提（リーグスタートか、装備がそろった後か）が違うためです。':'2つのサイトの評価は同じです。'}全アセンダンシーの比較は<a href="/guides/build-tier-list/#ascendancy">最強ビルドTier表</a>で確認できます。</p></section>`
 +`<section id="nodes" class="strategy-section"><h2>主なノード</h2><p>PoE2DB日本語版にあるノードのうち、特徴が分かりやすいものを6つ挙げます。効果は要約です。正確な数値はゲーム内の表示で確認してください。${cite(1)}</p><div class="table-scroll"><table class="entity-stages"><thead><tr><th scope="col">ノード</th><th scope="col">効果（要約）</th></tr></thead><tbody>${a.nodes.map(n=>`<tr><th scope="row">${esc(n.ja)}${n.en?`<br><small class="name-en" lang="en">${esc(n.en)}</small>`:''}</th><td data-label="効果（要約）">${esc(n.effect)}</td></tr>`).join('')}</tbody></table></div></section>`
 +`<section id="builds" class="strategy-section"><h2>おすすめビルド</h2>${own.length?`<h3>このサイトの育成ガイド</h3><ul>${own.map(b=>`<li>${buildLink(b)}：<a href="/builds/${b.classSlug}/${b.slug}/#roadmap">Lv別の育成手順</a></li>`).join('')}</ul>`:`<p>このサイトには、${esc(a.name)}の育成ガイドはまだありません。</p>`}${a.maxrollBuilds.length?`<h3>MaxrollのビルドTier表にあるビルド</h3><ul>${a.maxrollBuilds.map(b=>`<li>${tierBadge(b.tier)} ${esc(b.name)}</li>`).join('')}</ul><p>Maxrollのリーグスタート向けビルドTier表（${version}）から、${esc(a.name)}を使うビルドを抜き出しました。${cite(3)}</p>`:`<p>MaxrollのビルドTier表（${version}）には、${esc(a.name)}を使うビルドは載っていません。${cite(3)}</p>`}</section>`
 +`<section id="acquire" class="strategy-section"><h2>取得方法と注意</h2><ul><li>アセンダンシーは、試練（セケマの試練・混沌の試練）をクリアして得るポイントで振ります。手順は<a href="/guides/ascendancy-trials/">転職・試練攻略</a>で解説しています。</li><li>ノードの効果と評価は${version}時点のものです。1.0で変更される可能性があります。<a href="/poe2-1-0/balance-changes/">1.0のバランス変更</a>も確認してください。</li><li>ノードの名前は日本語版の翻訳に合わせています。英語名で探すときは、各ノードの下の英語表記を使ってください。</li></ul></section>`
 +`<section id="sources" class="sources"><h2>出典・確認した範囲</h2><p>ノードの名前と効果はPoE2DB日本語版（非公式のゲームデータ）の要約です。Tier評価は各サイトの意見をそのまま載せています。</p><ol>${src.map((s,i)=>`<li id="source-${i+1}"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">資料${i+1}：${esc(s.name)}</a>（確認 ${checked}）<p>${esc(s.supports)}</p></li>`).join('')}</ol></section>`
 +`<aside class="next-box"><h2>次に確認する</h2><div class="related-links"><a href="/ascendancies/">アセンダンシー一覧</a><a href="/classes/${cls.slug}/">${esc(cls.name)}のビルド</a><a href="/guides/build-tier-list/">最強ビルドTier表</a><a href="/guides/ascendancy-trials/">転職・試練攻略</a></div></aside></article></main>${FOOTER}</body></html>`;
 await mkdir(resolve(root,path(a).slice(1)),{recursive:true});
 await writeFile(resolve(root,path(a).slice(1),'index.html'),html);
}

// Hub
{
 const url=site.baseUrl+'/ascendancies/';
 const title=`PoE2 アセンダンシー一覧｜全22種の特徴とTier評価（${version}）`;
 const description=`PoE2の全8職業・22アセンダンシー（上位職）の一覧です。それぞれの特徴とMaxroll・PathofExile.ggのTier評価、おすすめビルドへのリンクを職業別にまとめています。`;
 const schema=[{'@context':'https://schema.org','@type':'CollectionPage',name:title,url,mainEntity:{'@type':'ItemList',itemListElement:list.map((a,i)=>({'@type':'ListItem',position:i+1,name:a.name,url:site.baseUrl+path(a)}))}},crumbs([['ホーム',site.baseUrl+'/'],['アセンダンシー一覧',url]])];
 const groups=classes.map(c=>[c,list.filter(a=>a.classSlug===c.slug)]).filter(([,l])=>l.length);
 const html=head(title,description,url,schema)+`<nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li>アセンダンシー一覧</li></ol></nav><article class="article-page strategy-article"><h1>${esc(title)}</h1><p class="lead">アセンダンシーは職業ごとに選ぶ上位職です。${version}では8職業に合計22種類あります。下の表で特徴と評価を比べ、気になるものは個別ページで主なノードとビルドを確認してください。</p><p>資料確認 <time datetime="${checked}">${checked}</time> · 評価：<a href="${esc(data.sources.maxrollAscendancy)}" target="_blank" rel="noopener noreferrer">Maxroll</a>・<a href="${esc(data.sources.pathofexilegg)}" target="_blank" rel="noopener noreferrer">PathofExile.gg</a> · ノード：PoE2DB日本語版（非公式）</p><p>転職の手順は<a href="/guides/ascendancy-trials/">転職・試練攻略</a>、ビルドの強さは<a href="/guides/build-tier-list/">最強ビルドTier表</a>で確認できます。</p><nav class="guide-toc" aria-label="職業"><ul>${groups.map(([c])=>`<li><a href="#${c.slug}">${esc(c.name)}</a></li>`).join('')}</ul></nav>`
 +groups.map(([c,l])=>`<section id="${c.slug}" class="strategy-section"><h2>${esc(c.name)}のアセンダンシー</h2><div class="table-scroll"><table class="entity-stages"><thead><tr><th scope="col">アセンダンシー</th><th scope="col">特徴</th><th scope="col">Maxroll</th><th scope="col">PoE.gg</th></tr></thead><tbody>${l.map(a=>`<tr><th scope="row"><a href="${path(a)}">${esc(label(a))}</a><br><small class="name-en" lang="en">${esc(a.englishName)}</small></th><td data-label="特徴">${esc(a.theme)}${siteBuilds(a).length?`<br>育成ガイド：${siteBuilds(a).map(buildLink).join('、')}`:''}</td><td data-label="Maxroll">${tierBadge(a.maxrollTier)}</td><td data-label="PoE.gg">${tierBadge(a.pathofexileggTier)}</td></tr>`).join('')}</tbody></table></div><p><a href="/classes/${c.slug}/">${esc(c.name)}のビルド一覧</a></p></section>`).join('')
 +`<section id="caution" class="strategy-section"><h2>評価を見るときの注意</h2><ul><li>Tierは各サイトの意見です。Maxrollは${version}のリーグスタート、PathofExile.ggは0.5時点の評価で、時期と前提が違います。</li><li>アセンダンシーの強さは、組み合わせるスキルと装備で大きく変わります。低い評価でも、特定のビルドでは強いことがあります。</li><li>1.0で内容が変わる可能性があります。<a href="/poe2-1-0/balance-changes/">1.0のバランス変更</a>も確認してください。</li></ul></section></article></main>${FOOTER}</body></html>`;
 await mkdir(resolve(root,'ascendancies'),{recursive:true});
 await writeFile(resolve(root,'ascendancies/index.html'),html);
}

// Class pages: a compact block linking that class's ascendancies (idempotent).
for(const c of classes){
 const file=resolve(root,`classes/${c.slug}/index.html`);let html;try{html=await readFile(file,'utf8');}catch{continue;}
 const own=list.filter(a=>a.classSlug===c.slug);if(!own.length)continue;
 html=html.replace(/<!-- ascendancy-links:start -->[\s\S]*?<!-- ascendancy-links:end -->/g,'');
 const block=`<!-- ascendancy-links:start --><section class="content-section" id="ascendancies"><h2>${esc(c.name)}のアセンダンシー</h2><ul>${own.map(a=>`<li><a href="${path(a)}">${esc(label(a))}</a>：${esc(a.theme)}</li>`).join('')}</ul><p><a href="/ascendancies/">全22アセンダンシーの一覧とTier評価</a></p></section><!-- ascendancy-links:end -->`;
 html=html.replace('</main>',block+'</main>');await writeFile(file,html);
}
console.log(`Generated ${list.length} ascendancy pages and the hub.`);
