// 5-axis build ratings. Scores are stored in data/builds.json and must follow
// the rubric below; every non-null score needs a quoted source statement.
import {esc} from './build-facts.mjs';

export const CRITERIA_URL='/rating-criteria/';
export const AXES=[
 {key:'beginner',field:'beginnerRating',label:'初心者向け',short:'初心者'},
 {key:'damage',field:'damageRating',label:'火力',short:'火力'},
 {key:'defense',field:'defenseRating',label:'耐久',short:'耐久'},
 {key:'mapping',field:'mappingRating',label:'周回',short:'周回'},
 {key:'boss',field:'bossRating',label:'ボス・単体',short:'ボス'}
];
export const BEGINNER_CHECKS=[
 ['earlyMainSkill','主力スキルをLv22以下（最初のアセンダンシー前後）から使える'],
 ['moderateOperation','当サイトの記録・原典で「操作が多い／要練習」と書かれていない'],
 ['ssfConfirmed','SSF（トレードなし）での成立を資料で確認済み'],
 ['noDodgeRequirement','原典の短所に「被弾しない立ち回りが前提」（Don\'t Get Hit Playstyle）がない']
];
export const SOURCE_SCALE=[
 [5,'長所（強調）','原典の長所として、Very・Insane・Amazing・Great・Incredibly・Extremely・One-Shotなどの強調語付きで挙げられている'],
 [4,'長所','原典の長所として挙げられている（強調語なし）'],
 [3,'長所と短所が両方','同じ項目について、長所と短所の両方が挙げられている'],
 [2,'短所','原典の短所・弱点として挙げられている'],
 [1,'短所（強調）','原典で強い短所、または成立しないと明記されている'],
 [null,'未評価','確認した資料に、その項目の長所・短所の記述がない（低評価ではありません）']
];
export const AXIS_SCOPE={
 damage:'DPS・ダメージ量そのものへの言及（単体火力の言及も含む）',
 defense:'耐久・被ダメージ・防御の厚さへの言及',
 mapping:'マップ殲滅・周回速度・移動の速さへの言及',
 boss:'ボス・単体戦への言及'
};

export const scoreText=score=>score==null?'未評価':`${score}/5`;
const meter=score=>score==null?'<span class="rating-meter is-empty" aria-hidden="true">―</span>':`<span class="rating-meter" aria-hidden="true">${'<i class="on"></i>'.repeat(score)}${'<i></i>'.repeat(5-score)}</span>`;

export function beginnerScore(evidence){
 return 1+BEGINNER_CHECKS.filter(([key])=>evidence.checks[key]===true).length;
}

export function ratingSectionHtml(build){
 const ev=build.ratingEvidence;
 const rows=AXES.map(axis=>{
  const e=ev[axis.key];const score=build[axis.field];
  let body;
  if(axis.key==='beginner'){
   body=`<p>${esc(e.note)}</p><ul class="rating-checks">${BEGINNER_CHECKS.map(([key,label])=>`<li class="${e.checks[key]?'ok':'ng'}"><span aria-hidden="true">${e.checks[key]?'✓':'—'}</span>${esc(label)}</li>`).join('')}</ul>`;
  }else if(score==null){
   body=`<p>${esc(e.note)}</p>`;
  }else{
   body=`<p>${esc(e.note)}</p><p class="rating-quote"><span>${esc(e.basis)}</span>「${esc(e.quote)}」— <a href="${esc(e.source)}" target="_blank" rel="noopener noreferrer">${esc(e.sourceName)}</a>（確認日 ${esc(e.checkedAt)}）</p>`;
  }
  return `<div class="rating-row"><dt>${esc(axis.label)}</dt><dd><div class="rating-score" aria-label="${esc(axis.label)}：${score==null?'未評価':`5段階中${score}`}">${meter(score)}<strong>${scoreText(score)}</strong></div>${body}</dd></div>`;
 }).join('');
 return `<!-- build-rating:start --><section id="build-rating" class="rating-card" aria-labelledby="rating-title"><p class="section-kicker">RATING</p><h2 id="rating-title">${esc(build.name)}の5項目評価</h2><p>点数は<a href="${CRITERIA_URL}">公開している評価基準</a>に沿い、元ガイドの長所・短所の記述だけで付けています。同じ条件で測ったDPSや順位ではありません。「未評価」は低評価ではなく、根拠となる記述を確認できていない状態です。</p><dl class="rating-list">${rows}</dl><p class="disclaimer">評価の確認日：${esc(ev.checkedAt)}／対応 ${esc(build.version)}</p></section><!-- build-rating:end -->`;
}

export function validateRatings(build){
 const errors=[];const ev=build.ratingEvidence;
 if(!ev){errors.push('ratingEvidence missing');return errors;}
 for(const axis of AXES){
  const e=ev[axis.key];const score=build[axis.field];
  if(!e){errors.push(`${axis.key}: evidence missing`);continue;}
  if(score!==null&&!(Number.isInteger(score)&&score>=1&&score<=5))errors.push(`${axis.field}: must be 1-5 or null`);
  if(e.score!==score)errors.push(`${axis.key}: evidence score ${e.score} != ${axis.field} ${score}`);
  if(!e.note)errors.push(`${axis.key}: note missing`);
  if(axis.key==='beginner'){
   if(BEGINNER_CHECKS.some(([key])=>typeof e.checks?.[key]!=='boolean'))errors.push('beginner: checks incomplete');
   else if(beginnerScore(e)!==score)errors.push(`beginner: score must be 1 + passed checks (${beginnerScore(e)})`);
   continue;
  }
  const scale=SOURCE_SCALE.find(([s])=>s===score);
  if(scale&&e.basis!==scale[1])errors.push(`${axis.key}: basis "${e.basis}" does not match score ${score}`);
  if(score!==null&&!(e.quote&&/^https:\/\//.test(e.source||'')&&e.sourceName&&/^\d{4}-\d{2}-\d{2}$/.test(e.checkedAt||'')))errors.push(`${axis.key}: quote/source/checkedAt required`);
 }
 return errors;
}
