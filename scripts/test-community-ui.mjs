import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {mountCommunity} from '../assets/community-ui.js';
const catalog = JSON.parse(await readFile(new URL('../data/community-catalog.json', import.meta.url)));
const saved = JSON.parse(await readFile(new URL('../tools/community-service/src/samples.json', import.meta.url)))[0].saved;
const sourceBefore = JSON.stringify(saved);
const dom = new JSDOM('<main id="root"></main>', {url: 'https://poe2-build-navi-jp.github.io/community/'});
for (const key of ['window', 'document', 'localStorage', 'location', 'history']) globalThis[key] = key === 'window' ? dom.window : dom.window[key];
const root = document.getElementById('root');
try {
  await mountCommunity(root, {
    catalog, getSources: async () => [{id: 'source', name: 'Saved source', saved}],
    publicBase: location.href, simulatorBase: location.origin + '/simulator/',
    api: async operation => {
      if (operation === 'list') return {posts: [], nextToken: null};
      throw Object.assign(new Error('APP_TEMPORARILY_UNAVAILABLE'), {status: 402});
    },
  });
  document.getElementById('community-source').value = 'source';
  document.getElementById('community-title').value = 'Retained draft';
  document.getElementById('community-review').click();
  document.getElementById('community-consent').checked = true;
  document.getElementById('community-compose-form').dispatchEvent(new dom.window.Event('submit', {bubbles: true, cancelable: true}));
  for (let turn = 0; turn < 10 && document.getElementById('community-compose-fields').disabled; turn++) await new Promise(setImmediate);
  assert.match(document.getElementById('community-post-status').textContent, /一時停止/);
  assert.equal(document.getElementById('community-title').value, 'Retained draft');
  assert.equal(document.getElementById('community-preview').hidden, false);
  assert.equal(document.getElementById('community-compose-fields').disabled, false);
  assert.equal(JSON.stringify(saved), sourceBefore);
  assert(!localStorage.getItem('poe2-simulator:v1:' + saved.preset));
  console.log('PASS: Generic HTTP 402 does not claim quota exhaustion and, preserves the reviewed draft and source, and does not write simulator saves');
} finally {
  dom.window.close();
  for (const key of ['window', 'document', 'localStorage', 'location', 'history']) delete globalThis[key];
}
