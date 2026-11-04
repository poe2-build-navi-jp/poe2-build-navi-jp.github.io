(() => {
  const copyButtons = document.querySelectorAll('[data-copy-gear]');
  for (const button of copyButtons) {
    button.hidden = false;
    button.addEventListener('click', async () => {
      const input = button.closest('li').querySelector('.unique-gear-copy-fallback');
      const status = button.closest('.unique-gear-shopping').querySelector('[data-copy-gear-status]');
      try {
        await navigator.clipboard.writeText(button.dataset.copyGear);
        input.hidden = true;
        status.textContent = '英語名をコピーしました。公式取引の検索欄に貼り付けてください。';
      } catch {
        input.hidden = false;
        input.focus();
        input.select();
        status.textContent = '表示された英語名を選択してコピーしてください。';
      }
      status.hidden = false;
    });
  }

  // Carry the level from the matching build only; a level alone doesn't unlock a purchase.
  function showLevelContext() {
    for (const p of document.querySelectorAll('[data-unique-level-context]')) p.hidden = true;
    const url = new URL(location.href);
    const level = url.searchParams.get('level');
    const buildId = url.searchParams.get('build');
    if (!/^(?:[1-9][0-9]?|100)$/.test(level ?? '') || !buildId || url.hash !== '#purchase-' + buildId) return;
    const box = document.getElementById('purchase-' + buildId);
    const context = box?.querySelector('[data-unique-level-context]');
    if (!context) return;
    context.textContent = 'Lvナビから：現在Lv' + level + '。今の育成段階と下の購入条件を照合してください。';
    context.hidden = false;
  }
  showLevelContext();
  window.addEventListener('hashchange', showLevelContext);
})();
