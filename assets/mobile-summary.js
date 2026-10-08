// Native <details> works without JavaScript. Deep links additionally reveal ancestors.
(() => {
  function revealHash(hash = location.hash) {
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    for (let node = target.parentElement; node; node = node.parentElement) {
      if (node.tagName === 'DETAILS') node.open = true;
    }
    // Section anchors lead to their advertised contents, not a still-closed comparison.
    if (['featured-builds', 'choose-class'].includes(id)) {
      const details = target.querySelector(':scope > details[data-mobile-summary]');
      if (details) details.open = true;
    }
    target.scrollIntoView?.({ block: 'start' });
  }
  window.addEventListener('hashchange', () => revealHash());
  window.addEventListener('pageshow', () => revealHash());
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search && url.hash) revealHash(url.hash);
  });
  revealHash();
})();
