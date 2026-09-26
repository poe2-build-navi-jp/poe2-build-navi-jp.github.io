// Derived display values only: never infer equipment costs. Ratings come from data/builds.json (see build-ratings.mjs).
export const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function facts(build, discovery) {
  const tags = discovery.buildTags[build.id] || [];
  const difficulty = build.reviewedFacts?.difficulty || (/^中（/.test(build.difficulty) ? '中' : tags.includes('操作少なめ') ? '低' : '未評価');
  const operation = tags.includes('操作少なめ') ? '少なめ' : tags.includes('操作多め') ? '多め' : /^中/.test(difficulty) ? '中' : '未評価';
  const match = build.difficulty.match(/Lv(\d+)で(?:主力|構成)を?切替/);
  const unlock = match ? Number(match[1]) : /主力はLv1から/.test(build.difficulty) ? 1 : null;
  const styles = tags.flatMap(tag => tag === 'ミニオン' ? ['召喚'] : tag === '遠近両用' ? ['近接','遠距離'] : ['近接','遠距離','魔法','召喚'].includes(tag) ? [tag] : []);
  return {difficulty, operation, unlock, styles, beginner: tags.includes('初心者'), tags:tags.slice(0,3)};
}
// Mirrors AXES in build-ratings.mjs (kept local to avoid a circular import).
const ratingSummary=b=>[['初心者','beginnerRating'],['火力','damageRating'],['耐久','defenseRating'],['周回','mappingRating'],['ボス','bossRating']].map(([k,f])=>`${k}${b[f]==null?'—':b[f]}`).join('・')+'（—は未評価）';
export function rows(b, d) {
  const f=facts(b,d);
  return [['職業',b.className],['アセンダンシー',b.ascendancy],['主力',b.mainSkill],['向いている人',b.audience],['弱点',b.weaknesses[0]],['操作難易度',f.difficulty],['操作量',b.reviewedFacts?.operation || f.operation],['構成切替・操作の注意',b.difficulty],['装備依存',b.reviewedFacts?.gearDependence || '未評価'],['主力解禁Lv',f.unlock ? `Lv${f.unlock}` : '正確なLv未確認（育成手順を参照）'],['初心者向け',f.beginner?'既存の初心者向け候補':'個別条件を確認'],['戦い方',f.styles.join('・')||'未分類'],['SSF',b.reviewedFacts?.ssfNote || (b.ssf===true?'確認済み':b.ssf===false?'非対応':'未確認')],['対応パッチ',b.version],['資料確認日',b.updatedAt],['5項目評価',ratingSummary(b)]];
}
export const factsHtml=(b,d)=>`<dl class="unified-facts">${rows(b,d).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${b.reviewedFacts?.source?`<p class="fact-source"><a href="${esc(b.reviewedFacts.source)}" target="_blank" rel="noopener noreferrer">追加確認した元ガイド</a>（${esc(b.reviewedFacts.checkedAt)}）</p>`:''}`;
