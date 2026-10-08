// The home page stays short; the beginner page owns the existing recommendation cards.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const root = path.resolve(__dirname, '..');
const base = 'https://poe2-build-navi-jp.github.io';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const builds = JSON.parse(read('data/builds.json'));
const discovery = JSON.parse(read('data/discovery.json'));
const site = JSON.parse(read('data/site.json'));
const home = new JSDOM(read('index.html'), {url: `${base}/`}).window.document;
const beginner = new JSDOM(read('beginner-builds/index.html'), {url: `${base}/beginner-builds/`}).window.document;
const buildUrl = build => `/builds/${build.classSlug}/${build.slug}/`;

function only(document, selector, label = selector) {
  const nodes = document.querySelectorAll(selector);
  assert.equal(nodes.length, 1, `${label} must appear exactly once`);
  return nodes[0];
}

const cta = only(home, 'section#purpose-picks', 'home beginner CTA');
assert.equal(only(home, '#featured-builds').closest('#purpose-picks'), cta,
  'both old homepage recommendation anchors must lead to the short CTA');
assert.equal(home.querySelectorAll('.purpose-card, .discovery-card').length, 0,
  'the homepage must not duplicate the moved recommendation cards');
assert(cta.querySelector('a[href="/beginner-builds/#featured-builds"]'),
  'the old featured-builds anchor needs a route to the detailed comparison');
const homeBeginnerLinks = [...home.querySelectorAll('.hero-actions a, #purpose-picks a')]
  .filter(link => link.pathname === '/beginner-builds/');
assert(homeBeginnerLinks.length >= 2, 'hero and short CTA must both reach the beginner page');
for (const link of homeBeginnerLinks) {
  if (link.hash) assert(beginner.getElementById(link.hash.slice(1)), `missing beginner destination: ${link.href}`);
}
assert(cta.textContent.trim().length < 500, 'the homepage beginner CTA must remain short');
for (const id of ['quick-start', 'quick-class', 'quick-build', 'quick-level', 'quick-link', 'recent-changes', 'class-grid']) {
  only(home, `#${id}`, `home ${id}`);
}
const homeSections = [...home.querySelectorAll('main section')];
assert(homeSections.indexOf(cta) < homeSections.indexOf(home.getElementById('quick-start')),
  'resume controls must follow the beginner CTA');
assert(homeSections.indexOf(home.getElementById('quick-start')) < homeSections.indexOf(home.getElementById('recent-changes')),
  'recent changes must remain after resume controls');
assert.equal(home.querySelectorAll('[data-class-slug]').length, 8, 'all class choices stay on home');

const quickSection = only(beginner, 'section#purpose-picks');
const featuredSection = only(beginner, 'section#featured-builds');
const quickCards = [...quickSection.querySelectorAll('.purpose-card')];
const featuredCards = [...featuredSection.querySelectorAll('.discovery-card')];
const quickIds = ['witch-minion-infernalist', 'ranger-ice-shot-deadeye', 'monk-whirling-assault',
  'sorceress-spark-stormweaver', 'witch-ed-contagion-lich'];
assert.equal(quickCards.length, 5);
assert.equal(featuredCards.length, 6);
const cardDestination = card => only(card, ':scope > a.button').pathname;
assert.deepEqual(quickCards.map(cardDestination), quickIds.map(id => buildUrl(builds.find(build => build.id === id))),
  'the existing five quick choices and their order must be retained');
assert.deepEqual(featuredCards.map(cardDestination), discovery.featuredBuildIds.map(id => buildUrl(builds.find(build => build.id === id))),
  'featured choices and order must come from discovery data');
assert(quickSection.compareDocumentPosition(featuredSection) & 4, 'quick choices must precede detailed comparison');
for (const card of quickCards) {
  const details = only(card, 'details');
  assert.equal(details.open, false, 'source details must initially be collapsed');
  assert.equal(only(card, '.unified-facts').closest('details'), details, 'full quick-choice facts stay in details');
  assert(card.querySelector('a[href$="#source-list"]'), 'the original build source list must remain reachable');
}
for (const [index, card] of featuredCards.entries()) {
  assert.deepEqual([...card.querySelectorAll('.build-tags span')].map(tag => tag.textContent),
    discovery.featuredBuildTags[discovery.featuredBuildIds[index]], 'featured tags must remain data-backed');
}

assert.equal(only(beginner, 'h1').textContent.trim().length > 0, true);
assert.equal(only(beginner, 'link[rel="canonical"]').href, `${base}/beginner-builds/`);
assert.equal(only(beginner, 'meta[property="og:url"]').content, `${base}/beginner-builds/`);
assert(!only(beginner, 'meta[name="robots"]').content.includes('noindex'));
assert(only(beginner, 'meta[name="description"]').content.trim());
const schema = [...beginner.querySelectorAll('script[type="application/ld+json"]')]
  .flatMap(script => [].concat(JSON.parse(script.textContent)));
const breadcrumb = schema.find(item => item['@type'] === 'BreadcrumbList');
assert(breadcrumb, 'beginner page needs structured breadcrumbs');
assert.equal(breadcrumb.itemListElement.at(-1).item, `${base}/beginner-builds/`);
assert.equal((read('sitemap.xml').match(/<loc>https:\/\/poe2-build-navi-jp\.github\.io\/beginner-builds\/<\/loc>/g) || []).length, 1);
const status = only(beginner, '.update-strip');
for (const value of [discovery.patchVersion, site.latestPatch, site.latestPatchCheckedAt]) {
  assert(status.textContent.includes(value), `beginner page must preserve patch metadata: ${value}`);
}
assert(status.querySelector(`a[href="${site.latestPatchSource}"]`), 'patch verification source must be preserved');
const scriptPaths = [...beginner.querySelectorAll('script[src]')].map(script => new URL(script.src).pathname);
assert.equal(scriptPaths.filter(src => src === '/assets/build-ux.js').length, 1, 'beginner click tracking loads once');
assert(!scriptPaths.includes('/assets/app.js'), 'homepage-only controls must not initialize on beginner page');
assert(!scriptPaths.includes('/assets/analytics-events.js'), 'the new page does not expand scoped analytics events');

function htmlFiles(directory = root) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    if (entry.name.startsWith('.') || ['node_modules', 'assets', 'data', 'images', 'scripts', 'tools', 'tests', 'company'].includes(entry.name)) return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(file) : entry.name.endsWith('.html') ? [file] : [];
  });
}
let navCount = 0;
for (const file of htmlFiles()) {
  const document = new JSDOM(fs.readFileSync(file, 'utf8')).window.document;
  for (const nav of document.querySelectorAll('.site-nav')) {
    const link = only(nav, 'a[href="/beginner-builds/"]', `${path.relative(root, file)} beginner navigation`);
    assert.equal(link.textContent.trim(), '初心者おすすめ');
    assert.equal(link.getAttribute('aria-current'), file === path.join(root, 'beginner-builds/index.html') ? 'page' : null,
      `${path.relative(root, file)} beginner current-page state`);
    navCount++;
  }
}
assert(navCount > 0, 'common navigation must be checked');

(async () => {
  const {rows, factsHtml} = await import('../tools/build-facts.mjs');
  for (const card of [...quickCards, ...featuredCards]) {
    const build = builds.find(item => buildUrl(item) === cardDestination(card));
    const visibleFacts = [...card.querySelectorAll('.unified-facts > div')]
      .map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]);
    assert.deepEqual(visibleFacts, rows(build, discovery), `${build.id}: moved facts must match their original data`);
    const expected = new JSDOM(factsHtml(build, discovery)).window.document;
    const sources = document => [...document.querySelectorAll('.fact-source')].map(source => ({
      text: source.textContent, links: [...source.querySelectorAll('a')].map(link => link.getAttribute('href'))
    }));
    assert.deepEqual(sources(card), sources(expected), `${build.id}: source links and review dates must be retained`);
  }
  const runtime = new JSDOM(read('beginner-builds/index.html'), {url: `${base}/beginner-builds/`, runScripts: 'outside-only'});
  const events = [];
  runtime.window.gtag = (...args) => events.push(args);
  runtime.window.document.addEventListener('click', event => event.preventDefault());
  runtime.window.eval(read('assets/build-ux.js'));
  runtime.window.document.querySelector('#purpose-picks .purpose-card > a.button').click();
  assert.deepEqual(events.map(event => event[1]), ['quick_pick_click', 'build_open'],
    'moving quick picks must preserve the existing click events without duplicating them');
  runtime.window.close();
  console.log(`PASS: short home CTA, preserved anchors/resume, five quick and six featured choices, source facts, metadata, click events, and ${navCount} common menus`);
})().catch(error => { console.error(error); process.exitCode = 1; });
