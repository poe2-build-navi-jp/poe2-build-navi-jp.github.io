// Small navigation hub over the existing guides. No game facts or build ratings are copied here.
// Run after content generators, then generate-sitemap, inject-analytics and sync-asset-versions.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {FOOTER,ICON_BLOCK} from './site-chrome.mjs';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const save=(p,s)=>writeFile(resolve(root,p),s);
const [site,guides,pages]=await Promise.all(['site','guides','seo-pages'].map(async n=>JSON.parse(await read(`data/${n}.json`))));
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const base=site.baseUrl;
const groups=[
 {id:'problems',title:'困りごとから攻略を探す',intro:'今困っていることを1つ選び、該当ガイドの確認順へ進みます。',slugs:['why-i-die','increase-damage','mana-problem','cant-beat-boss','slow-mapping','gear-upgrade']},
 {id:'basics',title:'スキル・装備の基本を確認する',intro:'ビルドに書かれたスキルや装備の条件で迷ったときに使います。',slugs:['skill-gems','support-gems','passive-tree','equipment-basics','resistance']},
 {id:'progress',title:'キャンペーン終了後・Mappingの攻略',intro:'育成の次の段階へ進む前に、準備と進め方を確認します。',slugs:['after-campaign','mapping']}
];
const entry=slug=>{
 const path=`/guides/${slug}/`;
 const g=guides.find(x=>x.slug===slug),p=pages.find(x=>x.path===path);
 if(!g&&!p)throw new Error(`Guide missing from shared data: ${path}`);
 return {path,title:g?.title||p.h1,summary:p?.description||g.summary};
};
const sections=groups.map(group=>`<section id="${group.id}" aria-labelledby="${group.id}-title"><h2 id="${group.id}-title">${group.title}</h2><p>${group.intro}</p><div class="content-grid">${group.slugs.map(slug=>{const g=entry(slug);return `<a class="content-card" href="${g.path}"><strong>${esc(g.title)}</strong><span>${esc(g.summary)}</span></a>`;}).join('')}</div></section>`).join('');
const title='PoE2攻略ガイド｜困りごと・スキル・装備・Mapping';
const description='PoE2の攻略を困りごとと育成段階から探す日本語ガイド。火力不足、すぐ死ぬ、マナ不足、ボス、スキル・装備、Mappingの既存攻略から、現在Lvのビルド育成へ戻れます。';
const image=`${base}/images/poe2/og/poe2-beginner-guide-og.webp`;
const schema=[{'@context':'https://schema.org','@type':'CollectionPage',name:title,description,url:`${base}/guides/`,inLanguage:'ja',image,mainEntity:{'@type':'ItemList',itemListElement:groups.flatMap(x=>x.slugs).map((slug,i)=>({'@type':'ListItem',position:i+1,name:entry(slug).title,url:`${base}${entry(slug).path}`}))}},{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'ホーム',item:`${base}/`},{'@type':'ListItem',position:2,name:'攻略ガイド',item:`${base}/guides/`}]}];
const header='<header class="site-header"><a class="brand" href="/" aria-label="POE2ビルドナビ ホーム"><span class="brand-mark" aria-hidden="true">P2</span><span>POE2<br>ビルドナビ</span></a><nav class="site-nav page-nav" aria-label="メインメニュー"><a href="/builds/">ビルド</a><a href="/leveling/">レベリング</a><a href="/beginner-guide/">初心者ガイド</a></nav></header>';
await mkdir(resolve(root,'guides'),{recursive:true});
await save('guides/index.html',`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${description}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="google-adsense-account" content="ca-pub-7738997902416481"><link rel="canonical" href="${base}/guides/"><meta property="og:type" content="website"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="${esc(site.siteName)}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${base}/guides/"><meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="PoE2初心者向けビルド・育成ガイド"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/mobile.css">${ICON_BLOCK}<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7738997902416481" crossorigin="anonymous"></script><script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script></head><body><a class="skip-link" href="#main">本文へ移動</a>${header}<main id="main" class="page-main"><nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li>攻略ガイド</li></ol></nav><article class="article-page wide-article"><p class="section-kicker">POE2 / PRACTICAL GUIDES</p><h1>PoE2攻略ガイド</h1><p class="lead">火力が出ない・すぐ死ぬ・ボスに勝てないなど、育成中の疑問から必要な攻略を探せます。ビルドが決まっている人は、現在Lvの「今やること3つ」と合わせて使ってください。</p><p>掲載環境：${esc(site.siteVersion)}。各攻略の仕様・情報源・確認日は、リンク先のページで確認してください。攻略一覧の更新日を、全記事の再検証日として扱いません。</p><nav class="related-links" aria-label="攻略カテゴリ"><a href="#problems">困りごと</a><a href="#basics">スキル・装備</a><a href="#progress">Campaign後・Mapping</a></nav><aside class="next-box"><b>今のLvで何をすればいい？</b><p>職業・ビルド・現在Lvを選ぶと、該当する育成段階へ進めます。</p><a class="button" href="/leveling/">現在Lvから今やることを見る</a></aside>${sections}<section><h2>これから始める人へ</h2><p>攻略を全部読む必要はありません。最初のビルドを選び、育成中に迷った項目だけを確認してください。</p><div class="related-links"><a href="/what-is-poe2/">PoE2とは？</a><a href="/beginner-guide/">初心者向けビルド・始め方</a><a href="/classes/">自分に合う職業を選ぶ</a></div></section><aside class="next-box"><b>確認したら育成へ戻る</b><p>攻略で分かったことを、使っているビルドのスキル・装備・パッシブに当てはめます。具体的な採用構成は個別ビルドの育成手順を確認してください。</p><a class="button" href="/leveling/">現在Lvから今やることを見る</a><a class="button button-ghost" href="/builds/">使っているビルドを探す</a></aside></article></main>${FOOTER}</body></html>`);
// Small contextual entrances. Re-running after page generation restores them without duplicates.
const marker=/<!-- strategy-link:start -->[\s\S]*?<!-- strategy-link:end -->/g;
const wrap=html=>`<!-- strategy-link:start -->${html}<!-- strategy-link:end -->`;
let home=(await read('index.html')).replace(marker,'');
const anchor='<h2 id="quality-title">もっと詳しく探す</h2>';
if(!home.includes(anchor))throw new Error('Homepage discovery section changed');
home=home.replace(anchor,`${anchor}${wrap('<p><a class="button-secondary" href="/guides/">PoE2攻略を困りごとから探す</a></p>')}`);
await save('index.html',home);
for(const file of ['beginner-guide/index.html',...groups.flatMap(x=>x.slugs).map(slug=>`guides/${slug}/index.html`)]){
 let html=(await read(file)).replace(marker,'');
 const link=wrap('<p class="trouble-guides"><a href="/guides/">困りごと・育成段階から攻略を探す</a></p>');
 if(file==='beginner-guide/index.html')html=html.replace('<h1>PoE2初心者向けおすすめビルド・育成ガイド</h1>',`<h1>PoE2初心者向けおすすめビルド・育成ガイド</h1>${link}`);
 else {const end=html.lastIndexOf('</article>');if(end<0)throw new Error(`Article missing: ${file}`);html=html.slice(0,end)+link+html.slice(end);}
 await save(file,html);
}
console.log('Generated /guides/ and contextual links; existing guide content and build navigation preserved.');
