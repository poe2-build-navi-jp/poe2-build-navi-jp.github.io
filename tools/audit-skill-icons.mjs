// Check the exact calculation engine catalog, not an estimated list of visible names.
import {Worker} from 'node:worker_threads';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {skillIcons} from '../assets/skill-icon-data.js';
import {createSkillMatcher} from '../assets/skill-icon-matcher.js';
const root=resolve(import.meta.dirname,'..');
const worker=new Worker(new URL('../scripts/fixtures/simulator-worker-node.mjs',import.meta.url),{execArgv:[]});
try {
 const catalog=await new Promise((resolve,reject)=>{
  worker.on('error',reject);worker.on('message',message=>{if(message.id===1)message.error?reject(Error(message.error)):resolve(message.result);});
  worker.postMessage({id:1,action:'boot'});
 });
 const matcher=createSkillMatcher(skillIcons);
 const records=catalog.gems.map(gem=>{
  const image=matcher.lookup(gem.name);
  return {skillId:gem.skill_id,name:gem.name,selectable:!gem.ui_hidden,imageId:image?.id||null,image:image?.src||null};
 });
 const missing=records.filter(record=>!record.image);
 if(missing.length)throw Error(`Unidentified skill images (${missing.length}): ${missing.map(record=>record.name).join(', ')}`);
 const internal=records.filter(record=>!record.selectable);
 for(const record of internal)if(matcher.lookup(record.name)?.availability!=='internal')throw Error(`Unclassified internal entry: ${record.name}`);
 const entities=JSON.parse(await readFile(resolve(root,'data/core-entities.json'),'utf8'));
 const overrides=JSON.parse(await readFile(resolve(root,'data/skill-icon-overrides.json'),'utf8'));
 const authoredNames=[...new Set([...entities.filter(entity=>entity.kind==='skill').flatMap(entity=>[entity.name,entity.englishName]),...overrides.filter(entry=>entry.imageRole==='granting-minion').flatMap(entry=>entry.names)])];
 const authored=authoredNames.map(name=>({name,imageId:matcher.lookup(name)?.id||null}));
 for(const record of authored)if(!record.imageId)throw Error(`Unidentified authored skill: ${record.name}`);
 const source=await readFile(resolve(root,'data/skill-icons.json'));
 const audit={checkedAt:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}),engine:catalog.runtime,
  catalogSha256:createHash('sha256').update(source).digest('hex'),totalEngineEntries:records.length,
  selectable:records.length-internal.length,selectableWithImages:records.filter(record=>record.selectable&&record.image).length,
  internalEntries:internal.length,unidentified:0,selectableCoverage:1,authoredReferences:authored,records};
 await mkdir(resolve(root,'docs/audits'),{recursive:true});
 await writeFile(resolve(root,'docs/audits/skill-image-coverage.json'),JSON.stringify(audit,null,2)+'\n');
 console.log(`Skill image coverage: ${audit.selectableWithImages}/${audit.selectable} selectable skills (100%); ${records.length}/${records.length} total engine records; ${internal.length} internal placeholders retained for existing saves.`);
} finally {await worker.terminate();}
