import {parseSave, weaponSetState} from './simulator-model.js?v=161ef63cbd';
const plain = (value, limit) => String(value || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, limit);

export function plannerExport(value, index, options = {}) {
  const saved = parseSave(JSON.stringify(value)), request = saved.request;
  const from = Number(options.from ?? 1), to = Number(options.to ?? 100);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 100 || from > to) throw Error('PLANNER_LEVEL');
  const name = plain(options.name, 140);
  if (!name) throw Error('PLANNER_NAME');
  const build = {name, description: 'Snapshot from POE2 Build Navi. Game data ' + index.dataVersion + '. In-game planner format v1 (experimental).'};
  const author = plain(options.author, 80);
  if (author) build.author = author;
  const character = index.classes.find(entry => entry.name === request.character.class_name);
  if (!character) throw Error('PLANNER_CLASS');
  const omissions = [], interval = [from, to], counts = {passives: 0, skills: 0, supports: 0};
  const ascendancy = character.ascendancies.find(entry => entry.name === request.character.ascendancy_name);
  if (ascendancy) build.ascendancy = ascendancy.id;
  else if (request.character.ascendancy_name) omissions.push({kind: 'ascendancy', id: request.character.ascendancy_name, reason: 'unknown'});
  if (options.passives !== false) {
    const specific = request.weapon_swap?.exclusive_nodes || [[], []];
    const allSpecific = new Set(specific.flat());
    const scopes = [(request.allocated_nodes || []).filter(id => !allSpecific.has(id)), ...specific];
    build.passives = [];
    const currentTree = (request.tree_version || '0_5') === index.treeVersion;
    scopes.forEach((ids, scope) => {
      for (const id of new Set(ids)) {
        const node = currentTree ? index.nodes[id] : null;
        if (!node?.id) { omissions.push({kind: 'passive', id, reason: currentTree ? 'unknown' : 'tree-version'}); continue; }
        if (['class_start', 'ascendancy_start', 'mastery'].includes(node.kind)) continue;
        const passive = {id: node.id, level_interval: interval, weapon_set: scope};
        if (node.name === 'Attribute') {
          const choices = {str: 'Strength', dex: 'Dexterity', int: 'Intelligence'};
          passive.additional_text = 'Attribute choice: ' + (choices[request.attribute_choices?.[id]] || 'Strength');
        }
        build.passives.push(passive); counts.passives++;
      }
    });
  }
  if (options.skills !== false) {
    build.skills = [];
    for (const group of request.socket_groups || []) {
      if (group.enabled === false) continue;
      const enabled = (group.gems || []).filter(gem => gem.enabled !== false);
      const active = enabled.filter(gem => !index.gems[gem.skill_id]?.support);
      if (active.length !== 1) {
        for (const gem of active) omissions.push({kind: 'skill', id: gem.skill_id, reason: 'group'});
        continue;
      }
      const main = active[0], info = index.gems[main.skill_id];
      if (!info?.itemId || info.meta) {
        omissions.push({kind: 'skill', id: main.skill_id, reason: info?.meta ? 'meta' : 'unknown'}); continue;
      }
      const skill = {id: info.itemId, level_interval: interval,
        additional_text: 'Gem level ' + main.level + '; quality ' + (main.quality || 0) + '%',
        support_skills: []};
      for (const gem of enabled.filter(gem => gem !== main)) {
        const support = index.gems[gem.skill_id];
        if (!support?.support || !support.itemId) {
          omissions.push({kind: 'support', id: gem.skill_id, reason: 'unknown'}); continue;
        }
        skill.support_skills.push({id: support.itemId, level_interval: interval,
          additional_text: 'Gem level ' + gem.level + '; quality ' + (gem.quality || 0) + '%'});
        counts.supports++;
      }
      build.skills.push(skill); counts.skills++;
    }
  }
  // A planner file is guidance, not an equipment or simulator-save format.
  if (!counts.passives && !counts.skills) throw Error('PLANNER_EMPTY');
  validatePlanner(build, index);
  return {build, counts, omissions, dataVersion: index.dataVersion, preset: saved.preset};
}

export function validatePlanner(build, index) {
  if (!build || typeof build.name !== 'string' || !build.name.trim()) throw Error('PLANNER_FORMAT');
  const passiveIds = new Set(Object.values(index.nodes).map(node => node.id));
  const gemIds = new Set(Object.values(index.gems).filter(gem => gem.itemId).map(gem => gem.itemId));
  const validInterval = value => Array.isArray(value) && value.length === 2 &&
    value.every(Number.isInteger) && value[0] >= 1 && value[1] <= 100 && value[0] <= value[1];
  for (const node of build.passives || []) {
    if (!passiveIds.has(node.id) || !validInterval(node.level_interval) || ![0, 1, 2].includes(node.weapon_set)) throw Error('PLANNER_FORMAT');
  }
  for (const skill of build.skills || []) {
    if (!gemIds.has(skill.id) || !validInterval(skill.level_interval)) throw Error('PLANNER_FORMAT');
    for (const support of skill.support_skills || []) if (!gemIds.has(support.id) || !validInterval(support.level_interval)) throw Error('PLANNER_FORMAT');
  }
  return build;
}

export function plannerSourceKey(saved) {
  return JSON.stringify([saved.preset, saved.request, weaponSetState(saved.request, {}, saved.weaponSets)]);
}
