// Real-browser QA runs in GitHub Actions; it does not require sync-service writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {chromium, webkit} from 'playwright-core';
import {namedPlanKey} from '../assets/simulator-model.js';
import {goalKey} from '../assets/simulator-goal-model.js';

const root = resolve(import.meta.dirname, '..'), output = '/tmp/poe2-goal-qa';
await mkdir(output, {recursive: true});
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp'};
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
const base = 'http://127.0.0.1:4173';
const examples = JSON.parse(await readFile(resolve(root, 'data/simulator-examples.json')));
const target = structuredClone(examples.examples.find(example => example.id === 'complete-mercenary-twister-gemling').saved);
const current = structuredClone(target);
current.notes = 'PRESERVE THE ACTIVE DRAFT';
current.request.items = current.request.items.filter(item => item.slot !== 'helmet');
current.request.socket_groups[0].gems.pop();
current.request.socket_groups[0].gems[0].level = 15;
current.request.allocated_nodes.pop();
const preset = target.preset, auto = 'poe2-simulator:v1:' + preset;
const named = JSON.stringify({version: 1, plans: [{id: 'qa-goal-target', name: 'QA target <img src=x onerror=alert(1)>', saved: target}]});
const ready = async page => {
  try {
    await page.waitForFunction(() => document.querySelector('#sim-stats')?.getAttribute('aria-busy') === 'false' && !!window.Poe2SimulatorLibrary?.goalData(), undefined, {timeout: 100000});
  } catch (cause) {
    throw Error('Simulator initialization: ' + await page.locator('#sim-status').textContent() + ' / ' + await page.locator('#sim-error').textContent(), {cause});
  }
};
const open = async (page, selector) => { if (!await page.locator(selector).evaluate(element => element.open)) await page.locator(selector + '>summary').click(); };
const reports = [];
try {
  for (const [engine, name] of [[chromium, 'chromium'], [webkit, 'webkit']]) {
    const browser = await engine.launch();
    try {
      for (const width of [320, 1366]) for (const locale of ['', '/en']) {
        const context = await browser.newContext({viewport: {width, height: 900}, isMobile: width < 500, hasTouch: width < 500});
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => /google-analytics|googletagmanager|googlesyndication|doubleclick/.test(route.request().url()) ? route.abort() : route.continue());
        await context.addInitScript(values => {
          if (location.origin === 'http://127.0.0.1:4173' && !sessionStorage.getItem('goal-qa-seeded')) {
            for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
            sessionStorage.setItem('goal-qa-seeded', '1');
          }
        }, {[auto]: JSON.stringify(current), [namedPlanKey(preset)]: named});
        const label = `${name}-${width}-${locale ? 'en' : 'ja'}`;
        try {
          await page.goto(base + locale + '/simulator/?build=' + preset);
          await ready(page); await open(page, '#sim-goal-panel');
          const draft = await page.evaluate(key => localStorage.getItem(key), auto);
          await page.locator('#sim-goal-select').selectOption('plan:qa-goal-target');
          await page.locator('#sim-goal-set').click();
          assert.equal(await page.evaluate(key => localStorage.getItem(key), auto), draft);
          assert.equal(await page.locator('#sim-goal-name img').count(), 0);
          assert.equal(await page.locator('[data-goal-group="gems"] summary span').textContent(), '2');
          assert.equal(await page.locator('[data-goal-group="passives"] summary span').textContent(), '1');
          assert.equal(await page.locator('[data-goal-group="equipment"] summary span').textContent(), '1');
          const goal = await page.evaluate(key => localStorage.getItem(key), goalKey(preset));
          await open(page, '[data-goal-group="gems"]');
          await page.locator('[data-goal-group="gems"] .skill-icon').first().waitFor();
          await page.locator('[data-goal-edit="gems"]').click();
          await page.locator('[data-group="0"] [data-gem="0"] [data-gem-field="level"]').fill('20');
          await page.locator('[data-group="0"] [data-gem="0"] [data-gem-field="level"]').press('Tab');
          await page.waitForFunction(() => document.querySelector('[data-goal-group="gems"] summary span').textContent === '1');
          assert(await page.locator('[data-goal-group="gems"]').evaluate(element => element.open));
          await open(page, '[data-goal-group="equipment"]');
          await page.locator('[data-goal-edit="equipment"]').click();
          await page.locator('[data-slot="boots"]').click();
          await page.locator('[data-equipment-mode="rare"]').click();
          await page.locator('#sim-rare-name').fill('UNAPPLIED INPUT');
          await page.locator('[data-goal-edit="equipment"]').click();
          assert.equal(await page.locator('#sim-rare-name').inputValue(), 'UNAPPLIED INPUT');
          await open(page, '[data-goal-group="passives"]');
          const beforeNode = await page.evaluate(key => localStorage.getItem(key), auto);
          await page.locator('[data-goal-node]').click();
          assert.equal(await page.evaluate(key => localStorage.getItem(key), auto), beforeNode);
          assert.equal(await page.evaluate(key => localStorage.getItem(key), goalKey(preset)), goal);
          await page.reload(); await ready(page); await open(page, '#sim-goal-panel');
          assert.equal(await page.evaluate(key => localStorage.getItem(key), goalKey(preset)), goal);
          assert.equal(await page.locator('[data-goal-group="gems"] summary span').textContent(), '1');
          if (locale) assert(!(await page.locator('#sim-goal-panel').innerText()).match(/[ぁ-んァ-ヶ一-龥]/), 'English target controls must be localized');
          await page.goto(base + locale + '/simulator/?build=ranger-ice-shot-deadeye'); await ready(page); await open(page, '#sim-goal-panel');
          assert.equal(await page.locator('#sim-goal-active').isVisible(), false, 'targets are isolated by build');
          await page.goto(base + locale + '/simulator/?build=' + preset); await ready(page); await open(page, '#sim-goal-panel');
          await open(page, '[data-goal-group="gems"]'); await open(page, '[data-goal-group="passives"]');
          assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), label + ': overflow');
          await page.locator('#sim-goal-panel').screenshot({path: resolve(output, label + '.png')});
          await page.locator('#sim-goal-clear').click();
          assert.equal(await page.evaluate(key => localStorage.getItem(key), goalKey(preset)), null);
          assert.equal(await page.evaluate(key => localStorage.getItem(key), namedPlanKey(preset)), named);
          assert.deepEqual(errors, [], label + ': page errors');
          reports.push(label);
          console.log('PASS: ' + label + ' target checklist workflow');
        } catch (error) {
          console.error(label, await page.locator('#sim-goal-status').textContent().catch(() => ''), 'page errors:', errors);
          await page.screenshot({path: resolve(output, label + '-failure.png')}).catch(() => {});
          throw error;
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
  console.log(`PASS: ${reports.join(', ')}; correct gaps, safe names, skill artwork, live updates, preserved inputs, passive navigation, reload, per-build targets, English UI and reset`);
} finally { await new Promise(resolve => server.close(resolve)); }
