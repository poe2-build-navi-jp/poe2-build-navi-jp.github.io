import {parseSave, weaponSetState} from './simulator-model.js?v=161ef63cbd';

export const goalKey = preset => 'poe2-simulator-goal:v1:' + preset;
const slots = new Set(['weapon1', 'weapon2', 'helmet', 'body', 'gloves', 'boots', 'belt', 'amulet', 'ring1', 'ring2', 'Flask 1', 'Flask 2', 'Charm 1', 'Charm 2', 'Charm 3']);
const choices = new Set(['str', 'dex', 'int']);
const treeVersion = request => request.tree_version || '0_5';

function checkedSave(value, preset) {
  const saved = parseSave(JSON.stringify(value));
  if (saved.preset !== preset) throw Error('GOAL_PRESET');
  const request = saved.request;
  if (request.attribute_choices && (typeof request.attribute_choices !== 'object' || Array.isArray(request.attribute_choices) ||
      Object.values(request.attribute_choices).some(choice => !choices.has(choice)))) throw Error('GOAL_FORMAT');
  for (const items of [request.items || [], request.flasks || []]) {
    if (!Array.isArray(items) || items.length > 40) throw Error('GOAL_FORMAT');
    const seen = new Set();
    for (const item of items) {
      if (!item || typeof item.slot !== 'string' || item.slot.length > 60 || seen.has(item.slot) ||
          typeof item.text !== 'string' || item.text.length > 100000) throw Error('GOAL_FORMAT');
      seen.add(item.slot);
    }
  }
  for (const group of request.socket_groups || []) {
    if (!group || !Array.isArray(group.gems) || group.gems.length > 30) throw Error('GOAL_FORMAT');
    for (const gem of group.gems) {
      if (!gem || typeof gem.skill_id !== 'string' || gem.skill_id.length > 180 ||
          !Number.isInteger(gem.level) || gem.level < 1 || gem.level > 100 ||
          !Number.isInteger(gem.quality ?? 0) || (gem.quality ?? 0) < 0 || (gem.quality ?? 0) > 100) throw Error('GOAL_FORMAT');
    }
  }
  if (request.weapon_swap) {
    const sets = request.weapon_swap.exclusive_nodes;
    if (!Array.isArray(sets) || sets.length !== 2 || sets.some(ids => !Array.isArray(ids) || ids.length > 1000 || ids.some(id => !Number.isInteger(id)))) throw Error('GOAL_FORMAT');
  }
  return saved;
}

export function makeGoal(candidate, preset) {
  if (!candidate || typeof candidate.name !== 'string' || !candidate.name.trim() || candidate.name.length > 140 ||
      !['example', 'plan'].includes(candidate.kind) || !/^[a-zA-Z0-9-]{1,100}$/.test(candidate.id || '')) throw Error('GOAL_FORMAT');
  const source = checkedSave(candidate.saved, preset);
  const weaponSets = weaponSetState(source.request, {}, source.weaponSets);
  // Goal selection is a separate device preference, never a change to either build.
  const saved = {
    version: source.version, engine: source.engine, preset,
    request: structuredClone(source.request), questPoints: source.questPoints,
    notes: '', equipmentDrafts: {},
    weaponSets: {...weaponSets, sets: weaponSets.sets.map(set => ({items: set.items, drafts: {}}))},
    ...(source.calculation ? {calculation: structuredClone(source.calculation)} : {}),
  };
  return {version: 1, preset, name: candidate.name, source: {kind: candidate.kind, id: candidate.id}, saved};
}

export function parseGoal(text, preset) {
  if (!text || text.length > 2100000) throw Error('GOAL_FORMAT');
  const value = JSON.parse(text);
  if (value?.version !== 1 || value.preset !== preset) throw Error('GOAL_FORMAT');
  return makeGoal({name: value.name, kind: value.source?.kind, id: value.source?.id, saved: value.saved}, preset);
}

function compareGems(current, target, gemInfo) {
  const anchor = group => (group.gems || []).find(gem => !gemInfo(gem.skill_id)?.support)?.skill_id || group.gems?.[0]?.skill_id;
  const available = (current.socket_groups || []).map((group, index) => ({group, index}));
  const rows = [];
  for (const [groupIndex, group] of (target.socket_groups || []).entries()) {
    if (group.enabled === false) continue;
    const parent = anchor(group);
    const candidates = available.filter(entry => anchor(entry.group) === parent);
    const score = entry => (entry.group.enabled !== false ? 1000 : 0) +
      group.gems.reduce((sum, gem) => sum + (entry.group.gems.some(other => other.skill_id === gem.skill_id) ? 10 : 0), 0);
    candidates.sort((a, b) => score(b) - score(a));
    const match = candidates[0];
    if (match) available.splice(available.indexOf(match), 1);
    const gems = (match?.group.gems || []).map((gem, index) => ({gem, index}));
    for (const wanted of group.gems) {
      if (wanted.enabled === false) continue;
      const same = gems.filter(entry => entry.gem.skill_id === wanted.skill_id);
      const quality = entry => (entry.gem.enabled !== false ? 100000 : 0) +
        Math.min(entry.gem.level, wanted.level) * 100 + Math.min(entry.gem.quality || 0, wanted.quality || 0);
      same.sort((a, b) => quality(b) - quality(a));
      const found = same[0];
      if (found) gems.splice(gems.indexOf(found), 1);
      const actual = found?.gem;
      const status = !gemInfo(wanted.skill_id) ? 'unknown' : !actual ? 'missing' : actual.enabled === false || match.group.enabled === false ? 'disabled' :
        actual.level < wanted.level || (actual.quality || 0) < (wanted.quality || 0) ? 'upgrade' : 'matched';
      rows.push({skillId: wanted.skill_id, parent, group: groupIndex, status,
        level: wanted.level, quality: wanted.quality || 0,
        currentLevel: actual?.level ?? null, currentQuality: actual ? actual.quality || 0 : null});
    }
  }
  const main = request => anchor(request.socket_groups?.[request.main_socket_group || 0] || {gems: []});
  const mainActive = request => request.socket_groups?.[request.main_socket_group || 0]?.main_active_skill || 1;
  return {rows, missing: rows.filter(row => ['missing', 'disabled'].includes(row.status)).length,
    upgrades: rows.filter(row => row.status === 'upgrade').length, unknown: rows.filter(row => row.status === 'unknown').length,
    main: main(target) || null, mainActive: mainActive(target),
    mainDifferent: !!main(target) && (main(current) !== main(target) || mainActive(current) !== mainActive(target))};
}

function allocations(request) {
  const exclusive = request.weapon_swap?.exclusive_nodes || [[], []];
  const specific = new Set(exclusive.flat());
  return [new Set((request.allocated_nodes || []).filter(id => !specific.has(id))), ...exclusive.map(ids => new Set(ids))];
}

function comparePassives(current, target, nodeInfo, starts) {
  if (treeVersion(current) !== treeVersion(target)) return {available: false, rows: [], missing: 0, choices: 0, unknown: 0};
  const own = allocations(current), wanted = allocations(target), startIds = new Set(starts), rows = [];
  for (const [scope, ids] of wanted.entries()) for (const id of ids) {
    const node = nodeInfo(id);
    if (startIds.has(id) || ['class_start', 'ascendancy_start', 'mastery'].includes(node?.kind)) continue;
    const acquired = own[0].has(id) || (scope ? own[scope].has(id) : own[1].has(id) && own[2].has(id));
    const targetChoice = target.attribute_choices?.[id] || 'str';
    const currentChoice = current.attribute_choices?.[id] || 'str';
    const choiceDifferent = node?.attribute && choices.has(targetChoice) && targetChoice !== currentChoice;
    const status = !node ? 'unknown' : !acquired ? 'missing' : choiceDifferent ? 'choice' : 'matched';
    rows.push({id, scope, status, targetChoice, currentChoice, name: node?.name || String(id)});
  }
  return {available: true, rows, missing: rows.filter(row => row.status === 'missing').length,
    choices: rows.filter(row => row.status === 'choice').length, unknown: rows.filter(row => row.status === 'unknown').length};
}

export function itemFingerprint(text) {
  const lines = String(text || '').replaceAll('\r', '').split('\n').map(line => line.trim()).filter(Boolean);
  if (/^Rarity:\s*(RARE|MAGIC)$/i.test(lines[0] || '') && lines.length > 2) lines.splice(1, 1);
  return lines.sort().join('\n');
}

function compareEquipment(current, target) {
  const ownWeapons = weaponSetState(current.request, {}, current.weaponSets);
  const targetWeapons = weaponSetState(target.request, {}, target.weaponSets);
  const sets = saved => [...(saved.request.items || []).filter(item => !item.slot.startsWith('weapon')), ...(saved.request.flasks || [])];
  const rows = [];
  const compare = (wanted, actual, scope) => {
    const pool = actual.map(item => ({...item}));
    // Claim exact ring matches before assigning unmatched slots, including swaps.
    const ordered = [...wanted].sort((a, b) => {
      const exact = item => /^ring[12]$/.test(item.slot) && actual.some(other => /^ring[12]$/.test(other.slot) && itemFingerprint(other.text) === itemFingerprint(item.text));
      return Number(exact(b)) - Number(exact(a));
    });
    for (const item of ordered) {
      if (!item.text.trim()) continue;
      const ring = item.slot === 'ring1' || item.slot === 'ring2';
      const index = ring ? pool.findIndex(other => /^ring[12]$/.test(other.slot) && itemFingerprint(other.text) === itemFingerprint(item.text)) : -1;
      const sameSlot = pool.findIndex(other => other.slot === item.slot);
      const position = index >= 0 ? index : sameSlot;
      const found = position >= 0 ? pool.splice(position, 1)[0] : null;
      rows.push({slot: item.slot, scope, text: item.text, currentText: found?.text || '',
        status: !slots.has(item.slot) ? 'unknown' : !found?.text.trim() ? 'missing' :
          itemFingerprint(found.text) === itemFingerprint(item.text) ? 'matched' : 'different'});
    }
  };
  compare(sets(target), sets(current), 0);
  for (let i = 0; i < 2; i++) compare(targetWeapons.sets[i].items, ownWeapons.sets[i].items, i + 1);
  return {rows, pending: rows.filter(row => ['missing', 'different'].includes(row.status)).length,
    unknown: rows.filter(row => row.status === 'unknown').length};
}

export function compareGoal(currentValue, goal, {gemInfo = () => null, nodeInfo = () => null, starts = []} = {}) {
  const current = checkedSave(currentValue, goal.preset), target = checkedSave(goal.saved, goal.preset);
  if (current.request.character.class_name !== target.request.character.class_name) throw Error('GOAL_CLASS');
  return {
    character: {current: current.request.character, target: target.request.character,
      sameAscendancy: (current.request.character.ascendancy_name || '') === (target.request.character.ascendancy_name || ''),
      currentTree: treeVersion(current.request), targetTree: treeVersion(target.request),
      sameData: !target.calculation?.dataVersion || !current.calculation?.dataVersion || target.calculation.dataVersion === current.calculation.dataVersion},
    gems: compareGems(current.request, target.request, gemInfo),
    passives: comparePassives(current.request, target.request, nodeInfo, starts),
    equipment: compareEquipment(current, target),
  };
}
