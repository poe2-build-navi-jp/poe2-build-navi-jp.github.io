import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {gunzipSync} from 'node:zlib';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {JSDOM} from 'jsdom';
import * as model from '../assets/simulator-model.js';
const root=resolve(import.meta.dirname,'..');
const worker=new Worker(new URL('./fixtures/simulator-worker-node.mjs',import.meta.url));
let id=0;const tasks=new Map();
worker.on('message',message=>{if(message.progress)return;const task=tasks.get(message.id);if(!task)return;tasks.delete(message.id);message.error?task.reject(Error(message.error)):task.resolve(message.result);});
worker.on('error',error=>{for(const task of tasks.values())task.reject(error);});
const rpc=(action,payload)=>new Promise((resolve,reject)=>{const key=++id;tasks.set(key,{resolve,reject});worker.postMessage({id:key,action,payload});});
try{
 const catalog=await rpc('boot');
 assert.equal(catalog.runtime.release,'0.0.46');assert.equal(catalog.runtime.dataVersion,'0.5.5.5');
 const edges=model.treeEdges(catalog.tree),validNodes=new Set(catalog.tree.map(n=>n.skill));
 const expected=new Set(catalog.tree.flatMap(n=>n.connections.filter(id=>validNodes.has(id)).map(id=>[n.skill,id].sort((a,b)=>a-b).join(':'))));
 assert.equal(edges.length,expected.size,'every directed source connection must be rendered once');
 const presets=JSON.parse(await readFile(resolve(root,'data/simulator-presets.json'),'utf8'));
 assert.equal(presets.length,12);
 for(const preset of presets){const request=model.newPlan(preset,catalog.gems);assert.ok(request.socket_groups.length,`${preset.id}: primary skill resolved`);const result=await rpc('calculate',request);assert.ok(model.statValue(result,'Life')>0,preset.id);assert.equal(request.character.ascendancy_name,preset.ascendancy);}
 const request=model.newPlan(presets.find(p=>p.id==='mercenary-twister-gemling'),catalog.gems);
 const baseline=await rpc('calculate',request);
 const equipment=JSON.parse(await readFile(resolve(root,'data/simulator-equipment.json'),'utf8'));
 const rare={baseId:equipment.bases.find(b=>b.name==='Covert Hood').id,name:'比較用のレア兜',level:80,quality:20,modifiers:[{id:'life',values:[100]},{id:'fire_res',values:[30]},{id:'str',values:[20]}]};
 const rareText=model.buildRareItem(rare,'helmet',equipment),rareResult=await rpc('calculate',{...request,items:[{slot:'helmet',text:rareText}]});
 assert.equal(rareResult.item_errors.length,0);assert.equal(rareResult.unsupported_modifiers.length,0);
 assert.equal(model.statValue(rareResult,'Life')-model.statValue(baseline,'Life'),140,'100 life plus 40 life from 20 Strength');
 assert.equal(model.statValue(rareResult,'FireResist')-model.statValue(baseline,'FireResist'),30);
 assert.equal(model.statValue(rareResult,'Str')-model.statValue(baseline,'Str'),20);
 assert.ok(model.statValue(rareResult,'Evasion')>model.statValue(baseline,'Evasion'),'base item defences must calculate');
 for(const mod of equipment.modifiers){const text=model.buildRareItem({...rare,modifiers:[{id:mod.id,values:mod.default}]},'helmet',equipment);const checked=await rpc('calculate',{...request,items:[{slot:'helmet',text}]});assert.equal(checked.item_errors.length,0,mod.id);assert.equal(checked.unsupported_modifiers.length,0,mod.id);}
 assert.throws(()=>model.buildRareItem({...rare,modifiers:[{id:'physical_flat',values:[20,10]}]},'helmet',equipment));
 assert.throws(()=>model.buildRareItem(rare,'ring1',equipment));
 const withDraft=model.makeSave('mercenary-twister-gemling',{...request,items:[{slot:'helmet',text:rareText}]},0,'',{helmet:rare});assert.deepEqual(model.parseSave(JSON.stringify(withDraft)).equipmentDrafts.helmet,rare);

 const ordinary=await rpc('calculate',{...request,allocated_nodes:[59779]});assert.equal(model.statValue(ordinary,'Armour')-model.statValue(baseline,'Armour'),10);assert.equal(model.statValue(ordinary,'Evasion')-model.statValue(baseline,'Evasion'),8);
 const attribute=catalog.tree.find(n=>n.name==='Attribute');
 const dexterity=await rpc('calculate',{...request,allocated_nodes:[attribute.skill],attribute_choices:{[attribute.skill]:'dex'}});assert.equal(model.statValue(dexterity,'Dex')-model.statValue(baseline,'Dex'),5);
 const inoculation=catalog.tree.find(n=>n.name==='Chaos Inoculation');const ci=await rpc('calculate',{...request,allocated_nodes:[inoculation.skill]});assert.equal(model.statValue(ci,'Life'),1,'keystone mechanics must affect real calculations');
 const asc=await rpc('calculate',{...request,allocated_nodes:[1442]});assert.ok(model.statValue(asc,'Str')>=model.statValue(baseline,'Str'),'ascendancy effect is accepted by the same engine');
 for(const def of equipment.modifiers){const en=def.template.replace(/\{(\d+)\}/g,(_,i)=>String(def.default[+i]));const ja=model.localizeModifiers([en],equipment,{});assert.ok(ja.includes(def.label));assert.deepEqual(model.parseJapaneseModifiers(ja,equipment,{}),[en]);}
 assert.deepEqual(model.parseJapaneseModifiers('最大ライフ ＋１００\n火耐性 +30％\n追加物理ダメージ 10〜20',equipment,{}),['+100 to maximum Life','+30% to Fire Resistance','Adds 10 to 20 Physical Damage']);
 assert.throws(()=>model.parseJapaneseModifiers('追加物理ダメージ 20〜10',equipment,{}));assert.throws(()=>model.parseJapaneseModifiers('不明な効果 +100',equipment,{}));
 assert.deepEqual(model.passiveComparison([1,2],[2,3]),{shared:[2],referenceOnly:[3],ownOnly:[1]});
 const routes=JSON.parse(await readFile(resolve(root,'data/simulator-routes.json'),'utf8'));
 assert.equal(Object.keys(routes.templates).length,12);
 for(const preset of presets){const template=routes.templates[preset.id],plan=model.newPlan(preset,catalog.gems);assert.equal(template.steps.length,5);const roots=(await rpc('calculate',plan)).tree_effects.class_starts;assert.equal(template.root,roots[plan.character.class_name.toLowerCase()]);
  let previous=new Set();for(const stage of template.steps){assert.ok(stage.nodes.length<=79);assert.ok(previous.size<=stage.nodes.length);for(const id of previous)assert.ok(stage.nodes.includes(id));previous=new Set(stage.nodes);
   const connected=new Set([template.root]);let grew=true;while(grew){grew=false;for(const edge of edges)if((connected.has(edge.from)&&previous.has(edge.to))||(connected.has(edge.to)&&previous.has(edge.from))){const size=connected.size;connected.add(edge.from);connected.add(edge.to);if(connected.size>size)grew=true;}}
   for(const id of stage.nodes){assert.ok(connected.has(id),`${preset.id}: disconnected ${id}`);const node=catalog.tree.find(n=>n.skill===id);assert.ok(node&&!node.ascendancy_id&&!['keystone','mastery'].includes(node.kind));}
  }
  const allocated={...plan,allocated_nodes:template.steps.at(-1).nodes};const checked=await rpc('edit',{request:allocated,node:template.steps.at(-1).target,mode:0,action:'refund',quest_points:0});assert.ok(checked.valid,preset.id);assert.ok(checked.result.points_used<=79);
 }
 const locale=JSON.parse(await readFile(resolve(root,'data/simulator-localization.json'),'utf8'));
 for(const node of catalog.tree){const descriptions=model.passiveDescriptions(node,locale);assert.ok(descriptions.length>0,String(node.skill));assert.ok(descriptions.every(x=>typeof x==='string'&&x.length));}
 assert.match(model.passiveDescriptions(attribute,locale,{[attribute.skill]:'int'})[0],/知性.*5/);
 const swapped={...request,weapon_swap:{active:2,exclusive_nodes:[[],[]]}};assert.deepEqual(model.applyTreeAllocation(swapped,{shared:[1],exclusive:[[2],[3]]}).allocated_nodes,[1,3]);assert.deepEqual(swapped.weapon_swap.exclusive_nodes,[[],[]]);
 for(const entry of [...catalog.gems,...catalog.uniques,...catalog.minions.monsters.filter(m=>!m.name.startsWith('[DNT]'))])assert.match(locale.names[entry.name] || '',/[ぁ-んァ-ヶ一-龥]/,entry.name);
 for(const node of catalog.tree){assert.match(locale.names[node.name] || '',/[ぁ-んァ-ヶ一-龥]/,node.name);assert.ok(Array.isArray(locale.descriptions[locale.nodes[node.skill]]),String(node.skill));}
 const runtimeRoot=resolve(root,'assets/simulator-engine/v0.0.46'),manifest=JSON.parse(await readFile(resolve(runtimeRoot,'runtime.json'),'utf8'));
 const packed=await Promise.all(manifest.data.parts.map(p=>readFile(resolve(runtimeRoot,p.file))));
 const sourceData=JSON.parse(gunzipSync(Buffer.concat(packed)).toString());
 for(const unique of JSON.parse(sourceData.files['overlay/uniques.json']).uniques){const displayed=model.localizeItemText(unique.raw,locale.names);assert.equal(model.restoreItemText(displayed,locale.names,unique.raw),unique.raw,unique.name);}
 const editedText=model.restoreItemText('+20 to maximum Life',locale.names,'+10 to maximum Life');assert.equal(editedText,'+20 to maximum Life');
 const translated=model.localizeItemText('Rarity: UNIQUE\nAstramentis\nStellar Amulet',locale.names);assert.ok(translated.includes('アストラメンティス'));assert.ok(!translated.includes('Astramentis'));

 const modified=await rpc('calculate',{...request,extra_modifiers:['+100 to maximum Life']});
 assert.equal(model.statValue(modified,'Life')-model.statValue(baseline,'Life'),100);
 const badItem=await rpc('calculate',{...request,items:[{slot:'helmet',text:'not an item'}]});assert.ok(badItem.item_errors.length);
 const unsupported=await rpc('calculate',{...request,extra_modifiers:['UNSUPPORTED_SIMULATOR_TEST_123']});assert.ok(unsupported.unsupported_modifiers.length);
 const rootNode=baseline.tree_effects.class_starts.mercenary;
 const nextNode=catalog.tree.find(n=>n.connections.includes(rootNode));
 const edit=await rpc('edit',{request,node:nextNode.skill,mode:0,action:'allocate',quest_points:0});assert.equal(edit.valid,true);assert.equal(edit.result.points_used,1);
 const edited={...request,allocated_nodes:edit.result.allocation.shared};
 const refund=await rpc('edit',{request:edited,node:nextNode.skill,mode:0,action:'refund',quest_points:0});assert.equal(refund.valid,true);assert.equal(refund.result.points_used,0);
 const noPoints=await rpc('edit',{request:{...request,character:{...request.character,level:1}},node:nextNode.skill,mode:0,action:'allocate',quest_points:0});assert.equal(noPoints.valid,false);
 const astro=catalog.uniques.find(u=>u.name==='Astramentis');
 const low=await rpc('unique',{id:astro.id,roll:0}),high=await rpc('unique',{id:astro.id,roll:1});assert.notEqual(low.text,high.text);
 const equipped=await rpc('calculate',{...request,items:[{slot:'amulet',text:high.text}]});assert.equal(equipped.item_errors.length,0);assert.ok(model.statValue(equipped,'Str')>model.statValue(baseline,'Str'));
 const spell=model.newPlan(presets.find(p=>p.id==='sorceress-spark-stormweaver'),catalog.gems),spellLow=await rpc('calculate',spell);spell.socket_groups[0].gems[0].level=10;const spellHigh=await rpc('calculate',spell);assert.ok(model.statValue(spellHigh,'CombinedDPS')>model.statValue(spellLow,'CombinedDPS'),'gem level changes calculated spell damage');
 await assert.rejects(rpc('import','external-code'),/不明な操作/);
 await assert.rejects(rpc('export',{}),/不明な操作/);
 const save=model.makeSave('mercenary-twister-gemling',edited,0,'メモ');assert.deepEqual(model.parseSave(JSON.stringify(save)),save);assert.throws(()=>model.parseSave('{}'));
 console.log('PASS: real WASM/data integrity; 12 presets; exact Life delta; item and unsupported-effect diagnostics; connected allocation/refund/budget; unique rolls; external-code actions rejected; saved plan validation');
}finally{await worker.terminate();}
