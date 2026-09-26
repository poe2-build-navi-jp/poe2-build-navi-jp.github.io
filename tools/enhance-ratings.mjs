// Idempotent: publishes /rating-criteria/ and injects the 5-axis rating block into build pages.
// Run after the other generators, then `node tools/enhance-build-ux.mjs` and `node tools/generate-sitemap.mjs`.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {esc} from './build-facts.mjs';
import {AXES,BEGINNER_CHECKS,SOURCE_SCALE,AXIS_SCOPE,CRITERIA_URL,ratingSectionHtml,validateRatings,scoreText} from './build-ratings.mjs';
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
 html=html.replace('<section class="build-faq"',`${ratingSectionHtml(b)}<section class="build-faq"`);
 const sources=b.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a><span>${esc(s.type)}・確認日 ${esc(s.checkedAt)}</span></li>`).join('');
 html=html.replace(/(<ul id="source-list" class="source-list">)[\s\S]*?(<\/ul>)/,`$1${sources}$2`);
 await save(path,html);
}

// Criteria page.
const title='PoE2ビルドの評価基準｜初心者向け・火力・耐久・周回・ボスの採点方法';
const description='POE2ビルドナビの5項目評価（初心者向け・火力・耐久・周回・ボス）の採点基準と、掲載ビルドごとの点数・根拠の一覧。元ガイドの長所・短所の記述だけで採点しています。';
const pageUrl=`${base}${CRITERIA_URL}`;
const breadcrumb=JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":`${base}/`},{"@type":"ListItem","position":2,"name":"評価基準","item":pageUrl}]});
const cell=(b,a)=>{const s=b[a.field];return `<td data-label="${esc(a.label)}">${s==null?'<span class="rating-na">未評価</span>':`<span><b>${s}</b>/5</span>`}</td>`;};
const table=`<div class="comparison-scroll"><table class="comparison-table rating-table"><caption>掲載${builds.length}ビルドの5項目評価（確認日 ${esc(checkedAt)}）</caption><thead><tr><th scope="col">ビルド</th>${AXES.map(a=>`<th scope="col">${esc(a.label)}</th>`).join('')}</tr></thead><tbody>${builds.map(b=>`<tr><th scope="row"><a href="${url(b)}#build-rating">${esc(b.name)}</a><small>${esc(b.className)} / ${esc(b.ascendancy)}</small></th>${AXES.map(a=>cell(b,a)).join('')}</tr>`).join('')}</tbody></table></div>`;
const evidenceList=builds.map(b=>`<details><summary>${esc(b.name)}の根拠</summary><ul>${AXES.map(a=>{const e=b.ratingEvidence[a.key];const s=b[a.field];return `<li><b>${esc(a.label)} ${scoreText(s)}</b>：${esc(e.note)}${s!=null&&a.key!=='beginner'?` <a href="${esc(e.source)}" target="_blank" rel="noopener noreferrer">${esc(e.sourceName)}</a>（${esc(e.checkedAt)}）`:''}${a.key==='beginner'?Object.values(e.verifiedChecks||{}).map(proof=>` <a href="${esc(proof.source)}" target="_blank" rel="noopener noreferrer">確認した元ガイド</a>`).join(''):''}</li>`;}).join('')}</ul><a href="${url(b)}#build-rating">ビルドページで詳しく見る</a></details>`).join('');
const body=`<main id="main" class="page-main"><nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li>評価基準</li></ol></nav><section class="page-hero discovery-hero"><p class="section-kicker">RATING CRITERIA</p><h1>PoE2ビルドの評価基準と採点方法</h1><p>各ビルドの「初心者向け・火力・耐久・周回・ボス」を5段階で表示しています。点数の付け方と、ビルドごとの根拠をすべて公開します。</p><div class="update-strip"><span>対象：${esc(site.siteVersion)}掲載ビルド</span><span>評価確認日：${esc(checkedAt)}</span></div></section><article class="article-page discovery-page"><section class="content-action"><h2>結論：点数は元ガイドの記述から付けています</h2><ul><li>火力・耐久・周回・ボスは、元ガイドの<b>長所・短所に書かれた内容</b>だけで5段階にします。</li><li>初心者向けは、原典で確認できた<b>4つのチェック項目</b>から計算します。確認済み条件が一つもなければ未評価です。</li><li>根拠となる記述がない項目は、推測せず<b>「未評価」</b>にします。未評価は低評価ではありません。</li></ul><p>同じ条件で測ったDPSや、人気順位ではありません。ビルド同士を比べる目安として使ってください。</p></section><section><h2>5つの評価項目</h2><dl class="rating-axes">${AXES.map(a=>`<div><dt>${esc(a.label)}</dt><dd>${a.key==='beginner'?'下のチェック項目を満たす数で決まります。':`${esc(AXIS_SCOPE[a.key])}を根拠にします。`}</dd></div>`).join('')}</dl></section><section><h2>初心者向けの計算方法</h2><p>確認済みの条件が1つ以上ある場合のみ1点から始め、満たす項目1つにつき1点を足します（最大5点）。</p><ol>${BEGINNER_CHECKS.map(([,label])=>`<li>${esc(label)}</li>`).join('')}</ol><p>「難しいと書かれていない」だけでは操作の簡単さや防御を加点しません。条件を確認できない場合は未加点とし、確認できた条件がない場合は未評価にします。</p></section><section><h2>火力・耐久・周回・ボスの5段階</h2><div class="comparison-scroll"><table class="comparison-table rating-table"><thead><tr><th scope="col">点数</th><th scope="col">区分</th><th scope="col">条件</th></tr></thead><tbody>${SOURCE_SCALE.map(([s,label,rule])=>`<tr><th scope="row">${s==null?'未評価':`${s}点`}</th><td data-label="区分">${esc(label)}</td><td data-label="条件">${esc(rule)}</td></tr>`).join('')}</tbody></table></div><h3>採点のルール</h3><ul><li>元ガイドの長所・短所の欄と、当サイトで記録した原典の説明を根拠にします。</li><li>資料によって評価が分かれる場合は、低いほうの点数を使います。</li><li>1つの記述が複数の項目に当てはまる場合は、それぞれの項目の根拠にします（例：「単体火力が高い」は火力とボスの両方）。</li><li>ダメージの発生の遅れなど、量ではない特徴は火力の点数に含めません。</li><li>根拠の資料が対応パッチと異なる場合は、各ビルドの根拠欄に明記します。</li><li>パッチ更新やガイドの改訂があったときは、根拠を確認し直して点数を更新します。</li></ul></section><section id="rating-table"><h2>掲載ビルドの評価一覧</h2><p>ビルド名を選ぶと、そのビルドページの評価と根拠へ移動します。</p>${table}</section><section id="rating-evidence"><h2>ビルドごとの採点根拠</h2>${evidenceList}</section><section><h2>よくある質問</h2><details><summary>「未評価」が多いビルドは弱いの？</summary><p>いいえ。確認した元ガイドに、その項目の長所・短所の記述がなかったという意味です。資料を追加で確認できたら点数を付けます。</p></details><details><summary>Tierリストとの違いは？</summary><p>Tierリストは育成のしやすさや資料確認状況で並べた比較です。この評価は、項目ごとの点数とその根拠を示すものです。</p></details><details><summary>点数はどれくらいの頻度で更新される？</summary><p>パッチ更新や元ガイドの改訂を確認したときに見直します。各ビルドの評価確認日を表示しています。</p></details></section><section class="related"><h2>評価を見た後に</h2><div class="related-links"><a href="/builds/#advanced-filters">条件で絞ってビルドを比較する</a><a href="/tier-list/">初心者向けTierを見る</a><a href="/best-builds/">目的別おすすめを見る</a><a href="/editorial-policy/">編集方針を見る</a></div></section></article></main>`;
const page=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="google-adsense-account" content="ca-pub-7738997902416481"><link rel="canonical" href="${pageUrl}"><meta property="og:type" content="article"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="POE2ビルドナビ"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${pageUrl}"><link rel="stylesheet" href="/assets/styles.css?v=rating-1"><link rel="stylesheet" href="/assets/mobile.css?v=rating-1"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7738997902416481" crossorigin="anonymous"></script><script type="application/ld+json">${breadcrumb}</script></head><body><a class="skip-link" href="#main">本文へ移動</a><header class="site-header"><a class="brand" href="/" aria-label="POE2ビルドナビ ホーム"><span class="brand-mark" aria-hidden="true">P2</span><span>POE2<br>ビルドナビ</span></a><nav class="site-nav page-nav" aria-label="メインメニュー"><a href="/tier-list/">Tier</a><a href="/league-starter/">スターター</a><a href="/builds/">ビルド</a><a href="/beginner-guide/">初心者ガイド</a></nav></header>${body}</body></html>\n`;
await mkdir(resolve(root,'rating-criteria'),{recursive:true});
let existing='';try{existing=await read('rating-criteria/index.html');}catch{}
const gtag=existing.match(/<!-- Google tag \(gtag\.js\) -->[\s\S]*?<!-- \/Google tag -->/)?.[0]||'';
const imageTags=`<meta property="og:image" content="${base}/images/poe2/og/poe2-rating-criteria-og.webp"><meta name="twitter:card" content="summary_large_image">`;
await save('rating-criteria/index.html',page.replace('<head>',`<head>${gtag}${imageTags}`));

// Link the criteria from the editorial policy and hub pages.
let policy=await read('editorial-policy/index.html');
policy=policy.replace(/<!-- rating-link:start -->[\s\S]*?<!-- rating-link:end -->/g,'');
policy=policy.replace(/(<h2>評価と価格<\/h2><p>[^<]*<\/p>)/,`$1<!-- rating-link:start --><p>ビルドの5項目評価は、元ガイドの長所・短所の記述だけで採点し、根拠と確認日を各ビルドページに表示しています。<a href="${CRITERIA_URL}">評価基準と採点方法を見る</a></p><!-- rating-link:end -->`);
await save('editorial-policy/index.html',policy);
for(const path of ['tier-list/index.html','best-builds/index.html']){
 let html=await read(path);
 html=html.replace(/<!-- rating-link:start -->[\s\S]*?<!-- rating-link:end -->/g,'');
 html=html.replace(/(<a href="\/editorial-policy\/">編集方針と情報確認方法を見る<\/a>)/,`$1<!-- rating-link:start --> ・ <a href="${CRITERIA_URL}">5項目評価の基準と一覧を見る</a><!-- rating-link:end -->`);
 await save(path,html);
}
console.log(`Ratings: ${builds.length} build pages, ${CRITERIA_URL}`);
