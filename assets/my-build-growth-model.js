import {parseSave} from './simulator-model.js?v=fdda84f09b';

export const GROWTH_PREFIX='poe2-build-growth:v1:';
export const GROWTH_LIMIT=30;
export const GROWTH_STATS=['CombinedDPS','Life','EnergyShield','Armour','FireResist','ColdResist','LightningResist','ChaosResist'];
export const growthKey=preset=>{if(!/^[-a-z0-9]{1,100}$/.test(preset))throw Error('GROWTH_FORMAT');return GROWTH_PREFIX+preset;};
const fail=code=>{throw Error(code);};
const canonical=value=>JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(value).sort().map(key=>[key,JSON.parse(canonical(value[key]))])):value);
const text=(value,max)=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
function checked(record,preset){
 if(!record||record.preset!==preset||!/^[-a-zA-Z0-9]{1,80}$/.test(record.id)||!Number.isFinite(Date.parse(record.at))||!text(record.label,40)||!Number.isInteger(record.level)||record.level<1||record.level>100)fail('GROWTH_FORMAT');
 if(!record.values||GROWTH_STATS.some(id=>record.values[id]!==null&&(!Number.isFinite(record.values[id])||Math.abs(record.values[id])>1e30)))fail('GROWTH_FORMAT');
 const c=record.conditions;
 if(!c||['engine','data','tree','className','ascendancy','mainSkill','config'].some(key=>!text(c[key],key==='config'?15000:500))||![1,2].includes(c.weaponSet))fail('GROWTH_FORMAT');
 for(const key of ['gear','gems','passives'])if(!Number.isInteger(record.counts?.[key])||record.counts[key]<0||record.counts[key]>2000)fail('GROWTH_FORMAT');
 if(typeof record.warning!=='boolean')fail('GROWTH_FORMAT');
 return {...record,values:Object.fromEntries(GROWTH_STATS.map(id=>[id,record.values[id]])),conditions:{...c},counts:{...record.counts}};
}
export function parseGrowth(raw,preset){
 growthKey(preset);if(raw===null)return [];
 try{
  if(typeof raw!=='string'||raw.length>700000)fail('GROWTH_FORMAT');
  const data=JSON.parse(raw),ids=new Set();
  if(data?.version!==1||!Array.isArray(data.records)||data.records.length>GROWTH_LIMIT)fail('GROWTH_FORMAT');
  return data.records.map(record=>{const value=checked(record,preset);if(ids.has(value.id))fail('GROWTH_FORMAT');ids.add(value.id);return value;});
 }catch{fail('GROWTH_FORMAT');}
}
export function makeGrowth(data,label,{id,at}){
 if(!data||typeof data.warning!=='boolean')fail('GROWTH_NOT_READY');
 const saved=parseSave(JSON.stringify(data.saved)),r=saved.request,group=r.socket_groups?.[r.main_socket_group||0],gem=group?.gems?.find(g=>g.skill_id)||{};
 const config=canonical(r.config_inputs||{});
 const record={id,at,preset:saved.preset,label:label.trim(),level:r.character.level,values:Object.fromEntries(GROWTH_STATS.map(key=>[key,data.values?.[key]??null])),
  conditions:{engine:data.runtime.release,data:data.runtime.dataVersion,tree:r.tree_version||'0_5',className:r.character.class_name,ascendancy:r.character.ascendancy_name||'',weaponSet:saved.weaponSets?.active||1,
   mainSkill:canonical({id:gem.skill_id||'',minion:gem.minion||'',active:group?.main_active_skill||0}),config},
  counts:{gear:r.items.filter(item=>item.text?.trim()).length,gems:(r.socket_groups||[]).reduce((sum,group)=>sum+group.gems.length,0),passives:new Set(r.allocated_nodes||[]).size},warning:data.warning};
 if(GROWTH_STATS.every(key=>record.values[key]===null))fail('GROWTH_NOT_READY');
 return checked(record,saved.preset);
}
export function appendGrowth(records,record){
 if(records.length>=GROWTH_LIMIT)fail('GROWTH_CAPACITY');
 const content=({level,values,conditions,counts,warning})=>canonical({level,values,conditions,counts,warning});
 if(records[0]&&content(records[0])===content(record))fail('GROWTH_DUPLICATE');
 const next=[record,...records];return parseGrowth(JSON.stringify({version:1,records:next}),record.preset);
}
export function growthDifference(latest,previous){
 if(!previous)return {differences:[],deltas:null};
 const differences=Object.keys(latest.conditions).filter(key=>latest.conditions[key]!==previous.conditions[key]);
 if(latest.warning!==previous.warning)differences.push('coverage');
 return {differences,deltas:Object.fromEntries(GROWTH_STATS.map(key=>[key,!differences.length&&latest.values[key]!==null&&previous.values[key]!==null?latest.values[key]-previous.values[key]:null]))};
}
export function saveGrowth(storage,preset,expected,records){
 const key=growthKey(preset),raw=JSON.stringify({version:1,records});parseGrowth(raw,preset);
 if(storage.getItem(key)!==expected)fail('GROWTH_STALE');
 storage.setItem(key,raw);return raw;
}
