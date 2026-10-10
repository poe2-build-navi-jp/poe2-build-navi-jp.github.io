const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {JSDOM} = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const script = read('assets/site-search.js');
const css = read('assets/site-search.css');
const visible = document => [...document.querySelectorAll('[data-search-entry]')].filter(element => !element.hidden);
const urls = document => visible(document).map(element => element.querySelector('a').getAttribute('href'));
function start(html, query = '') {
  const dom = new JSDOM(html, {url: `https://poe2-build-navi-jp.github.io/search/${query}`, runScripts: 'outside-only'});
  dom.window.eval(script);
  return dom;
}
function applyLocation(dom, q, type = 'all') {
  const params = new URLSearchParams({q, type});
  dom.window.history.replaceState(null, '', `/search/?${params}`);
  dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
}
function input(dom, q) {
  const element = dom.window.document.querySelector('[data-search-input]');
  element.value = q;
  element.dispatchEvent(new dom.window.Event('input', {bubbles: true}));
}
function click(dom, type) { dom.window.document.querySelector(`[data-search-filter="${type}"]`).click(); }
function traverse(dom, direction) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No ${direction} popstate`)), 2000);
    dom.window.addEventListener('popstate', () => { clearTimeout(timer); resolve(); }, {once: true});
    dom.window.history[direction]();
  });
}
function luminance(hex) {
  const c = hex.replace('#', '').match(/../g).map(n => parseInt(n, 16) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}
function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
(async () => {
  const generator = await import(pathToFileURL(path.join(root, 'tools/generate-site-search.mjs')));
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'poe2-search-'));
  const fixture = path.join(temp, 'fixture');
  const outputRoot = path.join(temp, 'output');
  fs.mkdirSync(fixture);
  try {
    for (const dir of ['data', 'guides', 'builds', 'dictionary', 'skills', 'equipment']) {
      if (fs.existsSync(path.join(root, dir))) fs.cpSync(path.join(root, dir), path.join(fixture, dir), {recursive: true});
    }
    const data = await generator.generateSiteSearch({root: fixture, outputRoot});
    const second = await generator.generateSiteSearch({root: fixture, outputRoot});
    assert.deepEqual(second.output, data.output, 'Repeated generation must be deterministic');
    const html = data.output['search/index.html'];
    const namesHtml = data.output['name-index/index.html'];
    const noJs = new JSDOM(html).window.document;
    assert.equal(noJs.querySelectorAll('[data-search-entry]').length, data.entries.length);
    assert.equal(visible(noJs).length, data.entries.length, 'All entries readable without JS');
    assert(noJs.querySelector('[data-search-form]').hidden, 'Do not expose non-working no-JS controls');
    assert(noJs.querySelector('noscript').textContent.includes('種類別一覧'));
    assert.equal(noJs.querySelectorAll('h1').length, 1);
    for (const [file, markup] of Object.entries(data.output)) {
      const document = new JSDOM(markup).window.document;
      const pathname = `/${file.replace('index.html', '')}`;
      assert.equal(document.querySelector('link[rel=canonical]').href, `${data.site.baseUrl}${pathname}`);
      assert(document.querySelector('meta[name=description]').content.length > 30);
      assert(document.querySelector('meta[property="og:image"]').content.endsWith('/images/poe2/og/poe2-beginner-guide-og.webp'));
      const schema = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
      assert(schema.some(value => value['@type'] === 'CollectionPage'));
      assert(schema.some(value => value['@type'] === 'BreadcrumbList'));
      const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
      assert.equal(new Set(ids).size, ids.length, `${file}: duplicate IDs`);
      for (const link of document.querySelectorAll('a[href^="#"]')) assert(document.getElementById(link.hash.slice(1)), `${file}: missing local anchor`);
    }
    const namesDoc = new JSDOM(namesHtml).window.document;
    assert(data.names.length >= 30);
    assert.equal(namesDoc.querySelectorAll('.name-index-link').length, data.names.length);
    for (const name of data.names) {
      const link = namesDoc.getElementById(`name-${name.slug}`).querySelector('.name-index-link');
      assert.equal(link.getAttribute('href'), name.href);
      assert(link.textContent.includes(name.name) && link.textContent.includes(name.englishName));
      await generator.verifyDestination(root, name.href);
    }
    for (const href of ['/name-index/', '/skills/', '/equipment/']) assert(noJs.querySelector(`a[href="${href}"]`));
    const form = noJs.querySelector('[data-search-form]');
    const shortcuts = noJs.querySelector('.discovery-shortcuts');
    assert(form.compareDocumentPosition(shortcuts) & 4, 'Search controls precede supplementary links');

    const dom = start(html, '?q=%EF%BC%A7%EF%BC%A5%EF%BC%AF%EF%BC%AE%EF%BC%AF%EF%BC%B2&type=name');
    const document = dom.window.document;
    assert(!document.querySelector('[data-search-form]').hidden);
    assert(urls(document).includes('/guides/act-1-walkthrough/#count-geonor'), 'NFKC full-width English');
    assert(visible(document).every(element => element.dataset.searchType === 'name'));
    for (const name of data.names) {
      for (const alias of [name.name, name.englishName, ...name.aliases]) {
        applyLocation(dom, alias, 'name');
        assert(urls(document).includes(name.href), `Missing name alias: ${alias}`);
      }
    }
    for (const entry of data.entries.filter(entry => ['skill', 'equipment'].includes(entry.type))) {
      for (const alias of [entry.title, entry.englishName, ...entry.aliases]) {
        applyLocation(dom, alias, entry.type);
        assert(urls(document).includes(entry.href), `Missing entity alias: ${alias}`);
      }
    }
    for (const [q, destination] of [
      ['CountGeonor', '/guides/act-1-walkthrough/#count-geonor'],
      ['cOuNt　 gEoNoR', '/guides/act-1-walkthrough/#count-geonor'],
      ['ジオ ノール', '/guides/act-1-walkthrough/#count-geonor'],
      ['アズマディ', '/guides/interlude-walkthrough/#qimah'],
      ['Tavakai', '/guides/act-4-walkthrough/#tavakai'],
      ['Thane Wulfric', '/guides/interlude-walkthrough/#ogham-finale'],
      ['Zelina', '/guides/interlude-walkthrough/#vaal-twins'],
      ['skill　gem', '/dictionary/skill-gem/'],
      ['Energy Shield', '/dictionary/energy-shield/'],
      ['ES', '/dictionary/energy-shield/'],
      ['Whirling Assault', '/skills/whirling-assault/'],
      ['ワーリングアサルト', '/skills/whirling-assault/'],
      ['The Taming', '/equipment/the-taming/'],
      ['テイミング', '/equipment/the-taming/'],
      ['Martial Artist', '/builds/monk/whirling-assault/'],
      ['Gemling Legionnaire', '/builds/mercenary/twister-gemling/'],
      ['Smith of Kitava', '/builds/warrior/shield-wall-smith/'],
      ['Spirit Walker', '/builds/huntress/companion/'],
      ['Stormweaver', '/builds/sorceress/spark-stormweaver/'],

      ['ＷＨＩＲＬＩＮＧ　ＡＳＳＡＵＬＴ', '/builds/monk/whirling-assault/']
    ]) {
      applyLocation(dom, q);
      assert(urls(document).includes(destination), `Spacing/case lookup: ${q}`);
    }
    for (const [type] of generator.SEARCH_TYPES) {
      applyLocation(dom, '', type);
      assert.equal(visible(document).length, data.entries.filter(entry => entry.type === type).length);
      assert(visible(document).every(element => element.dataset.searchType === type));
      assert.equal(document.querySelector(`[data-search-filter="${type}"]`).getAttribute('aria-pressed'), 'true');
    }
    applyLocation(dom, 'Count Geonor', 'equipment');
    assert.equal(visible(document).length, 0, 'Category filters combine with the query');
    assert(!document.querySelector('[data-search-empty]').hidden);
    assert(document.querySelector('[data-search-status]').textContent.includes('0件'));
    document.querySelector('[data-search-empty] [data-search-reset]').click();
    assert.equal(visible(document).length, data.entries.length);
    assert.equal(dom.window.location.search, '');
    assert.equal(document.activeElement, document.querySelector('[data-search-input]'));
    applyLocation(dom, '<img src=x onerror="alert(1)">');
    assert.equal(document.querySelector('[data-search-status]').querySelectorAll('img').length, 0);
    assert(document.querySelector('[data-search-status]').textContent.includes('<img'));
    applyLocation(dom, 'ジオノール', 'invalid-type');
    assert.equal(document.querySelector('[data-search-filter=all]').getAttribute('aria-pressed'), 'true');
    assert(urls(document).includes('/guides/act-1-walkthrough/#count-geonor'));
    dom.window.eval(script);
    assert.equal(document.querySelectorAll('[data-search-form]').length, 1, 'Repeated enhancement is safe');
    dom.window.close();

    const historyDom = start(html, '?utm_source=test#search-guide');
    input(historyDom, 'Count');
    const firstLength = historyDom.window.history.length;
    input(historyDom, 'Count Geonor');
    assert.equal(historyDom.window.history.length, firstLength, 'Typing does not create one entry per key');
    assert.equal(new URLSearchParams(historyDom.window.location.search).get('q'), 'Count Geonor');
    click(historyDom, 'name');
    await traverse(historyDom, 'back');
    assert.equal(historyDom.window.document.querySelector('[data-search-filter=all]').getAttribute('aria-pressed'), 'true');
    assert.equal(historyDom.window.document.querySelector('[data-search-input]').value, 'Count Geonor');
    await traverse(historyDom, 'forward');
    assert.equal(historyDom.window.document.querySelector('[data-search-filter=name]').getAttribute('aria-pressed'), 'true');
    historyDom.window.document.querySelector('[data-search-form]').dispatchEvent(new historyDom.window.Event('submit', {cancelable: true, bubbles: true}));
    historyDom.window.document.querySelector('[data-search-reset]').click();
    assert.equal(historyDom.window.location.search, '?utm_source=test', 'Preserve unrelated URL parameters');
    assert.equal(historyDom.window.location.hash, '#search-guide');
    await traverse(historyDom, 'back');
    assert.equal(historyDom.window.document.querySelector('[data-search-input]').value, 'Count Geonor');
    assert.equal(historyDom.window.document.querySelector('[data-search-filter=name]').getAttribute('aria-pressed'), 'true');
    historyDom.window.close();

    const hostile = {...data, entries: [{type: 'guide', title: '</script><img src=x onerror=alert(1)>', summary: '" autofocus onfocus="alert(1)', href: '/guides/skill-gems/', aliases: ['<svg onload=alert(1)>']}]};
    const hostileDoc = new JSDOM(generator.renderSearchPage(hostile)).window.document;
    assert.equal(hostileDoc.querySelectorAll('img,svg,[onerror],[onfocus],[autofocus]').length, 0, 'Data is escaped in HTML and JSON-LD');
    assert(!/\.innerHTML\s*=|insertAdjacentHTML|document\.write/.test(script), 'No unsafe dynamic HTML sinks');
    await assert.rejects(generator.verifyDestination(root, 'javascript:alert(1)'), /Unsafe/);
    await assert.rejects(generator.verifyDestination(root, '/guides/act-1-walkthrough/#missing-anchor'), /Missing guide anchor/);
    // CSS checks are static safeguards, not a claimed rendered viewport test.
    assert(css.includes('background:#10151b;color:#e7e9ec'));
    assert(css.includes('.site-discovery .breadcrumbs a{color:var(--discovery-muted)}'));
    assert(css.includes('@media(max-width:600px)'));
    assert(css.includes('grid-template-columns:minmax(0,1fr)'));
    assert(css.includes('min-width:0'));
    assert(css.includes('font-size:16px'));
    assert(css.includes('[hidden]{display:none!important}'));
    for (const [foreground, background] of [
      ['#e7e9ec', '#10151b'], ['#b7c2ce', '#10151b'], ['#eed29d', '#10151b'],
      ['#b7c2ce', '#18212b'], ['#eed29d', '#18212b'], ['#edf1f7', '#18212b'],
      ['#f0f2f5', '#0e151c'], ['#acb8c5', '#0e151c'], ['#edf0f5', '#253240'],
      ['#191c21', '#e7c588'], ['#f0deb9', '#18212b']
    ]) assert(contrast(foreground, background) >= 4.5, `Contrast ${foreground}/${background}`);

    // Missing optional entity data is allowed; malformed destinations are not.
    const entityFile = path.join(fixture, 'data/core-entities.json');
    const savedEntities = fs.existsSync(entityFile) ? fs.readFileSync(entityFile) : null;
    if (savedEntities) fs.unlinkSync(entityFile);
    const noEntities = await generator.collectSearchEntries(fixture);
    assert(!noEntities.entries.some(entry => ['skill', 'equipment'].includes(entry.type)));
    if (savedEntities) fs.writeFileSync(entityFile, savedEntities);
    const buildsFile = path.join(fixture, 'data/builds.json');
    const builds = JSON.parse(fs.readFileSync(buildsFile));
    builds[0].status = 'draft';
    fs.writeFileSync(buildsFile, JSON.stringify(builds));
    const withoutDraft = await generator.collectSearchEntries(fixture);
    assert(!withoutDraft.entries.some(entry => entry.type === 'build' && entry.href === `/builds/${builds[0].classSlug}/${builds[0].slug}/`));
    const nameFile = path.join(fixture, 'data/name-index.json');
    const malformed = JSON.parse(fs.readFileSync(nameFile));
    malformed[0].sectionId = 'not-in-data';
    fs.writeFileSync(nameFile, JSON.stringify(malformed));
    await assert.rejects(generator.collectSearchEntries(fixture), /unknown guide section/);
    console.log(`PASS: ${data.entries.length} searchable entries / ${data.names.length} names; bilingual aliases, six filters, NFKC/case/spacing, URL Back/Forward/reset, safe DOM, no-JS lists, exact anchors, metadata, optional entities, draft exclusion, deterministic generation, static mobile and contrast safeguards. No real browser viewport test was run.`);
  } finally {
    fs.rmSync(temp, {recursive: true, force: true});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
