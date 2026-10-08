// Entry-page disclosures reduce the initial reading load without deleting guide content.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const root = path.resolve(__dirname, '..');
const base = 'https://poe2-build-navi-jp.github.io';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pages = [
  {file: 'index.html', route: '/', beginner: false},
  {file: 'beginner-builds/index.html', route: '/beginner-builds/', beginner: true}
];
const script = read('assets/mobile-summary.js');
const parse = (html, route = '/') => new JSDOM(html, {url: base + route});
const underClosedDetails = node => Boolean(node.closest('details:not([open])'));

function disclosure(document, selector) {
  const nodes = document.querySelectorAll(selector);
  assert.equal(nodes.length, 1, `${selector}: exactly one disclosure`);
  const details = nodes[0];
  assert.equal(details.tagName, 'DETAILS');
  assert.equal(details.open, false, `${selector}: initially collapsed`);
  assert.equal(details.firstElementChild.tagName, 'SUMMARY');
  assert(details.firstElementChild.textContent.trim(), `${selector}: accessible summary text`);
  assert.equal(details.querySelectorAll(':scope > summary').length, 1);
  assert(!details.hasAttribute('hidden'), 'Native details must remain discoverable without JS');
  // jsdom implements the native summary activation behavior without our enhancement script.
  details.firstElementChild.click();
  assert.equal(details.open, true, `${selector}: native summary opens without JS`);
  details.firstElementChild.click();
  assert.equal(details.open, false, `${selector}: native summary closes without JS`);
  return details;
}

function preservedContent(html) {
  const dom = parse(html), document = dom.window.document;
  document.querySelectorAll('[data-mobile-added], details[data-mobile-summary] > summary').forEach(n => n.remove());
  const walker = document.createTreeWalker(document.body, dom.window.NodeFilter.SHOW_TEXT);
  const text = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement.closest('script, style') && node.textContent.trim()) text.push(node.textContent.trim());
  }
  const content = {
    text: text.sort(),
    links: [...document.querySelectorAll('a[href]')].map(a => `${a.getAttribute('href')} ${a.textContent.trim()}`).sort(),
    ids: [...document.querySelectorAll('[id]')].map(n => n.id).sort(),
    metadata: [...document.head.querySelectorAll('title,meta,link[rel="canonical"],script')].map(n => n.outerHTML).sort()
  };
  dom.window.close();
  return content;
}

function openRuntime(entry, hash = '') {
  const dom = new JSDOM(read(entry.file), {url: base + entry.route + hash, runScripts: 'outside-only'});
  const scrolled = [];
  dom.window.HTMLElement.prototype.scrollIntoView = function () { scrolled.push(this.id); };
  dom.window.eval(script);
  return {dom, document: dom.window.document, window: dom.window, scrolled};
}

(async () => {
  const {applyMobileSummary, restoreMobileSummary} = await import('../tools/mobile-summary.mjs');
  for (const entry of pages) {
    const html = read(entry.file), dom = parse(html, entry.route), document = dom.window.document;
    assert(document.body.classList.contains('summary-page'));
    assert.equal(document.querySelectorAll('h1').length, 1);
    const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
    assert.equal(new Set(ids).size, ids.length, `${entry.file}: all IDs are unique after regeneration`);
    assert.equal(document.querySelector('link[rel="canonical"]').href, base + entry.route);
    assert.equal(document.querySelectorAll('link[href^="/assets/mobile-summary.css"]').length, 1);
    assert.equal(document.querySelectorAll('script[src^="/assets/mobile-summary.js"]').length, 1);
    assert.equal(document.querySelector('script[src^="/assets/mobile-summary.js"]').defer, true);
    assert.equal(document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').length, 1);
    assert.equal(document.querySelectorAll('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]').length, 1);
    for (const details of document.querySelectorAll('details[data-mobile-summary]')) {
      assert.equal(details.open, false, 'No forced-open secondary blocks in static HTML');
      assert.equal(details.querySelectorAll(':scope > summary').length, 1);
    }
    const restored = restoreMobileSummary(html);
    assert.equal(parse(restored).window.document.querySelectorAll('[data-mobile-summary], [data-mobile-added]').length, 0);
    const applied = applyMobileSummary(restored, entry.beginner);
    assert.deepEqual(preservedContent(applied), preservedContent(restored), `${entry.file}: text, links, IDs, SEO, ads and analytics preserved`);
    assert.equal(applyMobileSummary(applied, entry.beginner), applied, `${entry.file}: applying the helper twice is stable`);
    assert.deepEqual(preservedContent(restoreMobileSummary(applied)), preservedContent(restored), `${entry.file}: restoration preserves original content`);
    dom.window.close();
  }

  const home = parse(read(pages[0].file)).window.document;
  for (const selector of [
    '.hero details[data-mobile-summary]', '#choose-class > details[data-mobile-summary]',
    '#recent-changes > details[data-mobile-summary]', '[aria-labelledby="quality-title"] > details[data-mobile-summary]',
    '#real-example > details[data-mobile-summary]'
  ]) disclosure(home, selector);
  assert.equal(home.querySelectorAll('#build-answers .info-card > details[data-mobile-summary]').length, 3);
  assert.equal(home.querySelectorAll('#class-grid [data-class-slug]').length, 8);
  assert(home.querySelector('#class-grid').closest('details[data-mobile-summary]'));
  assert(home.querySelector('#quick-start').compareDocumentPosition(home.querySelector('#recent-changes')) & 4, 'Collapsed changes follow the primary resume flow');
  assert(home.querySelector('#recent-changes').compareDocumentPosition(home.querySelector('#choose-class')) & 4, 'Recent-change markers retain their original generator position');
  for (const selector of ['.hero-actions', '#purpose-picks', '#quick-start', '#quick-class', '#quick-build', '#quick-level', '#quick-link']) {
    assert(home.querySelector(selector), selector);
    assert(!underClosedDetails(home.querySelector(selector)), `${selector}: primary flow stays outside collapsed blocks`);
  }
  for (const href of ['/guides/', '/beginner-guide/', '/gear-check/', '/class-check/', '/dictionary/', '/builds/', '/best-builds/', '/leveling/']) {
    assert(home.querySelector(`a[href="${href}"]`), `${href}: guide route retained`);
  }
  assert(home.querySelector('#featured-builds').closest('#purpose-picks'), 'Legacy comparison anchor remains on the short entry CTA');

  const beginner = parse(read(pages[1].file), pages[1].route).window.document;
  disclosure(beginner, '.site-header > details[data-mobile-summary]');
  disclosure(beginner, '.discovery-hero > details[data-mobile-summary]');
  const comparison = disclosure(beginner, '#featured-builds > details[data-mobile-summary]');
  assert.equal(comparison.querySelectorAll('.discovery-card').length, 6);
  assert.equal(beginner.querySelectorAll('#purpose-picks .purpose-card').length, 5);
  for (const card of beginner.querySelectorAll('#purpose-picks .purpose-card')) {
    assert(!underClosedDetails(card), 'All five quick choices are available immediately');
    assert.deepEqual([...card.querySelectorAll('.quick-choice-facts dt')].map(n => n.textContent), ['向いている人', '弱点', '切替時期']);
    assert(!underClosedDetails(card.querySelector('.quick-choice-facts')), 'Decision-critical facts remain visible');
    assert(!underClosedDetails(card.querySelector(':scope > a.button')), 'Each build CTA remains visible');
    assert(card.querySelector('.unified-facts').closest('details:not([open])'), 'Full sources remain available in native disclosure');
  }
  assert(beginner.querySelector('.site-nav a[href="/guides/"]'), 'Collapsed menu retains the guide hub');
  assert(!underClosedDetails(beginner.querySelector('main a[href="/beginner-guide/"]')), 'Basic guide remains a direct link');

  for (const [entry, hash, selector] of [
    [pages[0], '#choose-class', '#choose-class > details[data-mobile-summary]'],
    [pages[0], '#class-grid', '#choose-class > details[data-mobile-summary]'],
    [pages[0], '#home-build-routes', '.hero details[data-mobile-summary]'],
    [pages[1], '#featured-builds', '#featured-builds > details[data-mobile-summary]']
  ]) {
    const runtime = openRuntime(entry, hash);
    const details = runtime.document.querySelector(selector);
    assert(details.open, `${entry.route}${hash}: incoming deep link reveals its content`);
    assert(runtime.scrolled.includes(hash.slice(1)), 'Revealed target is scrolled into view');
    details.open = false;
    runtime.window.dispatchEvent(new runtime.window.PageTransitionEvent('pageshow', {persisted: true}));
    assert(details.open, 'Back/Forward page restore reopens the target');
    details.open = false;
    runtime.window.dispatchEvent(new runtime.window.HashChangeEvent('hashchange'));
    assert(details.open, 'Changed hashes reopen the target');
    runtime.dom.window.close();
  }
  const repeated = openRuntime(pages[1], '#featured-builds');
  const repeatedDetails = repeated.document.querySelector('#featured-builds > details[data-mobile-summary]');
  repeatedDetails.open = false;
  repeated.document.querySelector('a[href="#featured-builds"]').click();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert(repeatedDetails.open, 'Clicking the current comparison anchor again must reopen its content');
  repeated.dom.window.close();
  for (const hash of ['#missing-target', '#%E0%A4%A']) {
    const runtime = openRuntime(pages[0], hash);
    assert(!runtime.document.querySelector('details[data-mobile-summary][open]'), 'Unknown or malformed hashes must not open unrelated content');
    runtime.dom.window.close();
  }
  const tracked = openRuntime(pages[1]);
  const events = [];
  tracked.window.gtag = (...args) => events.push(args);
  tracked.document.addEventListener('click', event => event.preventDefault());
  tracked.window.eval(read('assets/build-ux.js'));
  tracked.document.querySelector('#purpose-picks .purpose-card > a.button').click();
  assert.deepEqual(events.map(event => event[1]), ['quick_pick_click', 'build_open'], 'Disclosure enhancement must not duplicate build analytics');
  tracked.dom.window.close();
  for (const file of ['builds/index.html', 'guides/index.html', 'leveling/index.html']) {
    assert(!read(file).includes('/assets/mobile-summary.'), `${file}: enhancement stays limited to the two entry pages`);
  }
  console.log('PASS: preserved content/metadata, native disclosure and primary CTAs, five choices and six comparisons, repeatable helper, incoming/repeated/restored deep links and unchanged analytics');
})().catch(error => { console.error(error); process.exitCode = 1; });
