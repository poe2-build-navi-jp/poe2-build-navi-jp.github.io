export const SAVE_VERSION = 1;
export const ENGINE_VERSION = '0.0.46';
export function validRequest(request) {
  if (!request || !request.character || typeof request.character.class_name !== 'string') return false;
  if (!Number.isInteger(request.character.level) || request.character.level < 1 || request.character.level > 100) return false;
  if (request.items && (!Array.isArray(request.items) || request.items.length > 40)) return false;
  if (request.socket_groups && (!Array.isArray(request.socket_groups) || request.socket_groups.length > 50)) return false;
  if (request.allocated_nodes && (!Array.isArray(request.allocated_nodes) || request.allocated_nodes.length > 1000 || request.allocated_nodes.some(n => !Number.isInteger(n)))) return false;
  return true;
}
export function newPlan(preset, catalog) {
  const socket_groups = preset.skills.flatMap(name => {
    const gem = catalog.find(g => g.name === name && !g.is_support);
    return gem ? [{enabled:true, gems:[{skill_id:gem.skill_id,level:1,quality:0}], main_active_skill:1}] : [];
  });
  return {character:{class_name:preset.class, ascendancy_name:preset.ascendancy, level:80},
    allocated_nodes:[], attribute_choices:{}, items:[], flasks:[], jewels:[], socket_groups,
    main_socket_group:0, config_inputs:{'questInterlude 2Khari CrossingMolten Shrine':false}, breakdowns:[]};
}
export function parseSave(text) {
  if (!text || text.length > 2000000) throw new Error('保存データのサイズが上限を超えています。');
  const value = JSON.parse(text);
  if (value.version !== SAVE_VERSION || value.engine !== ENGINE_VERSION || !validRequest(value.request)
    || !Number.isInteger(value.questPoints) || value.questPoints<0 || value.questPoints>24
    || typeof value.notes!=='string' || value.notes.length>20000) throw new Error('保存データの形式または計算エンジンの版が異なります。');
  return value;
}
export function makeSave(preset, request, questPoints, notes = '') {
  return {version:SAVE_VERSION, engine:ENGINE_VERSION, preset, request, questPoints, notes, savedAt:new Date().toISOString()};
}
export const statValue = (result, id) => result?.stats?.find(stat => stat.id === id)?.value ?? null;
export function treeEdges(nodes) {
  const byId=new Map(nodes.map(n=>[n.skill,n])),seen=new Set(),edges=[];
  for(const node of nodes)for(const id of node.connections || []){
    const other=byId.get(id),key=[node.skill,id].sort((a,b)=>a-b).join(':');
    if(!other||seen.has(key))continue;
    seen.add(key);edges.push({from:node.skill,to:id,x1:node.x,y1:node.y,x2:other.x,y2:other.y});
  }
  return edges;
}
