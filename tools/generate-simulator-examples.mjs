// Generate deterministic, engine-checked examples from explicit inputs, never arbitrary character exports.
import {readFile,writeFile} from 'node:fs/promises';
import {Worker} from 'node:worker_threads';
import {resolve} from 'node:path';
import {newPlan,makeSave,buildRareItem,applyTreeAllocation,statValue,weaponSetState,parseSave} from '../assets/simulator-model.js';
const root=resolve(import.meta.dirname,'..'),read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const [presets,equipment,records,routes]=await Promise.all(['data/simulator-presets.json','data/simulator-equipment.json','data/simulator-records.json','data/simulator-routes.json'].map(read));
const worker=new Worker(new URL('../scripts/fixtures/simulator-worker-node.mjs',import.meta.url)),pending=new Map();let sequence=0;
worker.on('message',m=>{if(m.progress)return;const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve(m.result);});
worker.on('error',e=>{for(const p of pending.values())p.reject(e);pending.clear();});
const rpc=(action,payload)=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});worker.postMessage({id,action,payload});});
const cleanSave=(preset,request,weaponSets=null,questPoints=0)=>{const saved=makeSave(preset,request,questPoints,'',{},weaponSets);delete saved.savedAt;parseSave(JSON.stringify(saved));return saved;};
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
 // Input-complete reference configurations are separate from the six-slot operation samples.
 // Only the passive route is sourced from a character; equipment/gems are explicit calculation inputs.
 const byId=new Map(catalog.tree.map(n=>[n.skill,n]));
 const adjacency=new Map(catalog.tree.map(n=>[n.skill,new Set(n.connections||[])]));
 for(const node of catalog.tree)for(const next of node.connections||[])adjacency.get(next)?.add(node.skill);
 for(const [presetId,weaponClass,offhandClass,supportNames] of [
  ['mercenary-twister-gemling','Spear',null,['Elemental Armament I','Retreat I','Projectile Acceleration I']],
  ['ranger-ice-shot-deadeye','Bow','Quiver',['Elemental Armament I','Rapid Attacks I','Projectile Acceleration I']]
 ]){
  const preset=presets.find(p=>p.id===presetId),route=routes.templates[presetId],source=route.steps[0];
  const request=newPlan(preset,catalog.gems);request.character.level=route.source.level;request.enemy_tier='none';
  request.socket_groups=request.socket_groups.slice(0,1);request.socket_groups[0].gems[0].level=20;
  const main=catalog.gems.find(g=>g.skill_id===request.socket_groups[0].gems[0].skill_id);
  for(const name of supportNames){const gem=catalog.gems.find(g=>g.name===name&&g.is_support);if(!gem||!gem.tags.some(tag=>main.tags.includes(tag)))throw Error('Support tag mismatch: '+name);request.socket_groups[0].gems.push({skill_id:gem.skill_id,level:1,quality:0});}
  request.allocated_nodes=[...source.nodes];request.attribute_choices=Object.fromEntries(Object.entries(route.attributeChoices||{}).filter(([id])=>source.nodes.includes(+id)));
  let normal=source.nodes.filter(id=>!byId.get(id)?.ascendancy_id);
  const removedForBudget=[];
  while(normal.length>request.character.level-1+24){
   const owned=new Set([route.root,...normal]);
   const leaf=normal.filter(id=>[...(adjacency.get(id)||[])].filter(next=>owned.has(next)).length<=1)
    .sort((a,b)=>Number(byId.get(a)?.kind!=='normal')-Number(byId.get(b)?.kind!=='normal')||b-a)[0];
   if(leaf===undefined)throw Error('Cannot normalize passive budget: '+presetId);
   removedForBudget.push(leaf);normal=normal.filter(id=>id!==leaf);
  }
  request.allocated_nodes=request.allocated_nodes.filter(id=>!removedForBudget.includes(id));
  request.attribute_choices=Object.fromEntries(Object.entries(request.attribute_choices).filter(([id])=>!removedForBudget.includes(+id)));
  const questPoints=Math.max(0,normal.length-(request.character.level-1));
  const root=(await rpc('calculate',request)).tree_effects.class_starts[preset.class.toLowerCase()];
  const allowed=new Set([root,...normal]),reachable=new Set([root]),queue=[root];
  for(const id of queue)for(const next of adjacency.get(id)||[])if(allowed.has(next)&&!reachable.has(next)){reachable.add(next);queue.push(next);}
  if(normal.some(id=>!reachable.has(id)))throw Error('Complete example has disconnected passives: '+presetId);
  const base=type=>equipment.bases.filter(b=>b.itemClass===type&&(b.requirements.level||0)<=80&&Object.values(b.requirements).every(v=>v<=90))
   .sort((a,b)=>(b.requirements.level||0)-(a.requirements.level||0)||a.name.localeCompare(b.name,'en'))[0];
  const requirements=[];
  const add=(slot,type,mods)=>{const b=base(type);if(!b)throw Error('Missing base: '+type);requirements.push({slot,requirements:b.requirements});
   request.items.push({slot,text:buildRareItem({baseId:b.id,name:'参考構成の'+b.label,level:80,quality:0,modifiers:mods.map(([id,...values])=>({id,values}))},slot,equipment)});};
  add('weapon1',weaponClass,weaponClass==='Wand'?[['spell_pct',80],['cast_speed',15]]:[['physical_pct',100],['physical_flat',10,20],['attack_speed',15]]);
  if(offhandClass)add('weapon2',offhandClass,offhandClass==='Focus'?[['es',50],['mana',80],['fire_res',30]]:[['physical_flat',10,20],['accuracy',200],['dex',30]]);
  add('helmet','Helmet',[['life',100],['fire_res',40],['cold_res',30]]);
  add('body','Body Armour',[['life',120],['cold_res',40],['lightning_res',30]]);
  add('gloves','Gloves',[['life',80],['fire_res',30],['dex',25]]);
  add('boots','Boots',[['life',80],['move_speed',25],['lightning_res',40]]);
  add('ring1','Ring',[['life',70],['fire_res',30],['cold_res',30]]);
  add('ring2','Ring',[['life',70],['lightning_res',30],['chaos_res',20]]);
  add('amulet','Amulet',[['life',80],['str',25],['dex',25],['int',25]]);
  add('belt','Belt',[['life',80],['str',25],['chaos_res',20]]);
  const result=await rpc('calculate',request),gaps=await rpc('equipment-audit',{request,items:requirements});
  if(result.item_errors?.length||gaps.length||!(statValue(result,'CombinedDPS')>0)||result.tree_effects.warnings.length)throw Error('Complete example failed checks: '+presetId+' '+JSON.stringify({gaps,errors:result.item_errors,warnings:result.tree_effects.warnings}));
  examples.push({id:'complete-'+presetId,preset:presetId,title:preset.name+'：参考完成構成',kind:'sample',level:request.character.level,
   source:{href:route.source.url,label:'poe.ninjaのパッシブ取得元（装備・ジェムは別の計算例）',checkedAt:route.source.verifiedAt.slice(0,10)},
   description:'主力ジェム・サポート・接続済みパッシブと、使用する全装備部位を入力した0.5.5の計算例です。公開キャラクターの装備を再現したものではありません。',
   omissions:['装備は明示した数値の仮レア装備です。ゲーム内の取得性・相場・最適性・ボス撃破を実証した完成ビルドではありません。',
    'パッシブ経路だけを公開キャラクターから参照し、通常ポイント上限に合わせて末端を調整しています。原典のユニーク装備・ジュエル・補助スキルは再現していません。',
    '付与スキルなど一部のパッシブ効果は計算未対応です。取り込み後の「計算の確認事項」で確認してください。',
    '正式版1.0の構成ではありません。メインスキルの参考計算であり、実戦の総ダメージ・耐久・強さを保証しません。',
    ...(offhandClass?[]:['槍の見本はオフハンドを空けています。未入力の装備エラーではありません。'])],
   saved:cleanSave(presetId,request,null,questPoints),verification:{inputComplete:true,gameplayVerified:false,engine:catalog.runtime.release,data:catalog.runtime.dataVersion,
    checkedAt:'2026-11-16',life:statValue(result,'Life'),dps:statValue(result,'CombinedDPS'),allocated:request.allocated_nodes.length,normalPoints:normal.length,questPoints,removedForBudget,
    parsedItems:request.items.length,requirementGaps:0,connected:true,unsupportedCount:result.unsupported_modifiers.length,sourceCharacter:route.source.character,sourceCheckedAt:route.source.verifiedAt.slice(0,10)}});
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
