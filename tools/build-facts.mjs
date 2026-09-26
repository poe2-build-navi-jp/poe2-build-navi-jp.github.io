// Derived display values only: never infer equipment costs or new build ratings.
export const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function facts(build, discovery) {
  const tags = discovery.buildTags[build.id] || [];
  const difficulty = /^中（/.test(build.difficulty) ? '中' : tags.includes('操作少なめ') ? '低' : '未評価';
  const operation = tags.includes('操作少なめ') ? '少なめ' : tags.includes('操作多め') ? '多め' : difficulty === '中' ? '中' : '未評価';
  const match = build.difficulty.match(/Lv(\d+)で(?:主力|構成)を?切替/);
  const unlock = match ? Number(match[1]) : /主力はLv1から/.test(build.difficulty) ? 1 : null;
  const styles = tags.flatMap(tag => tag === 'ミニオン' ? ['召喚'] : tag === '遠近両用' ? ['近接','遠距離'] : ['近接','遠距離','魔法','召喚'].includes(tag) ? [tag] : []);
  return {difficulty, operation, unlock, styles, beginner: tags.includes('初心者'), tags:tags.slice(0,3)};
}
export function rows(b, d) {
  const f=facts(b,d);
  return [['職業',b.className],['アセンダンシー',b.ascendancy],['主力',b.mainSkill],['向いている人',b.audience],['弱点',b.weaknesses[0]],['操作難易度',f.difficulty],['操作量',f.operation],['構成切替・操作の注意',b.difficulty],['装備依存','未評価'],['主力解禁Lv',f.unlock ? `Lv${f.unlock}` : '正確なLv未確認（育成手順を参照）'],['初心者向け',f.beginner?'既存の初心者向け候補':'個別条件を確認'],['戦い方',f.styles.join('・')||'未分類'],['SSF',b.ssf===true?'確認済み':b.ssf===false?'非対応':'未確認'],['対応パッチ',b.version],['資料確認日',b.updatedAt]];
}
export const factsHtml=(b,d)=>`<dl class="unified-facts">${rows(b,d).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
