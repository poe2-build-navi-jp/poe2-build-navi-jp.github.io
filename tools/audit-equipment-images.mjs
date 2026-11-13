import {Worker} from 'node:worker_threads';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {equipmentImages} from '../assets/equipment-image-data.js';
import {createEquipmentMatcher} from '../assets/equipment-image-matcher.js';
const root=resolve(import.meta.dirname,'..'),matcher=createEquipmentMatcher(equipmentImages);
const worker=new Worker(new URL('../scripts/fixtures/simulator-worker-node.mjs',import.meta.url),{execArgv:[]});
try{
 const engine=await new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',message=>{if(message.id===1)message.error?reject(Error(message.error)):resolve(message.result);});worker.postMessage({id:1,action:'boot'});});
 const bases=JSON.parse(await readFile(resolve(root,'data/simulator-equipment.json'),'utf8')).bases;
 const rows=[...engine.uniques.map(item=>({kind:'unique',engineId:item.id,name:item.name,base:item.bases[0]?.name||''})),...bases.map(item=>({kind:'base',engineId:item.id,name:item.name,base:item.name}))].map(item=>{const image=matcher.lookup(item.name,item.base);return {...item,imageId:image?.id||null,image:image?.src||null};});
 const missing=rows.filter(row=>!row.image);if(missing.length)throw Error('Unidentified equipment images: '+missing.map(row=>row.name).join(', '));
 const entities=JSON.parse(await readFile(resolve(root,'data/core-entities.json'),'utf8'));
 const authored=entities.filter(item=>item.kind==='equipment').map(item=>({name:item.englishName,imageId:matcher.lookup(item.englishName)?.id||null}));
 if(authored.some(item=>!item.imageId))throw Error('An equipment article has no identified image');
 const catalog=await readFile(resolve(root,'data/equipment-images.json'));
 const report={checkedAt:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}),engine:engine.runtime,catalogSha256:createHash('sha256').update(catalog).digest('hex'),uniques:engine.uniques.length,editableBases:bases.length,withImages:rows.length,unidentified:0,authored,records:rows};
 await mkdir(resolve(root,'docs/audits'),{recursive:true});await writeFile(resolve(root,'docs/audits/equipment-image-coverage.json'),JSON.stringify(report,null,2)+'\n');
 console.log(`Equipment image coverage: ${engine.uniques.length}/${engine.uniques.length} engine uniques and ${bases.length}/${bases.length} editable bases.`);
}finally{await worker.terminate();}
