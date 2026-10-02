const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const builds = JSON.parse(fs.readFileSync('data/builds.json', 'utf8'));
const script = fs.readFileSync('assets/detail.js', 'utf8');

async function openBuild(id, level) {
  const data = structuredClone(builds);
  const build = data.find(item => item.id === id);
  const path = `builds/${build.classSlug}/${build.slug}/`;
  const page = new JSDOM(fs.readFileSync(`${path}index.html`, 'utf8'), {
    runScripts: 'outside-only',
    url: `https://poe2-build-navi-jp.github.io/${path}?level=${level}`
  });
  page.window.fetch = async () => ({ ok: true, json: async () => data });
  page.window.eval(script);
  await new Promise(resolve => setImmediate(resolve));
  return { page, build, document: page.window.document };
}

function setLevel(page, level) {
  const input = page.window.document.getElementById('level-input');
  input.value = String(level);
  input.dispatchEvent(new page.window.Event('input'));
}

function assertInlineGuidance(document, build, stageIndex, actionIndex) {
  const actions = [...document.querySelectorAll('[data-now-action]')];
  const guidance = document.getElementById('now-action-guidance');
  const detail = build.levelingStages[stageIndex].actionGuidance;
  assert.equal(actions.length, 3, 'The three priority actions must remain');
  assert(actions.every(action => action.textContent.trim()));
  assert.equal(guidance.hidden, false);
  assert.equal(guidance.previousElementSibling, actions[actionIndex], 'Guidance must sit directly below its action');
  assert.equal(guidance.parentElement, actions[actionIndex].parentElement);
  assert.equal(guidance.style.gridColumn, '1 / -1', 'Guidance must fit desktop and single-column mobile rows');
  assert.match(guidance.textContent, /確認する段階/);
  assert(guidance.textContent.includes(detail.where));
  assert(guidance.textContent.includes(detail.what));
  const links = guidance.querySelectorAll('a');
  assert.equal(links.length, 1, 'Repeated level changes must not duplicate source links');
  assert.equal(links[0].href, detail.url);
  assert.equal(links[0].target, '_blank');
  assert(links[0].relList.contains('noopener'));
  assert(links[0].relList.contains('noreferrer'));
  return guidance;
}

(async () => {
  const shield = await openBuild('warrior-shield-wall-smith', 37);
  const shieldGuidance = assertInlineGuidance(shield.document, shield.build, 3, 1);
  assert.equal(shield.build.levelingStages[3].actionGuidance.url, shield.build.sources[0].url);
  assert(shieldGuidance.textContent.includes(shield.build.levelingStages[3].supportSourceStage));
  assert.equal(shield.document.querySelectorAll('[data-now-action]')[1].textContent, 'Act 3段階別ツリーを確認する');
  setLevel(shield.page, 70);
  assert.equal(shieldGuidance.hidden, true);
  assert.equal(shieldGuidance.childElementCount, 0, 'Changing stages must remove stale links');
  assert.equal(shieldGuidance.textContent, '');
  setLevel(shield.page, 37);
  assertInlineGuidance(shield.document, shield.build, 3, 1);
  setLevel(shield.page, 38);
  assertInlineGuidance(shield.document, shield.build, 3, 1);
  shield.build.levelingStages[3].actionGuidance.actionIndex = 8;
  setLevel(shield.page, 37);
  assert.equal(shieldGuidance.hidden, true, 'Out-of-range action references must not leave old guidance');
  assert.equal(shieldGuidance.childElementCount, 0);
  shield.page.window.close();

  const minion = await openBuild('witch-minion-infernalist', 37);
  const minionGuidance = assertInlineGuidance(minion.document, minion.build, 3, 2);
  assert.match(minionGuidance.textContent, /Act 3 - Vaal Guard Spectres/);
  setLevel(minion.page, 42);
  assertInlineGuidance(minion.document, minion.build, 4, 0);
  assert.match(minionGuidance.textContent, /When do I swap to Vaal Guards/);
  setLevel(minion.page, 70);
  assert.equal(minionGuidance.hidden, true);
  assert.equal(minionGuidance.childElementCount, 0);
  minion.page.window.close();

  const ice = await openBuild('ranger-ice-shot-deadeye', 37);
  assert.equal(ice.document.getElementById('now-action-guidance').hidden, true, 'Do not invent guidance for stages without source data');
  assert.equal(ice.document.querySelectorAll('[data-now-action]').length, 3);
  ice.page.window.close();
  console.log('PASS: Lv37 Act 3 source appears beneath its action; level changes clear stale links; minion guidance follows its action; unrelated builds stay unchanged');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
