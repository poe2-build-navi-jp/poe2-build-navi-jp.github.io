// Idempotent: publishes /rating-criteria/ and injects the 5-axis rating block into build pages.
// Run after the other generators, then `node tools/enhance-build-ux.mjs` and `node tools/generate-sitemap.mjs`.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {esc} from './build-facts.mjs';
import {AXES,BEGINNER_CHECKS,AXIS_SCOPE,CRITERIA_URL,ratingSectionHtml,validateRatings,evidenceLabel,evidenceNote} from './build-ratings.mjs';
import {insertBlock} from './block-order.mjs';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const save=(p,s)=>writeFile(resolve(root,p),s);
const builds=JSON.parse(await read('data/builds.json')).filter(b=>b.status!=='draft');
const site=JSON.parse(await read('data/site.json'));
const base=site.baseUrl;
const url=b=>`/builds/${b.classSlug}/${b.slug}/`;

const errors=builds.flatMap(b=>validateRatings(b).map(e=>`${b.id}: ${e}`));
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
const checkedAt=builds.map(b=>b.ratingEvidence.checkedAt).sort().at(-1);

// Build detail pages: rating block before the FAQ, static source list synced with data.
for(const b of builds){
 const path=`builds/${b.classSlug}/${b.slug}/index.html`;
 let html=await read(path);
 html=html.replace(/<!-- build-rating:start -->[\s\S]*?<!-- build-rating:end -->/g,'');
 // Above the practical Q&A when enhance-practical-help has added it, so the order is the same
 // whichever of the two runs first.
 const anchor=html.includes('<!-- practical-questions:start -->')?'<!-- practical-questions:start -->':'<section class="build-faq"';
 html=html.replace(anchor,()=>`${ratingSectionHtml(b)}${anchor}`);
 const sources=b.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a><span>${esc(s.type)}・確認日 ${esc(s.checkedAt)}</span></li>`).join('');
 html=html.replace(/(<ul id="source-list" class="source-list">)[\s\S]*?(<\/ul>)/,`$1${sources}$2`);
 html=html.replace(/<!-- review-schema:start -->[\s\S]*?<!-- review-schema:end -->/g,'');
 await save(path,html);
}

// Criteria page.
const title='PoE2ビルドの比較項目｜初心者条件と原典の長所・弱点';
const description='PoE2の掲載ビルドについて、初心者向けの確認済み条件と、火力・耐久・周回・ボスの原典に記載された長所・弱点を比較。原典と確認日を掲載します。';
const pageUrl=`${base}${CRITERIA_URL}`;
const breadcrumb=JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":`${base}/`},{"@type":"ListItem","position":2,"name":"評価基準","item":pageUrl}]});
const cell=(b,a)=>`<td data-label="${esc(a.label)}">${esc(evidenceLabel(a.key,b.ratingEvidence[a.key]))}</td>`;
const table=`<div class="comparison-scroll"><table class="comparison-table rating-table"><caption>掲載${builds.length}ビルドの原典確認一覧（最終確認 ${esc(checkedAt)}）</caption><thead><tr><th scope="col">ビルド</th>${AXES.map(a=>`<th scope="col">${esc(a.label)}</th>`).join('')}</tr></thead><tbody>${builds.map(b=>`<tr><th scope="row"><a href="${url(b)}#build-rating">${esc(b.name)}</a><small>${esc(b.className)} / ${esc(b.ascendancy)}</small></th>${AXES.map(a=>cell(b,a)).join('')}</tr>`).join('')}</tbody></table></div>`;
const evidenceList=builds.map(b=>`<details><summary>${esc(b.name)}の根拠</summary><ul>${AXES.map(a=>{const e=b.ratingEvidence[a.key];return `<li><b>${esc(a.label)}：${esc(evidenceLabel(a.key,e))}</b>。${esc(evidenceNote(a.key,e))}${a.key!=='beginner'&&e.source?` <a href="${esc(e.source)}" target="_blank" rel="noopener noreferrer">${esc(e.sourceName)}</a>（${esc(e.checkedAt)}）`:''}${a.key==='beginner'?Object.values(e.verifiedChecks||{}).map(proof=>` <a href="${esc(proof.source)}" target="_blank" rel="noopener noreferrer">確認した元ガイド</a>`).join(''):''}</li>`;}).join('')}</ul><a href="${url(b)}#build-rating">ビルドページで詳しく見る</a></details>`).join('');
const body=`<main id="main" class="page-main"><nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li>評価基準</li></ol></nav><section class="page-hero discovery-hero"><p class="section-kicker">RATING CRITERIA</p><h1>PoE2ビルドの比較項目と原典の確認方法</h1><p>初心者向けの共通条件と、火力・耐久・周回・ボスについて元ガイドが挙げた特徴を、原典と確認日付きで整理します。</p><div class="update-strip"><span>対象：${esc(site.siteVersion)}掲載ビルド</span><span>原典の最終確認：${esc(checkedAt)}</span></div></section><article class="article-page discovery-page"><section class="content-action"><h2>同じ条件で性能を測った順位ではありません</h2><p>初心者向けは、4つの共通条件のうち原典で確認できた件数です。火力・耐久・周回・ボスは、原典が長所として挙げたか、弱点として挙げたか、両方を挙げたかを示します。「Great」など執筆者の形容詞で点数を増減しません。</p><p>「原典の記述を確認中」は性能が低いという意味ではありません。実測条件がそろった比較データはないため、異なる原典の形容表現からビルド間の強さを順位付けしません。</p></section><section><h2>5つの確認項目</h2><dl class="rating-axes">${AXES.map(a=>`<div><dt>${esc(a.label)}</dt><dd>${a.key==='beginner'?'下のチェック項目を満たす数で決まります。':`${esc(AXIS_SCOPE[a.key])}を根拠にします。`}</dd></div>`).join('')}</dl></section><section><h2>初心者向けの4条件</h2><p>原典で明示された条件のみ「確認済み」として数えます。未確認は不適合を意味しません。</p><ol>${BEGINNER_CHECKS.map(([,label])=>`<li>${esc(label)}</li>`).join('')}</ol></section><section><h2>原典の特徴の読み方</h2><ul><li><b>原典で長所として紹介：</b>そのガイドの執筆者が長所として記載。</li><li><b>原典で弱点として紹介：</b>そのガイドの執筆者が弱点として記載。</li><li><b>原典に長所と弱点の両方：</b>両方向の記述があるため、採用条件を個別に確認。</li><li><b>原典の記述を確認中：</b>その項目を判断できる記述が未確認。</li></ul><p>原典の記述は同一条件の実測値ではありません。各ビルドの操作・装備条件と併せて読み、判断には出典の該当箇所を確認してください。</p></section><section id="rating-table"><h2>掲載ビルドの原典確認一覧</h2><p>ビルド名を選ぶと、そのビルドページの記述と根拠へ移動します。</p>${table}</section><section id="rating-evidence"><h2>ビルドごとの記述と根拠</h2>${evidenceList}</section><section><h2>よくある質問</h2><details><summary>「原典の記述を確認中」は弱いという意味？</summary><p>いいえ。確認した元ガイドで、その項目の長所・弱点を示す記述が見つかっていないという意味です。資料を確認できたら記述を更新します。</p></details><details><summary>Tierリストとの違いは？</summary><p>Tierリストは育成のしやすさや資料確認状況で並べた比較です。このページは項目別の原典記述と確認済み条件を示します。</p></details><details><summary>原典情報はどれくらいの頻度で見直す？</summary><p>パッチ更新や元ガイドの改訂を確認したときに見直します。各ビルドの資料確認日を表示しています。</p></details></section><section class="related"><h2>評価を見た後に</h2><div class="related-links"><a href="/builds/#advanced-filters">条件で絞ってビルドを比較する</a><a href="/tier-list/">初心者向けTierを見る</a><a href="/best-builds/">目的別おすすめを見る</a><a href="/editorial-policy/">編集方針を見る</a></div></section></article></main>`;
const page=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="google-adsense-account" content="ca-pub-7738997902416481"><link rel="canonical" href="${pageUrl}"><meta property="og:type" content="article"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="POE2ビルドナビ"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${pageUrl}"><link rel="stylesheet" href="/assets/styles.css?v=rating-1"><link rel="stylesheet" href="/assets/mobile.css?v=rating-1"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7738997902416481" crossorigin="anonymous"></script><script type="application/ld+json">${breadcrumb}</script></head><body><a class="skip-link" href="#main">本文へ移動</a><header class="site-header"><a class="brand" href="/" aria-label="POE2ビルドナビ ホーム"><span class="brand-mark" aria-hidden="true">P2</span><span>POE2<br>ビルドナビ</span></a><nav class="site-nav page-nav" aria-label="メインメニュー"><a href="/guides/">攻略ガイド</a><a href="/beginner-builds/">初心者おすすめ</a><a href="/tier-list/">Tier</a><a href="/league-starter/">スターター</a><a href="/builds/">ビルド</a><a href="/beginner-guide/">初心者ガイド</a></nav></header>${body}</body></html>\n`;
await mkdir(resolve(root,'rating-criteria'),{recursive:true});
let existing='';try{existing=await read('rating-criteria/index.html');}catch{}
// Keep what later tools added (preconnect + Google tag at the top of <head>, the OG block),
// so this rebuild gives the same page whichever order the tools run in.
const headStart=(existing.match(/<head>([\s\S]*?)<meta charset/)?.[1]||'').replace(/<meta (?:property="og:image(?::[a-z]+)?"|name="twitter:card") content="[^"]*">/g,'');
const ogBlock=existing.match(/<!-- og-image:start -->[\s\S]*?<!-- og-image:end -->/)?.[0];
const iconBlock=existing.match(/<!-- site-icon:start -->[\s\S]*?<!-- site-icon:end -->/)?.[0];
const imageTags=`<meta property="og:image" content="${base}/images/poe2/og/poe2-rating-criteria-og.webp"><meta name="twitter:card" content="summary_large_image">`;
const rebuilt=page.replace('<head>',`<head>${headStart}${ogBlock?'':imageTags}`);
let criteria=ogBlock?insertBlock(rebuilt,'</head>','og-image',ogBlock):rebuilt;
if(iconBlock)criteria=insertBlock(criteria,'</head>','site-icon',iconBlock);
const footerBlock=existing.match(/<!-- site-footer:start -->[\s\S]*?<!-- site-footer:end -->/)?.[0];
if(footerBlock)criteria=criteria.replace(/<\/main>(?![\s\S]*<\/main>)/,`</main>${footerBlock}`);
await save('rating-criteria/index.html',criteria);

// Link the criteria from the editorial policy and hub pages.
let policy=await read('editorial-policy/index.html');
policy=policy.replace(/<!-- rating-link:start -->[\s\S]*?<!-- rating-link:end -->/g,'');
policy=policy.replace(/(<h2>評価と価格<\/h2><p>[^<]*<\/p>)/,`$1<!-- rating-link:start --><p>ビルドの初心者条件と原典の長所・弱点は、根拠と確認日を各ビルドページに表示しています。<a href="${CRITERIA_URL}">比較項目と原典の確認方法を見る</a></p><!-- rating-link:end -->`);
await save('editorial-policy/index.html',policy);
for(const path of ['tier-list/index.html','best-builds/index.html']){
 let html=await read(path);
 html=html.replace(/<!-- rating-link:start -->[\s\S]*?<!-- rating-link:end -->/g,'');
 html=html.replace(/(<a href="\/editorial-policy\/">編集方針と情報確認方法を見る<\/a>)/,`$1<!-- rating-link:start --> ・ <a href="${CRITERIA_URL}">5項目の原典確認一覧を見る</a><!-- rating-link:end -->`);
 await save(path,html);
}
console.log(`Ratings: ${builds.length} build pages, ${CRITERIA_URL}`);
