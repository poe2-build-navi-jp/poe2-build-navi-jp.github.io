import assert from 'node:assert/strict';
import {readFile, mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {JSDOM} from 'jsdom';

const source = await readFile(new URL('../mobile/shared/host.js', import.meta.url), 'utf8');
const origin = 'https://poe2-build-navi-jp.github.io';
const initial = 'a'.repeat(40), latest = 'b'.repeat(40);
function setup(url = origin + '/simulator/') {
  const dom = new JSDOM(`<head><meta name="poe2-release" content="${initial}"></head><body></body>`, {url, runScripts: 'outside-only', pretendToBeVisual: true});
  const w = dom.window, messages = [];
  w.TextEncoder = TextEncoder;
  w.webkit = {messageHandlers: {Poe2Native: {postMessage: message => messages.push(message)}}};
  let revision = initial, file;
  w.fetch = async url => String(url).startsWith('blob:') ? {blob: async () => file} : {ok: true, json: async () => ({schemaVersion: 1, origin, revision})};
  w.eval(source);
  return {dom, w, messages, revision: value => { revision = value; }, file: value => { file = value; }};
}
const tick = () => new Promise(resolve => setTimeout(resolve, 20));
const backup = entries => JSON.stringify({format: 'poe2-build-navi-app-backup', version: 1, origin, entries});
const context = setup(), {w, messages} = context;
try {
  await tick();
  assert.ok(w.Poe2Host);
  assert.equal(messages.filter(m => m.type === 'update').length, 0);
  context.revision(latest); await w.Poe2Host.checkForUpdate(); await w.Poe2Host.checkForUpdate();
  assert.equal(messages.filter(m => m.type === 'update').length, 1, 'notify once; never force a reload during editing');
  assert.equal(messages.find(m => m.type === 'update').revision, latest);
  let saves = 0;
  w.addEventListener('pagehide', () => { saves++; w.localStorage.setItem('poe2-simulator:v1:test', 'editor-state'); });
  w.document.addEventListener('visibilitychange', () => { saves++; w.localStorage.setItem('poe2-simulator:v1:test', 'stale-editor'); });
  w.localStorage.setItem('poe2:reading-library:v1', '{"favorites":[]}');
  w.localStorage.setItem('unrelated', 'preserve-me');
  w.localStorage.setItem('poe2-build-sync:code:v1', 'private-test-code');
  w.localStorage.setItem('poe2-build-sync:state:v1', '{}');
  w.localStorage.setItem('poe2-simulator:sync-code:v1', 'legacy-private-test-code');
  await w.Poe2Host.exportBackup();
  const file = messages.find(m => m.type === 'file');
  assert.equal(file.mime, 'application/json');
  const exported = JSON.parse(Buffer.from(file.base64, 'base64').toString('utf8'));
  assert.deepEqual(exported.entries, [['poe2-simulator:v1:test', 'editor-state'], ['poe2:reading-library:v1', '{"favorites":[]}']]);
  assert.equal(saves, 1, 'flush committed editor state before exporting');
  for (const text of [backup([['unrelated', 'bad']]), backup([['poe2-simulator:v1:a', '1'], ['poe2-simulator:v1:a', '2']]), backup([['poe2-simulator:v1:a', {}]]), '{}']) {
    assert.throws(() => w.Poe2Host.restoreBackup(text));
  }
  const set = w.Storage.prototype.setItem;
  let once = true;
  w.Storage.prototype.setItem = function (key, value) {
    if (key === 'poe2-simulator:v1:fail' && once) { once = false; throw Error('quota'); }
    if (key === 'poe2-simulator:v1:test' && value === 'editor-state' && this.getItem('poe2-simulator:v1:new') !== null) throw Error('quota still full until new keys are removed');
    return set.call(this, key, value);
  };
  assert.throws(() => w.Poe2Host.restoreBackup(backup([['poe2-simulator:v1:test', 'changed'], ['poe2-simulator:v1:new', 'new'], ['poe2-simulator:v1:fail', 'new']])));
  assert.equal(w.localStorage.getItem('poe2-simulator:v1:test'), 'editor-state', 'rollback a partial restore on a storage failure');
  assert.equal(w.localStorage.getItem('poe2-simulator:v1:new'), null);
  w.Storage.prototype.setItem = set;
  const restored = backup([['poe2-simulator:v1:test', 'restored-state']]);
  assert.equal(w.Poe2Host.inspectBackup(restored).count, 1);
  assert.equal(w.Poe2Host.restoreBackup(restored), 1);
  w.dispatchEvent(new w.Event('pagehide')); w.document.dispatchEvent(new w.Event('visibilitychange'));
  assert.equal(saves, 1, 'reload must not autosave the stale editor over imported data');
  assert.equal(w.localStorage.getItem('poe2-simulator:v1:test'), 'restored-state');
  assert.equal(w.localStorage.getItem('unrelated'), 'preserve-me');
  context.file(new w.Blob(['{"build":1}'], {type: 'application/json'}));
  const anchor = w.document.createElement('a'); anchor.href = 'blob:' + origin + '/test'; anchor.download = 'build.json'; anchor.click();
  await tick();
  assert.ok(messages.find(m => m.type === 'file' && m.name === 'build.json'), 'script-created Blob downloads reach native file UI');
  await w.navigator.share({title: '構成', url: origin + '/simulator/'});
  assert.equal(messages.at(-1).type, 'share');
} finally { w.close(); }
const hostile = setup('https://example.com/');
try { assert.equal(hostile.w.Poe2Host, undefined); assert.equal(hostile.messages.length, 0); } finally { hostile.w.close(); }

const stalled = setup();
try {
  await tick();
  const timers=[],nativeTimeout=stalled.w.setTimeout.bind(stalled.w),nativeClear=stalled.w.clearTimeout.bind(stalled.w);
  stalled.w.setTimeout=(fn,delay,...args)=>delay===10000?(timers.push(fn),50000+timers.length):nativeTimeout(fn,delay,...args);
  stalled.w.clearTimeout=id=>{if(id<50000)nativeClear(id);};
  let first=true;
  stalled.w.fetch=async(url,options)=>{
    assert.equal(options.cache,'no-store');assert.equal(options.credentials,'omit');assert(options.signal);
    if(first){first=false;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));}
    return {ok:true,json:async()=>({schemaVersion:1,origin,revision:latest})};
  };
  stalled.w.localStorage.setItem('poe2-simulator:v1:retained','editing');
  const pending=stalled.w.Poe2Host.checkForUpdate();await tick();
  assert.equal(timers.length,1);timers[0]();await pending;
  stalled.w.dispatchEvent(new stalled.w.Event('online'));await tick();
  assert.equal(stalled.messages.filter(message=>message.type==='update').length,1,'a timed-out check cannot permanently block updates after reconnection');
  assert.equal(stalled.w.localStorage.getItem('poe2-simulator:v1:retained'),'editing');
}finally{stalled.w.close();}

const temp = await mkdtemp(join(tmpdir(), 'poe2-release-'));
try {
  await mkdir(join(temp, 'simulator'));
  await writeFile(join(temp, 'index.html'), '<html><head><title>Home</title></head><body>2026-11-15</body></html>');
  await writeFile(join(temp, 'simulator/index.html'), `<HEAD><meta name="poe2-release" content="${initial}"></HEAD>`);
  const script = resolve(import.meta.dirname, '../tools/stamp-mobile-release.mjs');
  execFileSync(process.execPath, [script, temp, latest]);
  const manifest = JSON.parse(await readFile(join(temp, 'mobile-version.json')));
  assert.equal(manifest.revision, latest); assert.equal(manifest.origin, origin);
  for (const path of ['index.html', 'simulator/index.html']) {
    const html = await readFile(join(temp, path), 'utf8');
    assert.equal((html.match(/name="poe2-release"/g) || []).length, 1); assert.ok(html.includes(latest));
  }
  assert.ok((await readFile(join(temp, 'index.html'), 'utf8')).includes('2026-11-15'));
} finally { await rm(temp, {recursive: true}); }
console.log('PASS: trusted-origin bridge, update notification without reload, committed-state export, namespaced/transactional restore, stale-autosave suppression, Blob/share handling and matching deployed HTML/version metadata.');
