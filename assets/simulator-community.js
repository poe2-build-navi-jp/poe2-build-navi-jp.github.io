import {publicSnapshot} from './community-model.js?v=2dabb0f8a4';
const en = document.documentElement.lang === 'en';
const t = (ja, english) => en ? english : ja;
const button = document.getElementById('sim-community-prepare');
const status = document.getElementById('sim-community-status');
let catalog;
function refresh() {
  if (button) button.disabled = !catalog || !window.Poe2SimulatorLibrary?.goalData();
}
if (button) {
  button.addEventListener('click', () => {
    try {
      const state = window.Poe2SimulatorLibrary?.goalData();
      if (!state || !catalog) throw Error('PUBLIC_INPUT');
      const saved = publicSnapshot(state.current, catalog);
      localStorage.setItem('poe2-community-compose:v1', JSON.stringify({version: 1, saved}));
      location.assign((en ? '/en' : '') + '/community/?compose=1');
    } catch {
      status.textContent = t('投稿の準備ができませんでした。対応中のデータ版で、ジュエルなし・64KB以下の構成を選べます。元の構成は保持しています。', 'The draft could not be prepared. Use supported data, no jewels, and a snapshot under 64 KB. Your original save is intact.');
    }
  });
  for (const event of ['poe2:library-ready', 'poe2:workspace', 'poe2:goal-state']) window.addEventListener(event, refresh);
  try {
    const response = await fetch('/data/community-catalog.json?v=f05ab668d1');
    if (!response.ok) throw Error('PUBLIC_CATALOG');
    catalog = await response.json(); refresh();
  } catch { status.textContent = t('投稿用データを読み込めませんでした。再読み込みで再試行できます。', 'Publishing data could not load. Reload to retry.'); }
  refresh();
}
