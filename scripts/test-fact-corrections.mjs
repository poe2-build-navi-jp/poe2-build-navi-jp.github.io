// Regression checks for evidence-backed corrections. This is not a live fact-check.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const builds=await read('data/builds.json'),guides=await read('data/guides.json'),dictionary=await read('data/dictionary.json'),seo=await read('data/seo-pages.json');
const by=id=>builds.find(b=>b.id===id);
const twister=by('mercenary-twister-gemling');
assert.match(twister.gearPriorities.join(' '),/Prismatic Ring（指輪）/);
assert.doesNotMatch(twister.gearPriorities.join(' '),/ユニークアミュレット「The Taming」/);
assert.match(twister.levelingStages[7].mainSkill,/Sniper's Mark.*Barrage.*ツイスター/);
const spirit=by('huntress-twister-spirit-walker');
assert.doesNotMatch(JSON.stringify(spirit.levelingStages),/Twister → Barrage|Twister、Barrageへ/);
assert.equal(spirit.ratingEvidence.beginner.verifiedChecks.earlyMainSkill.source,'https://poe2db.tw/us/Twister');
assert.match(by('sorceress-sand-fire').levelingStages[0].caution,/Lv10.*Spirit|Spirit.*Lv10/);
assert.equal(by('mercenary-grenade-gemling').ratingEvidence.beginner.checks.moderateOperation,false);
assert.equal(by('mercenary-grenade-gemling').ratingEvidence.beginner.checks.ssfConfirmed,false);
assert.equal(by('mercenary-grenade-gemling').ratingEvidence.beginner.checks.noDodgeRequirement,true);
assert.equal(by('mercenary-grenade-gemling').ssf,null);
assert.doesNotMatch(by('mercenary-grenade-gemling').strengths.join(' '),/SSF.*Arbiter/);
assert.doesNotMatch(spirit.levelingStages[0].mainSkill,/PounceとShredを中心/);
assert.equal(by('witch-ed-contagion-lich').ratingEvidence.beginner.checks.moderateOperation,true);
assert.match(by('druid-plant-oracle').levelingStages[2].mainSkill,/手動Thunderstorm/);
assert.match(by('sorceress-spark-stormweaver').levelingStages[7].caution,/別の作者/);
assert.match(JSON.stringify(guides.find(x=>x.slug==='skill-gems')),/スペクターとテイムビースト/);
assert.match(JSON.stringify(guides.find(x=>x.slug==='support-gems')),/Solus Ipse/);
assert.match(JSON.stringify(dictionary.find(x=>x.slug==='support-gem')),/Solus Ipse/);
assert.doesNotMatch(JSON.stringify(dictionary),/ユニークのUnset Ring/);
assert.doesNotMatch(JSON.stringify(seo),/Steamではサポーターパックの購入が必要/);
assert.match(JSON.stringify(seo),/同じサブアカウント/);
assert.match(JSON.stringify(seo),/12月11日（PST）/);
console.log('PASS: equipment types, pre-attack buffs, source scope, gem exceptions and access-rights regressions');
const passive=dictionary.find(x=>x.slug==='passive-tree'),es=dictionary.find(x=>x.slug==='energy-shield'),mapping=dictionary.find(x=>x.slug==='mapping');
assert.match(passive.metaDescription,/基本123/);
assert.doesNotMatch(passive.metaDescription,/最大123/);
assert.match(passive.sections[0].bullets[0],/追加ポイントは別/);
assert.doesNotMatch(es.sections[0].bullets.join(' '),/ライフかES|回復中にダメージ/);
assert.match(es.importance,/ESを失い続ける/);
assert.match(es.sections[0].bullets[0],/ESを失わない.*4秒.*12.5%/);
assert.match(mapping.sections[1].bullets[1],/通常0回.*Stitch the Flesh/);
assert.doesNotMatch(by('monk-whirling-assault').levelingStages[4].nowActions.join(' '),/マナ不足ならEfficiency IIを使う/);
const ice=by('ranger-ice-shot-deadeye');
assert.match(ice.levelingStages[2].mainSkill,/lvl 24-30.*ライトニングアロー.*Freezing Mark/);
assert.match(ice.levelingStages[2].nowActions[0],/Lv7ジェム1個.*Lv5または6ジェム2個/);
assert.match(ice.levelingStages[3].supports,/lvl 31-41.*Herald of Ice/);
console.log('PASS: baseline exceptions, ES-loss trigger and source-specific transition preparation');
const dps=dictionary.find(x=>x.slug==='dps'),league=dictionary.find(x=>x.slug==='league-starter');
assert.doesNotMatch(dps.sections[0].bullets[0],/^継続ダメージは、効き始めるまでに時間がかかる/);
assert.match(dps.sections[0].bullets[1],/別の評価項目/);
assert.doesNotMatch(dps.sections[1].paragraphs[0],/採点/);
assert.match(dps.buildExamples[2].text,/Lundburgerr.*Endgame.*見積も/);
assert.doesNotMatch(JSON.stringify(league),/およそ4か月ごと|Early Access Standardという別|新しいキャラクターは作れません/);
assert.match(league.sections[0].bullets[2],/Runes of Aldur.*並行/);
for(const slug of ['league-starter','ssf']) {
 const example=dictionary.find(x=>x.slug===slug).buildExamples.find(x=>x.id==='mercenary-grenade-gemling');
 assert.match(example.text,/未確認/);
}
const sandExample=dictionary.find(x=>x.slug==='ascendancy').buildExamples.find(x=>x.id==='sorceress-sand-fire');
assert.match(sandExample.text,/最初.*ケラリ.*Lv40.*2回目.*ルザン/);
assert.doesNotMatch(JSON.stringify(seo),/公式フォーラムとSteamの公式ニュース（2026年8月25日付）|公式フォーラムとSteamの公式ニュースの2026年8月25日付/);
assert.match(JSON.stringify(seo),/microsoft-basic-display-adapter-in-windows/);
assert.match(JSON.stringify(seo),/free-up-drive-space-in-windows/);
assert.match(JSON.stringify(seo),/how-to-check-pc-specs-what-they-mean/);
console.log('PASS: DPS scope, league migration, repeated route claims and documentation provenance');
const resistance=dictionary.find(x=>x.slug==='resistance'),asc=dictionary.find(x=>x.slug==='ascendancy');
assert.match(resistance.buildExamples[0].text,/火耐性の修正値の50%/);
assert.match(asc.buildExamples.find(x=>x.id==='warrior-shield-wall-smith').text,/火耐性の修正値の50%/);
assert.match(by('warrior-shield-wall-smith').gearPriorities[2],/火耐性の修正値の50%/);
assert.match(guides.find(x=>x.slug==='support-gems').buildExamples[0].text,/すべてのミニオンやサポートに当てはまるわけではない/);
assert.doesNotMatch(guides.find(x=>x.slug==='after-campaign').sections[0].bullets[1],/1つ終えるごとに\+4/);
assert.doesNotMatch(asc.sections[0].bullets[2],/画面の中央からいつでも/);
assert.match(passive.buildExamples[1].text,/キーストーン以外.*つながっていなくても/);
assert.match(by('witch-ed-contagion-lich').gearPriorities[4],/再確認できていない/);
for(const slug of ['build','ascendancy']) assert.ok(dictionary.find(x=>x.slug===slug).metaDescription.includes(`このサイトの${builds.length}ビルド`));
const clauseAudit=await read('docs/audits/clause-review-2026-10-06.json');
assert.equal(clauseAudit.records.length,41);
assert.equal(new Set(clauseAudit.records.map(x=>x.claimId)).size,41);
assert.equal(clauseAudit.completeFactualCertification,false);
assert.deepEqual(clauseAudit.counts,{narrowed:17,supported:17,corrected:3,reasoned_unverifiable:4});
console.log('PASS: clause-scoped mechanics, unresolved-source warnings, build-count mirrors and41-record audit structure');

// An evidence gap must be visible in both the sources and generated pages.
for (const [entry, page] of [
  [guides.find(x => x.slug === 'support-gems'), 'guides/support-gems/index.html'],
  [dictionary.find(x => x.slug === 'support-gem'), 'dictionary/support-gem/index.html']
]) {
  const sourceText = JSON.stringify(entry);
  const html = await readFile(new URL('../' + page, import.meta.url), 'utf8');
  for (const text of [sourceText, html]) {
    assert.doesNotMatch(text, /サポートジェムはレベルを上げられず、コラプトもできない|サポートジェムはレベルを上げたり、コラプトしたりできない/);
    assert.match(text, /レベル上げ・コラプトの可否について、当サイトでは全種類に共通する現行ルールの確認を完了していません/);
  }
}
console.log('PASS: unresolved support-gem rules are qualified in source data and generated pages');

// Selected-stage evidence must not be replaced by a shared Endgame rotation.
const monk41=by('monk-whirling-assault').levelingStages[4];
assert.match(monk41.mainSkill,/Staggering Palm.*Tempest Bell.*Mantra of Destruction/);
assert.doesNotMatch(monk41.mainSkill+' '+monk41.transitionCondition+' '+monk41.nowActions.join(' '),/フォーリングサンダー|Falling Thunder|Charged Staff/);
assert.match(monk41.supports,/Magnified Area II.*Rage II.*Heavy Swing.*Pursuit II/);
assert.doesNotMatch(monk41.supports+' '+monk41.caution,/Efficiency II|Rage III/);
assert.match(monk41.caution,/Conservative Casting.*Pounce.*Mark of Siphoning/);
assert.match(ice.levelingStages[3].supports,/Rapid Attacks I.*Elemental Armament II.*Ice Bite I/);
assert.match(ice.levelingStages[3].caution,/Freezing Mark.*セット2.*セット1/);
const shield=by('warrior-shield-wall-smith');
assert.match(shield.levelingStages[2].supports,/Rapid Attacks I.*Magnified Area I.*Fire Attunement/);
assert.match(shield.levelingStages[2].gearPriority,/作者.*80以上.*目安/);
assert.match(shield.levelingStages[3].supports,/Fortifying Cry.*Close Combat I.*Sunder.*Prolonged Duration II/);
assert.match(twister.levelingStages[5].mainSkill,/ワーリングスラッシュのジェムLv1.*セット1.*ツイスターのジェムLv16.*セット2/);
assert.match(twister.levelingStages[5].supports,/Rage III.*Blazing Critical.*Prolonged Duration II.*Pinpoint Critical/);
assert.match(twister.levelingStages[5].caution,/War Banner・Fangs of Frostはない/);
const stageAudit=await read('docs/audits/stage-tabs-2026-10-06.json');
assert.equal(stageAudit.records.length,6);
assert.deepEqual(stageAudit.counts,{corrected_stage_attribution:1,source_coverage_expanded:5});
assert.equal(stageAudit.completeFactualCertification,false);
for(const record of stageAudit.records){
 const source=await read(record.sourceFile);
 const index=Number(record.jsonPointer.split('/').at(-1));
 assert.deepEqual(source.build.levelingStages[index],record.current);
 assert.ok(record.sourceUrl.includes('activeVariantId%2C'));
}
const site=await read('data/site.json');
assert.equal(site.latestPatch,'0.5.5e');
assert.equal(site.latestPatchSource,'https://www.pathofexile.com/forum/view-thread/4009785');
assert.equal(by('monk-whirling-assault').updatedAt,'2026-09-07');
console.log('PASS: six selected-stage records, one corrected attribution, patch freshness and preserved historical dates');

const discovery=await read('data/discovery.json');
for(const key of ['latestPatch','latestPatchSource','latestPatchCheckedAt']) assert.equal(discovery[key],site[key]);
for(const path of ['index.html','league-starter/index.html','tier-list/index.html','leveling/index.html','poe2-1-0/index.html','best-builds/index.html']) {
 const html=await readFile(new URL('../'+path,import.meta.url),'utf8');
 assert.match(html,/最新確認[^<]*0\.5\.5e/);
 assert.doesNotMatch(html,/最新確認[^<]*0\.5\.5d/);
}
console.log('PASS: patch metadata and discovery-page latest-patch labels stay aligned');
