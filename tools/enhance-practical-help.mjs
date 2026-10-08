// Reuse existing build/stage/source data. Run after the existing page enhancers.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {esc} from './build-facts.mjs';
import {insertBlock} from './block-order.mjs';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const save=(p,s)=>writeFile(resolve(root,p),s);
const builds=JSON.parse(await read('data/builds.json')).filter(b=>b.status!=='draft');
const strip=(s,name)=>s.replace(new RegExp(`<!-- ${name}:start -->[\\s\\S]*?<!-- ${name}:end -->`,'g'),'');
const block=(name,s)=>`<!-- ${name}:start -->${s}<!-- ${name}:end -->`;
for(const b of builds){
 const file=`builds/${b.classSlug}/${b.slug}/index.html`;
 let html=await read(file);
 for(const name of ['practical-assets','practical-questions','practical-now','build-feedback'])html=strip(html,name);
 html=html.replace(/<details(?: id="roadmap-stage-\d+")? data-stage-index="(\d+)"/g,'<details id="roadmap-stage-$1" data-stage-index="$1"');
 const nowLink=block('practical-now',`<nav class="practical-next" aria-label="今やることの詳細"><a id="now-stage-detail" class="button-secondary" href="#roadmap-stage-0">現在段階のスキル・装備・切替条件を見る</a>${b.practicalGuide?'<a class="button-secondary" href="#practical-guide">切替・困りごとの回答を見る</a>':''}</nav>`);
 html=html.replace('<p id="now-next"',`${nowLink}<p id="now-next"`);
 const guide=b.practicalGuide;
 if(guide){
  const questions=guide.questions.map((q,i)=>{
   const source=b.sources[q.sourceIndex],stage=b.levelingStages[q.stageIndex];
   if(!source||!stage||!q.where)throw new Error(`${b.id}: unresolved practical question`);
   return `<details id="practical-question-${i}"><summary>${esc(q.question)}</summary><p>${esc(q.answer)}</p><p class="disclaimer">確認箇所：${esc(q.where)}。<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">確認した元資料</a>（この回答の照合：${esc(guide.checkedAt)}）</p><a href="#roadmap-stage-${q.stageIndex}">${esc(stage.label)}の掲載構成を見る</a></details>`;
  }).join('');
  const section=block('practical-questions',`<section id="practical-guide" class="build-faq practical-guide" aria-labelledby="practical-title"><h2 id="practical-title">${esc(guide.heading)}</h2><p>以下は原典と照合した回答です。運営者の実機プレイによる検証結果ではありません。</p><p class="disclaimer">確認範囲：${esc(guide.scope)} 回答の照合日：${esc(guide.checkedAt)}。育成手順全体の確認日とは区別しています。</p>${questions}</section>`);
  html=html.replace('<section class="build-faq"',`${section}<section class="build-faq"`);
 }
 const feedback=block('build-feedback',`<section id="build-feedback" class="section practical-feedback"><details><summary>この段階で進めた？ 詰まったところを共有</summary><h2>育成ガイドの利用結果</h2><p>任意の回答です。ビルド・Lv帯・掲載パッチ・困りごと・結果を既存のGoogle Analyticsへ共有し、説明を改善する参考にします。このフォームで名前・メール・自由記述は収集しません。</p><form id="build-feedback-form" data-build="${esc(b.id)}" data-patch="${esc(b.version)}" hidden><p id="feedback-stage">現在Lvを読み込み中</p><label for="feedback-issue">確認したこと</label><select id="feedback-issue" required><option value="">選んでください</option><option value="transition">主力への切替</option><option value="supports">サポート・必要条件</option><option value="gear">装備・Spirit・防御</option><option value="damage">火力・ボス戦</option><option value="other">その他の育成手順</option></select><label for="feedback-outcome">結果</label><select id="feedback-outcome" required><option value="">選んでください</option><option value="progressed">手順を確認して進めた</option><option value="blocked">まだ詰まっている</option></select><button type="submit" class="button">名前を入力せず結果を共有</button><p id="feedback-status" role="status" aria-live="polite"></p></form><noscript><p>結果の共有にはJavaScriptが必要です。攻略本文はそのまま読めます。</p></noscript><p>個別の返信や実機検証済みの認定を行うフォームではありません。<a href="/privacy/">情報の取り扱い</a></p></details></section>`);
 html=insertBlock(html,'</main>','build-feedback',feedback);
 html=insertBlock(html,'</head>','practical-assets',block('practical-assets','<link rel="stylesheet" href="/assets/practical-help.css"><script defer src="/assets/practical-help.js"></script>'));
 await save(file,html);
}
// A lower-page entry, keeping the existing hero and quick choices intact.
let home=strip(await read('index.html'),'practical-entry');
const title='<h2 id="quality-title">もっと詳しく探す</h2>';
if(!home.includes(title))throw new Error('Home discovery section missing');
home=home.replace(title,title+block('practical-entry',`<p>主力への切替で迷ったら：${builds.filter(b=>b.practicalGuide).map(b=>`<a href="/builds/${b.classSlug}/${b.slug}/#practical-guide">${esc(b.name)}の条件・困りごと</a>`).join(' ／ ')}</p>`));
await save('index.html',home);
let privacy=strip(await read('privacy/index.html'),'build-feedback-privacy');
privacy=privacy.replace('<h2>広告配信</h2>',block('build-feedback-privacy','<h2>育成ガイドの利用結果</h2><p>個別ビルドの任意フォームでは、共有ボタンを押したときにビルド識別子・Lv帯・掲載パッチ・選択した困りごと・結果をGoogle Analyticsのイベントとして送信します。名前、メールアドレス、自由記述、端末内のチェック履歴は、このフォームから送信しません。回答は記事改善の参考に使い、返信や性能・成功率の証明には使用しません。</p>')+'<h2>広告配信</h2>');
privacy=privacy.replace(/最終更新：(\d{4})年(\d+)月(\d+)日。/,(text,y,m,d)=>
 `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`<'2026-10-08'?'最終更新：2026年10月8日。':text);
await save('privacy/index.html',privacy);
console.log('Practical help: three source-backed question sets, 12 stage links and optional result forms');
