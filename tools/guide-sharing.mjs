import {readFileSync} from 'node:fs';
export const shareResources=JSON.parse(readFileSync(new URL('../data/guide-share-resources.json',import.meta.url),'utf8'));
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const shareAssets='<link rel="stylesheet" href="/assets/guide-share.css"><script defer src="/assets/guide-share.js"></script>';
export function shareCard(item,base){
 if(!/^\/(?:[a-z0-9-]+\/)+$/.test(item.href))throw Error('Invalid share resource');
 const url=base+item.href;
 return `<article class="guide-share-card" data-guide-share><h3><a href="${item.href}">${esc(item.title)}</a></h3><p>${esc(item.description)}</p><div class="guide-share-actions"><a href="${item.href}">使ってみる →</a><button type="button" data-copy-guide hidden>リンクをコピー</button><a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(item.shareText)}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(item.title)}をXで共有（投稿画面が開きます）">Xで共有</a></div><details><summary>共有するURL</summary><input type="text" readonly aria-label="${esc(item.title)}の共有URL" value="${esc(url)}" data-guide-url></details><p role="status" aria-live="polite" data-guide-copy-status></p></article>`;
}
export const shareSection=(base)=>`<section id="share-tools" class="guide-share-section" aria-labelledby="share-tools-title"><h2 id="share-tools-title">友だちにも渡せる攻略ツール・比較例</h2><p>進行度や困りごとに合うページを、そのまま共有できます。</p><div class="guide-share-grid">${shareResources.map(item=>shareCard(item,base)).join('')}</div></section>`;
export function withShareResource(html,item,base){
 const block=`<!-- guide-share:start --><aside class="guide-share-section" aria-label="このページを共有する">${shareCard(item,base)}</aside><!-- guide-share:end -->`;
 html=html.replace(/<!-- guide-share:start -->[\s\S]*?<!-- guide-share:end -->/g,'');
 if(!html.includes('/assets/guide-share.css'))html=html.replace('</head>',shareAssets+'</head>');
 return html.replace('</main>',block+'</main>');
}
