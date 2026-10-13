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
  d.getElementById('gear-level').dispatchEvent(new window.Event('change', {bubbles:true}));
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
  const levelInput = d.getElementById('gear-level');
  assert.equal(levelInput.type, 'number');
  assert.equal(levelInput.inputMode, 'numeric');
  assert.equal(levelInput.readOnly, false);
  assert.equal(levelInput.getAttribute('enterkeyhint'), 'done');
  assert.equal(levelInput.getAttribute('aria-describedby'), 'gear-level-help');
  assert.equal(levelInput.min, '1'); assert.equal(levelInput.max, '100'); assert.equal(levelInput.step, '1');
  assert.match(d.getElementById('gear-level-help').textContent, /数字を直接入力/);

  const empty = await runtime();
  assert.equal(empty.window.document.getElementById('gear-build').value, '');
  toggleWithoutChangingDiagnosis(empty); empty.window.close();

  const gemling = await runtime(`?build=${gemlingId}&level=79&concern=death`, {'poe2:navi:quick-level':'1'});
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
  toggleWithoutChangingDiagnosis(gemling);
  const savedSelection = selection(gemling.window).storage;
  gemling.window.close();

  const restored = await runtime('', savedSelection);
  assert.equal(restored.window.document.getElementById('gear-result-title').textContent, 'ツイスター・ジェムリング / Lv79');
  assert.equal(restored.window.document.getElementById('gear-level').value, '79', 'Reload must prefer saved gear Lv79 over stale quick Lv1');
  assert.equal(restored.window.localStorage.getItem('poe2:navi:quick-level'), '1', 'Gear diagnosis must not rewrite the homepage level');
  toggleWithoutChangingDiagnosis(restored); restored.window.close();
  const explicitSample = await runtime(new URL(link.href).search, savedSelection);
  assert.equal(explicitSample.window.document.getElementById('gear-result-title').textContent, 'アイスショット・デッドアイ / Lv37');
  assert.equal(explicitSample.window.document.getElementById('gear-concern').value, 'damage');
  toggleWithoutChangingDiagnosis(explicitSample); explicitSample.window.close();

  const levelCases = [
    {name:'URL level wins', query:'?level=37', gear:'79', quick:'1', expected:37},
    {name:'explicit URL level 1 wins', query:'?level=1', gear:'79', quick:'37', expected:1},
    {name:'first gear visit uses quick level', quick:'37', expected:37},
    {name:'no saved levels starts at 1', expected:1},
    {name:'minimum gear level is valid', gear:'1', quick:'37', expected:1},
    {name:'maximum gear level is valid', gear:'100', quick:'37', expected:100},
    ...['', ' ', 'invalid', 'NaN', 'Infinity', '0', '-1', '101', '999', '37.5'].map(gear => ({name:`invalid gear ${JSON.stringify(gear)} uses quick level`, gear, quick:'37', expected:37})),
    ...['', ' ', 'invalid', '0', '101', '37.5'].map(quick => ({name:`invalid quick ${JSON.stringify(quick)} starts at 1`, gear:'invalid', quick, expected:1})),
    {name:'invalid URL falls back to valid gear level', query:'?level=999', gear:'79', quick:'1', expected:79}
  ];
  for (const {name,query='',gear,quick,expected} of levelCases) {
    const seed = {'poe2:navi:gear-build':gemlingId};
    if (gear !== undefined) seed['poe2:navi:gear-level'] = gear;
    if (quick !== undefined) seed['poe2:navi:quick-level'] = quick;
    const dom = await runtime(query, seed), d = dom.window.document;
    assert.equal(d.getElementById('gear-level').value, String(expected), name);
    assert.equal(d.getElementById('gear-result-title').textContent, `ツイスター・ジェムリング / Lv${expected}`, name);
    assert.equal(dom.window.localStorage.getItem('poe2:navi:gear-level'), String(expected), name);
    assert.equal(d.getElementById('gear-example-details').open, false, name);
    dom.window.close();
  }

  const editing = await runtime('', savedSelection), ew = editing.window, ed = ew.document;
  const editInput = ed.getElementById('gear-level');
  const draft = value => { editInput.value=value; editInput.dispatchEvent(new ew.Event('input',{bubbles:true})); };
  const expectLevel = value => {
    assert.equal(ed.getElementById('gear-result-title').textContent, `ツイスター・ジェムリング / Lv${value}`);
    assert.equal(ew.localStorage.getItem('poe2:navi:gear-level'), String(value));
  };
  draft(''); assert.equal(editInput.value,''); expectLevel(79);
  ed.getElementById('gear-concern').value='damage';
  ed.getElementById('gear-concern').dispatchEvent(new ew.Event('input',{bubbles:true}));
  assert.equal(editInput.value,''); expectLevel(79);
  draft('7'); expectLevel(79); draft('79'); expectLevel(79);
  const enter = new ew.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
  const initialURL = ew.location.href;
  editInput.dispatchEvent(enter); assert(enter.defaultPrevented); assert.equal(ew.location.href,initialURL); expectLevel(79);
  draft('37'); expectLevel(79); editInput.dispatchEvent(new ew.Event('blur')); expectLevel(37);
  editInput.stepUp(); editInput.dispatchEvent(new ew.Event('input')); editInput.dispatchEvent(new ew.Event('change')); expectLevel(38);
  draft(''); editInput.dispatchEvent(new ew.Event('blur')); assert.equal(editInput.value,'38'); expectLevel(38);
  draft('invalid'); editInput.dispatchEvent(new ew.Event('change')); assert.equal(editInput.value,'38'); expectLevel(38);
  for (const [value,expected] of [['999',100],['0',1],['37.5',37],['79',79]]) {
    draft(value); editInput.dispatchEvent(new ew.Event('blur')); assert.equal(editInput.value,String(expected)); expectLevel(expected);
  }
  const afterTyping = selection(ew).storage; ew.close();
  const typedReload = await runtime('', afterTyping);
  assert.equal(typedReload.window.document.getElementById('gear-result-title').textContent,'ツイスター・ジェムリング / Lv79');
  toggleWithoutChangingDiagnosis(typedReload); typedReload.window.close();

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
  console.log('PASS: separate live result and collapsed sample; Gemling Lv79 reload; URL / gear / quick level precedence and invalid-value fallback; native toggle and localStorage isolation; explicit sample navigation; safe DOM; repeatable generation');
})().catch(error => { console.error(error); process.exitCode=1; });
