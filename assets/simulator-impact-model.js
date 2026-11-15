import {parseNamedPlans, namedPlanKey, ENGINE_VERSION, weaponSetState} from './simulator-model.js?v=161ef63cbd';

export function reviewPlans(storage, presets) {
  const plans = [], unreadable = [];
  for (const preset of presets) {
    try {
      const raw = storage.getItem(namedPlanKey(preset.id));
      if (!raw) continue;
      if (raw.length > 6000000) throw Error('REVIEW_FORMAT');
      const input = JSON.parse(raw);
      // Older engine versions are reviewable, but are never applied or rewritten here.
      const engines = (input.plans || []).map(plan => plan?.saved?.engine);
      for (const plan of input.plans || []) {
        if (!/^\d+\.\d+\.\d+$/.test(plan?.saved?.engine || '')) throw Error('REVIEW_FORMAT');
        plan.saved.engine = ENGINE_VERSION;
      }
      parseNamedPlans(JSON.stringify(input), preset.id).forEach((plan, index) => {
        plan.saved.engine = engines[index];
        plans.push({...plan, preset: preset.id});
      });
    } catch { unreadable.push(preset.id); }
  }
  return {plans, unreadable};
}

export function buildParts(saved, index) {
  const request = saved.request, parts = [];
  const currentTree = (request.tree_version || '0_5') === index.treeVersion;
  for (const [groupId, group] of (request.socket_groups || []).entries()) {
    for (const [position, gem] of (group.gems || []).entries()) {
      const info = index.gems[gem.skill_id];
      parts.push({
        kind: 'gem', key: groupId + ':' + position, id: gem.skill_id,
        name: info?.name || gem.skill_id, tags: info?.tags || [], support: !!info?.support,
        enabled: group.enabled !== false && gem.enabled !== false,
      });
    }
  }
  for (const id of request.allocated_nodes || []) {
    const node = currentTree ? index.nodes[id] : null;
    if (['class_start', 'ascendancy_start', 'mastery'].includes(node?.kind)) continue;
    parts.push({kind: 'passive', key: String(id), id, name: node?.name || String(id),
      ascendancy: node?.ascendancy || '', unverified: !node});
  }
  const weapons = weaponSetState(request, {}, saved.weaponSets);
  const gear = [
    ...(request.items || []).filter(item => !item.slot.startsWith('weapon')).map(item => ({...item, scope: 0})),
    ...weapons.sets.flatMap((set, index) => set.items.map(item => ({...item, scope: index + 1}))),
  ];
  for (const item of gear) {
    const lines = item.text.split('\n').map(line => line.trim()).filter(Boolean);
    const base = lines.find(line => Object.hasOwn(index.bases, line));
    parts.push({
      kind: 'equipment', key: item.slot + ':' + item.scope, id: item.slot,
      scope: item.scope, name: base || lines[1] || item.slot,
      itemClass: base ? index.bases[base] : '', unverified: !base,
    });
  }
  return parts;
}

export function noticeParts(notice, saved, index) {
  const parts = buildParts(saved, index);
  const selectors = notice.targets || [];
  if (!selectors.length) return {basis: 'review', parts, unknownScope: true};
  const matches = parts.filter(part => selectors.some(selector => {
    if (selector.kind && selector.kind !== part.kind) return false;
    if (selector.ids && !selector.ids.includes(part.id)) return false;
    if (selector.itemClasses && !selector.itemClasses.includes(part.itemClass)) return false;
    if (typeof selector.support === 'boolean' && selector.support !== part.support) return false;
    if (selector.tags && !selector.tags.some(tag => part.tags?.includes(tag))) return false;
    if (selector.ascendancies && !selector.ascendancies.includes(part.ascendancy)) return false;
    return true;
  }));
  return {basis: notice.basis === 'confirmed' ? 'confirmed' : 'review', parts: matches, unknownScope: false};
}
