import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {chromium, webkit} from 'playwright-core';
import {decodePlanLink, namedPlanKey} from '../assets/simulator-model.js';
const root = resolve(import.meta.dirname, '..'), output = '/tmp/poe2-community-qa';
await mkdir(output, {recursive: true});
const types = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm'};
const server = createServer(async (request, response) => {
  try {
    let path = new URL(request.url, 'http://localhost').pathname;
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(root, '.' + decodeURIComponent(path));
    if (!file.startsWith(root + '/')) throw Error('outside');
    const contents = await readFile(file);
    response.writeHead(200, {'Content-Type': types[extname(file)] || 'application/octet-stream'}); response.end(contents);
  } catch {response.writeHead(404); response.end('Not found');}
});
await new Promise(resolve => server.listen(4173, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:4173';
const sample = JSON.parse(await readFile(resolve(root, 'tools/community-service/src/samples.json')))[0].saved;
const saved = {...structuredClone(sample), notes: 'PRIVATE_QA_NOTE', equipmentDrafts: {helmet: 'PRIVATE_QA_DRAFT'}};
const named = JSON.stringify({version: 1, plans: [{id: 'community-test-save', name: 'QA saved input', saved}]});
try {
  for (const [engine, engineName] of [[chromium, 'chromium'], [webkit, 'webkit']]) {
    const browser = await engine.launch();
    try {
      for (const [width, locale, suffix] of [[320, '', 'A'], [1366, '/en', 'B']]) {
        const code = (engineName === 'chromium' ? 'C' : 'W').repeat(42) + suffix; // Disposable QA posts only.
        const label = engineName + '-' + width, title = 'QA community ' + label;
        const context = await browser.newContext({viewport: {width, height: 900}, isMobile: width < 500, hasTouch: width < 500});
        const readerContext = await browser.newContext({viewport: {width, height: 900}});
        const page = await context.newPage(), reader = await readerContext.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message)); reader.on('pageerror', error => errors.push(error.message));
        const sourceKey = namedPlanKey(saved.preset);
        await context.addInitScript(({code, sourceKey, named}) => {
          if (location.origin !== 'http://127.0.0.1:4173') return;
          localStorage.setItem('poe2-community-owner:v1', code);
          if (!localStorage.getItem(sourceKey)) localStorage.setItem(sourceKey, named);
        }, {code, sourceKey, named});
        for (const actor of [page, reader]) await actor.route('**/*', route => /google-analytics|googletagmanager|googlesyndication|doubleclick/.test(route.request().url()) ? route.abort() : route.continue());
        const path = origin + locale + '/community/';
        const open = async (actor, selector) => {
          if (!await actor.locator(selector).evaluate(element => element.open)) await actor.locator(selector + '>summary').click();
        };
        const ownPosts = async actor => {await open(actor, '#community-manage'); await actor.locator('#community-mine-refresh').click(); await actor.locator('#community-manage-status').filter({hasText: /投稿|posts/}).waitFor({timeout: 45000});};
        const withdrawAll = async actor => {
          await ownPosts(actor);
          while (await actor.locator('#community-mine [data-community-withdraw]').count()) {
            const button = actor.locator('#community-mine [data-community-withdraw]').first();
            await button.click(); await button.click();
            await actor.locator('#community-manage-status').filter({hasText: /取り下げました|Withdrawn/}).waitFor({timeout: 45000});
          }
        };
        try {
          await page.goto(path); await page.locator('#community-source option[value*="community-test-save"]').waitFor({state: 'attached'});
          await page.waitForFunction(() => {
            const text = document.querySelector('#community-list-status')?.textContent || '';
            return text && !/読み込んでいます|Loading posts/.test(text);
          }, undefined, {timeout: 45000});
          if (/利用枠|usage allowance/.test(await page.locator('#community-list-status').textContent())) throw Error('PUBLIC_BACKEND_CREDITS_402');
          await withdrawAll(page); // Clean an interrupted run's disposable posts.
          await open(page, '#community-compose');
          await page.locator('#community-source').selectOption(saved.preset + ':community-test-save');
          await page.locator('#community-review').click();
          assert(await page.locator('#community-post-status').innerText());
          await page.locator('#community-title').fill(title);
          await page.locator('#community-post-purpose').selectOption('boss');
          await page.locator('#community-post-budget').fill('3');
          await page.locator('#community-review').click();
          assert(!(await page.locator('#community-preview').textContent()).includes('PRIVATE_QA'));
          await page.locator('#community-publish').click();
          assert.equal(await page.locator('#community-preview').isVisible(), true, 'consent guard retains preview');
          await page.locator('#community-consent').check();
          await page.locator('#community-title').fill(title + ' changed');
          assert(!await page.locator('#community-consent').isChecked());
          assert(!await page.locator('#community-preview').isVisible());
          await page.locator('#community-title').fill(title);
          await page.locator('#community-review').click(); await page.locator('#community-consent').check();
          await page.locator('#community-publish').click();
          await page.locator('#community-detail h2').filter({hasText: title}).waitFor({timeout: 45000});
          const id = new URL(page.url()).searchParams.get('build'); assert(id);
          const simulatorUrl = new URL(await page.locator('#community-detail .community-primary').getAttribute('href'));
          const shared = await decodePlanLink(simulatorUrl.hash.slice(6));
          assert.equal(shared.notes, ''); assert.equal(shared.preset, saved.preset);
          assert.equal(shared.request.socket_groups[0].gems.length, saved.request.socket_groups[0].gems.length);
          const share = new URL(await page.locator('#community-detail a[href*="twitter.com"]').getAttribute('href'));
          assert.equal(share.searchParams.get('url'), path + '?build=' + id);
          assert(!share.href.includes(code));
          assert.equal(await page.evaluate(key => localStorage.getItem(key), sourceKey), named);
          await reader.goto(path + '?build=' + id);
          await reader.locator('#community-detail h2').filter({hasText: title}).waitFor({timeout: 45000});
          await reader.locator('#community-query').fill(title);
          await reader.locator('#community-skill').selectOption('TwisterPlayer');
          await reader.locator('#community-purpose').selectOption('boss');
          await reader.locator('#community-budget-max').fill('4');
          await reader.locator('#community-search-form button[type="submit"]').click();
          await reader.locator('#community-list [data-public-post="' + id + '"]').waitFor({timeout: 45000});
          await reader.locator('#community-budget-max').fill('2');
          await reader.locator('#community-search-form button[type="submit"]').click();
          await reader.locator('#community-list [data-public-post="' + id + '"]').waitFor({state: 'detached', timeout: 45000});
          await ownPosts(reader); assert.equal(await reader.locator('#community-mine [data-community-withdraw]').count(), 0);
          await reader.locator('#community-detail details').last().locator('summary').click();
          await reader.locator('#community-report-reason').selectOption('other');
          await reader.locator('#community-report-note').fill('Disposable QA report'); await reader.locator('#community-report').click();
          await reader.locator('#community-report-status').filter({hasText: /受け付け|received/}).waitFor({timeout: 45000});
          await reader.locator('#community-manage>details>summary').click();
          await reader.locator('#community-restore-code').fill(code); await reader.locator('#community-restore').click();
          await reader.locator('#community-mine [data-community-withdraw="' + id + '"]').waitFor({timeout: 45000});
          assert(!await reader.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), label + ': public page overflow');
          await reader.screenshot({path: resolve(output, label + '.png'), fullPage: true});
          const withdraw = reader.locator('#community-mine [data-community-withdraw="' + id + '"]');
          await withdraw.click(); assert(await withdraw.isVisible()); await withdraw.click();
          await reader.locator('#community-manage-status').filter({hasText: /取り下げました|Withdrawn/}).waitFor({timeout: 45000});
          await page.reload();
          await page.locator('#community-detail').filter({hasText: /見つかりません|not found/}).waitFor({timeout: 45000});
          assert.equal(await page.evaluate(key => localStorage.getItem(key), sourceKey), named);
          assert.deepEqual(errors, []);
          console.log('PASS: ' + label + ' private-data projection, public cross-visitor search/share/report, code recovery and durable withdrawal');
        } catch (cause) {
          console.error(label, errors, await page.locator('#community-list-status').textContent().catch(() => ''), await page.locator('#community-post-status').textContent().catch(() => ''));
          await page.screenshot({path: resolve(output, label + '-failure.png'), fullPage: true}).catch(() => {});
          throw cause;
        } finally {
          await withdrawAll(page).catch(() => {});
          await context.close(); await readerContext.close();
        }
      }
    } finally {await browser.close();}
  }
} finally {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
