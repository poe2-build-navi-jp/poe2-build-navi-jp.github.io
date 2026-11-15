import {parseNamedPlans, namedPlanKey} from './simulator-model.js?v=161ef63cbd';
import {goalKey, makeGoal, parseGoal, compareGoal} from './simulator-goal-model.js?v=9fc88e5370';

const en = document.documentElement.lang === 'en';
const t = (ja, english) => en ? english : ja;
const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const slotNames = {
  weapon1: t('メイン武器', 'Main hand'), weapon2: t('サブ武器・盾', 'Off hand'),
  helmet: t('兜', 'Helmet'), body: t('鎧', 'Body armour'), gloves: t('手袋', 'Gloves'),
  boots: t('靴', 'Boots'), belt: t('ベルト', 'Belt'), amulet: t('アミュレット', 'Amulet'),
  ring1: t('指輪1', 'Ring 1'), ring2: t('指輪2', 'Ring 2'),
  'Flask 1': t('フラスコ1', 'Flask 1'), 'Flask 2': t('フラスコ2', 'Flask 2'),
  'Charm 1': t('チャーム1', 'Charm 1'), 'Charm 2': t('チャーム2', 'Charm 2'), 'Charm 3': t('チャーム3', 'Charm 3'),
};
const statusNames = {
  missing: t('未設定', 'Not configured'), disabled: t('無効', 'Disabled'), upgrade: t('Lv・品質不足', 'Level / quality below target'),
  matched: t('一致', 'Matches'), choice: t('能力値の選択違い', 'Different attribute choice'), unknown: t('未確認', 'Unverified'), different: t('入力内容が違う', 'Different inputs'),
};
const attributes = {str: t('筋力', 'Strength'), dex: t('器用さ', 'Dexterity'), int: t('知性', 'Intelligence')};
let bridge, candidates = [], activePreset = '';
const scopeName = scope => scope ? t('武器セット', 'Weapon set ') + scope : t('共通', 'Shared');
const gemName = id => bridge.goalGem(id)?.name || id;
const badge = (status, name = statusNames[status]) => `<span class="sim-goal-state ${status === 'matched' ? 'is-match' : ''}">${name}</span>`;
const visibleRows = rows => $('sim-goal-show-matched').checked ? rows : rows.filter(row => row.status !== 'matched');
const nothing = rows => `<p class="sim-library-help">${rows.length ? t('入力済みの目標項目は一致しています。', 'The configured target entries match.') : t('目標に入力がないため、この項目は未確認です。', 'The target has no entries for this section, so it is unverified.')}</p>`;
const list = (rows, render) => visibleRows(rows).length ? '<ul class="sim-goal-list">' + visibleRows(rows).map(render).join('') + '</ul>' : nothing(rows);

function renderGems(section) {
  const items = list(section.rows, row => {
    const name = escape(gemName(row.skillId));
    const parent = bridge.goalGem(row.skillId)?.support ? `<small>${escape(gemName(row.parent))}${t('のサポート', ' support')}</small>` : '';
    const own = row.currentLevel === null ? t('未設定', 'Not configured') : `Lv${row.currentLevel} / ${t('品質', 'quality ')}${row.currentQuality}%`;
    return `<li>${badge(row.status)}<b data-skill-selected="${escape(gemName(row.skillId))}">${name}</b>${parent}<p>${t('目標', 'Target')}: Lv${row.level} / ${t('品質', 'quality ')}${row.quality}%<br>${t('現在', 'Current')}: ${own}</p></li>`;
  });
  return (section.mainDifferent ? `<p class="sim-goal-notice">${t('主力スキルの指定も目標と異なります。目標：', 'The main skill selection also differs. Target: ')}${escape(gemName(section.main))} · ${t('スキル内の主力指定', 'Active skill selection ')}${section.mainActive}</p>` : '') +
    '<p class="sim-library-help">' + t('有効な同じスキルの組にあるジェムを照合します。Lv・品質は目標以上なら一致です。', 'Gems are checked in the matching enabled skill group. Levels and quality at or above the target count as a match.') + '</p>' + items;
}

function renderPassives(section) {
  if (!section.available) return `<p class="sim-goal-notice">${t('ツリーの版が異なるため、未取得数を判定できません。同じ版の構成を目標に選び直してください。', 'The passive tree versions differ, so missing nodes cannot be determined. Select a target using the same tree version.')}</p>`;
  return list(section.rows, row => `<li>${badge(row.status, row.status === 'missing' ? t('未取得', 'Not allocated') : statusNames[row.status])}${bridge.goalNode(row.id)?.icon || ''}<b translate="no">${escape(row.name)}</b><small>${scopeName(row.scope)} · ID ${row.id}</small>${row.status === 'choice' ? `<p>${t('目標', 'Target')}: ${attributes[row.targetChoice]} / ${t('現在', 'Current')}: ${attributes[row.currentChoice] || '—'}</p>` : ''}${row.status !== 'unknown' ? `<button type="button" data-goal-node="${row.id}">${t('ツリーで場所を見る', 'Locate in passive tree')}</button>` : ''}</li>`);
}

function displayItem(text) {
  const value = bridge.goalItemText(text);
  return escape(value.length > 5000 ? value.slice(0, 5000) + t('\n…表示を省略しています。', '\n…display truncated.') : value);
}

function renderEquipment(section) {
  return list(section.rows, row => `<li>${badge(row.status)}<b>${escape(slotNames[row.slot] || row.slot)}</b>${row.scope ? `<small>${scopeName(row.scope)}</small>` : ''}<p>${t('目標', 'Target')}: ${escape(bridge.goalItemName(row.text))}<br>${t('現在', 'Current')}: ${row.currentText ? escape(bridge.goalItemName(row.currentText)) : t('未装備', 'Empty')}</p><details><summary>${t('装備の入力内容を見比べる', 'Compare equipment inputs')}</summary><h5>${t('目標', 'Target')}</h5><pre>${displayItem(row.text)}</pre><h5>${t('現在', 'Current')}</h5><pre>${row.currentText ? displayItem(row.currentText) : t('未装備', 'Empty')}</pre></details></li>`);
}

function renderReport(goal, current) {
  const report = compareGoal(current, goal, {
    gemInfo: id => bridge.goalGem(id), nodeInfo: id => bridge.goalNode(id), starts: bridge.goalStarts(),
  });
  const opened = new Set([...$('sim-goal-result').querySelectorAll('details[data-goal-group][open]')].map(node => node.dataset.goalGroup));
  const group = (id, title, count, body, action) => `<details class="sim-goal-group" data-goal-group="${id}"${opened.has(id) ? ' open' : ''}><summary>${title} <span>${count}</span></summary>${action ? `<button type="button" data-goal-edit="${id}">${action}</button>` : ''}${body}</details>`;
  const passives = report.passives.available ? String(report.passives.missing) : '—';
  const gemGaps = report.gems.missing + report.gems.upgrades + Number(report.gems.mainDifferent);
  const passiveGaps = report.passives.available ? report.passives.missing + report.passives.choices : '—';
  const unverified = report.gems.unknown || report.passives.unknown || report.equipment.unknown || !report.passives.available ||
    !report.gems.rows.length || !report.passives.rows.length || !report.equipment.rows.length;
  const notices = [
    !report.character.sameAscendancy && t('アセンダンシーの指定が異なります。', 'The ascendancy selections differ.'),
    !report.character.sameData && t('計算データの版が異なるため、参考の照合です。', 'The calculation data versions differ; treat this as a reference check.'),
  ].filter(Boolean);
  $('sim-goal-name').textContent = goal.name;
  $('sim-goal-count').textContent = t(`ジェム ${gemGaps} / パッシブ ${passiveGaps} / 装備 ${report.equipment.pending}`, `Gems ${gemGaps} / Passives ${passiveGaps} / Gear ${report.equipment.pending}`) + (unverified ? t(' · 未確認あり', ' · Includes unverified entries') : '');
  $('sim-goal-result').innerHTML = `<p>${t('現在', 'Current')} Lv${report.character.current.level} → ${t('目標', 'Target')} Lv${report.character.target.level}</p>${notices.map(notice => `<p class="sim-goal-notice">${notice}</p>`).join('')}<div class="sim-goal-totals"><div><b>${report.gems.missing}</b><span>${t('未設定・無効のジェム', 'Missing / disabled gems')}</span></div><div><b>${report.gems.upgrades}</b><span>${t('Lv・品質不足', 'Below target level / quality')}</span></div><div><b>${passives}</b><span>${t('未取得パッシブ', 'Missing passives')}</span></div><div><b>${report.equipment.pending}</b><span>${t('装備の違い', 'Equipment differences')}</span></div></div>` +
    group('gems', t('ジェムの不足・設定', 'Gems and skill configuration'), gemGaps, renderGems(report.gems), t('ジェムを編集', 'Edit gems')) +
    group('passives', t('パッシブの未取得・選択違い', 'Passive nodes and attribute choices'), report.passives.available ? report.passives.missing + report.passives.choices : '—', renderPassives(report.passives), t('パッシブツリーを開く', 'Open passive tree')) +
    group('equipment', t('目標の装備との違い', 'Differences from target equipment'), report.equipment.pending, renderEquipment(report.equipment), t('装備を編集', 'Edit equipment')) +
    `<p class="sim-library-help">${t('未確認のジェム', 'Unverified gems')}: ${report.gems.unknown} / ${t('未確認のパッシブ', 'Unverified passive nodes')}: ${report.passives.available ? report.passives.unknown : t('版が異なるため判定できません', 'Cannot check across different tree versions')} / ${t('未確認の装備', 'Unverified equipment slots')}: ${report.equipment.unknown}</p>`;
  $('sim-goal-active').hidden = false;
}

function render() {
  if (!bridge || !$('sim-goal-panel')) return;
  const state = bridge.goalData();
  $('sim-goal-panel').hidden = !state;
  if (!state) return;
  const selection = activePreset === state.preset ? $('sim-goal-select').value : '';
  if (activePreset !== state.preset) $('sim-goal-status').textContent = '';
  activePreset = state.preset;
  candidates = state.examples.map(example => ({kind: 'example', id: example.id, name: example.title, saved: example.saved}));
  let damaged = false;
  try {
    const plans = parseNamedPlans(localStorage.getItem(namedPlanKey(state.preset)), state.preset);
    candidates.push(...plans.map(plan => ({kind: 'plan', id: plan.id, name: plan.name, saved: plan.saved})));
  } catch { damaged = true; }
  $('sim-goal-select').innerHTML = `<option value="">${t('目標にする構成を選択', 'Choose a target build')}</option>` + candidates.map(candidate => `<option value="${candidate.kind}:${candidate.id}">${candidate.kind === 'example' ? t('完成見本', 'Reference') : t('保存構成', 'Named save')} · ${escape(candidate.name)}</option>`).join('');
  if (candidates.some(candidate => candidate.kind + ':' + candidate.id === selection)) $('sim-goal-select').value = selection;
  $('sim-goal-set').disabled = !$('sim-goal-select').value;
  $('sim-goal-options-help').textContent = damaged ? t('保存構成の一覧を読み込めません。元の保存は保持しています。', 'Named saves could not be read. Existing saves are intact.') : candidates.length ? t('このビルドの完成見本、または名前付き保存を選べます。', 'Choose a reference or a named save for this build.') : t('このビルドの構成に名前を付けて保存すると、目標に選べます。', 'Save a named configuration for this build to use it as a target.');
  const raw = localStorage.getItem(goalKey(state.preset));
  $('sim-goal-clear').hidden = !raw;
  $('sim-goal-active').hidden = true;
  $('sim-goal-count').textContent = '';
  if (!raw) { $('sim-goal-result').replaceChildren(); return; }
  try {
    const goal = parseGoal(raw, state.preset);
    const selected = goal.source.kind + ':' + goal.source.id;
    if (!$('sim-goal-select').value && candidates.some(candidate => candidate.kind + ':' + candidate.id === selected)) {
      $('sim-goal-select').value = selected;
      $('sim-goal-set').disabled = false;
    }
    renderReport(goal, state.current);
  }
  catch { $('sim-goal-status').textContent = t('保存した目標を照合できません。目標を選び直してください。現在の構成と元の目標データは保持しています。', 'The saved target cannot be compared. Choose a target again. Your current build and original target data are intact.'); }
}

function initialize() {
  const next = window.Poe2SimulatorLibrary;
  if (!next?.goalData || !$('sim-goal-panel')) return;
  bridge = next;
  try { render(); } catch { $('sim-goal-status').textContent = t('端末内の目標を読み込めませんでした。', 'The device target could not be read.'); }
}

for (const event of ['poe2:library-ready', 'poe2:workspace', 'poe2:goal-state', 'poe2:saved-builds']) window.addEventListener(event, initialize);
window.addEventListener('storage', event => {
  if (event.key === null || event.key === goalKey(activePreset) || event.key === namedPlanKey(activePreset)) initialize();
});
document.addEventListener('change', event => {
  if (event.target.id === 'sim-goal-select') $('sim-goal-set').disabled = !event.target.value;
  if (event.target.id === 'sim-goal-show-matched') initialize();
});
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || !bridge || !button.closest('#sim-goal-panel')) return;
  const state = bridge.goalData();
  if (!state) return;
  try {
    if (button.id === 'sim-goal-set') {
      const candidate = candidates.find(candidate => candidate.kind + ':' + candidate.id === $('sim-goal-select').value);
      if (!candidate) return;
      const goal = makeGoal(candidate, state.preset);
      compareGoal(state.current, goal);
      localStorage.setItem(goalKey(state.preset), JSON.stringify(goal));
      $('sim-goal-status').textContent = t('この端末の目標として保存しました。構成を編集すると不足一覧も更新されます。', 'Target saved on this device. The gap list updates as you edit your build.');
      $('sim-goal-panel').open = true;
      initialize();
    } else if (button.id === 'sim-goal-clear') {
      localStorage.removeItem(goalKey(state.preset));
      $('sim-goal-status').textContent = t('この端末の目標設定を解除しました。', 'The target preference was cleared on this device.');
      initialize();
    } else if (button.dataset.goalEdit || button.dataset.goalNode) {
      const kind = button.dataset.goalEdit || 'passives';
      bridge.goalNavigate(kind, button.dataset.goalNode ? Number(button.dataset.goalNode) : null);
    }
  } catch { $('sim-goal-status').textContent = t('目標を保存できませんでした。保存容量や構成の内容を確認してください。現在の構成は保持しています。', 'The target could not be saved. Check device storage and the build inputs. Your current build is intact.'); }
});
initialize();
