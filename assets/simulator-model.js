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

// Only display names change; the calculation engine retains its original identifiers.
const itemFields = {'Rarity':'レアリティ','Quality':'品質','Item Level':'アイテムレベル','Sockets':'ソケット','Armour':'アーマー','Evasion Rating':'回避力','Energy Shield':'エナジーシールド','Spirit':'スピリット','Physical Damage':'物理ダメージ','Elemental Damage':'元素ダメージ','Critical Hit Chance':'クリティカルヒット率','Attacks per Second':'秒間アタック回数','Requires':'装備条件'};
const rarities = {'UNIQUE':'ユニーク','Unique':'ユニーク','RARE':'レア','Rare':'レア','MAGIC':'マジック','Magic':'マジック','NORMAL':'ノーマル','Normal':'ノーマル'};
export function localizeItemText(text,names){
 return text.split('\n').map(line=>{
  if(names[line])return names[line];
  const match=line.match(/^([^:]+): (.*)$/);if(!match||!itemFields[match[1]])return line;
  return `${itemFields[match[1]]}: ${match[1]==='Rarity'?(rarities[match[2]] || match[2]):match[2]}`;
 }).join('\n');
}
export function restoreItemText(text,names,original=''){
 const originals=original.split('\n'),reverse=new Map();
 for(const [en,ja]of Object.entries(names))if(!reverse.has(ja))reverse.set(ja,en);
 const fields=Object.fromEntries(Object.entries(itemFields).map(([en,ja])=>[ja,en]));
 const rarity={ユニーク:'UNIQUE',レア:'RARE',マジック:'MAGIC',ノーマル:'NORMAL'};
 return text.split('\n').map((line,index)=>{
  if(originals[index]!==undefined&&localizeItemText(originals[index],names)===line)return originals[index];
  if(originals[index]!==undefined){
   const before=localizeItemText(originals[index],names),number=/[+-]?\d+(?:\.\d+)?/g;
   if(before.replace(number,'#')===line.replace(number,'#')){
    const a=originals[index].match(number)||[],b=before.match(number)||[],c=line.match(number)||[];
    if(a.length&&a.length===b.length&&b.length===c.length){
     const used=new Set(),positions=a.map(value=>{const i=b.findIndex((other,j)=>other===value&&!used.has(j));used.add(i);return i;});
     if(positions.every(i=>i>=0)){let i=0;return originals[index].replace(number,()=>c[positions[i++]]);}
    }
   }
  }
  const match=line.match(/^([^:]+): (.*)$/);
  if(match&&fields[match[1]])return `${fields[match[1]]}: ${fields[match[1]]==='Rarity'?(rarity[match[2]] || match[2]):match[2]}`;
  return reverse.get(line) || line;
 }).join('\n');
}
