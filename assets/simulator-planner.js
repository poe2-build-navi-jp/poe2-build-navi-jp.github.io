import {parseNamedPlans, namedPlanKey} from './simulator-model.js?v=161ef63cbd';
import {plannerExport, plannerSourceKey} from './simulator-planner-model.js?v=e93c211938';
const en = document.documentElement.lang === 'en';
const t = (ja, english) => en ? english : ja;
const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
let index, sources = [], preset = '', prepared = null;
const source = () => sources.find(entry => entry.id === $('sim-planner-source').value);
const fields = () => JSON.stringify(['name', 'author', 'from', 'to', 'passives', 'skills'].map(id => {
  const field = $('sim-planner-' + id); return field.type === 'checkbox' ? field.checked : field.value;
}));
function invalidate(message = '') {
  prepared = null;
  $('sim-planner-download').disabled = true;
  $('sim-planner-preview').replaceChildren();
  $('sim-planner-partial-row').hidden = true;
  $('sim-planner-partial').checked = false;
  if (message) $('sim-planner-status').textContent = message;
}
function refresh() {
  const state = window.Poe2SimulatorLibrary?.goalData();
  if (!$('sim-planner-panel')) return;
  $('sim-planner-panel').hidden = !state;
  if (!state) { if (prepared) invalidate(); return; }
  const selection = state.preset === preset ? $('sim-planner-source').value : 'current';
  const changedPreset = preset !== state.preset;
  preset = state.preset;
  sources = [{id: 'current', name: t('現在の入力', 'Open draft'), saved: state.current}];
  try {
    sources.push(...parseNamedPlans(localStorage.getItem(namedPlanKey(preset)), preset).map(plan => ({
      id: plan.id, name: plan.name, saved: plan.saved,
    })));
  } catch {
    $('sim-planner-status').textContent = t('名前付き保存を読み込めません。元の保存は保持しています。現在の入力は書き出せます。', 'Named saves could not be read. Existing saves are intact; the open draft can still be exported.');
  }
  $('sim-planner-source').innerHTML = sources.map(entry => '<option value="' + escape(entry.id) + '">' + escape(entry.name) + '</option>').join('');
  $('sim-planner-source').value = sources.some(entry => entry.id === selection) ? selection : 'current';
  if (changedPreset) {
    const selected = window.Poe2SimulatorLibrary.presets.find(entry => entry.id === preset);
    $('sim-planner-name').value = selected?.name || t('自分のビルド', 'My build');
    invalidate();
  } else if (prepared && (source()?.id !== prepared.sourceId || plannerSourceKey(source().saved) !== prepared.sourceKey)) {
    invalidate(t('構成が変わりました。書き出す内容をもう一度確認してください。', 'The build changed. Review the export again.'));
  }
  $('sim-planner-check').disabled = !index;
}
function errorText(cause) {
  const messages = {
    PLANNER_NAME: t('書き出すビルド名を入力してください。', 'Enter a build name.'),
    PLANNER_LEVEL: t('レベル範囲を1〜100で指定してください。開始Lvは終了Lv以下にします。', 'Use levels 1–100, with the start no higher than the end.'),
    PLANNER_EMPTY: t('書き出せるスキル・パッシブがありません。構成と対象項目を確認してください。', 'No supported skills or passives can be exported. Check the build and selected sections.'),
  };
  return messages[cause.message] || t('書き出し内容を確認できませんでした。元の構成は保持しています。', 'The export could not be prepared. Your build is intact.');
}
function preview() {
  const selected = source();
  if (!index || !selected) throw Error('PLANNER_SOURCE');
  const result = plannerExport(selected.saved, index, {
    name: $('sim-planner-name').value, author: $('sim-planner-author').value,
    from: Number($('sim-planner-from').value), to: Number($('sim-planner-to').value),
    passives: $('sim-planner-passives').checked, skills: $('sim-planner-skills').checked,
  });
  prepared = {...result, sourceId: selected.id, sourceKey: plannerSourceKey(selected.saved), fields: fields()};
  const counts = result.counts;
  $('sim-planner-preview').innerHTML = '<p><b>' + counts.passives + '</b> ' + t('パッシブ', 'passives') +
    ' · <b>' + counts.skills + '</b> ' + t('スキル', 'skills') + ' · <b>' + counts.supports + '</b> ' + t('サポート', 'supports') + '</p>' +
    '<p>' + t('参照データ', 'Reference data') + ': ' + escape(result.dataVersion) + '</p>' +
    (result.omissions.length ? '<div class="sim-goal-notice"><b>' + t('書き出せない項目', 'Entries excluded from export') + ': ' + result.omissions.length + '</b><ul>' +
      result.omissions.map(entry => '<li>' + escape(entry.id) + ' · ' + escape({
        unknown: t('対応IDを確認できません', 'No verified format ID'),
        'tree-version': t('ツリー版が異なります', 'Different tree version'),
        meta: t('公式形式でメタジェムは非対応です', 'The official format does not support meta gems'),
        group: t('単一スキルの組として変換できません', 'Cannot represent this as a single skill group'),
      }[entry.reason] || entry.reason)) + '</li>').join('') + '</ul></div>' : '') +
    '<details><summary>' + t('生成するJSONを見る', 'View generated JSON') + '</summary><pre>' +
      escape(JSON.stringify(result.build, null, 2)) + '</pre></details>';
  $('sim-planner-partial-row').hidden = !result.omissions.length;
  $('sim-planner-partial').checked = false;
  $('sim-planner-download').disabled = !!result.omissions.length;
  $('sim-planner-status').textContent = result.omissions.length
    ? t('未対応項目を確認し、対応分だけ書き出す場合はチェックを入れてください。', 'Review the excluded entries and check the box if you want to export the supported subset.')
    : t('書き出し内容を確認しました。.buildをダウンロードできます。', 'Export checked. You can download the .build file.');
}
document.addEventListener('input', event => {
  if (event.target.closest('#sim-planner-panel') && !['sim-planner-source', 'sim-planner-partial'].includes(event.target.id)) invalidate();
});
document.addEventListener('change', event => {
  if (event.target.id === 'sim-planner-source') invalidate();
  if (event.target.id === 'sim-planner-partial') $('sim-planner-download').disabled = !prepared || !event.target.checked;
});
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button?.closest('#sim-planner-panel')) return;
  try {
    if (button.id === 'sim-planner-check') preview();
    if (button.id === 'sim-planner-download') {
      refresh();
      if (!prepared || prepared.fields !== fields() || (prepared.omissions.length && !$('sim-planner-partial').checked)) throw Error('PLANNER_STALE');
      const url = URL.createObjectURL(new Blob([JSON.stringify(prepared.build, null, 2)], {type: 'application/json'}));
      const link = document.createElement('a');
      link.href = url; link.download = 'poe2-' + preset + '-planner.build'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      $('sim-planner-status').textContent = t('.buildを書き出しました。下の手順でゲームへ読み込めます。', '.build exported. Follow the steps below to load it in game.');
    }
  } catch (cause) { invalidate(); $('sim-planner-status').textContent = errorText(cause); }
});
for (const event of ['poe2:library-ready', 'poe2:workspace', 'poe2:goal-state', 'poe2:saved-builds']) window.addEventListener(event, refresh);
window.addEventListener('storage', event => { if (event.key === namedPlanKey(preset) || event.key === null) refresh(); });
try {
  const response = await fetch('/data/simulator-index.json');
  if (!response.ok) throw Error('PLANNER_INDEX');
  index = await response.json(); refresh();
} catch {
  $('sim-planner-status').textContent = t('書き出し用データを読み込めませんでした。再読み込みで再試行できます。元の構成は保持しています。', 'Export data could not load. Reload to retry. Your build is intact.');
}
refresh();
