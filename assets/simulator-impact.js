import {reviewPlans, noticeParts} from './simulator-impact-model.js?v=c29fe023b8';
const en = document.documentElement.lang === 'en';
const t = (ja, english) => en ? english : ja;
const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const labels = {gem: t('ジェム', 'Gems'), passive: t('パッシブ', 'Passives'), equipment: t('装備', 'Equipment')};
let index, names = {}, active = null, rendering = false;
const translate = value => en ? value : names[value] || value;
const bridge = () => window.Poe2SimulatorLibrary;
function relevant() { return window.Poe2SimulatorNotices || []; }
function currentParts(notice) {
  const current = bridge()?.goalData()?.current;
  return current && notice.presets.includes(current.preset) ? noticeParts(notice, current, index) : null;
}
function render() {
  if (!index || !bridge() || rendering) return;
  rendering = true;
  try {
    const {plans, unreadable} = reviewPlans(localStorage, bridge().presets);
    for (const notice of relevant()) {
      const article = [...document.querySelectorAll('#sim-update-list article')].find(element => element.dataset.updateId === notice.id);
      if (!article) continue;
      const existing = article.querySelector('.sim-impact-details');
      if (existing) {
        existing.querySelector('[data-impact-notice]').disabled = !currentParts(notice)?.parts.length;
        continue;
      }
      const matches = plans.filter(plan => notice.presets.includes(plan.preset));
      const details = document.createElement('details');
      details.className = 'sim-impact-details';
      const certainty = notice.basis === 'confirmed' ? t('変更対象', 'Changed entries') : t('再確認する項目', 'Entries to review');
      details.innerHTML = '<summary>' + certainty + ' · ' + matches.length + t('構成', ' saves') + '</summary>' +
        '<p class="sim-library-help">' + (notice.basis === 'confirmed'
          ? t('変更対象として案内されたIDと保存構成を照合しています。火力の増減は再計算して確認してください。', 'Announced IDs are matched against saved builds. Recalculate to assess performance changes.')
          : t('発表内容やデータ版をもとにした確認対象です。個々の効果が変更されたと確定した一覧ではありません。', 'These are review candidates based on the announcement or data version. Individual effects are not confirmed changes.')) + '</p>' +
        matches.map(plan => {
          const report = noticeParts(notice, plan.saved, index);
          return '<section><h5>' + escape(plan.name) + '</h5>' +
            (report.unknownScope ? '<p>' + t('更新の詳細な対象IDは未確認です。入力済みの項目を表示します。', 'Exact affected IDs are unavailable. Configured entries are shown for review.') + '</p>' : '') +
            Object.entries(labels).map(([kind, label]) => {
              const rows = report.parts.filter(part => part.kind === kind);
              if (!rows.length) return '';
              return '<details><summary>' + label + ' · ' + rows.length + '</summary><ul class="sim-impact-list">' +
                rows.map(part => '<li><span class="sim-impact-badge">' + certainty + '</span> <b' +
                  (kind === 'gem' ? ' data-skill-selected="' + escape(translate(part.name)) + '"' : ' translate="no"') + '>' +
                  escape(translate(part.name)) + '</b><small>' + escape(kind === 'equipment' ? part.id + (part.scope ? ' · ' + t('武器セット', 'Weapon set ') + part.scope : '') : 'ID ' + part.id) +
                  (part.unverified ? ' · ' + t('詳細未確認', 'Details unverified') : '') + '</small></li>').join('') + '</ul></details>';
            }).join('') +
            (!report.parts.length ? '<p>' + t('保存した入力に、この案内の対象項目は見つかりませんでした。', 'No matching configured entries were found in this save.') + '</p>' : '') + '</section>';
        }).join('') +
        (unreadable.length ? '<p role="status">' + t('一部の保存構成を照合できませんでした。元の保存は保持しています。', 'Some saved builds could not be checked. Original saves are intact.') + '</p>' : '') +
        '<button type="button" data-impact-notice="' + escape(notice.id) + '"' + (!currentParts(notice)?.parts.length ? ' disabled' : '') + '>' +
          t('現在開いている構成でも目印を表示', 'Highlight matching entries in the open build') + '</button>' +
        '<p class="sim-library-help">' + t('保存構成と現在の入力が異なる場合、編集画面では現在の入力だけに目印を付けます。', 'When the open draft differs from a named save, editor highlights use only the open draft.') + '</p>';
      article.append(details);
    }
    mark();
  } finally { rendering = false; }
}
function clear() {
  for (const element of document.querySelectorAll('[data-impact-review]')) {
    element.removeAttribute('data-impact-review');
    element.removeAttribute('data-impact-label');
  }
  document.getElementById('sim-impact-active')?.remove();
}
function mark() {
  if (!index || !active) return;
  const report = currentParts(active);
  if (!report) { active = null; clear(); return; }
  const keys = new Set();
  for (const part of report.parts) {
    let selector;
    if (part.kind === 'gem') {
      const [group, gem] = part.key.split(':');
      selector = '[data-group="' + group + '"] [data-gem="' + gem + '"]';
    } else if (part.kind === 'passive') selector = '#sim-tree [data-node="' + Number(part.id) + '"]';
    else {
      if (part.scope && part.scope !== (bridge().goalData()?.current.weaponSets?.active || 1)) continue;
      selector = '#sim-slots [data-slot="' + part.id + '"]';
    }
    for (const element of document.querySelectorAll(selector)) {
      keys.add(element);
      element.setAttribute('data-impact-review', 'true');
      element.setAttribute('data-impact-label', t('更新の確認対象', 'Review after update'));
    }
  }
  for (const element of document.querySelectorAll('[data-impact-review]')) if (!keys.has(element)) {
    element.removeAttribute('data-impact-review'); element.removeAttribute('data-impact-label');
  }
  let banner = document.getElementById('sim-impact-active');
  if (!banner) {
    banner = document.createElement('section'); banner.id = 'sim-impact-active'; banner.className = 'sim-impact-active';
    document.querySelector('.sim-layout')?.before(banner);
  }
  banner.innerHTML = '<b>' + escape(active.title[en ? 'en' : 'ja']) + '</b><p>' +
    t('現在の入力の確認対象', 'Review candidates in the open draft') + ': ' + report.parts.length +
    '</p><div class="sim-actions">' + Object.entries(labels).filter(([kind]) => report.parts.some(part => part.kind === kind)).map(([kind, label]) =>
      '<button type="button" data-impact-editor="' + kind + '">' + label + '</button>').join('') +
      '<button type="button" id="sim-impact-clear">' + t('目印を解除', 'Clear highlights') + '</button></div>';
}
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || !index) return;
  if (button.dataset.impactNotice) {
    active = relevant().find(notice => notice.id === button.dataset.impactNotice);
    if (active) {
      clear(); mark();
      document.getElementById('sim-impact-active')?.scrollIntoView({block: 'start', behavior: 'instant'});
    }
  }
  if (button.id === 'sim-impact-clear') { active = null; clear(); }
  if (button.dataset.impactEditor && active) {
    const kind = button.dataset.impactEditor;
    const first = currentParts(active)?.parts.find(part => part.kind === kind);
    bridge().goalNavigate({gem: 'gems', passive: 'passives', equipment: 'equipment'}[kind], kind === 'passive' ? first?.id : null);
  }
});
for (const event of ['poe2:update-notices', 'poe2:library-ready', 'poe2:workspace', 'poe2:goal-state']) window.addEventListener(event, render);
const observer = new MutationObserver(records => {
  if (active && records.some(record => record.target.closest?.('#sim-tree-nodes, #sim-skills, #sim-slots'))) mark();
});
observer.observe(document.body, {childList: true, subtree: true});
try {
  const responses = await Promise.all(['/data/simulator-index.json?v=081a4b68e0', '/data/simulator-names.json?v=1ad39e08ae'].map(url => fetch(url)));
  if (responses.some(response => !response.ok)) throw Error('IMPACT_DATA');
  [index, names] = await Promise.all(responses.map(response => response.json()));
  render();
} catch {
  const message = document.createElement('p');
  message.className = 'sim-library-help'; message.setAttribute('role', 'status');
  message.textContent = t('項目別の更新確認を読み込めませんでした。ページを再読み込みすると再試行できます。保存構成は保持しています。', 'Entry-level review could not load. Reload to retry. Saved builds are intact.');
  document.getElementById('sim-updates-panel')?.append(message);
}
