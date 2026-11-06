import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {JSDOM} from 'jsdom';

const root = resolve(import.meta.dirname, '..');
const read = path => readFile(resolve(root, path), 'utf8');
const sitemap = await read('sitemap.xml');
const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname);
const before = new Map(await Promise.all(paths.map(async path => [path, await read(`.${path}index.html`)])));
const dates = await read('data/page-dates.json');
for (const tool of ['enhance-editorial-trust', 'inject-analytics', 'sync-asset-versions']) execFileSync(process.execPath, [`tools/${tool}.mjs`], {cwd:root, stdio:'pipe'});
let count = 0;
for (const path of paths) {
 const html = await read(`.${path}index.html`);
 assert.equal(html, before.get(path), `Idempotence: ${path}`);
 const d = new JSDOM(html).window.document;
 const flatten = value => Array.isArray(value) ? value.flatMap(flatten) : [value, ...value?.['@graph'] ? flatten(value['@graph']) : []];
 const schemas = [...d.querySelectorAll('script[type="application/ld+json"]')].flatMap(s => flatten(JSON.parse(s.textContent)));
 const articles = schemas.filter(s => [].concat(s?.['@type'] || []).includes('Article'));
 if (!articles.length) continue;
 count++;
 assert.equal(articles.length, 1, `Duplicate Article: ${path}`);
 assert.equal(d.querySelectorAll('.editorial-credit').length, 1);
 assert.ok(d.querySelector('.editorial-credit a[href="/about/"]'));
 assert.ok(d.querySelector('.editorial-credit a[href="/editorial-policy/"]'));
 assert.ok(articles[0].author['@id']?.endsWith('/about/#organization'));
 assert.ok(articles[0].isPartOf['@id']?.endsWith('/#website'));
}
assert.equal(await read('data/page-dates.json'), dates);
assert.equal(await read('sitemap.xml'), sitemap);

const code = await read('assets/analytics-events.js');
const dom = new JSDOM('<header><a id="header" href="/guides/act-2/">Guide</a></header><main><a id="build" href="/builds/monk/whirling-assault/?secret=hidden">Build</a><a id="next" href="/guides/act-2/?private=hidden">Next</a><a id="same" href="#section">Anchor</a><a id="trade" href="https://www.pathofexile.com/trade2/search/league/item?private=hidden">Trade</a><div class="sources"><a id="source" href="https://poe2db.tw/us/Item?private=hidden">Source</a></div><a id="fake" href="https://example.com/builds/monk/whirling-assault/">External</a></main>', {url:'https://poe2-build-navi-jp.github.io/guides/valuable-drops-early/', runScripts:'outside-only'});
const events = [];
dom.window.gtag = (...args) => events.push(args);
dom.window.eval(code);
for (const id of ['build','next','same','trade','source','fake','header']) dom.window.document.getElementById(id).dispatchEvent(new dom.window.MouseEvent('click', {bubbles:true}));
assert.deepEqual(events.map(e => e[1]), ['guide_build_click','guide_next_click','guide_trade_click','guide_source_click']);
assert.ok(!JSON.stringify(events).includes('hidden'));
assert.equal(events[0][2].destination_path, '/builds/monk/whirling-assault/');
assert.equal(events[3][2].source_host, 'poe2db.tw');
dom.window.close();
console.log(`PASS: ${count} article identities/credits, generation idempotence, date preservation and guide journey events`);
