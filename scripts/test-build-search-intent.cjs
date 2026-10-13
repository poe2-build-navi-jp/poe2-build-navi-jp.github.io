// Search-intent contract: answers and constraints are visible; evidence is not a rank.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const builds = JSON.parse(read('data/builds.json')).filter(build => build.status !== 'draft');
const comparison = JSON.parse(read('data/build-search-comparison.json'));
const base = 'https://poe2-build-navi-jp.github.io';
const home = new JSDOM(read('index.html'), {url: base}).window.document;
const best = new JSDOM(read('best-builds/index.html'), {url: base + '/best-builds/'}).window.document;
const visible = node => node && !node.closest('details:not([open]),[hidden]');
assert(visible(home.querySelector('.mobile-lead')), 'General build guidance is visible immediately');
assert(visible(home.querySelector('.hero-actions a[href="/best-builds/"]')), 'Strongest-build comparison has a direct visible entrance');
assert(visible(home.querySelector('.hero-actions a[href="/beginner-builds/"]')), 'Existing beginner entrance is preserved');
assert(visible(best.querySelector('#best-answer')), 'Answer-first comparison is not hidden in details');
assert.match(read('assets/build-search.css'), /\.best-build-sources \.source-list li\{display:block\}/, 'Source dates must not become separate inherited flex columns');
assert.match(read('assets/build-search.css'), /\.best-build-sources \.source-list time\{white-space:nowrap\}/, 'A source date must stay readable on one line');
assert(best.querySelector('#best-answer').compareDocumentPosition(best.querySelector('#best-candidates')) & 4);
assert.match(best.querySelector('title').textContent, /^PoE2 最強ビルド｜/);
assert.match(best.querySelector('h1').textContent, /^PoE2 最強ビルド｜/);
assert.equal(best.querySelectorAll('h1').length, 1);
assert.equal(best.querySelector('link[rel="canonical"]').href, base + '/best-builds/');
assert(!best.querySelector('meta[name="robots"]').content.includes('noindex'));
assert.match(best.querySelector('#best-answer').textContent, /実測順位ではありません/);
assert.match(best.querySelector('#best-answer').textContent, /全ビルドの再検証日ではありません/);
assert.match(best.querySelector('#best-answer').textContent, /ゲーム内の実測日とは区別/);
assert.equal(best.querySelectorAll('#best-candidates .purpose-card').length, comparison.candidates.length);
for (const candidate of comparison.candidates) {
  const build = builds.find(build => build.id === candidate.id);
  assert(build, candidate.id);
  const card = best.getElementById(`best-${candidate.anchor}`);
  assert(card && visible(card), candidate.anchor);
  for (const key of ['stage', 'conditions', 'budget']) {
    assert(candidate[key]?.trim());
    assert(card.textContent.includes(candidate[key]), `${candidate.id}: ${key} must match data`);
  }
  assert(visible(card.querySelector('.best-build-conditions')), 'Decision-critical conditions remain visible');
  assert.equal(card.querySelectorAll('.best-build-conditions dd').length, 3);
  for (const source of candidate.sources) {
    assert(build.sources.some(item => item.url === source.url), `${candidate.id}: source must be an existing named build reference`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(source.checkedAt));
    assert(source.checkedAt <= comparison.editedAt, 'Source review must not be dated after the comparison edit');
    const a = [...card.querySelectorAll('.source-list a')].find(a => a.href === source.url);
    assert(a && a.parentElement.textContent.includes(source.checkedAt));
  }
  const details = card.querySelector('details');
  assert.equal(details.open, false);
  details.querySelector('summary').click(); assert.equal(details.open, true);
  details.querySelector('summary').click(); assert.equal(details.open, false);
  const href = card.querySelector('a.button').getAttribute('href');
  assert.equal(href, `/builds/${build.classSlug}/${build.slug}/?level=1#now`);
  assert(card.querySelector(`a[href="/guides/unique-gear/#${build.id}"]`));
}
assert(!best.body.textContent.includes('低資産・SSF'), 'SSF must not be labeled as budget');
assert.match(best.querySelector('#best-budget').textContent, /取引を使わず/);
assert.match(best.querySelector('#best-budget').textContent, /必要通貨額は未検証/);
assert.equal(best.querySelectorAll('.comparison-table tbody tr').length, builds.length);
assert.equal(best.querySelectorAll('td[data-label="SSFの確認範囲"]').length, builds.length);
const minionRow = [...best.querySelectorAll('.comparison-table tbody tr')].find(row => row.textContent.includes('スナイパーミニオン'));
assert.match(minionRow.textContent, /初心者・SSF候補/, 'Multiple purposes are retained rather than overwritten');
const ids = [...best.querySelectorAll('[id]')].map(node => node.id);
assert.equal(ids.length, new Set(ids).size);
for (const a of best.querySelectorAll('a[href^="#"]')) assert(best.getElementById(a.hash.slice(1)), a.hash);
for (const a of best.querySelectorAll('a[href^="/"]')) {
  const url = new URL(a.href);
  const target = path.join(root, url.pathname, 'index.html');
  assert(fs.existsSync(target), url.pathname);
  if (url.hash) {
    const doc = new JSDOM(fs.readFileSync(target, 'utf8')).window.document;
    assert(doc.getElementById(url.hash.slice(1)), url.pathname + url.hash);
  }
}
const schema = [...best.querySelectorAll('script[type="application/ld+json"]')].map(script => JSON.parse(script.textContent));
const collection = schema.find(item => item['@type'] === 'CollectionPage');
assert(collection);
assert.equal(collection.url, best.querySelector('link[rel="canonical"]').href);
assert.equal(collection.name, best.title);
assert.equal(collection.mainEntity.itemListOrder, 'https://schema.org/ItemListUnordered');
const uniqueIds = [...new Set(comparison.candidates.map(candidate => candidate.id))];
assert.equal(collection.mainEntity.numberOfItems, uniqueIds.length);
assert.equal(collection.mainEntity.itemListElement.length, uniqueIds.length);
assert(!schema.some(item => ['FAQPage','AggregateRating','Review'].includes(item['@type'])), 'No rich-result or rating claims are manufactured');
assert.match(read('tier-list/index.html'), /PoE2 0.5.5初心者向けビルドTier/);
console.log('PASS: visible build-search answers, scoped candidates and dates, budget/SSF separation, source links, native disclosure, intent ownership and unranked schema');
