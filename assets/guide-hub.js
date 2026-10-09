(() => {
  'use strict';
  const controls = document.querySelector('[data-guide-controls]');
  if (!controls) return;
  const search = document.querySelector('#guide-search');
  const cards = [...document.querySelectorAll('[data-guide-card]')];
  const groups = [...document.querySelectorAll('[data-guide-group]')];
  const buttons = [...controls.querySelectorAll('[data-filter]')];
  const status = controls.querySelector('[data-guide-status]');
  const empty = document.querySelector('[data-guide-empty]');
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase('ja').trim();
  const texts = new Map(cards.map(card => [card, normalize(card.dataset.search)]));
  let category = 'all';
  function render() {
    const words = normalize(search.value).split(/\s+/u).filter(Boolean);
    let count = 0;
    for (const card of cards) {
      card.hidden = !(words.every(word => texts.get(card).includes(word)) && (category === 'all' || category === card.dataset.category));
      if (!card.hidden) count++;
    }
    for (const group of groups) {
      const visible = [...group.querySelectorAll('[data-guide-card]')].filter(card => !card.hidden).length;
      group.hidden = visible === 0;
      group.querySelector('[data-group-count]').textContent = `${visible}記事`;
    }
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.filter === category));
      const matches = cards.filter(card => words.every(word => texts.get(card).includes(word)) && (button.dataset.filter === 'all' || button.dataset.filter === card.dataset.category)).length;
      button.querySelector('span').textContent = matches;
    }
    status.textContent = `${cards.length}件中 ${count}件の記事を表示`;
    empty.hidden = count !== 0;
  }
  function save(method = 'replaceState') {
    const url = new URL(location.href);
    if (search.value.trim()) url.searchParams.set('q', search.value.trim()); else url.searchParams.delete('q');
    if (category !== 'all') url.searchParams.set('category', category); else url.searchParams.delete('category');
    if (url.href !== location.href) history[method](null, '', url);
  }
  function restore() {
    const params = new URL(location.href).searchParams;
    search.value = params.get('q') || '';
    const selected = params.get('category');
    category = buttons.some(button => button.dataset.filter === selected) ? selected : 'all';
    render();
  }
  search.addEventListener('input', () => { render(); save(); });
  for (const button of buttons) button.addEventListener('click', () => { category = button.dataset.filter; render(); save('pushState'); });
  for (const button of document.querySelectorAll('[data-guide-reset]')) button.addEventListener('click', () => { category = 'all'; search.value = ''; render(); save('pushState'); search.focus(); });
  // Category anchors remain real links, including with JavaScript disabled.
  for (const link of document.querySelectorAll('.guide-category-nav a')) link.addEventListener('click', () => {
    category = 'all'; search.value = ''; render(); save();
  });
  window.addEventListener('popstate', restore);
  window.addEventListener('pageshow', restore);
  controls.hidden = false;
  restore();
})();
