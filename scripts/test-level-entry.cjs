const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const builds = JSON.parse(fs.readFileSync('data/builds.json', 'utf8'));
const script = fs.readFileSync('assets/detail.js', 'utf8');
const generator = fs.readFileSync('tools/generate-pages.mjs', 'utf8');
const build = builds.find(b => b.id === 'mercenary-twister-gemling');
const path = `builds/${build.classSlug}/${build.slug}/index.html`;
const url = `https://poe2-build-navi-jp.github.io/${path.replace('index.html', '')}`;
const key = `poe2:navi:level:${build.id}`;

async function runtime(seed = {}, query = '') {
  const dom = new JSDOM(fs.readFileSync(path, 'utf8'), {url: url + query, runScripts:'outside-only'});
  for (const [key,value] of Object.entries(seed)) dom.window.localStorage.setItem(key,value);
  dom.window.fetch = async () => ({ok:true,json:async()=>builds});
  dom.window.eval(script);
  await new Promise(resolve=>setTimeout(resolve,0));
  return dom;
}

(async()=>{
  for (const item of builds.filter(b=>b.status!=='draft')) {
    const dom = new JSDOM(fs.readFileSync(`builds/${item.classSlug}/${item.slug}/index.html`,'utf8'));
    const d = dom.window.document, input = d.getElementById('level-input');
    assert.equal(input.type,'number'); assert.equal(input.inputMode,'numeric');
    assert.equal(input.readOnly,false); assert.equal(input.disabled,false);
    assert.equal(input.min,'1'); assert.equal(input.max,'100'); assert.equal(input.step,'1');
    assert.equal(input.getAttribute('enterkeyhint'),'done');
    assert.equal(input.getAttribute('aria-label'),'現在レベル');
    assert.equal(input.getAttribute('aria-describedby'),'level-input-help');
    assert.match(d.getElementById('level-input-help').textContent,/数字を直接入力/);
    assert.equal(d.querySelectorAll('#level-minus, #level-plus').length,2);
    assert(d.getElementById('level-range'));
    assert(d.querySelector('link[href^="/assets/level-input.css"]'));
    assert(generator.includes(input.outerHTML), 'Input attributes must be in the generator');
    assert(generator.includes(d.getElementById('level-input-help').outerHTML), 'Help must be in the generator');
    dom.window.close();
  }
  assert.match(fs.readFileSync('assets/level-input.css','utf8'),/min-height:48px/);
  assert.match(fs.readFileSync('assets/level-input.css','utf8'),/font-size:1rem/);
  const dom = await runtime({[key]:'37'}), w = dom.window, d = w.document;
  const input = d.getElementById('level-input');
  const draft = value => {input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));};
  const expectLevel = value => {
    assert.equal(d.getElementById('level-output').value,`Lv${value}`);
    assert.equal(d.getElementById('level-range').value,String(value));
    assert.equal(w.localStorage.getItem(key),String(value));
    assert.equal(w.localStorage.getItem('poe2:navi:quick-level'),String(value));
  };
  expectLevel(37);
  const originalURL = w.location.href;
  const originalProgress = d.querySelector('#progress-checks input');
  input.dispatchEvent(new w.Event('blur'));
  assert.equal(w.location.href,originalURL,'Leaving an unchanged input must not add a query');
  assert.equal(d.querySelector('#progress-checks input'),originalProgress,'Unchanged blur must preserve progress checkbox nodes');
  draft(''); input.dispatchEvent(new w.Event('blur')); assert.equal(input.value,'37');
  assert.equal(w.location.href,originalURL,'Cancelling an empty draft must not add a query');
  draft(''); assert.equal(input.value,''); expectLevel(37);
  draft('7'); assert.equal(input.value,'7'); expectLevel(37);
  draft('79'); assert.equal(input.value,'79'); expectLevel(37);
  assert.equal(w.location.href,originalURL,'Draft typing must not alter the URL');
  const enter = new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
  input.dispatchEvent(enter); assert(enter.defaultPrevented); expectLevel(79);
  assert.equal(w.location.search,'?level=79');
  const committedProgress = d.querySelector('#progress-checks input');
  input.dispatchEvent(new w.Event('change')); input.dispatchEvent(new w.Event('blur'));
  assert.equal(d.querySelector('#progress-checks input'),committedProgress,'Repeated commit must preserve progress nodes');
  assert.equal(d.getElementById('gear-check-link').search,'?build=mercenary-twister-gemling&level=79&concern=purchase');
  d.getElementById('level-plus').click(); assert.equal(input.value,'80'); expectLevel(80);
  d.getElementById('level-minus').click(); assert.equal(input.value,'79'); expectLevel(79);
  draft('42'); expectLevel(79); input.dispatchEvent(new w.Event('blur')); expectLevel(42);
  input.stepUp(); input.dispatchEvent(new w.Event('input')); input.dispatchEvent(new w.Event('change')); expectLevel(43);
  draft(''); input.dispatchEvent(new w.Event('blur')); assert.equal(input.value,'43'); expectLevel(43);
  draft('invalid'); input.dispatchEvent(new w.Event('change')); assert.equal(input.value,'43'); expectLevel(43);
  for (const [value,expected] of [['999',100],['0',1],['37.5',37],['79',79]]) {
    draft(value); input.dispatchEvent(new w.Event('blur')); assert.equal(input.value,String(expected)); expectLevel(expected);
  }
  const saved = Object.fromEntries(Object.keys(w.localStorage).map(k=>[k,w.localStorage.getItem(k)]));
  const reload = await runtime(saved);
  assert.equal(reload.window.document.getElementById('level-input').value,'79'); reload.window.close();
  const explicit = await runtime(saved,'?level=37');
  assert.equal(explicit.window.document.getElementById('level-input').value,'37'); explicit.window.close();
  d.getElementById('level-range').value='91';d.getElementById('level-range').dispatchEvent(new w.Event('input'));expectLevel(91);
  assert.equal(input.value,'91');
  w.close();
  console.log('PASS: all 12 build inputs are editable and labeled; draft typing, Enter/blur, +/−, native step, slider, bounds, URL and reload persistence');
})().catch(error=>{console.error(error);process.exitCode=1;});
