/* Progressive enhancement: all results and destinations remain readable without JS. */
(function () {
  'use strict';
  const root = document.querySelector('[data-site-search]');
  if (!root || root.dataset.searchReady === 'true') return;
  const form = root.querySelector('[data-search-form]');
  const input = root.querySelector('[data-search-input]');
  const status = root.querySelector('[data-search-status]');
  const empty = root.querySelector('[data-search-empty]');
  const filters = Array.from(root.querySelectorAll('[data-search-filter]'));
  const groups = Array.from(root.querySelectorAll('[data-search-group]'));
  if (!form || !input || !status || !empty || !filters.length) return;
  const types = new Set(filters.map(button => button.dataset.searchFilter));
  const normalize = text => String(text || '').normalize('NFKC').toLowerCase().replace(/[\s\u3000]+/g, ' ').trim();
  const compact = text => normalize(text).replace(/ /g, '');
  const records = Array.from(root.querySelectorAll('[data-search-entry]')).map(element => ({
    element, type: element.dataset.searchType, text: compact(element.dataset.searchText)
  }));
  let state = {q: '', type: 'all'};
  let editing = false;
  function fromLocation() {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type') || 'all';
    return {q: (params.get('q') || '').trim(), type: types.has(type) ? type : 'all'};
  }
  function render() {
    const query = normalize(state.q);
    const tokens = query.split(' ').filter(Boolean);
    const counts = new Map();
    let total = 0;
    for (const record of records) {
      // Both normal word spacing and compact Japanese/English names are accepted.
      const matched = (state.type === 'all' || record.type === state.type) && tokens.every(token => record.text.includes(compact(token)));
      record.element.hidden = !matched;
      if (matched) { total += 1; counts.set(record.type, (counts.get(record.type) || 0) + 1); }
    }
    for (const group of groups) {
      const count = counts.get(group.dataset.searchGroup) || 0;
      group.hidden = count === 0;
      const countLabel = group.querySelector('[data-search-group-count]');
      if (countLabel) countLabel.textContent = `${count}件`;
    }
    for (const button of filters) button.setAttribute('aria-pressed', String(button.dataset.searchFilter === state.type));
    empty.hidden = total !== 0;
    status.textContent = `${state.q ? `「${state.q}」：` : ''}${total}件を表示`;
  }
  function writeLocation(mode) {
    const url = new URL(window.location.href);
    if (state.q) url.searchParams.set('q', state.q); else url.searchParams.delete('q');
    if (state.type !== 'all') url.searchParams.set('type', state.type); else url.searchParams.delete('type');
    if (url.href === window.location.href) return;
    // Search still works where the environment does not permit history changes.
    try { window.history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', `${url.pathname}${url.search}${url.hash}`); }
    catch (_) { /* No navigation/network fallback is needed for local filtering. */ }
  }
  input.addEventListener('input', () => {
    state.q = input.value.trim();
    render();
    // One history entry per editing session, rather than per character.
    writeLocation(editing ? 'replace' : 'push');
    editing = true;
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    state.q = input.value.trim();
    render();
    writeLocation('push');
    editing = false;
  });
  filters.forEach(button => button.addEventListener('click', () => {
    state = {q: input.value.trim(), type: button.dataset.searchFilter};
    render();
    writeLocation('push');
    editing = false;
  }));
  root.querySelectorAll('[data-search-reset]').forEach(button => button.addEventListener('click', () => {
    state = {q: '', type: 'all'};
    input.value = '';
    render();
    writeLocation('push');
    editing = false;
    input.focus();
  }));
  window.addEventListener('popstate', () => {
    state = fromLocation();
    input.value = state.q;
    editing = false;
    render();
  });
  state = fromLocation();
  input.value = state.q;
  render();
  writeLocation('replace');
  const jumps = root.querySelector('.search-jump-links');
  if (jumps) jumps.hidden = true;
  form.hidden = false;
  root.dataset.searchReady = 'true';
})();
