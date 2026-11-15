// CI only: update-review navigation and real planner downloads in Chromium/WebKit.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {chromium, webkit} from 'playwright-core';
import {namedPlanKey} from '../assets/simulator-model.js';
const root = resolve(import.meta.dirname, '..'), output = '/tmp/poe2-progress-qa';
await mkdir(output, {recursive: true});
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp'};
const server = createServer(async (request, response) => {
  try {
    let path = new URL(request.url, 'http://localhost').pathname;
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(root, '.' + decodeURIComponent(path));
    if (!file.startsWith(root + '/')) throw Error('outside');
    response.writeHead(200, {'Content-Type': types[extname(file)] || 'application/octet-stream'});
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(4173, '127.0.0.1', resolve));
const examples = JSON.parse(await readFile(resolve(root, 'data/simulator-examples.json')));
const saved = structuredClone(examples.examples.find(example => example.id === 'complete-mercenary-twister-gemling').saved);
saved.notes = 'PRIVATE NOTES NEVER IN PUBLIC EXPORT';
saved.calculation = {...saved.calculation, engine: saved.engine, dataVersion: '0.5.5.5', guideRevision: 'earlier-guide'};
const preset = saved.preset, auto = 'poe2-simulator:v1:' + preset;
const named = JSON.stringify({version: 1, plans: [{id: 'qa-review-source', name: 'QA <img src=x onerror=alert(1)>', saved}]});
const open = async (page, selector) => {
  if (!await page.locator(selector).evaluate(element => element.open)) {
    await page.locator(selector + '>summary').click();
  }
};
try {
  for (const [engine, browserName] of [[chromium, 'chromium'], [webkit, 'webkit']]) {
    const browser = await engine.launch();
    try {
      for (const [width, locale] of [[320, ''], [1366, '/en']]) {
        const context = await browser.newContext({viewport: {width, height: 900}, isMobile: width < 500, hasTouch: width < 500, acceptDownloads: true});
        const page = await context.newPage(), errors = [], label = browserName + '-' + width + (locale ? '-en' : '-ja');
        page.on('pageerror', error => errors.push(error.message));
        await context.addInitScript(values => {
          if (location.origin === 'http://127.0.0.1:4173') for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
        }, {[auto]: JSON.stringify(saved), [namedPlanKey(preset)]: named});
        await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4173' ? route.continue() : route.abort());
        try {
          await page.goto('http://127.0.0.1:4173' + locale + '/simulator/?build=' + preset, {waitUntil: 'domcontentloaded'});
          await page.waitForFunction(() => document.querySelector('#sim-stats')?.getAttribute('aria-busy') === 'false' && !document.querySelector('#sim-planner-check')?.disabled, undefined, {timeout: 100000});
          await page.locator('.sim-impact-details').first().waitFor({state: 'attached'});
          const before = await page.evaluate(key => localStorage.getItem(key), auto);
          await open(page, '#sim-updates-panel');
          const target = '[data-update-id="one-zero-passive-review"]';
          await open(page, target + '>.sim-impact-details');
          assert.equal(await page.locator(target + ' h5 img').count(), 0, 'a named save is escaped');
          await page.locator(target + ' [data-impact-notice]').click();
          assert(await page.locator('#sim-slots [data-impact-review]').count() > 0);
          await page.locator('[data-impact-editor="passive"]').click();
          await page.locator('#sim-tree circle[data-impact-review]').first().waitFor();
          assert.equal(await page.evaluate(key => localStorage.getItem(key), auto), before, 'review cannot allocate nodes or change the active save');
          await page.locator('#sim-impact-clear').click();
          assert.equal(await page.locator('[data-impact-review]').count(), 0);
          await open(page, '#sim-planner-panel');
          await page.locator('#sim-planner-name').fill('QA build planner');
          await page.locator('#sim-planner-check').click();
          assert(await page.locator('#sim-planner-download').isEnabled());
          const downloadWait = page.waitForEvent('download');
          await page.locator('#sim-planner-download').click();
          const download = await downloadWait;
          assert(download.suggestedFilename().endsWith('.build'));
          const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
          assert.equal(exported.name, 'QA build planner');
          assert.equal(exported.skills[0].id, 'Metadata/Items/Gem/SkillGemTwister');
          assert.equal(exported.skills[0].support_skills.length, 3);
          assert(exported.passives.length > 20);
          assert(!JSON.stringify(exported).includes(saved.notes));
          assert.equal(await page.evaluate(key => localStorage.getItem(key), auto), before);
          await page.locator('[data-tab="skills"]').click();
          const level = page.locator('[data-group="0"] [data-gem="0"] [data-gem-field="level"]');
          await level.fill('15'); await level.press('Tab');
          await page.waitForFunction(() => document.querySelector('#sim-planner-download').disabled);
          await page.locator('#sim-planner-source').selectOption('qa-review-source');
          await page.locator('#sim-planner-check').click();
          assert(await page.locator('#sim-planner-download').isEnabled());
          if (locale) assert(!(await page.locator('#sim-planner-panel').innerText()).match(/[ぁ-んァ-ヶ一-龥]/));
          assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), label + ': overflow');
          assert.equal(await page.evaluate(key => localStorage.getItem(key), namedPlanKey(preset)), named, 'export never rewrites its named source');
          assert.deepEqual(errors, []);
          await page.locator('#sim-planner-panel').screenshot({path: resolve(output, label + '.png')});
          console.log('PASS: ' + label + ' update review and .build download');
        } catch (cause) {
          console.error(label, await page.locator('#sim-error').textContent().catch(() => ''), errors);
          await page.screenshot({path: resolve(output, label + '-failure.png')}).catch(() => {});
          throw cause;
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
