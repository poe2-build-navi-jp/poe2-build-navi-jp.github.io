import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {esc,facts,factsHtml} from './build-facts.mjs';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const save=(p,s)=>writeFile(resolve(root,p),s);
const builds=JSON.parse(await read('data/builds.json')).filter(b=>b.status!=='draft');
const discovery=JSON.parse(await read('data/discovery.json'));
const site=JSON.parse(await read('data/site.json'));
const url=b=>`/builds/${b.classSlug}/${b.slug}/`;
const pages=['index.html','builds/index.html','tier-list/index.html','league-starter/index.html','classes/index.html','leveling/index.html',...[...new Set(builds.map(b=>b.classSlug))].map(c=>`classes/${c}/index.html`)];
for(const page of pages){
 let html=await read(page);
 html=html.replace(/<article\b(?=[^>]*class="(?:catalog-card|class-build-card|build-card|quick-pick-card|discovery-card|purpose-card|tier-card|starter-card)\b)[^>]*>[\s\S]*?<\/article>/g,article=>{
  if(/class="early-build-card/.test(article))return article.replace(/<dl class="unified-facts">[\s\S]*?<\/dl>/g,'');
  const b=builds.find(b=>article.includes(`href="${url(b)}`));
  if(!b)return article;
  article=article.replace(/<dl\b[^>]*>[\s\S]*?<\/dl>/g,'').replace(/<p class="fact-source">[\s\S]*?<\/p>/g,'');
  article=article.replace(/<button[^>]*data-compare[^>]*>[\s\S]*?<\/button>/g,'');
  article=article.replace('</article>',`${factsHtml(b,discovery)}${page==='builds/index.html'?`<button type="button" data-compare="${esc(b.id)}" aria-pressed="false" hidden>比較に追加</button>`:''}</article>`);
  if(page==='builds/index.html'){
   const f=facts(b,discovery);
   article=article.replace(/ data-(build-id|styles|beginner|operation|ssf|unlock)="[^"]*"/g,'').replace('<article ',`<article data-build-id="${b.id}" data-styles="${f.styles.join(',')}" data-beginner="${f.beginner}" data-operation="${f.operation}" data-ssf="${b.ssf===true}" data-unlock="${f.switchLevel||''}" `);
  }
  return article;
 });
 html=html.replace(/<!-- build-ux:start -->[\s\S]*?<!-- build-ux:end -->/g,'');
 html=html.replace('</head>','<!-- build-ux:start --><link rel="stylesheet" href="/assets/build-ux.css?v=1"><script type="module" src="/assets/build-ux.js?v=1"></script><!-- build-ux:end --></head>');
 if(page==='index.html'){
  html=html.replace(/<div class="hero-actions">[\s\S]*?<\/div>/,`<div class="hero-actions" aria-label="まず何をしたい？"><a class="button" href="#purpose-picks">おすすめをすぐ決める</a><a class="button-secondary" href="/classes/">自分に合う職業を選ぶ</a><a class="button-secondary" href="/leveling/">現在Lvから続きを見る</a></div>`);
  const quick=html.match(/<section id="quick-start"[\s\S]*?<\/section>/)?.[0];
  if(quick){html=html.replace(quick,'').replace(/(<section id="purpose-picks"[\s\S]*?<\/section>)/,`$1${quick}`);}
  html=html.replace('id="quality-title">目的から探す','id="quality-title">もっと詳しく探す');
  html=html.replace(/<!-- recent-builds:start -->[\s\S]*?<!-- recent-builds:end -->/g,'');
  const recent=[...builds].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,3);
  const recentHtml=`<!-- recent-builds:start --><section class="section"><h2>最近のビルド資料確認</h2><p>過去の変更理由が未記録の資料は、その旨を表示しています。</p><ul>${recent.map(b=>`<li><a href="${url(b)}#update-history">${esc(b.name)}</a>：${esc(b.updatedAt)} 資料確認。個別変更理由は未記録。</li>`).join('')}</ul></section><!-- recent-builds:end -->`;
  html=html.replace(/(<section id="quick-start"[\s\S]*?<\/section>)/,`$1${recentHtml}`);
 }
 if(page==='builds/index.html'){
  html=html.replace(/<!-- comparison:start -->[\s\S]*?<!-- comparison:end -->/g,'');
  const selects=[['style','戦い方',['近接','遠距離','魔法','召喚']],['beginner','初心者',['初心者向け']],['ssf','SSF',['確認済のみ']],['operation','操作量',['少なめ','中','多め','未評価']],['unlock','主力への切替目安',['Lv1から','Lv20まで','Lv40まで','Lv41以降','未確認']]];
  const filters=`<!-- comparison:start --><section id="advanced-filters" hidden><h2>条件で絞る・最大3ビルドを比較</h2><p>未評価は低評価を意味しません。切替目安は育成手順に明記されたものだけで絞ります。スキル使用可能Lvとは異なります。</p><div class="ux-filters">${selects.map(([id,label,options])=>`<label>${label}<select id="filter-${id}"><option value="">すべて</option>${options.map(o=>`<option>${o}</option>`).join('')}</select></label>`).join('')}</div><button type="button" id="reset-filters">全ビルドを見る</button><p id="filter-empty" hidden>条件に一致するビルドはありません。<button type="button" id="relax-filter">条件を1つ外す</button></p><p id="compare-status" role="status" aria-live="polite">比較：0 / 3件</p><button type="button" id="show-compare">選択したビルドを比較</button><section id="build-comparison" tabindex="-1" hidden><h2>選択したビルドの比較</h2><div id="comparison-cards" class="ux-comparison"></div></section></section><!-- comparison:end -->`;
  html=html.replace('<div id="build-list"',`${filters}<div id="build-list"`);
 }
 html=html.replace(/\/assets\/(app|catalog-static)\.js(?:\?[^"']*)?/g,'/assets/$1.js?v=ux-20260926');
 await save(page,html);
}
for(const b of builds){
 const path=`builds/${b.classSlug}/${b.slug}/index.html`;
 let html=await read(path);
 html=html.replace(/対応環境 [^<]+・<a href="[^"]+" target="_blank" rel="noopener noreferrer">最新確認 [^<]+<\/a>・最終確認 [^<]+/,`対応環境 ${esc(b.version)}・育成手順の原典照合 ${esc(b.updatedAt)}・<a href="${esc(site.latestPatchSource)}" target="_blank" rel="noopener noreferrer">公式パッチノート確認 ${esc(site.latestPatchCheckedAt)}</a>`);
 html=html.replace(/<div id="fact-grid" class="fact-grid">[\s\S]*?<\/div><\/div>/,`<div id="fact-grid" class="fact-grid"><div class="fact">対応パッチ：${esc(b.version)}</div><div class="fact">育成手順の原典照合：${esc(b.updatedAt)}</div></div></div>`);
 if(!html.includes('id="now-action-guidance"'))html=html.replace('<p id="now-next"', '<p id="now-action-guidance" class="disclaimer" hidden></p><p id="now-next"');
 html=html.replace(/<!-- build-history:start -->[\s\S]*?<!-- build-history:end -->/g,'');
 if(b.reviewedFacts?.ssfNote)html=html.replace(/(<b>SSF：<\/b>)未確認/,`$1${esc(b.reviewedFacts.ssfNote)}`);
 const records=(b.changeHistory||[]).map(r=>`<li><time>${esc(r.date)}</time> ${esc(r.summary)}</li>`).join('');
 const review=b.reviewedFacts;
 const reviewedItems=review?[['操作難易度',review.difficulty],['操作量',review.operation],['装備の条件',review.gearDependence],['SSF',review.ssfNote]].filter(([,value])=>value).map(([label,value])=>`<li>${esc(label)}：${esc(value)}</li>`).join(''):'';
 const reviewHtml=review?`<p>${esc(review.checkedAt)}：元ガイドの比較項目を追加確認しました。育成8段階の全内容を再検証した日付ではありません。</p><ul>${reviewedItems}</ul><p><a href="${esc(review.source)}" target="_blank" rel="noopener noreferrer">確認した元ガイドを見る</a></p>`:'';
 html=html.replace('</main>',`<!-- build-history:start --><section id="update-history" class="section"><h2>資料確認・更新履歴</h2><p>ビルド資料確認日：${esc(b.updatedAt)}／対応 ${esc(b.version)}。過去の具体的な変更理由は記録されていません。</p>${records?`<ul>${records}</ul>`:''}${reviewHtml}<p>2026-09-26：比較項目・再訪導線を整備。ゲーム内の育成内容を再検証した日ではありません。</p><a href="/builds/#advanced-filters">他のビルドと比較する</a> ・ <a href="/leveling/">別のLv・ビルドから探す</a></section><script type="module" src="/assets/build-ux.js?v=1"></script><!-- build-history:end --></main>`);
 html=html.replace(/<p id="build-update-notice"[^>]*><\/p>/g,'').replace('<section id="now"','<p id="build-update-notice" role="status" hidden></p><section id="now"');
 html=html.replace(/\/assets\/detail\.js(?:\?[^"']*)?/g,'/assets/detail.js?v=ux-20260926');
 await save(path,html);
}
console.log('Build UX: shared cards, filters, comparison, history, resume');
