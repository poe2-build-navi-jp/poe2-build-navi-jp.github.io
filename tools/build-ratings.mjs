// Evidence for five comparison topics. Legacy scores in builds.json are retained
// for historical consistency only; they do not describe comparable performance.
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

export const CRITERIA_URL='/rating-criteria/';
export const AXES=[
 {key:'beginner',field:'beginnerRating',label:'初心者向け',short:'初心者'},
 {key:'damage',field:'damageRating',label:'火力',short:'火力'},
 {key:'defense',field:'defenseRating',label:'耐久',short:'耐久'},
 {key:'mapping',field:'mappingRating',label:'周回',short:'周回'},
 {key:'boss',field:'bossRating',label:'ボス・単体',short:'ボス'}
];
export const BEGINNER_CHECKS=[
 ['earlyMainSkill','掲載ビルドの主力スキルの少なくとも1つをLv22以下から使える（序盤の代替スキルは対象外）'],
 ['moderateOperation','原典が操作の簡単さを長所として明記している'],
 ['ssfConfirmed','資料がSSF（トレードなし）での成立を明記している（「ユニーク不要」だけでは確認済みとしない）'],
 ['noDodgeRequirement','原典が防御や安全な立ち回りを長所として明記している']
];
export const AXIS_SCOPE={
 damage:'DPS・ダメージ量そのものへの言及（単体火力の言及も含む）',
 defense:'耐久・被ダメージ・防御の厚さへの言及',
 mapping:'マップ殲滅・周回速度・移動の速さへの言及',
 boss:'ボス・単体戦への言及'
};

// Legacy numeric scores in builds.json record the old editorial rubric. They are not
// comparable performance measurements and must not be rendered as such.
export const evidenceLabel=(axis,evidence)=>{
 if(axis==='beginner'){
  const count=BEGINNER_CHECKS.filter(([key])=>evidence.checks[key]===true).length;
  return count?`確認済み条件 ${count}/4`:'確認できた条件なし';
 }
 if(!evidence.quote)return '原典の記述を確認中';
 if(evidence.basis==='長所と短所が両方')return '原典に長所と弱点の両方';
 if(evidence.basis?.startsWith('長所'))return '原典で長所として紹介';
 if(evidence.basis?.startsWith('短所'))return '原典で弱点として紹介';
 return '原典の記述を確認中';
};
export const evidenceNote=(axis,evidence)=>axis==='beginner'
 ? evidence.note.replaceAll('加点した条件','確認した条件').replaceAll('加点しません','確認済み条件に含めません').replaceAll('5/5です','4条件を確認しました')
 : evidence.note;

export function beginnerScore(evidence){
 const confirmed=BEGINNER_CHECKS.filter(([key])=>evidence.checks[key]===true).length;
 return confirmed ? 1+confirmed : null;
}

export function ratingSectionHtml(build){
 const ev=build.ratingEvidence;
 const rows=AXES.map(axis=>{
  const e=ev[axis.key];const score=build[axis.field];
  let body;
  if(axis.key==='beginner'){
   body=`<p>${esc(evidenceNote(axis.key,e))}</p><ul class="rating-checks">${BEGINNER_CHECKS.map(([key,label])=>`<li class="${e.checks[key]?'ok':'ng'}"><span aria-hidden="true">${e.checks[key]?'✓':'—'}</span>${esc(label)}${e.checks[key]?`：${esc(e.verifiedChecks[key].basis)} <a href="${esc(e.verifiedChecks[key].source)}" target="_blank" rel="noopener noreferrer">元ガイド</a>`:''}</li>`).join('')}</ul>`;
  }else if(score==null){
   body=`<p>${esc(e.note)}</p>`;
  }else{
   body=`<p>${esc(e.note)}</p><p class="rating-quote"><span>${esc(e.basis)}</span>「${esc(e.quote)}」— <a href="${esc(e.source)}" target="_blank" rel="noopener noreferrer">${esc(e.sourceName)}</a>（確認日 ${esc(e.checkedAt)}）</p>`;
  }
  return `<div class="rating-row"><dt>${esc(axis.label)}</dt><dd><div class="rating-score"><strong>${esc(evidenceLabel(axis.key,e))}</strong></div>${body}</dd></div>`;
 }).join('');
 return `<!-- build-rating:start --><section id="build-rating" class="rating-card" aria-labelledby="rating-title"><p class="section-kicker">SOURCE EVIDENCE</p><h2 id="rating-title">${esc(build.name)}の5項目の原典確認</h2><p>初心者向けは<a href="${CRITERIA_URL}">共通の4条件</a>の確認件数を表示します。火力・耐久・周回・ボスは、元ガイドが長所・弱点として挙げた内容を分類します。同一条件の性能測定ではありません。更新履歴に残る点数は旧方式の記録です。</p><dl class="rating-list">${rows}</dl><p class="disclaimer">原典の確認日：${esc(ev.checkedAt)}／対応 ${esc(build.version)}</p></section><!-- build-rating:end -->`;
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
   else if(beginnerScore(e)!==score)errors.push(`beginner: score must be 1 + passed checks (${beginnerScore(e)}) or null when none`);
   for(const [key] of BEGINNER_CHECKS)if(e.checks?.[key]&&!(e.verifiedChecks?.[key]?.basis&&/^https:\/\//.test(e.verifiedChecks?.[key]?.source||'')))errors.push(`beginner: ${key} needs explicit basis and source`);
   continue;
  }
  if(score!==null&&!['長所（強調）','長所','長所と短所が両方','短所','短所（強調）'].includes(e.basis))errors.push(`${axis.key}: unknown source characterization ${e.basis}`);
  if(score!==null&&!(e.quote&&/^https:\/\//.test(e.source||'')&&e.sourceName&&/^\d{4}-\d{2}-\d{2}$/.test(e.checkedAt||'')))errors.push(`${axis.key}: quote/source/checkedAt required`);
 }
 return errors;
}
