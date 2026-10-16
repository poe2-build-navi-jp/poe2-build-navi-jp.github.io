import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { SITE, REPO, KEY_FILE, ENDPOINT, articleUrl, inspectArticle, validatePlan, digest } from './indexnow-content.mjs';
import { runIndexNow, verifyDeployment } from './indexnow-submit.mjs';
const root = resolve(import.meta.dirname, '..');
import { readdir } from 'node:fs/promises';
// The newest reviewed plan must describe the current pages (a later content change needs a new plan).
const planName = (await readdir(join(root, 'docs/indexnow'))).filter(name => name.endsWith('-changes.json')).sort().at(-1);
const original = JSON.parse(await readFile(join(root, 'docs/indexnow', planName), 'utf8'));
const planUrls = (await readFile(join(root, 'docs/indexnow', planName.replace('-changes.json', '-urls.txt')), 'utf8')).trim().split(/\s+/);
const plan = { ...original, urls: [original.urls[0]], deploymentCommit: '1'.repeat(40) };
const key = (await readFile(join(root, KEY_FILE), 'utf8')).trim();
const html = await readFile(join(root, 'index.html'), 'utf8');
const robots = await readFile(join(root, 'robots.txt'), 'utf8');
const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8');
const run = { id: 123, name: 'pages build and deployment', path: 'dynamic/pages/pages-build-deployment', head_sha: plan.deploymentCommit, head_branch: 'main', repository: { full_name: REPO }, event: 'dynamic', status: 'completed', conclusion: 'success', updated_at: '2026-10-13T11:00:00Z', html_url: `https://github.com/${REPO}/actions/runs/123` };
function fixture({ statuses = [200], changeHtml = s => s, wrongKey = false, branch = plan.deploymentCommit, failStatus, blockRobots = false, omitSitemap = false, wrongKeyAfterPost = false } = {}) {
  let posts = 0;
  const fetchFn = async (url, init = {}) => {
    if (init.method === 'POST') {
      assert.equal(url, ENDPOINT);
      assert.equal(init.redirect, 'manual');
      assert.deepEqual(JSON.parse(init.body), { host: new URL(SITE).host, key, keyLocation: `${SITE}/${KEY_FILE}`, urlList: plan.urls.map(e => e.url) });
      const status = statuses[Math.min(posts++, statuses.length - 1)];
      if (status === 'throw') throw new Error('connection lost');
      return new Response('', { status, headers: { 'Retry-After': '0' } });
    }
    if (url.endsWith('/branches/main')) return Response.json({ commit: { sha: branch } });
    if (url.includes('/actions/runs?')) return Response.json({ workflow_runs: [{ ...run, ...(failStatus ? { conclusion: failStatus } : {}) }] });
    if (url.endsWith(KEY_FILE)) return new Response(wrongKey || (wrongKeyAfterPost && posts > 0) ? 'bad' : key);
    if (url.endsWith('/robots.txt')) return new Response(blockRobots ? 'User-agent: *\nDisallow: /' : robots);
    if (url.endsWith('/sitemap.xml')) return new Response(omitSitemap ? '' : sitemap);
    if (url === plan.urls[0].url) return new Response(changeHtml(html), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    throw new Error(`Unexpected URL ${url}`);
  };
  return { fetchFn, posts: () => posts };
}
async function stateTest(callback) {
  const stateDir = await mkdtemp('/tmp/poe2-indexnow-test-');
  try { await callback(stateDir); } finally { await rm(stateDir, { recursive: true, force: true }); }
}
test('only explicit production canonical paths are allowed', () => {
  for (const url of ['http://poe2-build-navi-jp.github.io/', 'https://gemnao.pages.dev/', `${SITE}/?x=1`, `${SITE}/#x`, `${SITE}/builds`, `${SITE}/../`, `${SITE}/%61/`, `${SITE}:444/`]) assert.throws(() => articleUrl(url));
  assert.equal(validatePlan(original).urls.length, planUrls.length);
  assert.throws(() => validatePlan({ ...plan, urls: [{ ...plan.urls[0], beforeHash: plan.urls[0].afterHash }] }));
});
test('local verification resources match and Bing tag remains in head', () => {
  assert.equal(KEY_FILE, `${key}.txt`);
  assert.match(key, /^[a-f0-9]{32}$/);
  const head = html.match(/<head>([\s\S]+?)<\/head>/)[1];
  assert.equal([...head.matchAll(/name="msvalidate\.01"/g)].length, 1);
  assert.match(head, /name="msvalidate\.01" content="8C02613CB39D96A4B791BA7BCCACC2CF"/);
  assert.equal(inspectArticle(html, `${SITE}/`).hash, plan.urls[0].afterHash);
});
test('self canonical and robots are validated', () => {
  assert.throws(() => inspectArticle(html.replace(`href="${SITE}/"`, `href="${SITE}/wrong/"`), `${SITE}/`));
  assert.throws(() => inspectArticle(html.replace('index,follow', 'noindex,follow'), `${SITE}/`));
  assert.throws(() => inspectArticle(html, `${SITE}/`, new Headers({ 'X-Robots-Tag': 'noindex' })));
});
test('dry-run has zero network requests', async () => {
  const result = await runIndexNow({ plan, fetchFn: () => { throw new Error('No network'); } });
  assert.equal(result.posts, 0);
});
test('verify checks exact deployment, live key, sitemap and content but never posts', async () => {
  const f = fixture();
  const result = await runIndexNow({ plan, key, mode: 'verify', fetchFn: f.fetchFn });
  assert.equal(result.deployment.head, plan.deploymentCommit);
  assert.equal(f.posts(), 0);
  for (const options of [{ wrongKey: true }, { branch: '2'.repeat(40) }, { failStatus: 'failure' }, { blockRobots: true }, { omitSitemap: true }, { changeHtml: s => s.replace('POE2ビルドナビ ホーム', 'Changed').replace('<h1 id="hero-title">', '<h1 id="hero-title">changed') }]) {
    const bad = fixture(options);
    await assert.rejects(runIndexNow({ plan, key, mode: 'verify', fetchFn: bad.fetchFn }));
    assert.equal(bad.posts(), 0);
  }
});
for (const [status, expected] of [[200, 'accepted'], [202, 'key_validation_pending']]) test(`${status} is recorded once and not resent`, async () => stateTest(async stateDir => {
  const f = fixture({ statuses: [status] });
  const args = { plan, key, stateDir, mode: 'send', fetchFn: f.fetchFn };
  const first = await runIndexNow(args);
  assert.equal(first.status, expected); assert.equal(first.indexingConfirmed, false);
  assert.equal((await runIndexNow(args)).status, 'already_received'); assert.equal(f.posts(), 1);
  const state = JSON.parse(await readFile(join(stateDir, 'receipts.json')));
  assert.equal(Object.values(state.entries)[0].httpStatus, status);
}));
for (const status of ['throw', 503]) test(`${status} outcome is preserved and blocks resubmission`, async () => stateTest(async stateDir => {
  const f = fixture({ statuses: [status] });
  const args = { plan, key, stateDir, mode: 'send', fetchFn: f.fetchFn };
  await assert.rejects(runIndexNow(args));
  await assert.rejects(runIndexNow(args));
  assert.equal(f.posts(), 1);
  const state = JSON.parse(await readFile(join(stateDir, 'receipts.json')));
  assert.equal(Object.values(state.entries)[0].status, 'uncertain');
}));
test('explicit 429 may retry at most three times', async () => stateTest(async stateDir => {
  const f = fixture({ statuses: [429] });
  await assert.rejects(runIndexNow({ plan, key, stateDir, mode: 'send', fetchFn: f.fetchFn, sleep: async () => {} }));
  assert.equal(f.posts(), 3);
}));
test('in-flight durable state and concurrent lock prevent a second request', async () => stateTest(async stateDir => {
  const f = fixture();
  await writeFile(join(stateDir, 'submission.lock'), '');
  await assert.rejects(runIndexNow({ plan, key, stateDir, mode: 'send', fetchFn: f.fetchFn }));
  await rm(join(stateDir, 'submission.lock'));
  const e = plan.urls[0], id = digest(`${e.url}\0${e.afterHash}`);
  await writeFile(join(stateDir, 'receipts.json'), JSON.stringify({ version: 1, origin: SITE, events: [], entries: { [id]: { url: e.url, contentHash: e.afterHash, commit: plan.deploymentCommit, checkId: 123, status: 'in_flight', attempts: 1, updatedAt: Date.now() } } }));
  await assert.rejects(runIndexNow({ plan, key, stateDir, mode: 'send', fetchFn: f.fetchFn }));
  assert.equal(f.posts(), 0);
}));

test('429 retry revalidates the live key and stops if it changed', async () => stateTest(async stateDir => {
  const f = fixture({ statuses: [429, 200], wrongKeyAfterPost: true });
  await assert.rejects(runIndexNow({ plan, key, stateDir, mode: 'send', fetchFn: f.fetchFn, sleep: async () => {} }), /key content does not match/);
  assert.equal(f.posts(), 1);
}));
