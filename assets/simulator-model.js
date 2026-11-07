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
  if(value.weaponSets)weaponSetState(value.request,value.equipmentDrafts || {},value.weaponSets);
 return value;
}
export function makeSave(preset, request, questPoints, notes = '', equipmentDrafts = {}, weaponSets = null) {
  return {version:SAVE_VERSION, engine:ENGINE_VERSION, preset, request, questPoints, notes, equipmentDrafts, weaponSets:weaponSetState(request,equipmentDrafts,weaponSets), savedAt:new Date().toISOString()};
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

const rareSlotClasses={helmet:['Helmet'],body:['Body Armour'],gloves:['Gloves'],boots:['Boots'],belt:['Belt'],amulet:['Amulet'],ring1:['Ring'],ring2:['Ring'],weapon1:['Bow','Crossbow','One Hand Mace','Two Hand Mace','Wand','Staff','Warstaff','Sceptre','Spear','Talisman'],weapon2:['Shield','Buckler','Focus','Quiver','One Hand Mace','Wand','Sceptre','Spear']};
export function rareBasesForSlot(slot,catalog){return catalog.bases.filter(b=>(rareSlotClasses[slot] || []).includes(b.itemClass));}
export function buildRareItem(draft,slot,catalog){
 const base=rareBasesForSlot(slot,catalog).find(b=>b.id===draft.baseId);if(!base)throw Error('この部位に対応するベース装備を選んでください。');
 const name=String(draft.name || '自作のレア装備').trim();if(!name||name.length>80||/[\r\n]/.test(name))throw Error('装備名は改行なしの80文字以内で入力してください。');
 const level=Number(draft.level),quality=Number(draft.quality);if(!Number.isInteger(level)||level<1||level>100||!Number.isInteger(quality)||quality<0||quality>30)throw Error('アイテムレベルは1〜100、品質は0〜30で入力してください。');
 if(!Array.isArray(draft.modifiers)||draft.modifiers.length>10)throw Error('オプションは10行まで追加できます。');
 const seen=new Set(),lines=draft.modifiers.map(mod=>{
  const definition=catalog.modifiers.find(d=>d.id===mod.id);if(!definition||seen.has(mod.id))throw Error('同じオプションの重複を解除してください。');seen.add(mod.id);
  if(!Array.isArray(mod.values)||mod.values.length!==definition.default.length||mod.values.some(v=>v===''||!Number.isFinite(Number(v))||Number(v)<0||Number(v)>100000))throw Error('オプションの数値は0〜100000で入力してください。');
  if(mod.values.length===2&&Number(mod.values[0])>Number(mod.values[1]))throw Error('ダメージの最小値は最大値以下にしてください。');
  return definition.template.replace(/\{(\d+)\}/g,(_,i)=>String(Number(mod.values[+i])));
 });
 return ['Rarity: RARE',name,base.name,`Item Level: ${level}`,`Quality: ${quality}`,'Implicits: 0',...lines].join('\n');
}

export function passiveDescriptions(node,localization,choices={},current=true){
 if(node.name==='Attribute')return [`${{str:'筋力',dex:'器用さ',int:'知性'}[choices[node.skill] || 'str']} +5（能力値を変更できます）`];
 const translated=current?localization.descriptions[localization.nodes[node.skill]]:null;
 const lines=(translated?.length?translated:node.stats || []).flatMap(line=>line.split('\n')).filter(Boolean);
 if(lines.length)return lines;
 if(node.kind==='mastery')return ['パッシブ群の中央マークです。このマーク自体には取得する能力はありません。'];
 if(node.kind==='jewel_socket')return ['ジュエルを配置するソケットです。取得だけでは能力値は増えません。ジュエルの個別設定はこの画面では未対応です。'];
 if(node.kind==='ascendancy_start')return ['選択したアセンダンシーの開始点です。開始点自体に追加の能力はありません。'];
 if(/^[A-Z]+$/.test(node.name))return ['職業の開始点です。開始点自体に追加の能力はありません。'];
 return ['対応データに効果の定義がありません。個別の選択効果は未対応のため、このノード単体の能力を計算したとは扱いません。'];
}
export function applyTreeAllocation(request,allocation){
 const next=structuredClone(request);next.allocated_nodes=[...allocation.shared];
 if(next.weapon_swap){next.weapon_swap.exclusive_nodes=structuredClone(allocation.exclusive);next.allocated_nodes=[...new Set([...allocation.shared,...allocation.exclusive[(next.weapon_swap.active || 1)-1]])];}
 return next;
}

const escapePattern=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function modifierJapanese(definition,values){return `${definition.label} ${values.length===2?values.join('〜'):'+'+values[0]}${definition.unit || ''}`;}
export function localizeModifiers(lines,catalog,names){
 return lines.map(line=>{
  for(const def of catalog.modifiers){const pattern=escapePattern(def.template).replace(/\\\{\d+\\\}/g,'([0-9]+(?:\\.[0-9]+)?)');const match=line.match(new RegExp('^'+pattern+'$'));if(match)return modifierJapanese(def,match.slice(1));}
  return localizeItemText(line,names);
 }).join('\n');
}
export function parseJapaneseModifiers(text,catalog,names,original=[]){
 const lines=text.normalize('NFKC').split('\n').map(line=>line.trim()).filter(Boolean);
 if(lines.length>100)throw Error('追加の効果は100行までです。');
 return lines.map((line,index)=>{
  for(const def of catalog.modifiers){
   const match=line.match(new RegExp('^'+escapePattern(def.label)+'\\s*[:：]?\\s*\\+?([0-9]+(?:\\.[0-9]+)?)'+(def.default.length===2?'\\s*[〜~～]\\s*([0-9]+(?:\\.[0-9]+)?)':'')+'\\s*'+(def.unit?'%?':'')+'$'));
   if(!match)continue;
   const values=match.slice(1).map(Number);if(values.some(v=>!Number.isFinite(v)||v>100000)||values.length===2&&values[0]>values[1])throw Error(`${index+1}行目の数値を確認してください。`);
   return def.template.replace(/\{(\d+)\}/g,(_,i)=>String(values[+i]));
  }
  const restored=restoreItemText(line,names,original[index] || '');
  if(/[ぁ-んァ-ヶ一-龥]/.test(restored))throw Error(`${index+1}行目の日本語の効果を認識できません。「追加する効果」から選ぶか、入力例の形式で入力してください。`);
  return restored;
 });
}

export function passiveComparison(own,reference){const a=new Set(own),b=new Set(reference);return {shared:[...a].filter(n=>b.has(n)),referenceOnly:[...b].filter(n=>!a.has(n)),ownOnly:[...a].filter(n=>!b.has(n))};}

const weaponSlots=new Set(['weapon1','weapon2']);
export function weaponSetState(request,drafts={},previous=null){
 const state=previous?structuredClone(previous):{active:1,sets:[{items:[],drafts:{}},{items:[],drafts:{}}]};
 if(![1,2].includes(state.active)||!Array.isArray(state.sets)||state.sets.length!==2||state.sets.some(set=>!set||!Array.isArray(set.items)||set.items.length>2||set.items.some(item=>!weaponSlots.has(item.slot)||typeof item.text!=='string')||!set.drafts||typeof set.drafts!=='object'))throw Error('武器スロットの保存形式が正しくありません。');
 state.sets[state.active-1]={items:structuredClone((request.items || []).filter(item=>weaponSlots.has(item.slot))),drafts:structuredClone(Object.fromEntries(Object.entries(drafts).filter(([slot])=>weaponSlots.has(slot))))};return state;
}
export function selectWeaponSet(plan,active){
 if(![1,2].includes(active))throw Error('武器スロットは1または2を選んでください。');
 const next=structuredClone(plan),state=weaponSetState(next.request,next.equipmentDrafts || {},next.weaponSets);state.active=active;next.weaponSets=state;
 next.request.items=[...(next.request.items || []).filter(item=>!weaponSlots.has(item.slot)),...structuredClone(state.sets[active-1].items)];
 next.equipmentDrafts={...Object.fromEntries(Object.entries(next.equipmentDrafts || {}).filter(([slot])=>!weaponSlots.has(slot))),...structuredClone(state.sets[active-1].drafts)};
 if(next.request.weapon_swap){const swap=next.request.weapon_swap,exclusive=new Set((swap.exclusive_nodes || []).flat());next.request.allocated_nodes=[...new Set([...(next.request.allocated_nodes || []).filter(id=>!exclusive.has(id)),...(swap.exclusive_nodes?.[active-1] || [])])];swap.active=active;}
 return next;
}

export function drawableTreeEdges(nodes){
 const byId=new Map(nodes.map(node=>[node.skill,node]));
 return treeEdges(nodes).filter(edge=>{
  const a=byId.get(edge.from),b=byId.get(edge.to);
  // These graph links enable ascendancy/class changes. They are not map routes.
  return (a.ascendancy_id || null)===(b.ascendancy_id || null)&&[edge.x1,edge.y1,edge.x2,edge.y2].every(Number.isFinite);
 });
}
export function acquiredTreeState(request,nodes,classStarts,ascendancyId){
 const byId=new Map(nodes.map(node=>[node.skill,node])),allStarts=new Set(Object.values(classStarts || {})),starts=new Set();
 const root=classStarts?.[request.character.class_name.toLowerCase()];if(root!==undefined)starts.add(root);
 const ascRoot=nodes.find(node=>node.kind==='ascendancy_start'&&node.ascendancy_id===ascendancyId);if(ascRoot)starts.add(ascRoot.skill);
 const owned=new Set((request.allocated_nodes || []).filter(id=>{const node=byId.get(id);return node&&!allStarts.has(id)&&node.kind!=='ascendancy_start'&&node.kind!=='mastery';}));
 return {starts,owned};
}
