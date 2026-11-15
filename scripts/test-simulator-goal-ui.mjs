import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Worker} from 'node:worker_threads';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {JSDOM, VirtualConsole} from 'jsdom';
import * as model from '../assets/simulator-model.js';
import * as goals from '../assets/simulator-goal-model.js';

const root = resolve(import.meta.dirname, '..');
const native = new Worker(new URL('./fixtures/simulator-worker-node.mjs', import.meta.url));
let sequence = 0;
const pending = new Map();
native.on('message', message => {
  if (message.progress) return;
  const task = pending.get(message.id);
  if (!task) return;
  pending.delete(message.id);
  message.error ? task.reject(Error(message.error)) : task.resolve(message.result);
});
const rpc = (action, payload) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, {resolve, reject});
  native.postMessage({id, action, payload});
});
const errors = [], virtual = new VirtualConsole();
virtual.on('jsdomError', error => errors.push(error.message));
const dom = new JSDOM(await readFile(resolve(root, 'simulator/index.html'), 'utf8'), {
  url: 'https://poe2-build-navi-jp.github.io/simulator/', runScripts: 'outside-only', virtualConsole: virtual,
});
const w = dom.window, d = w.document;
Object.assign(w, model, goals, {structuredClone, DecompressionStream, WebAssembly});
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
w.HTMLDialogElement.prototype.close = function () { this.open = false; };
w.fetch = async url => new Response(await readFile(resolve(root, new URL(String(url), 'https://test.local').pathname.slice(1))));
w.Worker = class {
  postMessage({id, action, payload}) {
    rpc(action, payload).then(result => this.onmessage?.({data: {id, result}}), error => this.onmessage?.({data: {id, error: error.message}}));
  }
};
const wait = async condition => {
  const deadline = Date.now() + 30000;
  while (!condition()) {
    if (Date.now() > deadline) throw Error('Goal UI timeout: ' + d.getElementById('sim-goal-status').textContent);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
};
const click = selector => { assert(d.querySelector(selector), selector); d.querySelector(selector).click(); };
const change = (selector, value) => {
  const input = d.querySelector(selector);
  input.value = value;
  input.dispatchEvent(new w.Event('change', {bubbles: true}));
};
const ready = () => d.getElementById('sim-stats').getAttribute('aria-busy') === 'false' && !!d.querySelector('.sim-stat');
try {
  let source = await readFile(resolve(root, 'assets/simulator.js'), 'utf8');
  source = source.replace(/^import[^\n]+\n/, '').replaceAll('import.meta.url', JSON.stringify(pathToFileURL(resolve(root, 'assets/simulator.js')).href));
  await w.eval(`(async () => {${source}\n})()`);
  let ui = await readFile(resolve(root, 'assets/simulator-goal.js'), 'utf8');
  ui = ui.replace(/^import[^\n]+\n/gm, '');
  w.eval(`(() => {${ui}\n})()`);
  click('[data-preset="mercenary-twister-gemling"]');
  await wait(ready);
  const preset = 'mercenary-twister-gemling', auto = 'poe2-simulator:v1:' + preset;
  const before = w.localStorage.getItem(auto);
  change('#sim-goal-select', 'example:complete-mercenary-twister-gemling');
  click('#sim-goal-set');
  assert.equal(w.localStorage.getItem(auto), before, 'choosing a target preserves the active autosave');
  assert.equal(d.getElementById('sim-goal-active').hidden, false);
  assert.match(d.getElementById('sim-goal-count').textContent, /ジェム 4/);
  assert.equal(d.querySelector('[data-goal-group="gems"] summary span').textContent, '4');
  assert.equal(d.querySelector('[data-goal-group="equipment"] summary span').textContent, '9');
  const stored = w.localStorage.getItem(goals.goalKey(preset));
  assert(stored);
  click('[data-goal-group="gems"] > summary');
  click('[data-goal-edit="gems"]');
  assert.equal(d.getElementById('sim-skills').hidden, false);
  change('[data-group="0"] [data-gem="0"] [data-gem-field="level"]', '20');
  await wait(ready);
  assert.equal(d.querySelector('[data-goal-group="gems"] summary span').textContent, '3');
  assert(d.querySelector('[data-goal-group="gems"]').open, 'an open checklist stays open after recalculation');
  assert.equal(w.localStorage.getItem(goals.goalKey(preset)), stored, 'edits cannot change the frozen target');
  const beforeNavigation = w.localStorage.getItem(auto);
  click('[data-goal-group="passives"] > summary');
  click('[data-goal-node]');
  assert.equal(d.getElementById('sim-tree').hidden, false);
  assert.equal(w.localStorage.getItem(auto), beforeNavigation, 'locating a passive never allocates it');
  assert.equal(d.querySelector('#sim-goal-panel img[onerror]'), null);
  // Named saves can be targets for every build, including user-authored names.
  const saved = JSON.parse(w.localStorage.getItem(auto));
  const entry = {id: 'goal-private-name', name: '<img src=x onerror=alert(1)>', saved};
  w.localStorage.setItem(model.namedPlanKey(preset), JSON.stringify({version: 1, plans: [entry]}));
  w.dispatchEvent(new w.CustomEvent('poe2:saved-builds'));
  change('#sim-goal-select', 'plan:goal-private-name');
  click('#sim-goal-set');
  assert.equal(d.getElementById('sim-goal-name').textContent, entry.name);
  assert.equal(d.getElementById('sim-goal-name').querySelector('img'), null);
  assert.match(d.getElementById('sim-goal-count').textContent, /ジェム 0/);
  assert.match(d.getElementById('sim-goal-count').textContent, /未確認あり/, 'empty target sections cannot imply a fully checked build');
  w.localStorage.setItem(goals.goalKey(preset), 'broken target');
  w.dispatchEvent(new w.StorageEvent('storage', {key: goals.goalKey(preset)}));
  assert.equal(w.localStorage.getItem(goals.goalKey(preset)), 'broken target');
  assert.match(d.getElementById('sim-goal-status').textContent, /選び直/);
  click('#sim-goal-clear');
  assert.equal(w.localStorage.getItem(goals.goalKey(preset)), null);
  assert.equal(d.getElementById('sim-goal-active').hidden, true);
  assert.equal(w.localStorage.getItem(auto), beforeNavigation, 'clearing the target leaves the build untouched');
  assert.deepEqual(errors, []);
  console.log('PASS: real-engine goal selection, live gem updates, retained open sections, frozen targets, read-only passive navigation, named targets, escaped names, corrupt-target preservation and independent reset');
} finally {
  dom.window.close();
  await native.terminate();
}
