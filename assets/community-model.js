import {parseSave, weaponSetState, ENGINE_VERSION} from './simulator-model.js?v=fdda84f09b';
export const PUBLIC_LIMIT = 64000;
export const PUBLIC_PURPOSES = ['leveling', 'mapping', 'boss', 'all'];
export const PUBLIC_CURRENCIES = ['exalted', 'divine', 'chaos'];
const gearSlots = new Set(['weapon1', 'weapon2', 'helmet', 'body', 'gloves', 'boots', 'belt', 'amulet', 'ring1', 'ring2']);
const utilitySlots = new Set(['Flask 1', 'Flask 2', 'Charm 1', 'Charm 2', 'Charm 3']);
const text = (value, maximum, required = false) => {
  if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw Error('PUBLIC_INPUT');
  const result = value.trim();
  if (required && !result) throw Error('PUBLIC_INPUT');
  return result;
};
const integer = (value, minimum, maximum) => {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw Error('PUBLIC_INPUT');
  return value;
};
function items(value, allowed, maximum) {
  if (!Array.isArray(value) || value.length > maximum) throw Error('PUBLIC_INPUT');
  const seen = new Set();
  return value.map(item => {
    if (!item || !allowed.has(item.slot) || seen.has(item.slot)) throw Error('PUBLIC_INPUT');
    seen.add(item.slot);
    return {slot: item.slot, text: text(item.text, 8000, true)};
  });
}
export function publicSnapshot(value, catalog) {
  const saved = parseSave(JSON.stringify(value)), request = saved.request;
  const preset = catalog.presets.find(preset => preset.id === saved.preset);
  if (!preset || request.character.class_name !== preset.class) throw Error('PUBLIC_PRESET');
  const treeVersion = request.tree_version || '0_5';
  if (treeVersion !== catalog.treeVersion) throw Error('PUBLIC_TREE');
  const ascendancy = request.character.ascendancy_name || '';
  if (ascendancy && !catalog.classes.find(entry => entry.name === preset.class)?.ascendancies.some(entry => entry.name === ascendancy)) throw Error('PUBLIC_PRESET');
  const validNodes = new Set(catalog.nodes);
  const nodeList = values => {
    if (!Array.isArray(values) || values.length > 300) throw Error('PUBLIC_INPUT');
    const nodes = [...new Set(values)];
    if (nodes.some(id => !Number.isInteger(id) || !validNodes.has(id))) throw Error('PUBLIC_NODE');
    return nodes;
  };
  const allocated = nodeList(request.allocated_nodes || []);
  const attributes = Object.fromEntries(Object.entries(request.attribute_choices || {}).map(([id, choice]) => {
    if (!/^\d+$/.test(id) || !validNodes.has(Number(id)) || !['str', 'dex', 'int'].includes(choice)) throw Error('PUBLIC_INPUT');
    return [id, choice];
  }));
  if (Object.keys(attributes).length > 300) throw Error('PUBLIC_INPUT');
  const groups = request.socket_groups || [];
  if (!Array.isArray(groups) || groups.length > 12) throw Error('PUBLIC_INPUT');
  const socketGroups = groups.map(group => {
    if (!Array.isArray(group.gems) || group.gems.length > 12) throw Error('PUBLIC_INPUT');
    return {
      enabled: group.enabled !== false,
      main_active_skill: integer(group.main_active_skill ?? 1, 1, 20),
      gems: group.gems.map(gem => {
        if (!Object.hasOwn(catalog.gems, gem.skill_id)) throw Error('PUBLIC_GEM');
        const result = {skill_id: gem.skill_id, level: integer(gem.level, 1, 40), quality: integer(gem.quality || 0, 0, 30)};
        if (gem.enabled === false) result.enabled = false;
        for (const key of ['minion', 'minion_skill']) if (gem[key] != null) result[key] = text(gem[key], 150);
        if (gem.stat_set_index != null) result.stat_set_index = integer(gem.stat_set_index, 0, 20);
        return result;
      }),
    };
  });
  const config = Object.fromEntries(Object.entries(request.config_inputs || {}).map(([key, value]) => {
    if (!key || key.length > 120 || !catalog.configKeys.includes(key) || ['__proto__', 'prototype', 'constructor'].includes(key) ||
        !['boolean', 'number', 'string'].includes(typeof value) ||
        typeof value === 'number' && !Number.isFinite(value) || typeof value === 'string' && value.length > 80) throw Error('PUBLIC_INPUT');
    return [key, value];
  }));
  if (Object.keys(config).length > 60) throw Error('PUBLIC_INPUT');
  const modifiers = request.extra_modifiers || [];
  if (!Array.isArray(modifiers) || modifiers.length > 30) throw Error('PUBLIC_INPUT');
  if ((request.jewels || []).length) throw Error('PUBLIC_JEWELS');
  const clean = {
    character: {class_name: preset.class, ascendancy_name: ascendancy, level: integer(request.character.level, 1, 100)},
    tree_version: treeVersion, allocated_nodes: allocated, attribute_choices: attributes,
    socket_groups: socketGroups,
    main_socket_group: integer(request.main_socket_group || 0, 0, Math.max(0, socketGroups.length - 1)),
    items: items(request.items || [], gearSlots, 10), flasks: items(request.flasks || [], utilitySlots, 5),
    jewels: [], config_inputs: config,
    extra_modifiers: modifiers.map(value => text(value, 1000)),
    enemy_tier: ['none', 'boss', 'pinnacle', 'uber'].includes(request.enemy_tier) ? request.enemy_tier : 'none',
    breakdowns: [],
  };
  if (request.weapon_swap) {
    if (!Array.isArray(request.weapon_swap.exclusive_nodes) || request.weapon_swap.exclusive_nodes.length !== 2) throw Error('PUBLIC_INPUT');
    clean.weapon_swap = {
      active: integer(request.weapon_swap.active || 1, 1, 2),
      exclusive_nodes: request.weapon_swap.exclusive_nodes.map(nodeList),
    };
  }
  const weaponState = weaponSetState(request, {}, saved.weaponSets);
  const snapshot = {
    version: 1, engine: ENGINE_VERSION, preset: preset.id, request: clean,
    questPoints: integer(saved.questPoints, 0, 24), notes: '', equipmentDrafts: {},
    weaponSets: {
      active: weaponState.active,
      sets: weaponState.sets.map(set => ({items: items(set.items, new Set(['weapon1', 'weapon2']), 2), drafts: {}})),
    },
  };
  if (new TextEncoder().encode(JSON.stringify(snapshot)).length > PUBLIC_LIMIT) throw Error('PUBLIC_SIZE');
  return parseSave(JSON.stringify(snapshot));
}
export function publicPost(input, catalog) {
  if (!input || input.version !== 1 || !PUBLIC_PURPOSES.includes(input.purpose)) throw Error('PUBLIC_INPUT');
  const snapshot = publicSnapshot(input.snapshot, catalog);
  const amount = input.budget?.amount;
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 1000000)) throw Error('PUBLIC_BUDGET');
  if (!PUBLIC_CURRENCIES.includes(input.budget?.currency)) throw Error('PUBLIC_BUDGET');
  const groups = snapshot.request.socket_groups;
  const primary = groups[snapshot.request.main_socket_group || 0]?.gems.find(gem => !catalog.gems[gem.skill_id].support && gem.enabled !== false);
  if (!primary || groups[snapshot.request.main_socket_group || 0].enabled === false) throw Error('PUBLIC_SKILL');
  return {
    version: 1, title: text(input.title, 60, true), nickname: text(input.nickname || '', 30) || 'Anonymous',
    description: text(input.description || '', 1200), purpose: input.purpose,
    budget: {amount, currency: input.budget.currency}, primarySkill: primary.skill_id,
    dataVersion: catalog.dataVersion, snapshot,
  };
}
export function postSummary(post) {
  return {
    title: post.title, nickname: post.nickname, purpose: post.purpose, budget: post.budget,
    primarySkill: post.primarySkill, preset: post.snapshot.preset,
    level: post.snapshot.request.character.level, dataVersion: post.dataVersion,
  };
}
export function matchesPost(post, filters = {}) {
  if (filters.skill && post.primarySkill !== filters.skill) return false;
  if (filters.purpose && post.purpose !== filters.purpose) return false;
  if (filters.maximum != null && (post.budget.amount == null || post.budget.currency !== filters.currency || post.budget.amount > filters.maximum)) return false;
  const query = String(filters.query || '').normalize('NFKC').toLowerCase().trim();
  return !query || (post.title + ' ' + post.nickname).normalize('NFKC').toLowerCase().includes(query);
}
