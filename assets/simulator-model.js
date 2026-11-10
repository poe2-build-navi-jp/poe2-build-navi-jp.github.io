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
  if(value.origin&&(!['sample','record'].includes(value.origin.kind)||typeof value.origin.id!=='string'||!/^[-a-z0-9]{1,100}$/.test(value.origin.id)))throw Error('構成の出典情報が正しくありません。');
 return value;
}
export function makeSave(preset, request, questPoints, notes = '', equipmentDrafts = {}, weaponSets = null, origin = null) {
  return {version:SAVE_VERSION, engine:ENGINE_VERSION, preset, request, questPoints, notes, equipmentDrafts, weaponSets:weaponSetState(request,equipmentDrafts,weaponSets), ...(origin?{origin}:{}), savedAt:new Date().toISOString()};
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

// Plan all requested acquisitions against a cloned request; callers commit only the final result.
export async function previewPassiveBatch(request,targets,edit,questPoints=0,isCurrent=()=>true){
 const selected=[...new Set(targets)];if(!selected.length)return {valid:false,reason:'empty'};
 if(selected.some(id=>!Number.isInteger(id)))throw Error('選択したノードを確認してください。');
 let next=structuredClone(request),last=null;const path=new Set();
 for(const node of selected){
  if(!isCurrent())return {valid:false,reason:'cancelled'};
  if(next.allocated_nodes?.includes(node))continue;
  const checked=await edit({request:next,node,mode:0,action:'allocate',quest_points:questPoints});
  if(!isCurrent())return {valid:false,reason:'cancelled'};
  if(!checked.valid)return {valid:false,reason:'allocation',failedNode:node};
  next=applyTreeAllocation(next,checked.result.allocation);last=checked;
  for(const id of checked.result.path || [])path.add(id);
 }
 if(!selected.every(id=>next.allocated_nodes?.includes(id)))return {valid:false,reason:'allocation'};
 if(!last)return {valid:false,reason:'already_owned'};
 const before=new Set(request.allocated_nodes || []),after=new Set(next.allocated_nodes || []);
 return {valid:true,request:next,selectedTargets:selected,result:{...(last?.result || {}),added:[...after].filter(id=>!before.has(id)),removed:[...before].filter(id=>!after.has(id)),path:[...path]}};
}

// Shared links carry only the site's validated save format. Notes stay on the device.
export async function encodePlanLink(saved) {
  parseSave(JSON.stringify(saved));
  const copy={...saved,notes:'',savedAt:undefined};
  const bytes=new TextEncoder().encode(JSON.stringify(copy));
  const gzip=typeof CompressionStream==='function';
  const packed=gzip?new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()):bytes;
  let binary='';for(let i=0;i<packed.length;i+=8192)binary+=String.fromCharCode(...packed.subarray(i,i+8192));
  const value=`1${gzip?'g':'j'}.`+btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  if(value.length>24000)throw Error('この構成は共有URLの上限を超えています。保存ファイルを使ってください。');
  return value;
}
export async function decodePlanLink(value) {
  if(typeof value!=='string'||value.length>24000||!/^1[gj]\.[A-Za-z0-9_-]+$/.test(value))throw Error('共有URLの形式が正しくありません。');
  const binary=atob(value.slice(3).replaceAll('-','+').replaceAll('_','/'));
  let stream=new Blob([Uint8Array.from(binary,c=>c.charCodeAt(0))]).stream();
  if(value[1]==='g'){
    if(typeof DecompressionStream!=='function')throw Error('このブラウザでは共有構成を開けません。最新のブラウザをお使いください。');
    stream=stream.pipeThrough(new DecompressionStream('gzip'));
  }
  const reader=stream.getReader(),parts=[];let size=0;
  try{while(true){const {done,value:part}=await reader.read();if(done)break;size+=part.length;if(size>2000000){await reader.cancel();throw Error('共有構成のサイズが上限を超えています。');}parts.push(part);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  return parseSave(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
export function levelingStage(preset,level){
  const index=level<=10?0:level<=20?1:level<=30?2:level<=40?3:level<=65?4:level<=75?5:level<=90?6:7;
  return preset.stages?.[index] || null;
}
export function stageSkillCandidates(stage,gems,names){
  if(!stage)return [];
  // Present alternatives for the user to choose; never guess conditional cutovers or support links.
  return gems.filter(g=>!g.is_support&&[g.name,names[g.name]].filter(Boolean).some(n=>stage.mainSkill.includes(n))).sort((a,b)=>{
    const position=g=>Math.min(...[g.name,names[g.name]].filter(n=>n&&stage.mainSkill.includes(n)).map(n=>stage.mainSkill.indexOf(n)));
    return position(a)-position(b);
  });
}
export function itemRequirements(text,catalog){
  const lines=String(text||'').split('\n');
  const base=catalog.bases.find(b=>lines.includes(b.name));
  const req={...base?.requirements};
  // Accept both one-line simulator drafts and game clipboard requirement blocks.
  const region=lines.flatMap((line,i)=>/^Requires\b/i.test(line)?[line]:/^Requirements:/i.test(line)?lines.slice(i+1,i+6).filter(l=>!/^[-]+$/.test(l)):[]).join(' ');
  for(const [key,word]of [['str','Str(?:ength)?'],['dex','Dex(?:terity)?'],['int','Int(?:elligence)?']]){
    const match=new RegExp(`${word}\\s*:\\s*(\\d+)`,'i').exec(region)||new RegExp(`(\\d+)\\s+${word}\\b(?!\\s*:)`,'i').exec(region);
    if(match)req[key]=Number(match[1]);
  }
  const level=/Level\s*:?\s*(\d+)/i.exec(region);if(level)req.level=Number(level[1]);
  const reduction=/(\d+)% reduced Attribute Requirements/i.exec(text);if(reduction)for(const k of ['str','dex','int'])if(req[k])req[k]=Math.floor(req[k]*(1-Number(reduction[1])/100));
  return req;
}
export function resistanceGaps(result,target=75){
  return [['FireResist','火耐性'],['ColdResist','冷気耐性'],['LightningResist','雷耐性'],['ChaosResist','混沌耐性']].flatMap(([id,label])=>{
    const value=statValue(result,id);return Number.isFinite(value)&&value<target?[{id,label,value,missing:Math.round((target-value)*10)/10}]:[];
  });
}

// Named copies supplement the existing per-build autosave. Never migrate or replace it implicitly.
export const NAMED_PLAN_LIMIT=12;
export function namedPlanKey(preset){return `poe2-simulator:plans:v1:${preset}`;}
export function parseNamedPlans(text,preset){
 if(!text)return [];
 if(text.length>6000000)throw Error('構成一覧が大きすぎます。保存ファイルから復元してください。');
 const data=JSON.parse(text);
 if(data.version!==1||!Array.isArray(data.plans)||data.plans.length>NAMED_PLAN_LIMIT)throw Error('構成一覧の形式が正しくありません。');
 const ids=new Set();
 return data.plans.map(entry=>{
  if(!entry||typeof entry.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(entry.id)||ids.has(entry.id)||typeof entry.name!=='string'||!entry.name.trim()||entry.name.length>40)throw Error('保存した構成の名前・識別子を確認してください。');
  ids.add(entry.id);const saved=parseSave(JSON.stringify(entry.saved));if(saved.preset!==preset)throw Error('別のビルドの構成が混ざっています。');
  return {...entry,saved};
 });
}
export function putNamedPlan(plans,preset,name,saved,{id=null,newId=()=>crypto.randomUUID()}={}){
 const value=String(name).trim();if(!value||value.length>40||/[\r\n]/.test(value))throw Error('構成名は改行なしの1〜40文字で入力してください。');
 const next=structuredClone(plans),index=id?next.findIndex(p=>p.id===id):-1;
 if(next.some(p=>p.name===value&&p.id!==id))throw Error('同じ名前の構成があります。別の名前にするか、保存構成を選んで更新してください。');
 if(id&&index<0)throw Error('更新する構成が見つかりません。');
 if(index<0&&next.length>=NAMED_PLAN_LIMIT)throw Error(`このビルドには${NAMED_PLAN_LIMIT}構成まで保存できます。不要な構成を削除するか、保存ファイルを使ってください。`);
 const entry={id:id||newId(),name:value,saved:structuredClone(saved)};
 if(index>=0)next[index]=entry;else next.push(entry);
 return parseNamedPlans(JSON.stringify({version:1,plans:next}),preset);
}
export function upgradeAdvice(result,requirements=[],target=75,request={}){
 const advice=[];
 for(const item of requirements){if(advice.some(a=>a.slot===item.slot))continue;advice.push({title:'装備条件を先に満たす',detail:item.message,slot:item.slot,href:'/guides/equipment-basics/',link:'装備条件と能力値の確認方法'});}
 const spirit=statValue(result,'SpiritUnreserved');
 if(Number.isFinite(spirit)&&spirit<0)advice.push({title:'スピリットの予約を見直す',detail:`予約が${Math.ceil(-spirit)}不足しています。召喚数・予約スキルを調整してから装備を比較してください。`,href:'/dictionary/spirit/',link:'スピリットの仕組み'});
 const gaps=resistanceGaps(result,target).sort((a,b)=>(a.id==='ChaosResist')-(b.id==='ChaosResist')||b.missing-a.missing);
 const occupied=new Set((request.items||[]).map(i=>i.slot)),candidate=['ring1','ring2','boots','belt','gloves'].find(s=>!occupied.has(s))||'ring1';
 if(gaps.length)advice.push({title:'不足している耐性から比較する',detail:gaps.slice(0,3).map(g=>`${g.label}は目標${target}%まで${g.missing}ポイント`).join('、')+'。指輪・靴・ベルトなどで補う候補を作り、交換で失う能力値も確認します。',slot:candidate,href:'/guides/resistance/',link:'耐性を補う装備の選び方'});
 return advice.slice(0,3);
}
