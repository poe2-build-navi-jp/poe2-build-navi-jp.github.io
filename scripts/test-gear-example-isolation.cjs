const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {JSDOM} = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('gear-check/index.html');
const script = read('assets/gear-check.js');
const builds = JSON.parse(read('data/builds.json'));
const gemlingId = 'mercenary-twister-gemling';
const deadeyeId = 'ranger-ice-shot-deadeye';
const base = 'https://poe2-build-navi-jp.github.io';
const parse = () => new JSDOM(html, {url: base + '/gear-check/'});

function selection(window) {
  const ids = ['gear-class','gear-build','gear-level','gear-concern','gear-budget'];
  return {
    fields: Object.fromEntries(ids.map(id => [id, window.document.getElementById(id).value])),
    result: window.document.querySelector('.diagnosis-result').innerHTML,
    storage: Object.fromEntries(Object.keys(window.localStorage).sort().map(key => [key, window.localStorage.getItem(key)]))
  };
}
async function runtime(query = '', seed = {}, data = builds) {
  const dom = new JSDOM(html, {url: base + '/gear-check/' + query, runScripts: 'outside-only'});
  for (const [key,value] of Object.entries(seed)) dom.window.localStorage.setItem(key,value);
  dom.window.fetch = async url => {
    assert.equal(url, '/data/builds.json');
    return {json: async () => structuredClone(data)};
  };
  dom.window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 0));
  return dom;
}
function toggleWithoutChangingDiagnosis(dom) {
  const details = dom.window.document.getElementById('gear-example-details');
  const summary = details.querySelector('summary');
  const before = selection(dom.window);
  assert.equal(details.open, false);
  summary.click(); assert.equal(details.open, true);
  assert.deepEqual(selection(dom.window), before, 'Opening the sample must not change inputs, results or storage');
  summary.click(); assert.equal(details.open, false);
  assert.deepEqual(selection(dom.window), before, 'Closing the sample must not change inputs, results or storage');
}
function select(dom,id,level) {
  const {window} = dom, d = window.document;
  const build = builds.find(build => build.id === id);
  d.getElementById('gear-class').value = build.className;
  d.getElementById('gear-class').dispatchEvent(new window.Event('change', {bubbles:true}));
  d.getElementById('gear-build').value = id;
  d.getElementById('gear-build').dispatchEvent(new window.Event('input', {bubbles:true}));
  d.getElementById('gear-level').value = level;
  d.getElementById('gear-level').dispatchEvent(new window.Event('input', {bubbles:true}));
}
(async () => {
  const staticDom = parse(), d = staticDom.window.document;
  assert.equal(d.getElementById('gear-result-label').textContent, 'あなたの診断結果');
  assert.equal(d.querySelector('.diagnosis-result').getAttribute('aria-live'), 'polite');
  assert.equal(d.querySelector('.diagnosis-result').getAttribute('aria-labelledby'), 'gear-result-label gear-result-title');
  const sample = d.querySelector('.gear-example'), details = d.getElementById('gear-example-details');
  assert.equal(d.getElementById('gear-example-label').textContent, 'サンプル（選択したビルドの結果ではありません）');
  assert(!sample.closest('.diagnosis-result'), 'The sample must be outside the live result');
  assert.equal(details.open, false, 'The fixed sample is initially collapsed without JS');
  assert.equal(details.firstElementChild.tagName, 'SUMMARY');
  assert.equal(details.firstElementChild.textContent, '表示例を見る');
  assert.equal(details.querySelectorAll(':scope > summary').length, 1);
  assert.equal(d.getElementById('gear-example-title').closest('details'), details);
  assert.equal(details.querySelectorAll('.gear-action-list li').length, 3);
  assert.equal(d.querySelectorAll('#gear-example-title').length, 1);
  const link = details.querySelector('a.button');
  assert.equal(link.textContent, 'サンプルの条件で新しく診断する（現在の選択が変わります）');
  assert.equal(new URL(link.href).searchParams.get('build'), deadeyeId);
  assert.equal(new URL(link.href).searchParams.get('level'), '37');
  details.firstElementChild.click(); assert(details.open, 'Native sample disclosure works without app JS');
  details.firstElementChild.click(); assert(!details.open);
  assert.match(read('assets/gear-check.css'), /min-height:44px/);
  assert.match(read('assets/gear-check.css'), /summary:focus-visible/);

  const empty = await runtime();
  assert.equal(empty.window.document.getElementById('gear-build').value, '');
  toggleWithoutChangingDiagnosis(empty); empty.window.close();

  const gemling = await runtime(`?build=${gemlingId}&level=79&concern=death`);
  const gd = gemling.window.document;
  assert.equal(gd.getElementById('gear-result-title').textContent, 'ツイスター・ジェムリング / Lv79');
  assert.match(gd.getElementById('gear-context').textContent, /Early Endgame・悩み：すぐ死ぬ・予算：拾った装備だけ/);
  assert.match(gd.getElementById('gear-actions').textContent, /槍/);
  assert(!gd.querySelector('.diagnosis-result').textContent.includes('デッドアイ'));
  toggleWithoutChangingDiagnosis(gemling);
  select(gemling, deadeyeId, 37);
  assert.equal(gd.getElementById('gear-result-title').textContent, 'アイスショット・デッドアイ / Lv37');
  assert.equal(gd.getElementById('gear-example-details').open, false, 'Changing build must not auto-open the fixed sample');
  assert.match(gd.getElementById('gear-actions').textContent, /弓|矢筒/);
  toggleWithoutChangingDiagnosis(gemling);
  select(gemling, gemlingId, 79);
  assert.equal(gd.getElementById('gear-result-title').textContent, 'ツイスター・ジェムリング / Lv79');
  assert.equal(gemling.window.localStorage.getItem('poe2:navi:gear-build'), gemlingId);
  assert.equal(gemling.window.localStorage.getItem('poe2:navi:gear-level'), '79');
  toggleWithoutChangingDiagnosis(gemling); gemling.window.close();

  const restored = await runtime('', {'poe2:navi:gear-build':gemlingId,'poe2:navi:gear-level':'79'});
  assert.equal(restored.window.document.getElementById('gear-result-title').textContent, 'ツイスター・ジェムリング / Lv79');
  toggleWithoutChangingDiagnosis(restored); restored.window.close();
  const explicitSample = await runtime(new URL(link.href).search, {'poe2:navi:gear-build':gemlingId,'poe2:navi:gear-level':'79'});
  assert.equal(explicitSample.window.document.getElementById('gear-result-title').textContent, 'アイスショット・デッドアイ / Lv37');
  assert.equal(explicitSample.window.document.getElementById('gear-concern').value, 'damage');
  toggleWithoutChangingDiagnosis(explicitSample); explicitSample.window.close();

  const unsafe = structuredClone(builds), injected = unsafe.find(build => build.id === gemlingId);
  injected.name = '<img src=x onerror=alert(1)>';
  injected.levelingStages.find(stage => stage.label === 'Early Endgame').replaceGear = '<svg onload=alert(1)>';
  const safe = await runtime(`?build=${gemlingId}&level=79`, {}, unsafe);
  assert(!safe.window.document.querySelector('.diagnosis-result img, .diagnosis-result svg'));
  assert.match(safe.window.document.getElementById('gear-result-title').textContent, /<img/);
  safe.window.close(); staticDom.window.close();

  const tmp = await fsp.mkdtemp('/tmp/poe2-gear-example-');
  try {
    await fsp.cp(root,tmp,{recursive:true,filter:p=>!/(^|\/)(node_modules|\.git)$/.test(p)});
    for (let pass=0;pass<2;pass++) {
      for (const step of ['enhance-residual-pages','sync-asset-versions']) execFileSync(process.execPath,[path.join(tmp,'tools',`${step}.mjs`)],{cwd:tmp,stdio:'ignore'});
      assert.equal(await fsp.readFile(path.join(tmp,'gear-check/index.html'),'utf8'),html, 'Sample enhancement must be repeatable');
    }
    assert.equal(await fsp.readFile(path.join(tmp,'assets/gear-check.js'),'utf8'),script, 'Diagnosis logic is preserved');
  } finally { await fsp.rm(tmp,{recursive:true,force:true}); }
  console.log('PASS: separate live result and collapsed sample; Gemling Lv79 / Deadeye Lv37; native toggle and localStorage isolation; explicit sample navigation; safe DOM; repeatable generation');
})().catch(error => { console.error(error); process.exitCode=1; });
