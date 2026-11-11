// Generate deterministic, engine-checked examples from explicit inputs, never arbitrary character exports.
import {readFile,writeFile} from 'node:fs/promises';
import {Worker} from 'node:worker_threads';
import {resolve} from 'node:path';
import {newPlan,makeSave,buildRareItem,applyTreeAllocation,statValue,weaponSetState,parseSave} from '../assets/simulator-model.js';
const root=resolve(import.meta.dirname,'..'),read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const [presets,equipment,records]=await Promise.all(['data/simulator-presets.json','data/simulator-equipment.json','data/simulator-records.json'].map(read));
const worker=new Worker(new URL('../scripts/fixtures/simulator-worker-node.mjs',import.meta.url)),pending=new Map();let sequence=0;
worker.on('message',m=>{if(m.progress)return;const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve(m.result);});
worker.on('error',e=>{for(const p of pending.values())p.reject(e);pending.clear();});
const rpc=(action,payload)=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});worker.postMessage({id,action,payload});});
const cleanSave=(preset,request,weaponSets=null)=>{const saved=makeSave(preset,request,0,'',{},weaponSets);delete saved.savedAt;parseSave(JSON.stringify(saved));return saved;};
const examples=[];
try{
 const catalog=await rpc('boot');
 for(const [presetId,weaponClass] of [['mercenary-twister-gemling','Spear'],['ranger-ice-shot-deadeye','Bow'],['sorceress-spark-stormweaver','Wand']]){
  const preset=presets.find(p=>p.id===presetId);let request=newPlan(preset,catalog.gems);
  request.enemy_tier='none';
  request.socket_groups=request.socket_groups.slice(0,1);request.socket_groups[0].gems[0].level=10;
  const base=type=>equipment.bases.filter(b=>b.itemClass===type).sort((a,b)=>Math.max(0,...Object.values(a.requirements))-Math.max(0,...Object.values(b.requirements))||a.name.localeCompare(b.name,'en'))[0];
  const add=(slot,type,mods)=>{const b=base(type);request.items.push({slot,text:buildRareItem({baseId:b.id,name:'操作見本の'+b.label,level:80,quality:0,modifiers:mods.map(([id,...values])=>({id,values}))},slot,equipment)});};
  add('weapon1',weaponClass,weaponClass==='Wand'?[['spell_pct',50],['cast_speed',15]]:[['physical_pct',100],['physical_flat',10,20],['attack_speed',15]]);
  add('helmet','Helmet',[['life',100],['fire_res',30]]);add('body','Body Armour',[['life',100],['cold_res',30]]);
  add('boots','Boots',[['life',80],['move_speed',25],['lightning_res',30]]);add('ring1','Ring',[['life',60],['all_res',30]]);add('amulet','Amulet',[['attributes',60]]);
  const empty=await rpc('calculate',request),start=empty.tree_effects.class_starts[preset.class.toLowerCase()];
  const byId=new Map(catalog.tree.map(n=>[n.skill,n]));
  for(let i=0;i<3;i++){
   const owned=new Set([start,...request.allocated_nodes]);
   const candidates=[...new Set([...owned].flatMap(id=>byId.get(id)?.connections||[]))].map(id=>byId.get(id)).filter(n=>n&&!owned.has(n.skill)&&n.kind==='normal'&&!n.ascendancy_id&&n.stats.length).sort((a,b)=>a.skill-b.skill);
   let changed=false;
   for(const node of candidates){const next=await rpc('edit',{request,node:node.skill,mode:0,action:'allocate',quest_points:0});if(next.valid){request=applyTreeAllocation(request,next.result.allocation);changed=true;break;}}
   if(!changed)throw Error('Sample needs connected passives: '+presetId);
  }
  const result=await rpc('calculate',request);
  if(result.item_errors?.length||!(statValue(result,'CombinedDPS')>0)||!(statValue(result,'Life')>1000))throw Error('Sample failed engine checks: '+presetId);
  examples.push({id:'sample-'+presetId,preset:presetId,title:preset.name+'：操作サンプル',kind:'sample',level:80,source:{href:preset.path,label:preset.name+'の育成ガイド'},description:'Lv80・主力ジェムLv10・装備6点・通常パッシブ3点から試せます。数値比較用の仮装備を含む操作見本です。',omissions:['ゲーム内の取得性・最適な構成を実証したサンプルではありません。手持ちの装備とスキル条件へ調整してください。'],saved:cleanSave(presetId,request),verification:{engine:catalog.runtime.release,data:catalog.runtime.dataVersion,checkedAt:records.checkedAt,life:statValue(result,'Life'),dps:statValue(result,'CombinedDPS'),allocated:request.allocated_nodes.length}});
 }
 for(const record of records.records){
  const preset=presets.find(p=>p.id===record.preset),request=newPlan(preset,catalog.gems);request.character.level=record.level||80;request.socket_groups=[];
  request.enemy_tier='none';
  const raw=item=>['Rarity: '+(['血タロン','忘却の留め金'].includes(item.name)?'RARE':'UNIQUE'),item.name,item.base,`Quality: ${item.quality}`,...(Object.keys(item.requirements).length?['Requires: '+Object.entries(item.requirements).map(([k,v])=>k==='level'?`Level ${v}`:`${v} ${{str:'Str',dex:'Dex',int:'Int'}[k]}`).join(', ')]:[]),'Implicits: 0',...item.modifiers].join('\n');
  const spears=record.items.filter(i=>i.slot==='weapon1'),offhand=record.items.find(i=>i.slot==='weapon2');
  const ordinary=record.items.filter(i=>!i.slot.startsWith('weapon')).map(i=>({slot:i.slot,text:raw(i)}));
  const sets=spears.map(i=>({items:[{slot:'weapon1',text:raw(i)},...(offhand?[{slot:'weapon2',text:raw(offhand)}]:[])],drafts:{}}));
  if(sets.length!==2)throw Error('Record weapon set data missing');
  request.items=[...ordinary,...sets[0].items];
  const weaponSets=weaponSetState(request,{}, {active:1,sets});
  const result=await rpc('calculate',request);if(result.item_errors?.length)throw Error('Unreadable recorded equipment: '+record.id+' '+JSON.stringify(result.item_errors));
  examples.push({id:record.id,preset:record.preset,title:record.title,kind:'record',level:record.level,source:{href:`/guides/${record.guide}/`,label:record.title,checkedAt:record.sourceCheckedAt},description:'記事で確認できた装備の効果とLvを試算へ取り込みます。未確認の設定は空欄です。',omissions:record.omissions,itemCount:record.items.length,sourceItems:record.items.map(i=>({name:i.name,slot:i.slot,sourceText:i.sourceText})),saved:cleanSave(record.preset,request,weaponSets),verification:{engine:catalog.runtime.release,data:catalog.runtime.dataVersion,checkedAt:records.checkedAt,parsedItems:record.items.length}});
 }
 const comparisons=[];
 const sample=examples.find(e=>e.id==='sample-mercenary-twister-gemling');
 for(const spec of [{id:'ring-life-resistance',slot:'ring1',type:'Ring',name:'比較用のライフ指輪',mods:[['life',120],['fire_res',60]],cost:40,budget:50},{id:'boots-life-resistance',slot:'boots',type:'Boots',name:'比較用の耐性靴',mods:[['life',40],['move_speed',25],['all_res',40]],cost:20,budget:30}]){
  const a=structuredClone(sample.saved),b=structuredClone(sample.saved),base=equipment.bases.filter(x=>x.itemClass===spec.type).sort((x,y)=>Math.max(0,...Object.values(x.requirements))-Math.max(0,...Object.values(y.requirements))||x.name.localeCompare(y.name,'en'))[0];
  const text=buildRareItem({baseId:base.id,name:spec.name,level:80,quality:0,modifiers:spec.mods.map(([id,...values])=>({id,values}))},spec.slot,equipment);
  b.request.items=b.request.items.map(item=>item.slot===spec.slot?{slot:spec.slot,text}:item);b.weaponSets=weaponSetState(b.request,{},b.weaponSets);
  const ar=await rpc('calculate',a.request),br=await rpc('calculate',b.request);
  if([ar,br].some(r=>r.item_errors?.length||r.unsupported_modifiers?.length))throw Error('Comparison example has unparsed inputs: '+spec.id);
  const stats=['CombinedDPS','Life','Armour','Evasion','FireResist','ColdResist','LightningResist','ChaosResist'].map(id=>({id,a:statValue(ar,id),b:statValue(br,id)}));
  comparisons.push({id:spec.id,version:1,enemy:'none',a,b,prices:{version:1,budget:{amount:spec.budget,currency:'exalted'},entries:[{id:'a',amount:0,currency:'exalted'},{id:'b',amount:spec.cost,currency:'exalted'}]},verification:{engine:catalog.runtime.release,data:catalog.runtime.dataVersion,stats}});
 }
 await writeFile(resolve(root,'data/simulator-examples.json'),JSON.stringify({version:1,examples,comparisons},null,2)+'\n');
 console.log(`Examples: ${examples.filter(e=>e.kind==='sample').length} calculated samples, ${examples.filter(e=>e.kind==='record').length} sourced equipment records`);
}finally{await worker.terminate();}
