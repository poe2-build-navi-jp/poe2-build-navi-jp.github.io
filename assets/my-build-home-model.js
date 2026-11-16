import {parseSave, parseNamedPlans, namedPlanKey, ENGINE_VERSION} from './simulator-model.js?v=161ef63cbd';
import {parseGoal, compareGoal, goalKey} from './simulator-goal-model.js?v=9fc88e5370';

export const HOME_KEY='poe2:my-build-home:v1';
export const SEEN_KEY='poe2-simulator:updates-seen:v1';
const autoKey=preset=>'poe2-simulator:v1:'+preset;
export const recordKey=record=>record.preset+':'+record.kind+':'+(record.id||'');
const knownSlot=new Set(['weapon1','weapon2','helmet','body','gloves','boots','belt','amulet','ring1','ring2']);
const date=value=>Number.isFinite(Date.parse(value))?Date.parse(value):0;

// Read every source separately: a damaged save cannot hide other valid builds.
// Nothing here migrates, rewrites or removes an existing save.
export function readHomeRecords(storage,presets){
 const records=[],problems=[];
 for(const preset of presets){
  const accept=(saved,kind,id='',name='')=>{
   if(saved.preset!==preset.id||saved.request.character.class_name!==preset.class)throw Error('HOME_PRESET');
   records.push({preset:preset.id,kind,id,name,saved,meta:preset,key:recordKey({preset:preset.id,kind,id}),
    at:date(saved.savedAt),equipment:new Set((saved.request.items||[]).filter(item=>knownSlot.has(item?.slot)&&typeof item.text==='string'&&item.text.trim()).map(item=>item.slot)).size});
  };
  try{const raw=storage.getItem(autoKey(preset.id));if(raw)accept(parseSave(raw),'auto');}catch{problems.push(autoKey(preset.id));}
  try{
   const raw=storage.getItem(namedPlanKey(preset.id));if(!raw)continue;
   if(raw.length>6000000)throw Error('HOME_CAPACITY');
   const book=JSON.parse(raw);if(book.version!==1||!Array.isArray(book.plans)||book.plans.length>12)throw Error('HOME_FORMAT');
   const ids=new Set();
   for(const entry of book.plans){try{
    const [checked]=parseNamedPlans(JSON.stringify({version:1,plans:[entry]}),preset.id);
    if(ids.has(checked.id))throw Error('HOME_DUPLICATE');ids.add(checked.id);accept(checked.saved,'named',checked.id,checked.name);
   }catch{problems.push(namedPlanKey(preset.id));}}
  }catch{problems.push(namedPlanKey(preset.id));}
 }
 records.sort((a,b)=>b.at-a.at||(a.kind==='auto'?-1:1)-(b.kind==='auto'?-1:1)||a.key.localeCompare(b.key));
 return {records,problems:[...new Set(problems)]};
}

export function selectHomeRecord(records,raw){
 let selected;
 try{const value=JSON.parse(raw);if(value?.version===1&&typeof value.key==='string')selected=records.find(record=>record.key===value.key);}catch{}
 return selected||records[0]||null;
}

export function resumeHref(record,en=false,view=''){
 const query=new URLSearchParams({build:record.preset});
 if(record.kind==='named')query.set('saved',record.id);
 if(['goal','growth'].includes(view))query.set('home',view);
 return (en?'/en':'')+'/simulator/?'+query+(['goal','growth'].includes(view)?'#sim-'+view+'-panel':'');
}

export function checkedPresets(value){
 if(!Array.isArray(value)||value.length>40)throw Error('HOME_CATALOG');
 const seen=new Set();
 return value.map(preset=>{
  if(!preset||!/^[-a-z0-9]{1,100}$/.test(preset.id)||seen.has(preset.id)||typeof preset.name!=='string'||preset.name.length>160||typeof preset.class!=='string'||typeof preset.className!=='string'||typeof preset.path!=='string'||!/^\/builds\/[-a-z0-9]+\/[-a-z0-9]+\/$/.test(preset.path))throw Error('HOME_CATALOG');
  seen.add(preset.id);return preset;
 });
}

export function readHomeGoal(storage,record){
 const raw=storage.getItem(goalKey(record.preset));return raw?parseGoal(raw,record.preset):null;
}

export function summarizeHomeGoal(record,goal,index){
 if(index?.version!==1||!index.gems||!index.nodes)throw Error('HOME_INDEX');
 const sameTree=(record.saved.request.tree_version||'0_5')===index.treeVersion&&(goal.saved.request.tree_version||'0_5')===index.treeVersion;
 const report=compareGoal(record.saved,goal,{
  gemInfo:id=>index.gems[id]||null,
  nodeInfo:id=>sameTree&&index.nodes[id]?{...index.nodes[id],attribute:index.nodes[id].name==='Attribute'}:null,
 });
 const gems=report.gems.missing+report.gems.upgrades+Number(report.gems.mainDifferent);
 const passives=sameTree&&report.passives.available?report.passives.missing+report.passives.choices:null;
 const unverified=!sameTree||!report.passives.available||!report.character.sameData||!report.character.sameAscendancy||
  !!(report.gems.unknown||report.passives.unknown||report.equipment.unknown)||
  !report.gems.rows.length||!report.passives.rows.length||!report.equipment.rows.length;
 return {gems,passives,equipment:report.equipment.pending,unverified,current:report.character.current.level,target:report.character.target.level};
}

export function readSeen(raw){
 if(!raw)return {};
 if(raw.length>100000)throw Error('HOME_SEEN');
 const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('HOME_SEEN');return value;
}

export function homeNotices(catalog,record,seen={}){
 if(catalog?.version!==1||!Array.isArray(catalog.notices)||catalog.notices.length>100)throw Error('HOME_NOTICES');
 const notices=catalog.notices.filter(notice=>Array.isArray(notice.presets)&&notice.presets.includes(record.preset)&&
  /^[-a-z0-9]{1,140}$/.test(notice.id)&&Number.isInteger(notice.revision)&&notice.revision>0&&
  typeof notice.title?.ja==='string'&&typeof notice.title?.en==='string'&&typeof notice.href==='string'&&/^\/(?!\/)/.test(notice.href));
 if(record.saved.engine!==(catalog.engine||ENGINE_VERSION)||record.saved.calculation?.dataVersion&&record.saved.calculation.dataVersion!==catalog.dataVersion)
  notices.push({id:`calculation-${catalog.engine}-${catalog.dataVersion}`,revision:1,date:'',href:'/simulator/#sim-workspace',
   title:{ja:'保存後に計算データが更新されています',en:'Calculation data changed after this save'}});
 const revision=catalog.guideRevisions?.[record.preset];
 if(revision&&record.saved.calculation?.guideRevision&&record.saved.calculation.guideRevision!==revision)
  notices.push({id:`guide-${record.preset}-${revision}`,revision:1,date:'',href:record.meta.path,
   title:{ja:'このビルドの育成ガイドが更新されています',en:'This build’s progression guide has changed'}});
 return notices.map(notice=>({...notice,unread:seen[notice.id]!==notice.revision})).sort((a,b)=>Number(b.unread)-Number(a.unread)||date(b.date)-date(a.date));
}
