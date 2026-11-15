/* Shared by WKWebView and Android WebView. No native bridge is exposed to other origins. */
(() => {
  'use strict';
  const ORIGIN = 'https://poe2-build-navi-jp.github.io';
  if (window.top !== window || location.origin !== ORIGIN || window.Poe2Host) return;
  const MAX_BYTES = 8 * 1024 * 1024;
  let restoring = false;
  // Registered at document start, before the simulator registers its autosave listeners.
  window.addEventListener('pagehide', event => { if (restoring) event.stopImmediatePropagation(); }, true);
  document.addEventListener('visibilitychange', event => { if (restoring) event.stopImmediatePropagation(); }, true);
  const owned = key => key.startsWith('poe2-simulator:') || key.startsWith('poe2-template:') || key === 'poe2:reading-library:v1';
  const post = message => {
    const apple = window.webkit?.messageHandlers?.Poe2Native;
    if (apple) apple.postMessage(message);
    else window.Poe2Native?.postMessage(JSON.stringify(message));
  };
  const report = error => post({type: 'error', message: String(error?.message || error).slice(0, 300)});
  const byteSize = text => new TextEncoder().encode(text).length;
  const parse = text => {
    if (typeof text !== 'string' || byteSize(text) > MAX_BYTES) throw Error('バックアップは8MB以内のJSONを選んでください。');
    const value = JSON.parse(text);
    if (value.format !== 'poe2-build-navi-app-backup' || value.version !== 1 || value.origin !== ORIGIN || !Array.isArray(value.entries) || value.entries.length > 500) throw Error('このアプリのバックアップファイルではありません。');
    const seen = new Set();
    for (const entry of value.entries) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || !owned(entry[0]) || typeof entry[1] !== 'string' || seen.has(entry[0])) throw Error('バックアップの項目を確認できません。');
      seen.add(entry[0]);
    }
    return value;
  };
  async function sendBlob(blob, name) {
    if (blob.size > MAX_BYTES) throw Error('書き出しは8MBまでです。');
    const mime = blob.type.split(';')[0];
    if (!['application/json', 'image/png', 'image/jpeg'].includes(mime)) throw Error('JSONまたは比較画像を選んでください。');
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onerror = () => reject(Error('ファイルを読み出せませんでした。'));
      reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(blob);
    });
    post({type: 'file', name: String(name || 'poe2-backup.json').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100), mime, base64});
  }
  let checking = false, notified = '';
  async function checkForUpdate() {
    const current = document.querySelector('meta[name="poe2-release"]')?.content;
    if (!current || checking || document.hidden) return;
    checking = true;
    try {
      const response = await fetch('/mobile-version.json?t=' + Date.now(), {cache: 'no-store', credentials: 'omit'});
      if (!response.ok) return;
      const next = await response.json();
      if (next.schemaVersion === 1 && next.origin === ORIGIN && /^[a-f0-9]{40}$/.test(next.revision) && next.revision !== current && notified !== next.revision) {
        notified = next.revision; post({type: 'update', revision: next.revision});
      }
    } catch { /* Keep the editor and its saved data usable while offline. */ }
    finally { checking = false; }
  }
  window.Poe2Host = Object.freeze({
    checkForUpdate,
    async exportBackup() {
      try {
        window.dispatchEvent(new Event('pagehide'));
        const entries = Object.keys(localStorage).filter(owned).sort().map(key => [key, localStorage.getItem(key)]);
        if (!entries.length) throw Error('保存した構成・記事はまだありません。');
        const text = JSON.stringify({format: 'poe2-build-navi-app-backup', version: 1, origin: ORIGIN, createdAt: new Date().toISOString(), entries});
        parse(text);
        await sendBlob(new Blob([text], {type: 'application/json'}), 'poe2-app-backup.json');
      } catch (error) { report(error); }
    },
    inspectBackup(text) { return {count: parse(text).entries.length}; },
    restoreBackup(text) {
      const {entries} = parse(text), previous = entries.map(([key]) => [key, localStorage.getItem(key)]);
      try { for (const [key, value] of entries) localStorage.setItem(key, value); }
      catch (error) {
        // Free all imported keys first, so quota cannot prevent restoring larger old values.
        for (const [key] of entries) localStorage.removeItem(key);
        for (const [key, value] of previous) if (value !== null) localStorage.setItem(key, value);
        throw error;
      }
      restoring = true; // Suppress the old editor's final autosave during the native reload.
      return entries.length;
    }
  });
  const download = anchor => {
    if (!anchor?.download || !/^(blob:|data:(application\/json|image\/(png|jpeg)))/.test(anchor.href)) return false;
    fetch(anchor.href).then(response => response.blob()).then(blob => sendBlob(blob, anchor.download)).catch(report);
    return true;
  };
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (!download(this)) originalClick.call(this); };
  document.addEventListener('click', event => {
    const anchor = event.target?.closest?.('a[download]');
    if (download(anchor)) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  try {
    Object.defineProperty(navigator, 'share', {configurable: true, value: async data => {
      if (data.files?.length === 1) { await sendBlob(data.files[0], data.files[0].name); return; }
      if (data.files?.length) throw Error('1ファイルずつ共有してください。');
      post({type: 'share', text: [data.title, data.text, data.url].filter(Boolean).join('\n').slice(0, 64000)});
    }});
  } catch { /* Native toolbar sharing is always available. */ }
  function ready() {
    post({type: 'ready', revision: document.querySelector('meta[name="poe2-release"]')?.content || ''});
    checkForUpdate();
    setInterval(checkForUpdate, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, {once: true}); else ready();
})();
