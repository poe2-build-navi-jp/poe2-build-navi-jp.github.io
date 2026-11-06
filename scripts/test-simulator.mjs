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

 const locale=JSON.parse(await readFile(resolve(root,'data/simulator-localization.json'),'utf8'));
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
