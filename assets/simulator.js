import {newPlan, parseSave, makeSave, statValue, treeEdges, localizeItemText, restoreItemText, rareBasesForSlot, buildRareItem, passiveDescriptions, applyTreeAllocation, modifierJapanese, localizeModifiers, parseJapaneseModifiers, passiveComparison, weaponSetState, selectWeaponSet, drawableTreeEdges, acquiredTreeState, previewPassiveBatch, encodePlanLink, decodePlanLink, levelingStage, stageSkillCandidates, itemRequirements, resistanceGaps, namedPlanKey, parseNamedPlans, putNamedPlan, upgradeAdvice, createEditHistory, appendEditHistory, moveEditHistory, PRICE_CURRENCIES, priceBookKey, priceAmount, parsePriceBook, budgetVerdict, drawComparisonCard, comparisonChanges, validateComparison, encodeComparisonLink, decodeComparisonLink, simulatorBackup, parseSimulatorBackup, restoreSimulatorBackup, isolatedChanges, candidateOrder} from './simulator-model.js?v=161ef63cbd';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const clone = value => structuredClone(value);
const [presets,exampleData] = await loadCatalogs();
let localization={names:{}},equipmentCatalog,routeCatalog,editorCatalogPromise;
async function loadCatalogs(){for(;;){try{return await Promise.all(['/data/simulator-presets.json?v=99b38709f9','/data/simulator-examples.json?v=4253b9606f'].map(async url => {
 const r=await fetch(url);if(!r.ok)throw Error('ビルド一覧を読み込めません。再試行してください。');return r.json();
}));}catch(error){$('sim-catalog-error').hidden=false;$('sim-catalog-message').textContent=error.message;await new Promise(resolve=>{$('sim-catalog-retry').onclick=resolve;});$('sim-catalog-error').hidden=true;}}}
const trackSim=(name,extra={})=>{if(typeof window.gtag==='function')window.gtag('event',name,{page_path:location.pathname,...(selectedPreset?{build_id:selectedPreset.id}:{}),...extra});};
let sharedReadOnly=false,incomingLevel=null,stageBackup=null,auditSequence=0,readyGeneration=0,entrySource='chooser';
let names=localization.names;
function loadEditorCatalogs(){
 return editorCatalogPromise ||= Promise.all(['/data/simulator-localization.json?v=3f5c9b399b','/data/simulator-equipment.json?v=846e3f9450','/data/simulator-routes.json?v=856fb198d8'].map(async url=>{const response=await fetch(url);if(!response.ok)throw Error('編集用データを読み込めません。「再試行」を押してください。');return response.json();})).then(values=>{[localization,equipmentCatalog,routeCatalog]=values;names=localization.names;}).catch(error=>{editorCatalogPromise=null;throw error;});
}
const label=name=>name==='Soul Crystal: {0}'?'ソウルクリスタル（召喚対象を設定）':name==='Companion: {0}'?'コンパニオン（召喚対象を設定）':name==='Spectre: {0}'?'スペクター（召喚対象を設定）':names[name] || name;
const nodeStats=node=>passiveDescriptions(node,localization,plan?.request.attribute_choices || {},!plan?.request.tree_version||plan.request.tree_version==='0_5');
const examples=exampleData.examples;
let namedPlans=[],namedStorageSnapshot=null,deletedPlan=null,deletePlanId=null,workspaceBackup=null,examplePreview=null,workspaceSequence=0;
let editHistory=null,historyBusy=false,priceBook=null,priceStorageSnapshot=null,priceDirty=false,comparisonSnapshot=null,cardUrl=null,cardSequence=0,breakdownSequence=0;
let decisionSequence=0,multiSequence=0,isolateSequence=0,candidateTable=null;
let equipmentDraftVersion=0,candidateBusy=false,incomingComparison=null,comparisonSource=null,summaryBaseline=null,locationSequence=0;
let itemSource='',equipmentMode='unique',rareDraft=null,editorBaseline=null;
let worker,bootPromise,catalog,plan,result,baseline,selectedPreset,generation=0,calculation=0,sequence=0;
let selectedSlot='helmet',selectedNode=null,preview=null,activeTab='items',view={x:0,y:0,w:8500,h:6500},currentTree=[];
const pending = new Map();
const frame = window.requestAnimationFrame?.bind(window) || (fn=>setTimeout(fn,16));
let nodePage=0,editSequence=0,templateStep=0,templateVisible=true,templateRoute=null,templateNodes=new Set(),templateEdges=new Set();
let templateImport=null,templateImportSequence=0;
let treeNeedsFit=true;
let treeFrame=0,treeNodes=new Map(),treeConnections=[],renderedNodes=new Map(),renderedEdges=new Map();
let startState=new Set(),passiveResetBackup=null;
const queuedNodes=new Set();let queuedState=new Set();
let allocatedState=new Set(),highlightState=new Set(),selectedState=null,treeSearch=[];
const elementNS='http://www.w3.org/2000/svg';
function setCurrentTree(nodes){
 if(currentTree===nodes)return;
 currentTree=nodes;treeNodes=new Map(nodes.map(n=>[n.skill,n]));treeConnections=drawableTreeEdges(nodes);
 treeSearch=nodes.map(n=>({node:n,text:`${n.skill} ${n.name} ${label(n.name)} ${nodeStats(n).join(' ')}`.toLowerCase()}));
 $('sim-tree-nodes').replaceChildren();$('sim-tree-edges').replaceChildren();renderedNodes.clear();renderedEdges.clear();
}

function rpc(action,payload) {
 return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});try{if(!worker)throw Error('計算エンジンを再起動してください。');worker.postMessage({id,action,payload});}catch(error){pending.delete(id);reject(error);}});
}
function engine() {
 if(bootPromise)return bootPromise;
 if(!window.Worker || !window.DecompressionStream || !window.WebAssembly) return Promise.reject(Error('このブラウザは計算機能に対応していません。最新のSafari・Chrome・Edgeをご利用ください。'));
 const current=new Worker(new URL('./simulator-worker.js?v=2564face8b',import.meta.url),{type:'module'});worker=current;
 const fail=()=>{if(worker!==current)return;current.terminate?.();worker=null;bootPromise=null;catalog=null;for(const task of pending.values())task.reject(Error('読み込み・計算に失敗しました。「再試行」で構成を残したまま再開できます。'));pending.clear();};
 current.onmessage=({data})=>{if(worker!==current)return;if(data.progress){$('sim-status').textContent=data.progress;return;}const task=pending.get(data.id);if(!task)return;pending.delete(data.id);data.error?task.reject(Error(data.error)):task.resolve(data.result);};
 current.onerror=fail;
 const timer=setTimeout(fail,90000);
 bootPromise=Promise.all([rpc('boot'),loadEditorCatalogs()]).then(([data])=>{catalog=data;return data;}).catch(error=>{fail();throw error;}).finally(()=>clearTimeout(timer));return bootPromise;
}
async function retryEngine(){
 $('sim-engine-retry').disabled=true;clearError();
 try{await engine();if(plan){await recalculate();}else if(selectedPreset){await selectPreset(selectedPreset.id,{fromHistory:true});}}
 catch(error){showError(error);}finally{$('sim-engine-retry').disabled=false;}
}

function showError(error){const message=error.message || String(error);$('sim-error').textContent=message;$('sim-error').hidden=false;$('sim-engine-retry').hidden=false;$('sim-engine-retry').disabled=false;$('sim-tree-error-message').textContent=message;$('sim-tree-error').hidden=!treeFullscreen;}
function clearError(){$('sim-engine-retry').hidden=true;$('sim-error').hidden=true;$('sim-error').textContent='';$('sim-tree-error').hidden=true;$('sim-tree-error-message').textContent='';}
function save(options={}) {
 if(!plan)return;
 if(sharedReadOnly){$('sim-save-status').textContent='共有構成を確認中（未保存）';$('sim-tree-save-state').textContent='共有構成を確認中（未保存）';return true;}
 try{localStorage.setItem(`poe2-simulator:v1:${selectedPreset.id}`,JSON.stringify(makeSave(selectedPreset.id,plan.request,plan.questPoints,plan.notes,plan.equipmentDrafts || {},plan.weaponSets || null,plan.origin || null)));$('sim-save-status').textContent='この端末に保存済み';$('sim-tree-save-state').textContent='この端末に保存済み';if(options.track)trackSim('simulator_save',{method:'device'});return true;}
 catch{$('sim-save-status').textContent='端末保存ができません。保存ファイルを使ってください。';$('sim-tree-save-state').textContent=$('sim-save-status').textContent;return false;}
}
let calculating=false,queuedCalculation=null;
function recalculate() {
 if(!plan)return Promise.resolve();
 const token=++calculation,version=generation;
 clearError();renderMobileSummary(null,'再計算中…');$('sim-tree-save-state').textContent='再計算しています…';$('sim-item-result').setAttribute('aria-busy','true');$('sim-stats').setAttribute('aria-busy','true');$('sim-baseline').disabled=true;$('sim-status').textContent='変更を再計算しています…';
 return new Promise(resolve=>{
  if(queuedCalculation)queuedCalculation.resolve();
  queuedCalculation={token,version,request:clone(plan.request),resolve};
  void drainCalculations();
 });
}
async function drainCalculations(){
 if(calculating)return;calculating=true;
 try{while(queuedCalculation){
  const job=queuedCalculation;queuedCalculation=null;
  try{
   const next=await rpc('calculate',job.request);
   if(job.token!==calculation||job.version!==generation)continue;
   result=next;renderResults();renderTreeState();$('sim-status').textContent='変更を計算しました。';$('sim-tree-save-state').textContent=$('sim-save-status').textContent+'・計算反映済み';
   if(readyGeneration!==generation){readyGeneration=generation;trackSim('simulator_ready',{source:entrySource});}
  }catch(error){if(job.token===calculation&&job.version===generation){result=null;renderMobileSummary(null,'計算できません');$('sim-tree-live-stats').textContent='この構成は計算できません。';$('sim-tree-save-state').textContent='計算に失敗しました。構成の設定を確認してください。';$('sim-status').textContent=$('sim-tree-save-state').textContent;$('sim-stats').innerHTML='<p>この構成は計算できません。</p>';showError(error);}}
  finally{if(job.token===calculation&&job.version===generation){$('sim-item-result').setAttribute('aria-busy','false');$('sim-stats').setAttribute('aria-busy','false');$('sim-baseline').disabled=!result;}job.resolve();}
 }}finally{calculating=false;}
}
function commit(){invalidateBreakdown();invalidateComparison();rememberEdit();++editSequence;preview=null;$('sim-item-preview-result').hidden=true;save({track:true});void recalculate();}
const statistics=[['CombinedDPS','選択スキルのDPS'],['Life','最大ライフ'],['EnergyShield','エナジーシールド'],['Mana','最大マナ'],['Armour','アーマー'],['Evasion','回避力'],['SpiritUnreserved','未予約スピリット'],['FireResist','火耐性'],['ColdResist','冷気耐性'],['LightningResist','雷耐性'],['ChaosResist','混沌耐性'],['Str','筋力'],['Dex','器用さ'],['Int','知性']];
const integerFormat=new Intl.NumberFormat('ja-JP',{maximumFractionDigits:0}),decimalFormat=new Intl.NumberFormat('ja-JP',{maximumFractionDigits:1});
function number(value,id){if(value===null||!Number.isFinite(value))return'—';return (id.includes('DPS')?decimalFormat:integerFormat).format(value)+(/Resist/.test(id)?'%':'');}
function unsupportedLabel(value){
 const text=String(value),match=/^Tree:(\d+):\s*(.*)$/.exec(text),node=match&&treeNodes.get(+match[1]);if(node){const index=node.stats.indexOf(match[2]);return `${label(node.name)}：${index>=0?(nodeStats(node)[index] || '一部の効果は計算未対応です。'):'一部の効果は計算未対応です。'}`;}
 return localizeModifiers([text],equipmentCatalog,names);
}
const displayStat=(result,id,request=plan?.request)=>id==='CombinedDPS'&&(!result?.main_skill||!request?.socket_groups?.some(group=>group.enabled!==false&&group.gems?.length))?null:statValue(result,id);
function renderResults(){
 invalidateBreakdown();renderMobileSummary(result);
 const hasSkill=displayStat(result,'CombinedDPS')!==null;
 $('sim-stats').innerHTML=statistics.map(([id,title],i)=>{
  const value=displayStat(result,id);
  const old=baseline?.[id],delta=old!==null&&old!==undefined&&value!==null?value-old:null;
  return `<div class="sim-stat${i===0?' primary':''}"><span>${title}</span><div><b>${number(value,id)}</b>${delta!==null?`<small class="${delta<0?'negative':''}">${delta>0?'+':''}${number(delta,id)}</small>`:''}</div></div>`;
 }).join('');
 const starts=new Set(Object.values(result.tree_effects?.class_starts || {})),normalPoints=(plan.request.allocated_nodes || []).filter(id=>!starts.has(id)&&!treeNodes.get(id)?.ascendancy_id).length;
 const diagnostics=[...(normalPoints>plan.request.character.level-1+plan.questPoints?['選択した通常パッシブが現在Lvと報酬ポイントの上限を超えています。']:[]),...(result.unsupported_modifiers || []).map(v=>`未対応の効果：${unsupportedLabel(v)}`),...(result.item_errors || []).map(v=>`装備を計算から除外：${slots.find(s=>s[0]===v.slot)?.[1] || '装備'}。装備データの形式を確認してください。`),...(result.tree_effects?.warnings || []),...(plan.request.allocated_nodes || []).filter(id=>{const n=treeNodes.get(id);return n&&!n.stats.length&&n.kind==='notable';}).map(id=>`${label(treeNodes.get(id).name)}：対応データに効果の定義がありません。個別の能力は計算に含まれません。`)];
 $('sim-diagnostic-count').textContent=`（${diagnostics.length}件）`;
 $('sim-diagnostic-body').innerHTML=`<p>${hasSkill?'選択したスキルと現在の計算条件の結果です。':'計算対象のダメージスキルがありません。スキルと必要な武器・召喚対象を設定してください。'}</p>${diagnostics.length?`<p>以下の効果は数値に含まれない場合があります。</p><ul>${diagnostics.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:'<p>エンジンから未対応効果・装備エラーの報告はありません。全機構の再現を保証する判定ではありません。</p>'}`;
 $('sim-diagnostics').open=diagnostics.length>0;
 $('sim-engine-version').textContent=`対応データ ${result.provenance?.data_version || catalog.runtime.dataVersion}`;
 void updateBuildWarnings(result,plan.request);
 renderItemResult();$('sim-tree-live-stats').textContent=['Life','Armour','Evasion','CombinedDPS'].map(id=>`${statistics.find(s=>s[0]===id)[1]} ${number(displayStat(result,id),id)}`).join(' · ');
 $('sim-character-name').textContent=`${label(plan.request.character.class_name)} / ${label(plan.request.character.ascendancy_name)} · 装備・パッシブは自分の設定`;
}
async function selectPreset(id,{fromHistory=false,shared=null}={}){
 if(!fromHistory)++locationSequence;$('sim-mobile-summary').hidden=true;
 if(treeFullscreen){save();restoreTreeEditor();}
 const preset=presets.find(p=>p.id===id);if(!preset){showChooser();return;}
 const version=++generation;++calculation;incomingComparison=null;summaryBaseline=null;$('sim-imported-comparison').hidden=true;selectedPreset=preset;sharedReadOnly=!!shared;incomingLevel=null;stageBackup=null;$('sim-stage-undo').hidden=true;$('sim-stage-panel').hidden=true;$('sim-share-panel').hidden=true;$('sim-shared-panel').hidden=!shared;passiveResetBackup=null;$('sim-passives-undo').hidden=true;plan=null;editHistory=null;historyBusy=false;result=null;baseline=null;preview=null;selectedNode=null;queuedNodes.clear();++workspaceSequence;examplePreview=null;workspaceBackup=null;$('sim-workspace-restore').hidden=true;$('sim-example-preview-result').hidden=true;$('sim-example-apply').hidden=true;$('sim-example-status').textContent='';invalidateComparison();$('sim-plan-delete-confirm').hidden=true;
 $('sim-chooser').hidden=true;$('sim-workbench').hidden=false;$('sim-build-name').textContent=preset.name;$('sim-guide-link').href=preset.path;
 $('sim-status').textContent='計算画面を準備しています…';clearError();$('sim-item-editor').hidden=true;$('sim-item-list').hidden=false;
 $('sim-stats').innerHTML='<p>準備中…</p>';
 for(const element of $('sim-workbench').querySelectorAll('button,input,select,textarea'))if(element.id!=='sim-change-build')element.disabled=true;
 if(!fromHistory){const u=new URL(location.href);u.searchParams.set('build',id);u.searchParams.delete('level');u.searchParams.delete('from');u.searchParams.delete('saved');u.searchParams.delete('example');u.searchParams.delete('comparison');u.hash='';history.pushState({},'',u.pathname+u.search);}
 try{
  await engine();if(version!==generation)return;
  let recoveryError;
  if(shared)plan={request:shared.request,questPoints:shared.questPoints,notes:shared.notes,equipmentDrafts:shared.equipmentDrafts || {},weaponSets:shared.weaponSets || null,origin:shared.origin || null};
  try{const saved=!shared&&localStorage.getItem(`poe2-simulator:v1:${id}`);if(saved){const data=parseSave(saved);plan={request:data.request,questPoints:data.questPoints || 0,notes:data.notes || '',equipmentDrafts:data.equipmentDrafts || {},weaponSets:data.weaponSets || null,origin:data.origin || null};}}
  catch(error){recoveryError=Error('前回の保存を読み込めませんでした。新しい試作を表示しています。以前の保存ファイルがあれば「保存を読み込む」で復元できます。');}
  plan ||= {request:newPlan(preset,catalog.gems),questPoints:0,notes:''};
  const nodes=!plan.request.tree_version||plan.request.tree_version==='0_5'?catalog.tree:await rpc('tree',plan.request.tree_version);if(version!==generation)return;setCurrentTree(nodes);loadTemplate();
  for(const element of $('sim-workbench').querySelectorAll('button,input,select,textarea'))element.disabled=false;
  rememberEdit(true);renderInputs();renderStageHandoff();renderWorkspace();renderExampleOptions();entrySource=shared?'shared':incomingLevel?'guide':new URLSearchParams(location.search).get('from')==='record'?'record':'chooser';await recalculate();if(version!==generation)return;renderTree();
  if(recoveryError)showError(recoveryError);else if(result)save();
  const requestedSave=new URLSearchParams(location.search).get('saved');if(requestedSave&&namedPlans?.some(p=>p.id===requestedSave)){$('sim-workspace').open=true;$('sim-plan-select').value=requestedSave;$('sim-plan-name').value=namedPlans.find(p=>p.id===requestedSave).name;$('sim-plan-status').textContent='保存構成を選びました。「この構成を読み込む」で今の作業を退避して開けます。';}
  const requestedExample=new URLSearchParams(location.search).get('example');if(requestedExample&&examples.some(e=>e.id===requestedExample&&e.preset===preset.id)){$('sim-examples-panel').open=true;$('sim-example-select').value=requestedExample;setExampleConditions();await previewExample();}
 }catch(error){if(version===generation)showError(error);}
}
function showChooser(){$('sim-mobile-summary').hidden=true;if(treeFullscreen){save();restoreTreeEditor();}generation++;calculation++;$('sim-chooser').hidden=false;$('sim-workbench').hidden=true;const u=new URL(location.href);u.searchParams.delete('build');u.searchParams.delete('level');u.searchParams.delete('from');u.searchParams.delete('saved');u.searchParams.delete('example');u.searchParams.delete('comparison');u.hash='';history.pushState({},'',u.pathname+u.search);renderResume();$('sim-chooser').scrollIntoView({block:'start'});}
function renderInputs(){
 $('sim-level').value=plan.request.character.level;$('sim-tree-level').value=plan.request.character.level;
 $('sim-enemy').value=plan.request.enemy_tier || 'none';
 $('sim-life-reward').checked=!!plan.request.config_inputs?.['questInterlude 2Khari CrossingMolten Shrine'];
 $('sim-extra-mods').value=localizeModifiers(plan.request.extra_modifiers || [],equipmentCatalog,names);$('sim-config-modifier').innerHTML=equipmentCatalog.modifiers.map(m=>`<option value="${m.id}">${esc(m.label)}</option>`).join('');$('sim-notes').value=plan.notes;
 $('sim-quest-points').value=plan.questPoints;
 renderSlots();renderSkills();setTab(activeTab);renderOrigin();renderFirstGuide();
}
let treeFullscreen=false,treeClosing=false,treeReturnFocus=null,treePageOverflow=null,treeHomeMarker=null,treeMainInert=false;
function openTreeEditor(){
 if(treeFullscreen||!plan)return;treeFullscreen=true;treeReturnFocus=document.activeElement;
 const mobile=!!window.matchMedia?.('(max-width: 720px)').matches;if(mobile){treeHomeMarker=document.createElement('div');treeHomeMarker.setAttribute('aria-hidden','true');treeHomeMarker.style.height=$('sim-tree').getBoundingClientRect().height+'px';$('sim-tree').before(treeHomeMarker);document.body.append($('sim-tree'));treeMainInert=$('main').inert;$('main').inert=true;$('sim-tree').classList.add('sim-tree-mobile');$('sim-tree-mobile-controls').hidden=false;}
 treePageOverflow={body:document.body.style.overflow,html:document.documentElement.style.overflow};document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';
 $('sim-tree').classList.add('sim-tree-fullscreen');$('sim-tree').setAttribute('role','dialog');$('sim-tree').setAttribute('aria-modal','true');$('sim-tree').setAttribute('aria-label','パッシブツリーの編集');
 $('sim-tree-error').hidden=true;$('sim-tree-full-header').hidden=false;$('sim-tree-settings').open=false;$('sim-node-inspector').open=!mobile&&selectedNode!==null;$('sim-tree-close').focus({preventScroll:true});if(mobile)fitTree();else updateView();
}
async function closeTreeEditor(){
 if(!treeFullscreen||treeClosing)return;treeClosing=true;$('sim-tree').classList.add('sim-tree-closing');$('sim-tree-settings').inert=true;$('sim-node-inspector').inert=true;const button=$('sim-tree-close');button.disabled=true;button.textContent='保存・計算中…';
 try{await recalculate();if(!save())showError(Error('端末への保存ができませんでした。構成をファイルで保存してください。'));}finally{
 restoreTreeEditor();
 }
}
function restoreTreeEditor(){
 if(!treeFullscreen)return;
 treeFullscreen=false;treeClosing=false;$('sim-tree').classList.remove('sim-tree-fullscreen','sim-tree-closing');$('sim-tree-settings').inert=false;$('sim-node-inspector').inert=false;for(const name of ['role','aria-modal','aria-label'])$('sim-tree').removeAttribute(name);
 if(treeHomeMarker){treeHomeMarker.replaceWith($('sim-tree'));treeHomeMarker=null;$('main').inert=treeMainInert;}$('sim-tree').classList.remove('sim-tree-mobile');$('sim-tree-mobile-controls').hidden=true;
 $('sim-tree-error').hidden=true;$('sim-tree-full-header').hidden=true;$('sim-tree-settings').open=true;$('sim-node-inspector').open=true;document.body.style.overflow=treePageOverflow.body;document.documentElement.style.overflow=treePageOverflow.html;
 $('sim-tree-close').disabled=false;$('sim-tree-close').textContent='保存して戻る';treeReturnFocus?.focus?.({preventScroll:true});updateView();
}
function setTab(name){activeTab=name;for(const button of document.querySelectorAll('[data-tab]'))button.setAttribute('aria-pressed',String(button.dataset.tab===name));for(const panel of ['items','skills','tree','config'])$(`sim-${panel}`).hidden=panel!==name;if(name==='tree'){if(treeNeedsFit){treeNeedsFit=false;fitTree();}else updateView();}}
const slots=[['weapon1','メイン武器'],['weapon2','サブ武器・盾'],['helmet','兜'],['body','鎧'],['gloves','手袋'],['boots','靴'],['belt','ベルト'],['amulet','アミュレット'],['ring1','指輪1'],['ring2','指輪2'],['Flask 1','フラスコ1'],['Flask 2','フラスコ2'],['Charm 1','チャーム1'],['Charm 2','チャーム2'],['Charm 3','チャーム3']];
const utility=slot=>/^(Flask|Charm) /.test(slot);
const itemList=()=>utility(selectedSlot)?(plan.request.flasks ||= []):(plan.request.items ||= []);
function itemName(text){const lines=text.trim().split('\n');return /^Rarity:/i.test(lines[0])?lines[1] || '未装備':lines[0] || '未装備';}
function renderSlots(){
 plan.weaponSets=weaponSetState(plan.request,plan.equipmentDrafts || {},plan.weaponSets);for(const b of document.querySelectorAll('[data-weapon-set]')){const active=+b.dataset.weaponSet===plan.weaponSets.active;b.setAttribute('aria-pressed',String(active));} $('sim-weapon-set-status').textContent=`武器スロット${plan.weaponSets.active}の装備でステータスを計算します。`;
 $('sim-slots').innerHTML=slots.map(([id,title])=>{const item=(utility(id)?plan.request.flasks:plan.request.items)?.find(i=>i.slot===id);return `<button type="button" data-slot="${id}" aria-pressed="${id===selectedSlot}">${title}<small>${esc(item?label(itemName(item.text)):'未装備')}</small></button>`;}).join('');
 $('sim-slot-title').textContent=(selectedSlot.startsWith('weapon')?`武器スロット${plan.weaponSets.active} · `:'')+slots.find(s=>s[0]===selectedSlot)?.[1];itemSource=itemList().find(i=>i.slot===selectedSlot)?.text || '';$('sim-item-text').value=localizeItemText(itemSource,names);renderUniques();
}
function openItemEditor(){
 $('sim-item-preview-result').hidden=true;
 editorBaseline=result?Object.fromEntries(statistics.map(([id])=>[id,statValue(result,id)])):null;
 $('sim-item-list').hidden=true;$('sim-item-editor').hidden=false;
 const bases=rareBasesForSlot(selectedSlot,equipmentCatalog),saved=plan.equipmentDrafts?.[selectedSlot];
 rareDraft=saved&&bases.some(b=>b.id===saved.baseId)?clone(saved):{baseId:bases[0]?.id || '',name:`自作の${slots.find(s=>s[0]===selectedSlot)?.[1] || '装備'}`,level:80,quality:20,modifiers:[]};
 renderRareEditor();setEquipmentMode(saved&&bases.length?'rare':'unique');renderItemResult();initCandidateEditor();
 $('sim-slot-title').focus({preventScroll:true});$('sim-item-editor').scrollIntoView({block:'start',behavior:'instant'});
}
function closeItemEditor(){
 $('sim-item-editor').hidden=true;$('sim-item-list').hidden=false;$('sim-item-list-title').focus({preventScroll:true});$('sim-item-list').scrollIntoView({block:'start',behavior:'instant'});
}
function setEquipmentMode(mode){
 equipmentMode=mode;
 for(const b of document.querySelectorAll('[data-equipment-mode]'))b.setAttribute('aria-pressed',String(b.dataset.equipmentMode===mode));
 $('sim-unique-editor').hidden=mode!=='unique';$('sim-rare-editor').hidden=mode!=='rare';$('sim-item-source').hidden=mode==='rare';
 $('sim-item-apply').disabled=mode==='rare'&&!rareBasesForSlot(selectedSlot,equipmentCatalog).length;
}
function renderRareEditor(){
 const bases=rareBasesForSlot(selectedSlot,equipmentCatalog);
 $('sim-rare-base').innerHTML=bases.map(b=>`<option value="${esc(b.id)}">${esc(b.label)}</option>`).join('');$('sim-rare-base').value=rareDraft.baseId;
 $('sim-rare-name').value=rareDraft.name;$('sim-rare-level').value=rareDraft.level;$('sim-rare-quality').value=rareDraft.quality;
 $('sim-rare-fields').hidden=!bases.length;$('sim-rare-unavailable').hidden=!!bases.length;renderRareModifiers();
}
function renderRareModifiers(){
 $('sim-rare-modifiers').innerHTML=rareDraft.modifiers.map((mod,i)=>{const def=equipmentCatalog.modifiers.find(m=>m.id===mod.id);if(!def)return'';
 return `<div class="sim-rare-mod-row" data-rare-row="${i}"><label>効果<select data-rare-mod="${i}">${equipmentCatalog.modifiers.map(m=>`<option value="${m.id}"${m.id===mod.id?' selected':''}>${esc(m.group)}：${esc(m.label)}</option>`).join('')}</select></label><div class="sim-rare-values">${mod.values.map((v,j)=>`<label>${mod.values.length===2?(j===0?'最小値':'最大値'):'数値'}${def.unit?`（${esc(def.unit)}）`:''}<input type="number" min="0" max="100000" step="any" data-rare-value="${j}" value="${esc(v)}"></label>`).join('')}</div><button type="button" data-rare-remove="${i}" aria-label="オプション${i+1}を削除">削除</button></div>`;
 }).join('') || '<p class="sim-muted">効果を追加し、付けたい数値を入力してください。</p>';
 $('sim-rare-add').disabled=rareDraft.modifiers.length>=10;
 $('sim-rare-dirty').textContent='「この装備を反映」でステータスに適用します。';
}
function readRareDraft(){
 if(!rareDraft)return;
 rareDraft.baseId=$('sim-rare-base').value;rareDraft.name=$('sim-rare-name').value;rareDraft.level=Number($('sim-rare-level').value);rareDraft.quality=Number($('sim-rare-quality').value);
 rareDraft.modifiers=[...document.querySelectorAll('[data-rare-row]')].map(row=>({id:row.querySelector('[data-rare-mod]').value,values:[...row.querySelectorAll('[data-rare-value]')].map(e=>e.value)}));
}
function renderItemResult(){
 if(!result||$('sim-item-editor').hidden)return;
 const ids=['CombinedDPS','Life','Mana','EnergyShield','FireResist','ColdResist','LightningResist','ChaosResist'];
 $('sim-item-result-values').innerHTML='<dl>'+ids.map(id=>{const value=displayStat(result,id),old=editorBaseline?.[id],delta=value!==null&&old!==undefined&&old!==null?value-old:null;return `<div><dt>${statistics.find(s=>s[0]===id)[1]}</dt><dd>${number(value,id)}${delta?`<small>${delta>0?'+':''}${number(delta,id)}</small>`:''}</dd></div>`;}).join('')+'</dl>';
 $('sim-rare-dirty').textContent='反映済みの構成のステータスです。';
}
function renderUniques(){
 const q=$('sim-unique-search').value.trim().toLowerCase();
 const types=selectedSlot==='weapon1'?['bow','crossbow','mace','sceptre','spear','staff','talisman','wand']:selectedSlot==='weapon2'?['focus','quiver','shield','wand','sceptre','mace','spear']:selectedSlot.startsWith('ring')?['ring']:utility(selectedSlot)?['flask']:[selectedSlot];
 const matches=catalog.uniques.filter(u=>types.includes(u.item_type)&&`${u.name} ${names[u.name] || ''}`.toLowerCase().includes(q));
 $('sim-unique').innerHTML='<option value="">ユニークを選ぶ</option>'+matches.map(u=>`<option value="${u.id}">${esc(label(u.name))}</option>`).join('');
 $('sim-unique-draft').disabled=/^Charm/.test(selectedSlot);
}
const gemOptionCache=new Map();
function fullGemOptions(support,selected){
 if(!gemOptionCache.has(support))gemOptionCache.set(support, `<option value="">${support?'サポート':'スキル'}を選ぶ</option>`+catalog.gems.filter(g=>g.is_support===support&&!g.ui_hidden).map(g=>`<option value="${esc(g.skill_id)}">${esc(label(g.name))}</option>`).join(''));
 return gemOptionCache.get(support).replace(`value="${esc(selected)}"`,`value="${esc(selected)}" selected`);
}
function gemOptions(support,selected){
 const gem=catalog.gems.find(g=>g.skill_id===selected);
 return `<option value="">${support?'サポート':'スキル'}を選ぶ</option>`+(gem?`<option value="${esc(selected)}" selected>${esc(label(gem.name))}</option>`:'');
}
function expandGemOptions(target){
 if(target.dataset.gemField!=='skill_id'||target.dataset.optionsLoaded)return;
 const selected=target.value,old=target.selectedOptions[0]?.cloneNode(true);
 target.innerHTML=fullGemOptions(target.dataset.support==='true',selected);
 if(selected&&!catalog.gems.some(g=>g.skill_id===selected&&!g.ui_hidden)&&old)target.prepend(old);
 target.value=selected;target.dataset.optionsLoaded='true';
}
document.addEventListener('focusin',event=>expandGemOptions(event.target));
document.addEventListener('pointerdown',event=>expandGemOptions(event.target));
function renderSkills(){
 $('sim-skill-groups').innerHTML=(plan.request.socket_groups || []).map((group,index)=>`<section class="sim-gem-group" data-group="${index}"><div class="sim-gem-group-head"><label class="sim-check"><input type="radio" name="main-skill" data-main="${index}"${(plan.request.main_socket_group || 0)===index?' checked':''}>計算する主力</label><button type="button" data-remove-group="${index}" aria-label="スキル組${index+1}を削除">組を削除</button></div>${group.gems.map((gem,j)=>{
 const entry=catalog.gems.find(g=>g.skill_id===gem.skill_id);const support=entry?.is_support || false;
 const summoner=catalog.minions.summoners.find(s=>s.skill_id===gem.skill_id);const monsters=summoner?catalog.minions.monsters.filter(m=>!m.name.startsWith('[DNT]')&&summoner.minion_ids.includes(m.id)):[];
 return `<div class="sim-gem-row" data-gem="${j}"><label>${support?'サポート':'スキル'}<span class="skill-select-field" data-skill-selected="${esc(entry?.name || '')}"><select data-gem-field="skill_id" data-support="${support}">${!entry?`<option value="${esc(gem.skill_id)}">${esc(label(gem.name_spec || gem.skill_id))}（未解決）</option>`:''}${gemOptions(support,gem.skill_id)}</select></span></label><label>Lv<input data-gem-field="level" type="number" min="1" max="40" value="${gem.level}"></label><label>品質<input data-gem-field="quality" type="number" min="0" max="30" value="${gem.quality}"></label><button type="button" data-remove-gem="${j}" aria-label="ジェム${j+1}を削除">×</button></div>${monsters.length?`<label>召喚する対象<select data-minion="${j}"><option value="">対象を選ぶ</option>${monsters.map(m=>`<option value="${esc(m.id)}"${gem.minion===m.id?' selected':''}>${esc(label(m.name))}</option>`).join('')}</select></label>`:''}`;
 }).join('')}<label class="sim-check"><input type="checkbox" data-enabled="${index}"${group.enabled?' checked':''}>このスキル組を有効にする</label><button type="button" class="sim-add-support" data-add-support="${index}">＋ サポートを追加</button></section>`).join('');
}
function renderTree(){treeNeedsFit=true;if(activeTab==='tree'){treeNeedsFit=false;fitTree();}renderTreeState();renderNodeCatalog();}
function fitTree(){
 const nodes=currentTree.filter(n=>!n.ascendancy_id&&Number.isFinite(n.x)&&Number.isFinite(n.y));if(!nodes.length)return;
 const rect=$('sim-tree-map').getBoundingClientRect(),ratio=rect.width&&rect.height?rect.height/rect.width:.76;
 const minX=Math.min(...nodes.map(n=>n.x)),maxX=Math.max(...nodes.map(n=>n.x)),minY=Math.min(...nodes.map(n=>n.y)),maxY=Math.max(...nodes.map(n=>n.y));
 view.x=(minX+maxX)/2;view.y=(minY+maxY)/2;view.w=Math.max(maxX-minX+1800,(maxY-minY+1800)/ratio);view.h=view.w*ratio;updateView();
}
function nodeTint(node){const text=(node.stats || []).join(' ').toLowerCase();return /fire|ignite/.test(text)?'#b46548':/cold|freeze/.test(text)?'#5486b8':/lightning|shock/.test(text)?'#8b76bb':/chaos|poison/.test(text)?'#709668':/minion/.test(text)?'#a477a7':/life|strength/.test(text)?'#ae7960':/dexterity|evasion/.test(text)?'#709b8b':/intelligence|energy shield|mana/.test(text)?'#6d90b8':'#949384';}
function centerTree(){const root=result?.tree_effects?.class_starts?.[plan?.request.character.class_name.toLowerCase()];const node=treeNodes.get(root);if(node){view.x=node.x;view.y=node.y;}else{view.x=0;view.y=0;}view.w=8500;view.h=6500;updateView();}
function updateView(){
 if(activeTab!=='tree'||$('sim-workbench').hidden||treeFrame)return;
 treeFrame=frame(()=>{treeFrame=0;if(activeTab!=='tree'||$('sim-workbench').hidden)return;const rect=$('sim-tree-map').getBoundingClientRect();if(rect.width>0&&rect.height>0)view.h=view.w*rect.height/rect.width;
  $('sim-tree-svg').classList.toggle('sim-tree-overview',view.w>18000);$('sim-tree-svg').setAttribute('viewBox',`${view.x-view.w/2} ${view.y-view.h/2} ${view.w} ${view.h}`);drawTreeViewport();
 });
}
function nodeClasses(id){const node=treeNodes.get(id);return [node.kind,startState.has(id)?'start':'',allocatedState.has(id)?'allocated':'',highlightState.has(id)?'preview':'',selectedState===id?'selected':'',queuedNodes.has(id)?'queued':'',templateVisible&&templateNodes.has(id)?'template':''].filter(Boolean).join(' ');}
function drawTreeViewport(){
 const margin=150,left=view.x-view.w/2-margin,right=view.x+view.w/2+margin,top=view.y-view.h/2-margin,bottom=view.y+view.h/2+margin;
 const visible=new Set(),edges=new Set(),nodeFragment=document.createDocumentFragment(),edgeFragment=document.createDocumentFragment();
 for(const node of currentTree){
  if(!Number.isFinite(node.x)||!Number.isFinite(node.y)||node.x<left||node.x>right||node.y<top||node.y>bottom)continue;
  visible.add(node.skill);if(renderedNodes.has(node.skill))continue;
  const circle=document.createElementNS(elementNS,'circle');
  for(const [key,value]of Object.entries({cx:node.x,cy:node.y,r:node.kind==='keystone'?65:node.kind==='notable'?48:node.kind==='ascendancy_start'?80:28,'data-node':node.skill,'class':nodeClasses(node.skill)}))circle.setAttribute(key,value);
  circle.style.setProperty('--node-tint',nodeTint(node));
  const title=document.createElementNS(elementNS,'title');title.textContent=[label(node.name),...nodeStats(node)].join('\n');circle.append(title);renderedNodes.set(node.skill,circle);nodeFragment.append(circle);
 }
 for(const edge of treeConnections){
  if(Math.max(edge.x1,edge.x2)<left||Math.min(edge.x1,edge.x2)>right||Math.max(edge.y1,edge.y2)<top||Math.min(edge.y1,edge.y2)>bottom)continue;
  const key=`${edge.from}:${edge.to}`;edges.add(key);if(renderedEdges.has(key))continue;
  const arc=(!plan.request.tree_version||plan.request.tree_version==='0_5')?routeCatalog.geometry?.arcs?.[[edge.from,edge.to].sort((a,b)=>a-b).join(':')]:null;const line=document.createElementNS(elementNS,arc?'path':'line');if(arc)line.setAttribute('d',arc);for(const [name,value]of Object.entries({x1:edge.x1,y1:edge.y1,x2:edge.x2,y2:edge.y2,'data-from':edge.from,'data-to':edge.to}))line.setAttribute(name,value);
  if(isOwnedEdge(edge.from,edge.to))line.classList.add('allocated');if(templateVisible&&templateEdges.has([edge.from,edge.to].sort((a,b)=>a-b).join(':')))line.classList.add('template');renderedEdges.set(key,line);edgeFragment.append(line);
 }
 for(const [id,element]of renderedNodes)if(!visible.has(id)){element.remove();renderedNodes.delete(id);}
 for(const [key,element]of renderedEdges)if(!edges.has(key)){element.remove();renderedEdges.delete(key);}
 $('sim-tree-edges').append(edgeFragment);$('sim-tree-nodes').append(nodeFragment);
}
function isStartNode(node){return node?.kind==='ascendancy_start'||Object.values(result?.tree_effects?.class_starts || {}).includes(node?.skill);}
function isAllocatedNode(node){return !!node&&!isStartNode(node)&&node.kind!=='mastery'&&!!plan.request.allocated_nodes?.includes(node.skill);}
function isOwnedEdge(a,b){return (allocatedState.has(a)||startState.has(a))&&(allocatedState.has(b)||startState.has(b))&&(allocatedState.has(a)||allocatedState.has(b));}
function renderTreeState(){
 if(!plan)return;
 const cls=catalog.meta.classes.find(c=>c.name===plan.request.character.class_name),asc=cls?.ascendancies?.find(a=>a.name===plan.request.character.ascendancy_name);
 const {owned:allocated,starts}=acquiredTreeState(plan.request,currentTree,result?.tree_effects?.class_starts,asc?.id),highlight=new Set(preview?.result?.path || []);
 for(const id of queuedNodes)if(allocated.has(id))queuedNodes.delete(id);
 const changed=new Set([...allocatedState,...allocated,...startState,...starts].filter(id=>allocatedState.has(id)!==allocated.has(id)||startState.has(id)!==starts.has(id)));
 const nodeChanges=new Set([...changed,...[...highlightState,...highlight].filter(id=>highlightState.has(id)!==highlight.has(id)),selectedState,selectedNode,...[...queuedState,...queuedNodes].filter(id=>queuedState.has(id)!==queuedNodes.has(id))]);
 queuedState=new Set(queuedNodes);
 allocatedState=allocated;startState=starts;highlightState=highlight;selectedState=selectedNode;
 for(const id of nodeChanges){const node=renderedNodes.get(id);if(node)node.setAttribute('class',nodeClasses(id));}
 if(changed.size)for(const line of renderedEdges.values()){const a=+line.dataset.from,b=+line.dataset.to;if(changed.has(a)||changed.has(b))line.classList.toggle('allocated',isOwnedEdge(a,b));}
 const chosen=[...allocated],used=chosen.filter(id=>!treeNodes.get(id)?.ascendancy_id).length,limit=plan.request.character.level-1+plan.questPoints;$('sim-tree-budget-summary').textContent=`通常ポイント ${used} / ${limit} · ${used>limit?`${used-limit}ポイント超過しています。レベル・報酬ポイントを確認するか、ノードを外してください。`:`あと${limit-used}ポイント取得できます。`}`;$('sim-tree-budget-summary').classList.toggle('sim-budget-over',used>limit);$('sim-passives-reset').disabled=chosen.length===0;$('sim-point-count').textContent=`取得済み ${chosen.length}ノード · 通常 ${chosen.filter(id=>!treeNodes.get(id)?.ascendancy_id).length} / ${plan.request.character.level-1+plan.questPoints}pt · アセンダンシー ${chosen.filter(id=>treeNodes.get(id)?.ascendancy_id).length}ノード`;renderTemplateSummary();renderQueuedSelection();
}
function loadTemplate(){
 ++templateImportSequence;templateImport=null;$('sim-template-import-preview').replaceChildren();
 const reference=routeCatalog.source==='poe.ninja'?routeCatalog.templates[selectedPreset.id]:null;const verified=reference?.source?.verifiedAt&&/^https:\/\/poe\.ninja\/(?:ja\/)?poe2\/builds\//.test(reference?.source?.url || '');templateRoute=verified&&(!plan.request.tree_version||plan.request.tree_version==='0_5')?reference:null;templateStep=0;templateVisible=true;
 try{const saved=JSON.parse(localStorage.getItem(`poe2-template:v1:${selectedPreset.id}`));if(saved){templateStep=Math.max(0,Math.min((templateRoute?.steps.length || 1)-1,Number(saved.step)||0));templateVisible=saved.visible!==false;}}catch{}
 $('sim-template-stage').innerHTML=(templateRoute?.steps || []).map((step,i)=>`<option value="${i}">${esc(step.label)}</option>`).join('');
 if(templateRoute){$('sim-template-source').href=templateRoute.source.url;}$('sim-template-stage').value=String(templateStep);$('sim-template-visible').checked=templateVisible;$('sim-template-controls').hidden=!templateRoute;$('sim-template-unavailable').hidden=!!templateRoute;updateTemplate();
}
function updateTemplate(){
 ++templateImportSequence;templateImport=null;$('sim-template-import-preview').replaceChildren();
 const step=templateRoute?.steps[templateStep];$('sim-tree-svg').classList.toggle('has-template',templateVisible&&!!step);templateNodes=new Set(step?[templateRoute.root,...(step.starts || []),...step.nodes]:[]);templateEdges=new Set();
 for(const edge of treeConnections)if(templateNodes.has(edge.from)&&templateNodes.has(edge.to))templateEdges.add([edge.from,edge.to].sort((a,b)=>a-b).join(':'));
 $('sim-tree-reference').textContent=templateRoute?`NINJA Lv${templateRoute.source.level}`:'NINJA未設定';
 if(templateRoute)$('sim-template-provenance').textContent=`${templateRoute.source.character} · Lv${templateRoute.source.level} · ${templateRoute.source.verifiedAt.slice(0,10)}確認。${templateRoute.source.level<100?'一覧先頭はLv100未満です。Lv100の完成形は未確認です。':''}取得順は公開されていません。ジュエルの個別効果は含みません。`;
 for(const[id,node]of renderedNodes)node.setAttribute('class',nodeClasses(id));for(const line of renderedEdges.values())line.classList.toggle('template',templateVisible&&templateEdges.has([+line.dataset.from,+line.dataset.to].sort((a,b)=>a-b).join(':')));
 try{localStorage.setItem(`poe2-template:v1:${selectedPreset.id}`,JSON.stringify({step:templateStep,visible:templateVisible}));}catch{}renderTemplateSummary();
}
function renderTemplateSummary(){
 const step=templateRoute?.steps[templateStep];if(!step)return;
 const compared=passiveComparison(plan?.request.allocated_nodes || [],step.nodes),next=step.nodes.find(id=>!plan.request.allocated_nodes?.includes(id));
 $('sim-template-summary').textContent=`NINJA Lv${templateRoute.source.level} 完成形 · 一致 ${compared.shared.length} / ${step.nodes.length}ノード`;
 $('sim-template-next').disabled=next===undefined;
}
function focusTemplate(){
 const nodes=[...templateNodes].map(id=>treeNodes.get(id)).filter(n=>!n?.ascendancy_id&&Number.isFinite(n?.x)&&Number.isFinite(n?.y));if(!nodes.length)return;
 const minX=Math.min(...nodes.map(n=>n.x)),maxX=Math.max(...nodes.map(n=>n.x)),minY=Math.min(...nodes.map(n=>n.y)),maxY=Math.max(...nodes.map(n=>n.y));
 const rect=$('sim-tree-map').getBoundingClientRect(),ratio=rect.width&&rect.height?rect.height/rect.width:.76;
 view.x=(minX+maxX)/2;view.y=(minY+maxY)/2;view.w=Math.max(2200,maxX-minX+1200,(maxY-minY+1200)/ratio);view.h=view.w*ratio;updateView();
}
async function previewTemplateImport(){
 if(!templateRoute)return;const step=templateRoute.steps[templateStep],version=generation,edited=editSequence,token=++templateImportSequence,request=clone(plan.request);
 const normal=step.nodes.filter(id=>!treeNodes.get(id)?.ascendancy_id).length,level=templateRoute.source.level,points=Math.max(plan.questPoints,normal-(level-1));
 templateImport=null;
 if(points>24){$('sim-template-import-preview').innerHTML='<p>この参考ツリーは通常ポイント上限を超えています。ジュエルなどによる特殊な取得条件を再現できないため、一括反映はできません。参考表示を見ながら個別に選んでください。</p>';return;}
 request.character.level=level;request.allocated_nodes=[...step.nodes];request.attribute_choices=Object.fromEntries(Object.entries(templateRoute.attributeChoices || {}).filter(([id])=>step.nodes.includes(+id)));
 // Copy only the displayed tree. Equipment and skills remain the user's configuration.
 if(request.weapon_swap)request.weapon_swap.exclusive_nodes=[[],[]];
 const next=await rpc('calculate',request);if(version!==generation||edited!==editSequence||token!==templateImportSequence)return;
 templateImport={request,points,edited,version};const changes=[['Life','最大ライフ'],['Armour','アーマー'],['Evasion','回避力'],['CombinedDPS','DPS']].map(([key,name])=>`${name}：${number(displayStat(result,key),key)} → ${number(displayStat(next,key,request),key)}`).join('<br>');
 $('sim-template-import-preview').innerHTML=`<p>今のパッシブを<strong>${esc(step.label)}</strong>の${step.nodes.length}ノードに置き換えます。レベルは${level}、報酬ポイントは${points}になります。装備・ジェム・ジュエル効果は取り込みません。</p><p>${changes}</p><button id="sim-template-import-apply" type="button" class="sim-primary">この内容で反映して保存</button><button id="sim-template-import-cancel" type="button">キャンセル</button>`;
}
function setPassiveBudget(level,points){
 if(level===plan.request.character.level&&points===plan.questPoints)return;
 preview=null;templateImport=null;++templateImportSequence;
 for(const id of ['sim-node-preview-result','sim-template-import-preview']){const box=$(id);if(box?.hasChildNodes())box.textContent='レベル・報酬ポイントが変わりました。もう一度反映内容を確認してください。';}
 plan.request.character.level=level;plan.questPoints=points;$('sim-level').value=level;$('sim-tree-level').value=level;$('sim-quest-points').value=points;commit();renderTreeState();
}
function passiveKind(node){return {normal:'通常',notable:'ノータブル',keystone:'キーストーン',ascendancy_start:'開始点',jewel_socket:'ジュエルソケット',mastery:'中央マーク'}[node.kind] || 'パッシブ';}
function renderNodeCatalog(){
 const mode=$('sim-node-filter').value,q=$('sim-node-search').value.trim().toLowerCase();
 const nodes=treeSearch.filter(({node,text})=>(!q||text.includes(q))&&(mode==='all'||mode==='allocated'&&isAllocatedNode(node)||mode==='ascendancy'&&node.ascendancy_id||node.kind===mode));
 const pages=Math.max(1,Math.ceil(nodes.length/30));nodePage=Math.max(0,Math.min(nodePage,pages-1));
 $('sim-node-catalog-count').textContent=`${nodes.length}件 · ${nodePage+1} / ${pages}ページ`;
 $('sim-node-catalog-list').innerHTML=nodes.slice(nodePage*30,nodePage*30+30).map(({node})=>`<button type="button" data-node-result="${node.skill}"><strong>${esc(label(node.name))}</strong><span>${passiveKind(node)}${isAllocatedNode(node)?' · 取得済み':isStartNode(node)?' · 開始点（取得数に含めません）':''}</span>${nodeStats(node).map(line=>`<small>${esc(line)}</small>`).join('')}</button>`).join('') || '<p>一致するパッシブはありません。</p>';
 $('sim-node-prev').disabled=nodePage===0;$('sim-node-next').disabled=nodePage===pages-1;
}
function renderQueuedSelection(){
 const count=queuedNodes.size;$('sim-tree-selection').hidden=!count;$('sim-tree').classList.toggle('sim-has-selection',count>0);
 $('sim-selection-count').textContent=`選択中 ${count}ノード（未反映）`;
 $('sim-selection-name').textContent=label(treeNodes.get(selectedNode)?.name || '');
 $('sim-selection-list').innerHTML=[...queuedNodes].map(id=>`<button type="button" data-selection-remove="${id}" aria-label="${esc(label(treeNodes.get(id)?.name))}の選択を解除">${esc(label(treeNodes.get(id)?.name))} ×</button>`).join('');
}
function changeQueuedNode(id,enabled){
 if(enabled)queuedNodes.add(id);else queuedNodes.delete(id);preview=null;++editSequence;
 if(selectedNode!==null)nodeDetail(selectedNode,{reveal:false});else renderTreeState();
}
function nodeDetail(id,{reveal=true,select=false,compact=false}={}){
 $('sim-node-inspector').open=true;if(treeFullscreen)$('sim-tree-settings').open=false;
 const node=treeNodes.get(id);if(!node)return;
 if(select&&!isStartNode(node)&&node.kind!=='mastery'&&!isAllocatedNode(node)){if(queuedNodes.has(id))queuedNodes.delete(id);else queuedNodes.add(id);}
 selectedNode=id;preview=null;++editSequence;
 const allocated=isAllocatedNode(node),start=Object.values(result?.tree_effects?.class_starts || {}).includes(id)||node.kind==='ascendancy_start',decorative=node.kind==='mastery';
 $('sim-node-detail').innerHTML=`<h4 tabindex="-1">${esc(label(node.name))}</h4><p>${passiveKind(node)} · ${start?'開始点（取得数に含めません）':allocated?'取得済み':'未取得'}${node.ascendancy_id?' · アセンダンシー':''}</p><ul>${nodeStats(node).map(s=>`<li>${esc(s)}</li>`).join('')}</ul>${node.name==='Attribute'?`<label>このノードの能力値<select id="sim-node-attribute"><option value="str">筋力 +5</option><option value="dex">器用さ +5</option><option value="int">知性 +5</option></select></label>`:''}${!start&&!decorative?`<div class="sim-actions"><button type="button" id="sim-node-preview" class="sim-primary">${queuedNodes.size?`選んだ${queuedNodes.size}ノードの取得を確認`:allocated?'外す範囲と変化を確認':'取得経路と変化を確認'}</button></div>`:''}<div id="sim-node-preview-result" aria-live="polite"></div>`;
 if($('sim-node-attribute'))$('sim-node-attribute').value=plan.request.attribute_choices?.[id] || 'str';renderTreeState();
 if(compact&&queuedNodes.size)$('sim-node-inspector').open=false;
 if(reveal&&!treeFullscreen){$('sim-node-detail').querySelector('h4').focus({preventScroll:true});$('sim-node-detail').scrollIntoView({block:'nearest',behavior:'instant'});}
}
async function previewNode(){
 const id=selectedNode,version=generation,token=++editSequence,source=clone(plan.request),targets=[...queuedNodes];
 $('sim-node-inspector').open=true;if(treeFullscreen)$('sim-tree-settings').open=false;preview=null;renderTreeState();
 $('sim-node-preview-result').textContent='経路と能力の変化を計算しています…';
 try{
 const action=source.allocated_nodes?.includes(id)?'refund':'allocate',next=targets.length?await previewPassiveBatch(source,targets,payload=>rpc('edit',payload),plan.questPoints,()=>id===selectedNode&&version===generation&&token===editSequence):await rpc('edit',{request:source,node:id,mode:0,action,quest_points:plan.questPoints});
 if(id!==selectedNode||version!==generation||token!==editSequence)return;
 if(!next.valid){$('sim-node-preview-result').innerHTML='<p role="status">この組み合わせは反映できません。接続経路・職業・通常／アセンダンシーのポイント上限を確認してください。一部だけ取得することはありません。</p>';return;}
 const request=next.request || applyTreeAllocation(source,next.result.allocation),calculated=await rpc('calculate',request);
 if(id!==selectedNode||version!==generation||token!==editSequence)return;
 preview={...next,request,selectedTargets:targets};
 const changed=[...next.result.added,...next.result.removed],delta=statistics.map(([key,title])=>{const before=statValue(result,key),after=statValue(calculated,key);return before!==null&&after!==null&&Math.abs(after-before)>.00001?`<li>${title}：${number(before,key)} → ${number(after,key)}（${after>before?'+':''}${number(after-before,key)}）</li>`:'';}).join('');
 const unresolved=changed.filter(n=>{const node=treeNodes.get(n);return node&&!node.stats.length&&!['mastery','ascendancy_start','jewel_socket'].includes(node.kind);});
 $('sim-node-preview-result').innerHTML=`<p>${targets.length?`選択した${targets.length}ノードと必要な経路をまとめて反映します。<br>`:''}追加 ${next.result.added.length}ノード / 解除 ${next.result.removed.length}ノード<br>通常ポイント ${next.result.points_used} / ${next.result.points_max}</p><h5>反映後のステータス</h5>${delta?`<ul>${delta}</ul>`:'<p>表示中の数値に変化はありません。条件付き効果や必要な装備・スキルも確認してください。</p>'}${unresolved.length?'<p role="status">効果の定義がないノードを含みます。その個別効果は計算に含まれません。</p>':''}${calculated.unsupported_modifiers?.length?'<p role="status">未対応の効果があります。詳細は計算の確認事項を確認してください。</p>':''}<details><summary>変更される全ノードの能力</summary>${changed.map(n=>{const node=treeNodes.get(n);return node?`<h5>${next.result.added.includes(n)?'＋':'−'} ${esc(label(node.name))}</h5><ul>${nodeStats(node).map(line=>`<li>${esc(line)}</li>`).join('')}</ul>`:'';}).join('')}</details><button type="button" id="sim-node-apply" class="sim-primary">この変更を反映</button>`;renderTreeState();
 }catch(error){if(token===editSequence){$('sim-node-preview-result').textContent='変更を計算できませんでした。';showError(error);}}
}


function invalidateBreakdown(){++breakdownSequence;$('sim-breakdown-result').innerHTML='<p>現在の構成で内訳を確認できます。数値を選んで確認ボタンを押してください。</p>';$('sim-breakdown-show').disabled=false;}
const detailNumber=value=>typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat('ja-JP',{maximumFractionDigits:6}).format(value):'—';
const breakdownNames={Spirit:'総スピリット',SpiritReserved:'予約済みスピリット',...Object.fromEntries(statistics.map(([id,title])=>[id,title]))};
function breakdownSource(mod,request){
 if(mod.source_text&&request.extra_modifiers?.includes(mod.source_text))return '計算条件で追加した効果';
 const source={CharacterBase:'職業・Lv・能力値の基礎値',CampaignReward:'進行・クエスト報酬',Item:'装備の基礎値',ItemAffix:'装備の効果',Passive:'パッシブ',PassiveNode:'パッシブ',Gem:'ジェム',Support:'サポート',Buff:'一時効果'}[mod.origin_kind]||'効果（出所情報なし）';
 const slot=mod.slot==='bodyarmour'?'body':mod.slot;
 return mod.origin_id==='campaign.resistance_penalty'?'進行による耐性補正':(slots.find(s=>s[0]===slot)?.[1]?slots.find(s=>s[0]===slot)[1]+' · ':'')+source;
}
async function showBreakdown(){
 const id=$('sim-breakdown-stat').value;if(!statistics.some(s=>s[0]===id))throw Error('確認する数値を選んでください。');
 const box=$('sim-breakdown-result');if(id==='CombinedDPS'&&displayStat(result,id)===null){box.textContent='スキルを設定してからDPSの内訳を確認してください。';return;}
 const request=clone(plan.request),version=generation,edited=editSequence,token=++breakdownSequence;
 box.textContent='現在の構成の内訳を計算しています…';$('sim-breakdown-show').disabled=true;
 try{
  const calculated=await rpc('calculate',{...request,breakdowns:[id]});if(version!==generation||edited!==editSequence||token!==breakdownSequence)return;
  const value=displayStat(calculated,id,request),detail=calculated.breakdowns?.[id],title=breakdownNames[id],operations={flat:'基礎値・加算',increased:'増減の合計（%）',more:'乗算補正（倍率）',override:'上書き',floor:'切り捨て',round:'丸め',min:'小さい値を採用',max:'大きい値を採用',clamp:'上限・下限',hit_dps:'ヒットDPS',dot_dps:'継続ダメージDPS',combined_dps:'DPS合計',sum:'合計'};
  const steps=detail?.formula?.steps||[],mods=detail?.mods||[],inputs=detail?.derived?.inputs||[],contexts=detail?.derived?.context||[];
  const formula=steps.length?`<h5>計算の段階</h5><ol>${steps.map(step=>`<li>${esc(operations[step.op]||'補正（'+step.op+'）')}：${detailNumber(step.operand)} → ${detailNumber(step.result)}</li>`).join('')}</ol>`:inputs.length?`<h5>計算に使った数値</h5><dl>${inputs.map(input=>`<dt>${esc(breakdownNames[input.id]||input.id)}</dt><dd>${detailNumber(input.value)}</dd>`).join('')}</dl>${detail.derived.formula==='Spirit - SpiritReserved'?'<p>総スピリット − 予約済みスピリットで求めます。</p>':''}`:'<p>この数値の詳細な計算式は、対応データから表示できません。</p>';
  const hit=id==='CombinedDPS'&&calculated.main_skill?`<h5>選択スキルのDPS内訳</h5><p>ヒット：${detailNumber(calculated.main_skill.hit_dps)} / 継続ダメージ：${detailNumber(calculated.main_skill.dot_dps)}</p><p>DPS合計の直接内訳です。ヒットダメージに至るすべての内部式を展開したものではありません。</p>`:'';
  const contribution=mods.length?`<h5>この数値に関わる効果</h5><ul class="sim-mod-sources">${mods.slice(0,200).map(mod=>`<li><b>${esc(breakdownSource(mod,request))}</b> · ${esc(({BASE:'加算',INC:'増減（%）',MORE:'乗算効果（%）',OVERRIDE:'上書き'})[mod.mod_type]||mod.mod_type)} ${detailNumber(mod.value)} · ${mod.active?'適用中':'不使用・条件を確認'}${mod.source_text?`<p>${esc(localizeModifiers([mod.source_text],equipmentCatalog,names))}</p>`:''}</li>`).join('')}</ul>${mods.length>200?`<p>出所の表示は先頭200件です。残り${mods.length-200}件の出所表示は省略しています。</p>`:''}`:'<p>この指標の直接の効果一覧は返されていません。他の数値の内訳・計算条件も確認してください。</p>';
  const issues=[...(calculated.unsupported_modifiers||[]).map(unsupportedLabel),...(calculated.item_errors||[]).map(e=>'装備を計算から除外：'+(slots.find(s=>s[0]===e.slot)?.[1]||e.slot)),...(calculated.tree_effects?.warnings||[])];
  box.innerHTML=`<h4>${esc(title)}：${number(value,id)}</h4><p>敵：${esc(({none:'通常の敵',boss:'ボス',pinnacle:'ピナクルボス',uber:'ウーバーボス'})[request.enemy_tier]||'エンジンの既定条件（種類未指定）')} / Lv${request.character.level} / 武器スロット${plan.weaponSets?.active||1} / 追加効果${request.extra_modifiers?.length||0}行。装備・ジェム・一時効果は現在の設定です。</p>${formula}${hit}${contribution}${contexts.length?'<p>追加の条件を伴う派生計算です。計算条件も確認してください。</p>':''}${issues.length?`<h5>計算に含まれない可能性がある効果</h5><ul>${issues.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:''}<p class="sim-muted">途中結果は小数で、通常の結果欄は丸めて表示します。表示される内訳はエンジンが返す範囲です。ゲーム内の全機構を再現した保証ではありません。</p>`;
  trackSim('simulator_breakdown',{stat:id});
 }catch(error){if(token===breakdownSequence){box.textContent='内訳を確認できませんでした。構成と計算の確認事項を確認してください。';throw error;}}
 finally{if(token===breakdownSequence)$('sim-breakdown-show').disabled=false;}
}
function clearComparisonCard(){++cardSequence;if(cardUrl){URL.revokeObjectURL(cardUrl);cardUrl=null;}$('sim-card-preview').hidden=true;$('sim-card-image').removeAttribute('src');$('sim-card-download').removeAttribute('href');}
function invalidateComparison(){++decisionSequence;candidateTable=null;$('sim-multi-result').replaceChildren();$('sim-isolate-result').replaceChildren();$('sim-isolate-run').hidden=true;++workspaceSequence;comparisonSnapshot=null;comparisonSource=null;$('sim-compare-share-panel').hidden=true;$('sim-compare-share-url').value='';clearComparisonCard();$('sim-compare-export').hidden=true;$('sim-compare-result').replaceChildren();}
function currencyOptions(selected){return Object.entries(PRICE_CURRENCIES).map(([id,name])=>`<option value="${id}"${id===selected?' selected':''}>${name}</option>`).join('');}
function priceText(price){return !price||price.amount===null?'未記録':`${new Intl.NumberFormat('ja-JP',{maximumFractionDigits:4}).format(price.amount)} ${PRICE_CURRENCIES[price.currency]}`;}
function renderPrices(){
 let error=false;
 try{priceStorageSnapshot=localStorage.getItem(priceBookKey(selectedPreset.id));priceBook=parsePriceBook(priceStorageSnapshot);}catch{priceBook=parsePriceBook(null);error=true;}
 priceDirty=false;$('sim-price-budget').value=priceBook.budget.amount??'';$('sim-price-currency').value=priceBook.budget.currency;
 $('sim-price-entries').innerHTML=[{id:'current',name:'今の構成（作業中）'},...(namedPlans||[])].map(p=>{const price=priceBook.entries.find(x=>x.id===p.id)||{amount:null,currency:priceBook.budget.currency};return `<div class="sim-price-row" data-price-entry="${esc(p.id)}"><b>${esc(p.name)}</b><label>予定額<input aria-label="${esc(p.name)}の予定額" type="number" min="0" max="1000000000" step="0.0001" data-price-amount value="${price.amount??''}" placeholder="未記録"></label><label>通貨<select aria-label="${esc(p.name)}の通貨" data-price-currency>${currencyOptions(price.currency)}</select></label></div>`;}).join('');
 $('sim-price-save').disabled=error;$('sim-price-status').textContent=error?'予定額データを読み込めません。元の保存は上書きせず保持しています。':'予定額は構成データとは別に、このブラウザに保存します。';
}
function savePrices(){
 if([...$('sim-price-panel').querySelectorAll('input[type=number]')].some(input=>input.validity.badInput))throw Error('予定額・予算を正しい数値で入力してください。');
 const next=parsePriceBook(JSON.stringify({version:1,budget:{amount:priceAmount($('sim-price-budget').value),currency:$('sim-price-currency').value},entries:[...$('sim-price-entries').querySelectorAll('[data-price-entry]')].map(row=>({id:row.dataset.priceEntry,amount:priceAmount(row.querySelector('[data-price-amount]').value),currency:row.querySelector('[data-price-currency]').value}))}));
 if(localStorage.getItem(priceBookKey(selectedPreset.id))!==priceStorageSnapshot)throw Error('別のタブで予定額が更新されました。構成を開き直して最新の予定額を確認してください。');
 const text=JSON.stringify(next);try{localStorage.setItem(priceBookKey(selectedPreset.id),text);}catch{throw Error('予定額を保存できませんでした。以前の保存は保持しています。');}
 priceBook=next;priceStorageSnapshot=text;priceDirty=false;invalidateComparison();$('sim-price-status').textContent='予定額と予算を保存しました。A/B比較で予算判定と能力値を並べて確認できます。';
}
function priceComparison(aId,bId,book){
 const a=book.entries.find(x=>x.id===aId),b=book.entries.find(x=>x.id===bId);
 return `<section class="sim-cost-comparison"><h5>予定額と予算</h5><p>予算：${esc(priceText(book.budget))}。手入力の予定額です。通貨の換算は行いません。</p><dl class="sim-cost-grid"><div><dt>構成A</dt><dd>${esc(priceText(a))} · ${esc(budgetVerdict(a,book.budget))}</dd></div><div><dt>構成B</dt><dd>${esc(priceText(b))} · ${esc(budgetVerdict(b,book.budget))}</dd></div></dl></section>`;
}
function renderHistory(){
 for(const [id,available]of [['sim-history-undo',editHistory?.past.length],['sim-tree-history-undo',editHistory?.past.length],['sim-history-redo',editHistory?.future.length],['sim-tree-history-redo',editHistory?.future.length]])$(id).disabled=historyBusy||!available;
 $('sim-history-status').textContent=`このビルドを開いている間、直近20操作を戻せます。戻せる操作 ${editHistory?.past.length||0} / やり直せる操作 ${editHistory?.future.length||0}。名前付き保存は変更しません。`;
}
function rememberEdit(reset=false){
 if(!plan)return;
 editHistory=reset?createEditHistory(capturePlan(),sharedReadOnly):appendEditHistory(editHistory,capturePlan(),sharedReadOnly);renderHistory();
}
async function replayEdit(direction){
 if(historyBusy)return;rememberEdit();const next=moveEditHistory(editHistory,direction);if(!next)return;
 historyBusy=true;renderHistory();
 try{if(await applyWorkspaceSave(next.current.saved,{history:true,readOnly:next.current.readOnly})){editHistory=next;$('sim-status').textContent=direction==='undo'?'変更を1つ戻しました。':'変更をやり直しました。';trackSim('simulator_edit_history',{action:direction});}}
 finally{historyBusy=false;renderHistory();}
}
function renderResume(){
 const groups=[];let damaged=0;
 for(const preset of presets){
  let auto=null,book=[];
  try{const text=localStorage.getItem(`poe2-simulator:v1:${preset.id}`);if(text){const saved=parseSave(text);if(saved.preset===preset.id)auto=saved;}}catch{damaged++;}
  try{book=parseNamedPlans(localStorage.getItem(namedPlanKey(preset.id)),preset.id);}catch{damaged++;}
  if(!auto&&!book.length)continue;
  const base=`/simulator/?build=${encodeURIComponent(preset.id)}`;
  groups.push(`<details class="sim-resume-build"><summary>${esc(preset.name)} · ${auto?'自動保存あり · ':''}名前付き${book.length}件</summary>${auto?`<p><a href="${base}">自動保存の続き · Lv${auto.request.character.level}</a></p>`:''}${book.length?`<ul>${book.map(p=>`<li><a href="${base}&amp;saved=${encodeURIComponent(p.id)}">${esc(p.name)} · Lv${p.saved.request.character.level}</a></li>`).join('')}</ul>`:''}</details>`);
 }
 $('sim-resume-list').innerHTML=groups.join('')||'<p>このブラウザに保存した構成はまだありません。下のサンプルかビルドを選んで始められます。</p>';
 if(damaged)$('sim-resume-list').insertAdjacentHTML('beforeend','<p>読み込めない保存は上書きせず残しています。保存ファイルがあれば対応するビルドで読み込んでください。</p>');
}
function capturePlan(){return makeSave(selectedPreset.id,plan.request,plan.questPoints,plan.notes,plan.equipmentDrafts||{},plan.weaponSets||null,plan.origin||null);}
function renderOrigin(){
 const example=examples.find(e=>e.id===plan?.origin?.id&&e.preset===selectedPreset?.id),box=$('sim-plan-origin');box.hidden=!example;
 if(example)box.innerHTML=`<b>この構成の出発点：${esc(example.title)}</b><p>${esc(example.kind==='record'?'記事の確認済み装備をもとにした試算です。未確認の設定は空欄、武器セットは計算用の仮配置です。':'数値比較用の仮装備を含む操作サンプルです。')} 編集内容は自分の設定です。</p><a href="${esc(example.source.href)}">出典・確認範囲を見る</a>`;
}
function renderWorkspace(selectedId=$('sim-plan-select').value){
 let error=null;
 try{namedStorageSnapshot=localStorage.getItem(namedPlanKey(selectedPreset.id));namedPlans=parseNamedPlans(namedStorageSnapshot,selectedPreset.id);}catch(e){namedPlans=null;error=e;}
 const plans=namedPlans||[],selected=plans.some(p=>p.id===selectedId)?selectedId:plans[0]?.id||'';
 $('sim-plan-select').innerHTML=plans.length?plans.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · Lv${p.saved.request.character.level}</option>`).join(''):'<option value="">名前付きの保存はまだありません</option>';
 $('sim-plan-select').value=selected;$('sim-plan-create').disabled=!!error;
 for(const id of ['sim-plan-load','sim-plan-update','sim-plan-delete'])$(id).disabled=!!error||!plans.length;
 for(const id of ['sim-compare-a','sim-compare-b']){
  const previous=$(id).value;
  $(id).innerHTML='<option value="current">今の構成</option>'+(incomingComparison?'<option value="shared-a">共有・見本の構成A</option><option value="shared-b">共有・見本の構成B</option>':'')+plans.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  $(id).value=previous==='current'||incomingComparison&&['shared-a','shared-b'].includes(previous)||plans.some(p=>p.id===previous)?previous:id==='sim-compare-b'&&plans.length?plans[0].id:'current';
 }
 $('sim-plan-status').textContent=error?'構成一覧を読み込めません。元の一覧を上書きせず保持しています。保存ファイルを確認してください。':`${plans.length} / 12構成を保存`;
 renderFirstGuide();$('sim-compare-plans').disabled=!!error&&!incomingComparison||!plans.length&&!incomingComparison;renderPrices();
 try{const text=localStorage.getItem(`poe2-simulator:deleted-plan:${selectedPreset.id}`);deletedPlan=text?parseNamedPlans(text,selectedPreset.id)[0]:null;}catch{deletedPlan=null;}
 $('sim-plan-delete-undo').hidden=!deletedPlan;
 if(!workspaceBackup)try{const backup=JSON.parse(localStorage.getItem(`poe2-simulator:before-workspace:${selectedPreset.id}`));if(backup?.saved&&parseSave(JSON.stringify(backup.saved)).preset===selectedPreset.id){workspaceBackup=backup;$('sim-workspace-restore').hidden=false;}}catch{}
}
function writeNamedPlans(next,selected){
 if(priceDirty)throw Error('予定額と予算の変更を先に保存してください。入力した予定額を残してから構成一覧を変更します。');
 parseNamedPlans(JSON.stringify({version:1,plans:next}),selectedPreset.id);
 if(localStorage.getItem(namedPlanKey(selectedPreset.id))!==namedStorageSnapshot){renderWorkspace();throw Error('別のタブで構成一覧が更新されました。最新の一覧を表示したので、もう一度操作してください。');}
 try{localStorage.setItem(namedPlanKey(selectedPreset.id),JSON.stringify({version:1,plans:next}));}catch{throw Error('構成を保存できませんでした。以前の一覧は保持されています。保存ファイルもお使いください。');}
 renderWorkspace(selected);if(next.length&&$('sim-compare-a').value==='current'&&$('sim-compare-b').value==='current')$('sim-compare-b').value=next.some(p=>p.id===selected)?selected:next[0].id;invalidateComparison();
}
function renderExampleOptions(){
 const choices=examples.filter(e=>e.preset===selectedPreset.id);
 $('sim-example-select').innerHTML=choices.length?choices.map(e=>`<option value="${esc(e.id)}">${esc(e.title)}</option>`).join(''):'<option value="">このビルドの見本は準備中です</option>';
 $('sim-example-preview').disabled=!choices.length;$('sim-example-conditions').hidden=!choices.length;
 if(choices.length)setExampleConditions();
 else $('sim-example-level-help').innerHTML='他の操作見本は<a href="/simulator/#sim-sample-choices">サンプル一覧</a>から選べます。';
}
function setExampleConditions(){
 const example=examples.find(e=>e.id===$('sim-example-select').value);if(!example)return;
 $('sim-example-level').value=example.level||plan.request.character.level;$('sim-example-level').readOnly=!!example.level;
 $('sim-example-level-help').textContent=example.level?`見本のLvは${example.level}です。取り込んだ後に編集できます。`:'撃破時のLvは未確認です。この入力は試算用のLvです。画像の撃破Lvを表すものではありません。';
 $('sim-example-weapon-label').hidden=example.kind!=='record';$('sim-example-weapon').value='1';
 examplePreview=null;++workspaceSequence;$('sim-example-apply').hidden=true;$('sim-example-preview-result').hidden=true;
}
async function previewExample(){
 const example=examples.find(e=>e.id===$('sim-example-select').value&&e.preset===selectedPreset.id);if(!example)throw Error('見本を選んでください。');
 const level=Number($('sim-example-level').value);if(!Number.isInteger(level)||level<1||level>100)throw Error('試算用のLvは1〜100で入力してください。');
 const version=generation,edited=editSequence,token=++workspaceSequence,saved=clone(example.saved);saved.request.character.level=example.level||level;
 saved.origin={id:example.id,kind:example.kind};
 if(example.kind==='record'){
  const next=selectWeaponSet({request:saved.request,equipmentDrafts:saved.equipmentDrafts,weaponSets:saved.weaponSets},Number($('sim-example-weapon').value));saved.request=next.request;saved.weaponSets=next.weaponSets;saved.equipmentDrafts=next.equipmentDrafts;
 }
 const box=$('sim-example-preview-result');box.hidden=false;box.textContent='読み込み内容を計算しています…';$('sim-example-apply').hidden=true;
 const calculated=await rpc('calculate',saved.request);
 if(version!==generation||edited!==editSequence||token!==workspaceSequence)return;
 if(calculated.item_errors?.length)throw Error('見本の装備を読み込めません。');
 examplePreview={saved,example,version,edited};
 const itemCount=example.kind==='record'?example.itemCount:saved.request.items.length;
 box.innerHTML=`<h3>${esc(example.title)}</h3><p>${esc(example.description)}</p><p>Lv${saved.request.character.level}${!example.level?'（試算用・撃破Lv未確認）':''} / 装備${itemCount}点 / 通常パッシブ${saved.request.allocated_nodes.length}点 / ${saved.request.socket_groups.length?'主力ジェムLv'+saved.request.socket_groups[0].gems[0].level:'スキル・サポート未設定'}</p><details><summary>計算の対応データと確認範囲</summary><p>計算エンジン ${esc(example.verification.engine)} / データ ${esc(example.verification.data)}で装備の読み込みを確認。試算は通常の敵で開始します。</p></details><ul>${example.omissions.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>${example.sourceItems?`<details><summary>取り込む装備と転記元</summary><ul>${example.sourceItems.map(i=>`<li><b>${esc(label(i.name))}</b><p>${esc(i.sourceText)}</p></li>`).join('')}</ul></details>`:''}<p>試算結果：最大ライフ ${number(statValue(calculated,'Life'),'Life')} / ES ${number(statValue(calculated,'EnergyShield'),'EnergyShield')} / 選択スキルのDPS ${displayStat(calculated,'CombinedDPS',saved.request)!==null?number(displayStat(calculated,'CombinedDPS',saved.request),'CombinedDPS'):'未設定'}</p><a href="${esc(example.source.href)}">${esc(example.source.label)}を確認</a><p>「この内容で試す」を押すと今の構成を退避して切り替えます。切替前に戻すこともできます。</p>`;
 $('sim-example-apply').hidden=false;$('sim-example-status').textContent='まだ現在の構成・保存内容は変わっていません。';
}
async function applyWorkspaceSave(saved,{restore=false,readOnly=false,history=false}={}){
 saved=parseSave(JSON.stringify(saved));
 if(saved.preset!==selectedPreset.id||saved.request.character.class_name!==selectedPreset.class)throw Error('選択中のビルドと構成が一致しません。');
 const version=generation,edited=editSequence,token=++workspaceSequence;
 const [next,nodes]=await Promise.all([rpc('calculate',saved.request),rpc('tree',saved.request.tree_version||null)]);
 if(version!==generation||edited!==editSequence||token!==workspaceSequence)return false;
 if(!history)rememberEdit();
 invalidateComparison();
 if(!restore&&!history){
  const backup={saved:capturePlan(),readOnly:sharedReadOnly};
  try{localStorage.setItem(`poe2-simulator:before-workspace:${selectedPreset.id}`,JSON.stringify(backup));}catch{throw Error('切替前の構成を退避できませんでした。保存ファイルを書き出してからお試しください。');}
  workspaceBackup=backup;
 }
 // Existing own autosaves remain protected while working from a shared URL.
 const protectedSave=restore||history?readOnly:sharedReadOnly;
 if(treeFullscreen)restoreTreeEditor();
 plan={request:saved.request,questPoints:saved.questPoints,notes:saved.notes,equipmentDrafts:saved.equipmentDrafts||{},weaponSets:saved.weaponSets||null,origin:saved.origin||null};
 sharedReadOnly=protectedSave;$('sim-shared-panel').hidden=!protectedSave;
 ++editSequence;++calculation;++auditSequence;baseline=null;preview=null;selectedNode=null;queuedNodes.clear();examplePreview=null;templateImport=null;++templateImportSequence;
 passiveResetBackup=null;stageBackup=null;$('sim-passives-undo').hidden=true;$('sim-stage-undo').hidden=true;$('sim-stage-panel').hidden=true;$('sim-example-apply').hidden=true;$('sim-example-preview-result').hidden=true;
 $('sim-item-preview-result').hidden=true;$('sim-item-editor').hidden=true;$('sim-item-list').hidden=false;
 setCurrentTree(nodes);result=next;if(!history)summaryBaseline=null;loadTemplate();renderInputs();renderTree();renderResults();save({track:true});clearError();
 $('sim-stats').setAttribute('aria-busy','false');$('sim-baseline').disabled=false;
 if(!history)$('sim-workspace-restore').hidden=restore;$('sim-status').textContent=restore?'切替前の構成に戻しました。':'構成を読み込んで計算しました。';
 if(!history)rememberEdit();
 if(restore){workspaceBackup=null;try{localStorage.removeItem(`poe2-simulator:before-workspace:${selectedPreset.id}`);}catch{}}
 return true;
}
async function compareNamedPlans(){
 if(!namedPlans&&!incomingComparison)throw Error('構成一覧を読み込めないため、比較できません。');
 if(priceDirty)throw Error('予定額と予算に未保存の変更があります。「予定額と予算を保存」を押してから比較してください。');
 const get=id=>id==='current'?{name:'今の構成',saved:capturePlan()}:incomingComparison&&['shared-a','shared-b'].includes(id)?{name:id==='shared-a'?'構成A（共有・見本）':'構成B（共有・見本）',saved:incomingComparison[id==='shared-a'?'a':'b']}:namedPlans?.find(p=>p.id===id);
 const a=get($('sim-compare-a').value),b=get($('sim-compare-b').value);if(!a||!b)throw Error('比較する構成を選び直してください。');
 if($('sim-compare-a').value===$('sim-compare-b').value)throw Error('構成Aと構成Bに、異なる構成を選んでください。');
 const version=generation,edited=editSequence,token=++workspaceSequence,enemy=$('sim-compare-enemy').value,book=comparisonPriceBook();
 const request=p=>({...clone(p.saved.request),enemy_tier:enemy});
 ++isolateSequence;$('sim-isolate-result').replaceChildren();$('sim-isolate-run').hidden=true;const box=$('sim-compare-result');comparisonSnapshot=null;comparisonSource=null;$('sim-compare-share-panel').hidden=true;clearComparisonCard();$('sim-compare-export').hidden=true;box.textContent='AとBを計算しています…';$('sim-compare-plans').disabled=true;
 try{
  const [ar,br]=await Promise.all([rpc('calculate',request(a)),rpc('calculate',request(b))]);
  if(version!==generation||edited!==editSequence||token!==workspaceSequence)return;
  const summary=p=>`Lv${p.saved.request.character.level} / 報酬${p.saved.questPoints}P / 武器スロット${p.saved.weaponSets?.active||1}`;
  const rows=statistics.map(([id,title])=>{const av=displayStat(ar,id,a.saved.request),bv=displayStat(br,id,b.saved.request),delta=av!==null&&bv!==null?bv-av:null;return {id,title,a:number(av,id),b:number(bv,id),delta:delta===null?'—':(delta>0?'+':'')+number(delta,id)};});
  const priceA=book.entries.find(x=>x.id===$('sim-compare-a').value),priceB=book.entries.find(x=>x.id===$('sim-compare-b').value),warning=[ar,br].some(r=>r.item_errors?.length||r.unsupported_modifiers?.length);
  comparisonSnapshot={build:selectedPreset.name,a:{name:a.name,summary:summary(a)},b:{name:b.name,summary:summary(b)},enemy:$('sim-compare-enemy').selectedOptions[0].textContent,rows,priceA:priceText(priceA),priceB:priceText(priceB),budget:priceText(book.budget),warning,dataVersion:ar.provenance?.data_version||catalog.runtime.dataVersion,date:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date())};
  box.innerHTML=`<h4>${esc(a.name)} と ${esc(b.name)}</h4><p>A：${esc(summary(a))}<br>B：${esc(summary(b))}</p><p>敵：${esc(comparisonSnapshot.enemy)}。装備・ジェム・一時効果・Lvは各構成の内容です。</p>${priceComparison($('sim-compare-a').value,$('sim-compare-b').value,book)}<div class="sim-table-scroll" tabindex="0" role="region" aria-label="構成比較の表"><table><caption>保存を変更しない構成比較</caption><thead><tr><th scope="col">項目</th><th scope="col">A</th><th scope="col">B</th><th scope="col">B − A</th></tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${row.title}</th><td>${row.a}</td><td>${row.b}</td><td>${row.delta}</td></tr>`).join('')}</tbody></table></div>${warning?'<p>未対応効果・装備の読み込みエラーを含む構成があります。各構成を開いて「計算の確認事項」を確認してください。</p>':''}`;
  box.insertAdjacentHTML('beforeend',changesHtml({...clone(a.saved),request:request(a)},{...clone(b.saved),request:request(b)}));
  $('sim-isolate-run').hidden=false;
  comparisonSource=validateComparison({version:1,a:clone(a.saved),b:clone(b.saved),enemy,prices:{version:1,budget:book.budget,entries:[{id:'a',amount:priceA?.amount??null,currency:priceA?.currency||book.budget.currency},{id:'b',amount:priceB?.amount??null,currency:priceB?.currency||book.budget.currency}]}});
  clearComparisonCard();$('sim-compare-export').hidden=false;
  trackSim('simulator_plan_compare',{count:2});
 }finally{$('sim-compare-plans').disabled=false;}
}
async function createComparisonCard(){
 if(!comparisonSnapshot)throw Error('先にA/B比較を行ってください。');
 const snapshot=clone(comparisonSnapshot),token=workspaceSequence,cardToken=++cardSequence,version=generation;
 $('sim-card-status').textContent='比較画像を作っています…';
 try{
  if(document.fonts?.ready)await document.fonts.ready;
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1280;const ctx=canvas.getContext('2d');if(!ctx)throw Error('画像を作れません。ブラウザを更新してお試しください。');
  drawComparisonCard(ctx,snapshot,$('sim-card-names').checked);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('画像を書き出せませんでした。');
  if(token!==workspaceSequence||cardToken!==cardSequence||version!==generation)return;
  clearComparisonCard();cardUrl=URL.createObjectURL(blob);$('sim-card-image').src=cardUrl;$('sim-card-download').href=cardUrl;$('sim-card-preview').hidden=false;
  $('sim-card-status').textContent='画像を確認して「PNGを保存」を押してください。';trackSim('simulator_comparison_image');
 }catch(error){$('sim-card-status').textContent='画像を作れませんでした。';throw error;}
}
async function handleWorkspaceClick(target){
 if(target.id==='sim-card-create'){await createComparisonCard();return true;}
 if(target.id==='sim-price-save'){savePrices();return true;}
 if(target.dataset.improveSlot){selectedSlot=target.dataset.improveSlot;setTab('items');renderSlots();openItemEditor();setEquipmentMode('rare');return true;}
 if(target.id==='sim-plan-create'||target.id==='sim-plan-update'){
  if(!namedPlans)throw Error('元の構成一覧を読み込めません。上書きは行いません。');
  const id=target.id==='sim-plan-update'?$('sim-plan-select').value:null;
  const next=putNamedPlan(namedPlans,selectedPreset.id,$('sim-plan-name').value,capturePlan(),{id});
  writeNamedPlans(next,id||next.at(-1).id);$('sim-plan-status').textContent=target.id==='sim-plan-update'?'選択した構成を更新しました。':'名前付きで保存しました。自動保存もそのまま使えます。';trackSim('simulator_named_save',{action:id?'update':'create',count:next.length});return true;
 }
 if(target.id==='sim-plan-load'){
  const item=namedPlans?.find(p=>p.id===$('sim-plan-select').value);if(!item)throw Error('構成を選んでください。');
  if(await applyWorkspaceSave(item.saved))$('sim-plan-status').textContent=`「${item.name}」を読み込みました。名前付きの保存は更新するまで変わりません。`;return true;
 }
 if(target.id==='sim-plan-delete'){
  const item=namedPlans?.find(p=>p.id===$('sim-plan-select').value);if(!item)throw Error('構成を選んでください。');deletePlanId=item.id;
  $('sim-plan-delete-message').textContent=`「${item.name}」を名前付きの一覧から削除します。今開いている構成は変わりません。`;$('sim-plan-delete-confirm').hidden=false;return true;
 }
 if(target.id==='sim-plan-delete-cancel'){deletePlanId=null;$('sim-plan-delete-confirm').hidden=true;return true;}
 if(target.id==='sim-plan-delete-apply'){
  const item=namedPlans?.find(p=>p.id===deletePlanId);if(!item)throw Error('削除する構成を確認し直してください。');
  localStorage.setItem(`poe2-simulator:deleted-plan:${selectedPreset.id}`,JSON.stringify({version:1,plans:[item]}));
  writeNamedPlans(namedPlans.filter(p=>p.id!==item.id));deletePlanId=null;$('sim-plan-delete-confirm').hidden=true;$('sim-plan-status').textContent='一覧から削除しました。「削除した構成を戻す」で復元できます。';return true;
 }
 if(target.id==='sim-plan-delete-undo'){
  if(!namedPlans||!deletedPlan)throw Error('復元する構成が見つかりません。');if(namedPlans.some(p=>p.id===deletedPlan.id))throw Error('この構成は一覧に存在します。');
  writeNamedPlans([...namedPlans,deletedPlan],deletedPlan.id);localStorage.removeItem(`poe2-simulator:deleted-plan:${selectedPreset.id}`);deletedPlan=null;$('sim-plan-delete-undo').hidden=true;$('sim-plan-status').textContent='削除した構成を復元しました。';return true;
 }
 if(target.id==='sim-compare-plans'){await compareNamedPlans();return true;}
 if(target.id==='sim-example-preview'){await previewExample();return true;}
 if(target.id==='sim-example-apply'){
  const p=examplePreview;if(!p||p.version!==generation||p.edited!==editSequence)throw Error('構成が変更されました。もう一度「内容を見る」で確認してください。');
  if(await applyWorkspaceSave(p.saved)){$('sim-example-status').textContent='見本から試算を開始しました。切替前に戻すこともできます。';trackSim('simulator_example_apply',{example_id:p.example.id,kind:p.example.kind});}return true;
 }
 if(target.id==='sim-workspace-undo'){
  let backup=workspaceBackup;
  if(!backup)try{backup=JSON.parse(localStorage.getItem(`poe2-simulator:before-workspace:${selectedPreset.id}`));}catch{}
  if(!backup?.saved)throw Error('切替前の構成が見つかりません。');
  await applyWorkspaceSave(backup.saved,{restore:true,readOnly:backup.readOnly});return true;
 }
 return false;
}
function handleWorkspaceChange(target){
 if(target.id==='sim-card-names'){clearComparisonCard();$('sim-card-status').textContent='表示内容が変わりました。比較画像を作り直してください。';return true;}
 if(target.closest('#sim-price-panel')){priceDirty=true;invalidateComparison();$('sim-price-status').textContent='未保存の変更があります。予定額と予算を保存してから比較してください。';return true;}
 if(target.id==='sim-plan-select'){
  const selected=namedPlans?.find(p=>p.id===target.value);if(selected)$('sim-plan-name').value=selected.name;
  deletePlanId=null;$('sim-plan-delete-confirm').hidden=true;return true;
 }
 if(target.id==='sim-example-select'){setExampleConditions();return true;}
 if(['sim-example-level','sim-example-weapon'].includes(target.id)){examplePreview=null;++workspaceSequence;$('sim-example-apply').hidden=true;$('sim-example-status').textContent='試算条件が変わりました。「内容を見る」で再確認してください。';return true;}
 if(['sim-compare-a','sim-compare-b','sim-compare-enemy'].includes(target.id)){invalidateComparison();return true;}
 return false;
}
function renderStageHandoff(){
 const params=new URLSearchParams(location.search),n=Number(params.get('level'));
 if(sharedReadOnly||params.get('from')!=='guide'||!Number.isInteger(n)||n<1||n>100)return;
 const stage=levelingStage(selectedPreset,n);if(!stage)return;incomingLevel=n;
 try{const previous=localStorage.getItem(`poe2-simulator:before-stage:${selectedPreset.id}`);if(previous){const saved=parseSave(previous);stageBackup={request:saved.request,questPoints:saved.questPoints,notes:saved.notes,equipmentDrafts:saved.equipmentDrafts || {},weaponSets:saved.weaponSets || null,origin:saved.origin || null};$('sim-stage-undo').hidden=false;}}catch{}
 $('sim-stage-title').textContent=`記事から引き継ぎ：Lv${n} / ${stage.label}`;
 $('sim-stage-description').innerHTML=`<p><b>主力の案内：</b>${esc(stage.mainSkill)}</p><details><summary>この段階の装備・パッシブ・切替条件</summary>${[['サポート',stage.supports],['装備',stage.gearPriority],['パッシブ',stage.passivePriority],['切替条件',stage.transitionCondition],['注意',stage.caution]].map(([title,value])=>`<p><b>${title}：</b>${esc(value)}</p>`).join('')}</details>`;
 const candidates=stageSkillCandidates(stage,catalog.gems,names);
 $('sim-stage-skill').innerHTML=candidates.map(g=>`<option value="${esc(g.skill_id)}">${esc(label(g.name))}</option>`).join('')||'<option value="">現在の主力スキルから調整</option>';
 $('sim-stage-panel').hidden=false;$('sim-stage-status').textContent='今の保存を残して、新しい試作へ切り替えられます。パッシブは取得済み0から始めます。';
}
function applyStageHandoff(){
 if(!incomingLevel)return;
 stageBackup=clone(plan);
 try{localStorage.setItem(`poe2-simulator:before-stage:${selectedPreset.id}`,JSON.stringify(makeSave(selectedPreset.id,plan.request,plan.questPoints,plan.notes,plan.equipmentDrafts || {},plan.weaponSets || null,plan.origin || null)));}catch{throw Error('切替前の保存ができません。先に保存ファイルを書き出してください。');}
 const request=newPlan(selectedPreset,catalog.gems);request.character.level=incomingLevel;
 const id=$('sim-stage-skill').value;if(id)request.socket_groups=[{enabled:true,main_active_skill:1,gems:[{skill_id:id,level:1,quality:0}]}];
 plan={request,questPoints:0,notes:''};baseline=null;selectedNode=null;queuedNodes.clear();preview=null;renderInputs();loadTemplate();commit();$('sim-stage-undo').hidden=false;$('sim-stage-status').textContent=`Lv${incomingLevel}の新しい試作に切り替えました。装備・サポート・ジェムLvを手持ちに合わせて設定してください。`;trackSim('simulator_stage_apply',{level:incomingLevel});
}
function saveSharedPlan(){
 try{const key=`poe2-simulator:v1:${selectedPreset.id}`,previous=localStorage.getItem(key);if(previous)localStorage.setItem(`poe2-simulator:before-share:${selectedPreset.id}`,previous);sharedReadOnly=false;if(!save({track:true})){sharedReadOnly=true;return false;}$('sim-shared-panel').hidden=true;return true;}catch(error){showError(error);return false;}
}
async function createShareLink(){
 const value=await encodePlanLink(makeSave(selectedPreset.id,plan.request,plan.questPoints,'',plan.equipmentDrafts || {},plan.weaponSets || null,plan.origin || null));
 const url=new URL('/simulator/',location.origin);url.searchParams.set('build',selectedPreset.id);url.hash='plan='+value;
 $('sim-share-url').value=url.href;$('sim-share-panel').hidden=false;$('sim-share-status').textContent='別の端末でこのURLを開くと、同じ構成を確認できます。';$('sim-share-url').focus();trackSim('simulator_share_create');
}
const targetValue=()=>Math.min(100,Math.max(-100,Number($('sim-resist-target').value)||0));
function auditRequirements(request){
 const items=(request.items || []).map(item=>({slot:item.slot,requirements:itemRequirements(item.text,equipmentCatalog)})).filter(item=>Object.values(item.requirements).some(n=>n>0));
 return items.length?rpc('equipment-audit',{request,items}):Promise.resolve([]);
}
function warningsHtml(next,requirements,request=plan.request){
 const gaps=resistanceGaps(next,targetValue());
 const advice=upgradeAdvice(next,requirements,targetValue(),request);
 const actions=advice.length?`<h4>次に確認すること</h4><ol class="sim-upgrade-actions">${advice.map(a=>`<li><b>${esc(a.title)}</b><p>${esc(a.detail)}</p>${a.slot?`<button type="button" data-improve-slot="${esc(a.slot)}">${esc(slots.find(s=>s[0]===a.slot)?.[1]||'装備')}の候補を作る</button>`:''} <a href="${esc(a.href)}">${esc(a.link)}</a></li>`).join('')}</ol>`:'<p>設定した耐性目標と通常の装備条件を満たしています。次は装備交換による火力・耐久の変化を比較してください。</p>';
 return `<h4>目標との不足・装備条件</h4>${gaps.length?`<ul>${gaps.map(g=>`<li>${g.label}：${number(g.value,g.id)}。目標${targetValue()}%まで${g.missing}ポイント不足</li>`).join('')}</ul>`:'<p>設定した耐性の目標を満たしています。</p>'}${requirements.length?`<ul>${requirements.map(v=>`<li>${esc(slots.find(s=>s[0]===v.slot)?.[1] || v.slot)}：${esc(v.message)}</li>`).join('')}</ul>`:'<p>データで確認できる通常の装備条件に不足は見つかりませんでした。</p>'}${next.item_errors?.length?'<p>読み込めない装備があります。計算の確認事項も見てください。</p>':''}${actions}`;
}
async function updateBuildWarnings(next,request){
 const token=++auditSequence,version=generation;
 $('sim-build-warnings').textContent='装備条件を確認中…';
 try{const requirements=await auditRequirements(clone(request));if(token!==auditSequence||version!==generation)return;$('sim-build-warnings').innerHTML=warningsHtml(next,requirements,request);}
 catch{if(token===auditSequence)$('sim-build-warnings').textContent='装備条件を確認できませんでした。ゲーム内表示を確認してください。';}
}
async function previewEquipment(){
 const version=generation,edited=editSequence,slot=selectedSlot,draftVersion=equipmentDraftVersion;
 let text;if(equipmentMode==='rare'){readRareDraft();text=buildRareItem(rareDraft,slot,equipmentCatalog);}else text=restoreItemText($('sim-item-text').value,names,itemSource).trim();
 if(!text||text.length>100000)throw Error('比較する装備を入力してください。');
 const request=clone(plan.request),key=utility(slot)?'flasks':'items';request[key]=(request[key] || []).filter(i=>i.slot!==slot);request[key].push({slot,text,...(utility(slot)?{active:true}:{})});
 const panel=$('sim-item-preview-result');panel.hidden=false;panel.textContent='今の構成を残したまま比較しています…';
 const next=await rpc('calculate',request),requirements=await auditRequirements(request);
 if(version!==generation||edited!==editSequence||slot!==selectedSlot||draftVersion!==equipmentDraftVersion)return;
 if(next.item_errors?.some(e=>e.slot===slot))throw Error('この装備を読み込めません。テキストを確認してください。');
 panel.innerHTML=`<h4>交換する前の比較（まだ反映していません）</h4><dl class="sim-difference">${statistics.filter(([id])=>!['SpiritUnreserved'].includes(id)).map(([id,title])=>{const old=statValue(result,id),value=statValue(next,id),delta=old!==null&&value!==null?value-old:null;return `<div><dt>${title}</dt><dd>${number(old,id)} → ${number(value,id)}${delta!==null?` <b class="${delta<0?'negative':''}">(${delta>0?'+':''}${number(delta,id)})</b>`:''}</dd></div>`;}).join('')}</dl>${warningsHtml(next,requirements,request)}<p>比較結果を確認してから「この装備を反映」を押してください。</p>`;
 trackSim('simulator_compare_preview',{slot});
}
function download(){const blob=new Blob([JSON.stringify(makeSave(selectedPreset.id,plan.request,plan.questPoints,plan.notes,plan.equipmentDrafts || {},plan.weaponSets || null,plan.origin || null),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`poe2-${selectedPreset.id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
// All inputs stay on this origin; no character or code upload is performed.
document.addEventListener('click',async event=>{
 const target=event.target.closest('button,a');if(!target)return;
 try{
  if(target.id==='menu-button'){const open=$('site-nav').classList.toggle('is-open');target.setAttribute('aria-expanded',String(open));return;}
  if(target.dataset.preset){event.preventDefault();await selectPreset(target.dataset.preset);return;}
  if(target.id==='sim-change-build'){save();showChooser();return;}
  if(target.id==='sim-engine-retry'){await retryEngine();return;}
  if(!plan)return;
  if(target.id==='sim-candidate-save'){await saveEquipmentCandidate();return;}
  if(target.id==='sim-compare-share'){await shareComparison();return;}
  if(target.id==='sim-compare-share-copy'){await copyComparison();return;}
  if(target.id==='sim-mobile-more'){document.querySelector('.sim-results').scrollIntoView({block:'start'});return;}
  if(target.dataset.mobileDetail){$('sim-breakdown-panel').open=true;$('sim-breakdown-stat').value=target.dataset.mobileDetail;await showBreakdown();$('sim-breakdown-panel').scrollIntoView({block:'start'});return;}
  if(target.id==='sim-imported-a'||target.id==='sim-imported-b'){if(incomingComparison&&await applyWorkspaceSave(incomingComparison[target.id.endsWith('-a')?'a':'b'],{readOnly:true,history:true}))rememberEdit();return;}
  if(['sim-history-undo','sim-tree-history-undo','sim-history-redo','sim-tree-history-redo'].includes(target.id)){await replayEdit(target.id.endsWith('undo')?'undo':'redo');return;}
  if(target.id==='sim-breakdown-show'){await showBreakdown();return;}
  if(target.id==='sim-card-create'||target.id==='sim-price-save'||target.dataset.improveSlot||/^sim-(plan-|compare-plans$|example-|workspace-undo$)/.test(target.id)){await handleWorkspaceClick(target);return;}
  if(target.dataset.tab){setTab(target.dataset.tab);if(target.dataset.tab==='tree'&&window.matchMedia?.('(max-width: 720px)').matches)openTreeEditor();return;}
  if(target.dataset.treeAction){$('sim-tree-'+target.dataset.treeAction).click();return;}
  if(target.id==='sim-tree-hide-settings'){$('sim-tree-settings').open=false;return;}
  if(target.id==='sim-tree-hide-node'){$('sim-node-inspector').open=false;return;}
  if(target.id==='sim-tree-open'){openTreeEditor();return;}
  if(target.id==='sim-tree-close'){await closeTreeEditor();return;}
  if(target.id==='sim-tree-error-close'){clearError();return;}
  if(target.dataset.weaponSet){plan=selectWeaponSet(plan,+target.dataset.weaponSet);selectedSlot='weapon1';commit();renderSlots();if(!$('sim-item-editor').hidden)openItemEditor();return;}
  if(target.id==='sim-passives-reset'){
   passiveResetBackup={allocated_nodes:clone(plan.request.allocated_nodes || []),attribute_choices:clone(plan.request.attribute_choices || {}),weapon_swap:clone(plan.request.weapon_swap || null),level:plan.request.character.level,questPoints:plan.questPoints};
   plan.request.allocated_nodes=[];plan.request.attribute_choices={};if(plan.request.weapon_swap)plan.request.weapon_swap.exclusive_nodes=[[],[]];selectedNode=null;preview=null;queuedNodes.clear();commit();renderTreeState();renderNodeCatalog();$('sim-passives-undo').hidden=false;$('sim-node-detail').innerHTML='<h4>取得済み0から始めます</h4><p>参考ルートは目安です。自分でノードを選び、取得経路を確認して反映してください。</p>';return;
  }
  if(target.id==='sim-passives-undo'&&passiveResetBackup){plan.request.allocated_nodes=passiveResetBackup.allocated_nodes;plan.request.attribute_choices=passiveResetBackup.attribute_choices;plan.request.character.level=passiveResetBackup.level ?? plan.request.character.level;plan.questPoints=passiveResetBackup.questPoints ?? plan.questPoints;if(passiveResetBackup.weapon_swap)plan.request.weapon_swap=passiveResetBackup.weapon_swap;passiveResetBackup=null;$('sim-passives-undo').hidden=true;renderInputs();commit();renderTreeState();renderNodeCatalog();$('sim-node-detail').innerHTML='<h4>取得状態を戻しました</h4><p>ノードを選ぶと能力と取得状態を確認できます。</p>';return;}
  if(target.dataset.slot){selectedSlot=target.dataset.slot;renderSlots();openItemEditor();return;}
  if(target.id==='sim-item-back'){closeItemEditor();return;}
  if(target.dataset.equipmentMode){setEquipmentMode(target.dataset.equipmentMode);return;}
  if(target.id==='sim-rare-add'){readRareDraft();if(rareDraft.modifiers.length>=10)throw Error('オプションは10行まで追加できます。');const def=equipmentCatalog.modifiers.find(m=>!rareDraft.modifiers.some(x=>x.id===m.id));rareDraft.modifiers.push({id:def.id,values:[...def.default]});renderRareModifiers();return;}
  if(target.dataset.rareRemove!==undefined){readRareDraft();rareDraft.modifiers.splice(+target.dataset.rareRemove,1);renderRareModifiers();return;}
  if(target.id==='sim-item-show-stats'){$('sim-stats').scrollIntoView({block:'start',behavior:'instant'});return;}
  if(target.id==='sim-unique-draft'){const value=$('sim-unique').value;if(!value)return;const drafted=await rpc('unique',{id:+value,roll:+$('sim-roll').value});itemSource=drafted.text;$('sim-item-text').value=localizeItemText(itemSource,names);return;}
  if(target.id==='sim-item-preview'){await previewEquipment();return;}
  if(target.id==='sim-item-apply'||target.id==='sim-item-remove'){
   let text='';
   if(target.id==='sim-item-apply'){
    if(equipmentMode==='rare'){readRareDraft();text=buildRareItem(rareDraft,selectedSlot,equipmentCatalog);}
    else text=restoreItemText($('sim-item-text').value,names,itemSource).trim();
    if(text.length>100000)throw Error('装備テキストが長すぎます。');
   }
   const list=itemList(),index=list.findIndex(i=>i.slot===selectedSlot);if(index>=0)list.splice(index,1);
   plan.equipmentDrafts ||= {};
   if(text){list.push({slot:selectedSlot,text,...(utility(selectedSlot)?{active:true}:{})});if(equipmentMode==='rare')plan.equipmentDrafts[selectedSlot]=clone(rareDraft);else delete plan.equipmentDrafts[selectedSlot];}
   else delete plan.equipmentDrafts[selectedSlot];
   trackSim('simulator_equipment_apply',{action:target.id==='sim-item-remove'?'remove':'apply',slot:selectedSlot});commit();renderSlots();$('sim-rare-dirty').textContent='変更を反映して再計算しています…';return;
  }
  if(target.dataset.removeGroup!==undefined){plan.request.socket_groups.splice(+target.dataset.removeGroup,1);plan.request.main_socket_group=Math.max(0,Math.min(plan.request.main_socket_group || 0,plan.request.socket_groups.length-1));renderSkills();commit();return;}
  if(target.dataset.removeGem!==undefined){const group=plan.request.socket_groups[+target.closest('[data-group]').dataset.group];group.gems.splice(+target.dataset.removeGem,1);renderSkills();commit();return;}
  if(target.dataset.addSupport!==undefined){const group=plan.request.socket_groups[+target.dataset.addSupport];if(group.gems.length>=6)throw Error('この画面では1組につき主力1個＋サポート5個まで追加できます。');group.gems.push({skill_id:catalog.gems.find(g=>g.is_support).skill_id,level:1,quality:0});renderSkills();commit();return;}
  if(target.id==='sim-add-group'){if(plan.request.socket_groups.length>=20)throw Error('スキル組は20個までです。');plan.request.socket_groups.push({enabled:true,main_active_skill:1,gems:[{skill_id:catalog.gems.find(g=>!g.is_support&&g.name==='Spark').skill_id,level:1,quality:0}]});renderSkills();commit();return;}
  if(target.id==='sim-template-import'){await previewTemplateImport();return;}
  if(target.id==='sim-template-import-cancel'){++templateImportSequence;templateImport=null;$('sim-template-import-preview').replaceChildren();return;}
  if(target.id==='sim-template-import-apply'&&templateImport){if(templateImport.version!==generation||templateImport.edited!==editSequence)throw Error('構成が変更されました。もう一度反映内容を確認してください。');passiveResetBackup={allocated_nodes:clone(plan.request.allocated_nodes || []),attribute_choices:clone(plan.request.attribute_choices || {}),weapon_swap:clone(plan.request.weapon_swap || null),level:plan.request.character.level,questPoints:plan.questPoints};plan.request=templateImport.request;plan.questPoints=templateImport.points;templateImport=null;selectedNode=null;preview=null;queuedNodes.clear();$('sim-template-import-preview').textContent='参考ツリーを反映して保存しました。';$('sim-passives-undo').hidden=false;renderInputs();commit();renderTreeState();renderNodeCatalog();return;}
  if(target.id==='sim-template-focus'){focusTemplate();return;}
  if(target.id==='sim-template-next'){const id=templateRoute?.steps[templateStep].nodes.find(id=>!plan.request.allocated_nodes?.includes(id));if(id!==undefined){const node=treeNodes.get(id);view.x=node.x;view.y=node.y;view.w=2600;view.h=2000;updateView();nodeDetail(id);}return;}
  if(target.dataset.nodeResult){nodeDetail(+target.dataset.nodeResult,{select:true});const n=treeNodes.get(+target.dataset.nodeResult);view.x=n.x;view.y=n.y;view.w=4000;view.h=3000;updateView();return;}
  if(target.id==='sim-node-preview'||target.id==='sim-selection-preview'){await previewNode();return;}
  if(target.id==='sim-selection-details'){$('sim-node-inspector').open=true;return;}
  if(target.id==='sim-selection-clear'){queuedNodes.clear();preview=null;++editSequence;if(selectedNode!==null)nodeDetail(selectedNode,{reveal:false});else renderTreeState();return;}
  if(target.dataset.selectionRemove){changeQueuedNode(+target.dataset.selectionRemove,false);return;}
  if(target.id==='sim-node-apply'&&preview?.valid){plan.request=preview.request;const id=selectedNode;queuedNodes.clear();commit();nodeDetail(id,{reveal:false});renderNodeCatalog();return;}
  if(target.id==='sim-node-prev'||target.id==='sim-node-next'){nodePage+=target.id==='sim-node-next'?1:-1;renderNodeCatalog();return;}
  if(target.id==='sim-tree-overview'){fitTree();return;}
  if(target.id==='sim-tree-reference'){if(templateRoute)focusTemplate();else $('sim-tree-settings').open=true;return;}
  if(target.id==='sim-tree-center'){centerTree();return;}
  if(target.id==='sim-tree-ascendancy'){const cls=catalog.meta.classes.find(c=>c.name===plan.request.character.class_name),asc=cls?.ascendancies?.find(a=>a.name===plan.request.character.ascendancy_name),node=currentTree.find(n=>n.kind==='ascendancy_start'&&n.ascendancy_id===asc?.id);if(node){view.x=node.x;view.y=node.y;view.w=4200;updateView();}else throw Error('この構成のアセンダンシー開始点が見つかりません。');return;}
  if(['sim-tree-plus','sim-tree-minus'].includes(target.id)){const factor=target.id==='sim-tree-plus'?.7:1.4;view.w=Math.max(800,Math.min(60000,view.w*factor));view.h=view.w*.76;updateView();return;}
  if(target.id==='sim-baseline'){if(result){baseline=Object.fromEntries(statistics.map(([id])=>[id,statValue(result,id)]));renderResults();$('sim-status').textContent='比較の基準を設定しました。以降の変更との差分を表示します。';}return;}
  if(target.id==='sim-config-add'){const def=equipmentCatalog.modifiers.find(m=>m.id===$('sim-config-modifier').value);if(def){const area=$('sim-extra-mods');area.value=[area.value.trim(),modifierJapanese(def,def.default)].filter(Boolean).join('\n');area.focus();}return;}
  if(target.id==='sim-config-apply'){const modifiers=parseJapaneseModifiers($('sim-extra-mods').value,equipmentCatalog,names,plan.request.extra_modifiers || []);plan.request.enemy_tier=$('sim-enemy').value;plan.request.config_inputs ||= {};plan.request.config_inputs['questInterlude 2Khari CrossingMolten Shrine']=$('sim-life-reward').checked;plan.request.extra_modifiers=modifiers;$('sim-extra-mods').value=localizeModifiers(modifiers,equipmentCatalog,names);commit();return;}
  if(target.id==='sim-stage-apply'){applyStageHandoff();return;}
  if(target.id==='sim-stage-cancel'){$('sim-stage-panel').hidden=true;return;}
  if(target.id==='sim-stage-undo'&&stageBackup){plan=stageBackup;stageBackup=null;$('sim-stage-undo').hidden=true;renderInputs();loadTemplate();commit();$('sim-stage-status').textContent='切替前の構成に戻しました。';return;}
  if(target.id==='sim-shared-save'){if(!saveSharedPlan())return;return;}
  if(target.id==='sim-share'){await createShareLink();return;}
  if(target.id==='sim-share-copy'){try{await navigator.clipboard.writeText($('sim-share-url').value);$('sim-share-status').textContent='URLをコピーしました。';trackSim('simulator_share_copy');}catch{$('sim-share-url').focus();$('sim-share-url').select();$('sim-share-status').textContent='URLを選択しました。長押し、またはコピー操作でコピーしてください。';}return;}
  if(target.id==='sim-share-close'){$('sim-share-panel').hidden=true;return;}
  if(target.id==='sim-download'){download();trackSim('simulator_save',{method:'file'});}
 }catch(error){showError(error);}
});
document.addEventListener('change',async event=>{
 const target=event.target;
 if(target.id==='sim-class-filter'){for(const card of document.querySelectorAll('[data-preset]'))card.hidden=!!target.value&&presets.find(p=>p.id===card.dataset.preset).class!==target.value;return;}
 if(!plan)return;
 try{
  if(target.id==='sim-breakdown-stat'){invalidateBreakdown();return;}
  if(target.id==='sim-notes'){commit();return;}
  if(handleWorkspaceChange(target))return;
  if(target.id==='sim-resist-target'){const value=Number(target.value);if(!Number.isFinite(value)||value< -100||value>100){target.value='75';throw Error('耐性の比較目標は−100〜100で入力してください。');}if(result)void updateBuildWarnings(result,plan.request);return;}
  if(target.closest('#sim-item-editor')){equipmentDraftVersion++;$('sim-item-preview-result').hidden=true;}
  if(target.id==='sim-rare-base'||target.id==='sim-rare-level'||target.id==='sim-rare-quality'||target.id==='sim-rare-name'||target.dataset.rareValue!==undefined){readRareDraft();$('sim-rare-dirty').textContent='未反映の変更があります。';return;}
  if(target.id==='sim-template-stage'||target.id==='sim-template-visible'){templateStep=Number($('sim-template-stage').value);templateVisible=$('sim-template-visible').checked;updateTemplate();focusTemplate();return;}
  if(target.id==='sim-node-filter'){nodePage=0;renderNodeCatalog();return;}
  if(target.dataset.rareMod!==undefined){readRareDraft();const row=rareDraft.modifiers[+target.dataset.rareMod],def=equipmentCatalog.modifiers.find(m=>m.id===target.value);row.id=def.id;row.values=[...def.default];renderRareModifiers();return;}
  if(target.id==='sim-level'||target.id==='sim-tree-level'){const n=Number(target.value);if(!target.value.trim()||!Number.isInteger(n)||n<1||n>100){target.value=plan.request.character.level;throw Error('Lvは1〜100で入力してください。');}setPassiveBudget(n,plan.questPoints);}
  if(target.id==='sim-quest-points'){const n=Number(target.value);if(!target.value.trim()||!Number.isInteger(n)||n<0||n>24){target.value=plan.questPoints;throw Error('報酬ポイントは0〜24で入力してください。');}setPassiveBudget(plan.request.character.level,n);}
  if(target.dataset.main!==undefined){plan.request.main_socket_group=+target.dataset.main;commit();}
  if(target.dataset.enabled!==undefined){plan.request.socket_groups[+target.dataset.enabled].enabled=target.checked;commit();}
  if(target.dataset.gemField){const group=plan.request.socket_groups[+target.closest('[data-group]').dataset.group],gem=group.gems[+target.closest('[data-gem]').dataset.gem],key=target.dataset.gemField;if(key==='skill_id'){gem.skill_id=target.value;delete gem.minion;delete gem.minion_skill;delete gem.stat_set_index;renderSkills();}else{const n=Number(target.value),max=key==='level'?40:30,min=key==='level'?1:0;if(!Number.isInteger(n)||n<min||n>max){target.value=gem[key];throw Error(`${key==='level'?'Lv':'品質'}は${min}〜${max}で入力してください。`);}gem[key]=n;}commit();}
  if(target.dataset.minion!==undefined){const group=plan.request.socket_groups[+target.closest('[data-group]').dataset.group];group.gems[+target.dataset.minion].minion=target.value || null;commit();}
  if(target.id==='sim-node-attribute'){plan.request.attribute_choices ||= {};plan.request.attribute_choices[selectedNode]=target.value;commit();nodeDetail(selectedNode,{reveal:false});renderNodeCatalog();}
  if(target.id==='sim-file'){
   const file=target.files[0];if(!file)return;if(file.size>2000000)throw Error('保存ファイルは2MBまでです。');const saved=parseSave(await file.text());
   if(saved.preset!==selectedPreset.id||saved.request.character.class_name!==selectedPreset.class)throw Error('この保存ファイルは別のビルドの構成です。対応するビルドを選んでから読み込んでください。');
   await applyWorkspaceSave(saved);target.value='';
  }
 }catch(error){showError(error);}
});
document.addEventListener('input',event=>{if(event.target.closest('#sim-price-panel')){priceDirty=true;invalidateComparison();$('sim-price-status').textContent='未保存の変更があります。予定額と予算を保存してから比較してください。';}if(event.target.closest('#sim-item-editor')){equipmentDraftVersion++;$('sim-item-preview-result').hidden=true;}});
let noteSaveTimer;
$('sim-notes').addEventListener('input',()=>{if(plan){plan.notes=$('sim-notes').value;clearTimeout(noteSaveTimer);noteSaveTimer=setTimeout(save,250);}});
window.addEventListener('pagehide',save);
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
$('sim-unique-search').addEventListener('input',()=>{if(catalog)renderUniques();});
$('sim-node-search').addEventListener('input',()=>{
 const q=$('sim-node-search').value.trim().toLowerCase();const found=[];if(q)for(const item of treeSearch){if(item.text.includes(q))found.push(item.node);if(found.length===25)break;}
 nodePage=0;renderNodeCatalog();$('sim-node-search-results').innerHTML=found.map(n=>`<button type="button" data-node-result="${n.skill}"><strong>${esc(label(n.name))}</strong><small>${esc(nodeStats(n).join(' / '))}</small></button>`).join('')+(q&&!found.length?'<p>一致するノードがありません。</p>':'');
});
let drag;
const treeSvg=$('sim-tree-svg'),treeMap=$('sim-tree-map'),treePointers=new Map();
const stopTreeGesture=event=>{if(event.cancelable)event.preventDefault();};
// Suppress only the browser's map-local gestures; page zoom outside stays available.
for(const type of ['touchstart','touchmove','gesturestart','gesturechange','gestureend'])treeMap.addEventListener(type,stopTreeGesture,{passive:false});
function treeWorldPoint(x,y,rect){return {x:view.x+(x-rect.left-rect.width/2)*view.w/Math.max(1,rect.width),y:view.y+(y-rect.top-rect.height/2)*view.h/Math.max(1,rect.height)};}
function beginTreePinch(){
 const [a,b]=[...treePointers.values()],rect=treeMap.getBoundingClientRect(),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
 drag={mode:'pinch',rect,distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),width:view.w,ratio:view.h/view.w,anchor:treeWorldPoint(mid.x,mid.y,rect),moved:true};
}
function zoomTreeAt(width,point,rect,anchor,ratio=view.h/view.w){
 view.w=Math.max(800,Math.min(60000,width));view.h=view.w*(rect.width>0&&rect.height>0?rect.height/rect.width:ratio);
 view.x=anchor.x-(point.x-rect.left-rect.width/2)*view.w/Math.max(1,rect.width);view.y=anchor.y-(point.y-rect.top-rect.height/2)*view.h/Math.max(1,rect.height);updateView();
}
treeSvg.addEventListener('pointerdown',event=>{
 if(event.button!==undefined&&event.button!==0)return;stopTreeGesture(event);
 if(treePointers.has(event.pointerId)||treePointers.size>=2)return;
 if(treeFullscreen&&$('sim-tree').classList.contains('sim-tree-mobile')){$('sim-tree-settings').open=false;$('sim-node-inspector').open=false;}
 treePointers.set(event.pointerId,{x:event.clientX,y:event.clientY});treeSvg.setPointerCapture?.(event.pointerId);
 if(treePointers.size===2){beginTreePinch();return;}
 let hit=event.target.closest('[data-node]')?.dataset.node;const rect=treeMap.getBoundingClientRect();
 if(!hit&&rect.width>0){let distance=20;for(const node of currentTree){if(!renderedNodes.has(node.skill))continue;const dx=(node.x-view.x)*rect.width/view.w+rect.width/2+rect.left-event.clientX,dy=(node.y-view.y)*rect.height/view.h+rect.height/2+rect.top-event.clientY,d=Math.hypot(dx,dy);if(d<distance){hit=node.skill;distance=d;}}}
 drag={mode:'pan',pointerId:event.pointerId,rect,x:event.clientX,y:event.clientY,vx:view.x,vy:view.y,moved:false,node:hit};
});
treeSvg.addEventListener('pointermove',event=>{
 if(!drag||!treePointers.has(event.pointerId))return;stopTreeGesture(event);treePointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
 if(drag.mode==='pinch'){
  const [a,b]=[...treePointers.values()];if(!a||!b)return;
  zoomTreeAt(drag.width*drag.distance/Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),{x:(a.x+b.x)/2,y:(a.y+b.y)/2},drag.rect,drag.anchor,drag.ratio);return;
 }
 const rect=drag.rect,dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.hypot(dx,dy)>6)drag.moved=true;if(!drag.moved)return;
 view.x=drag.vx-dx*view.w/Math.max(1,rect.width);view.y=drag.vy-dy*view.h/Math.max(1,rect.height);updateView();
});
function endTreePointer(event,cancelled=false){
 if(!treePointers.has(event.pointerId))return;stopTreeGesture(event);const gesture=drag;treePointers.delete(event.pointerId);
 if(treePointers.size){const [pointerId,point]=[...treePointers][0];drag={mode:'pan',pointerId,rect:treeMap.getBoundingClientRect(),x:point.x,y:point.y,vx:view.x,vy:view.y,moved:true};return;}
 drag=null;if(!cancelled&&gesture?.mode==='pan'&&!gesture.moved&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<=6&&gesture.node)nodeDetail(+gesture.node,{reveal:false,select:true,compact:treeFullscreen&&$('sim-tree').classList.contains('sim-tree-mobile')});
}
treeSvg.addEventListener('pointerup',event=>endTreePointer(event));
for(const type of ['pointercancel','lostpointercapture'])treeSvg.addEventListener(type,event=>endTreePointer(event,true));
window.addEventListener('blur',()=>{drag=null;treePointers.clear();});
treeSvg.addEventListener('wheel',event=>{event.preventDefault();event.stopPropagation();const rect=treeMap.getBoundingClientRect(),point={x:event.clientX,y:event.clientY};zoomTreeAt(view.w*(event.deltaY>0?1.12:.89),point,rect,treeWorldPoint(point.x,point.y,rect));},{passive:false});
async function openLocation(){
 const route=++locationSequence;
 try{
  const params=new URLSearchParams(location.search),value=location.hash.startsWith('#plan=')?location.hash.slice(6):null;
  const comparison=location.hash.startsWith('#compare=')?await decodeComparisonLink(location.hash.slice(9)):params.has('comparison')?validateComparison((exampleData.comparisons||[]).find(c=>c.id===params.get('comparison'))):null;
  if(route!==locationSequence)return;
  if(comparison){await openComparison(comparison,route,params.has('comparison'));}
  else if(value){const data=await decodePlanLink(value);const preset=presets.find(p=>p.id===data.preset);if(!preset||data.request.character.class_name!==preset.class)throw Error('共有URLのビルドを確認できません。');await selectPreset(preset.id,{fromHistory:true,shared:data});}
  else if(params.get('build'))await selectPreset(params.get('build'),{fromHistory:true});
  else{generation++;calculation++;$('sim-mobile-summary').hidden=true;$('sim-chooser').hidden=false;$('sim-workbench').hidden=true;}
 }catch(error){if(route!==locationSequence)return;$('sim-mobile-summary').hidden=true;$('sim-chooser').hidden=false;$('sim-workbench').hidden=true;$('sim-chooser').insertAdjacentHTML('beforeend',`<p role="alert">共有構成を開けませんでした。${esc(error.message)}</p>`);}
}
window.addEventListener('popstate',()=>{if(treeFullscreen){save();restoreTreeEditor();}void openLocation();});
renderResume();
window.addEventListener('storage',()=>{if(!$('sim-chooser').hidden)renderResume();});
void openLocation();

document.addEventListener('keydown',event=>{
 if(!plan||$('sim-workbench').hidden||event.altKey||!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='z'||event.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
 event.preventDefault();void replayEdit(event.shiftKey?'redo':'undo').catch(showError);
});

function initCandidateEditor(){
 let i=1,name;do{name=`${slots.find(s=>s[0]===selectedSlot)?.[1]||'装備'}交換候補 ${i++}`;}while(namedPlans?.some(p=>p.name===name));
 $('sim-candidate-name').value=name;$('sim-candidate-price').value='';$('sim-candidate-budget').value=priceBook?.budget.amount??'';$('sim-candidate-currency').value=priceBook?.budget.currency||'exalted';$('sim-candidate-status').textContent='価格は手入力です。相場の自動取得は行いません。';$('sim-candidate-save').disabled=false;
}
async function saveEquipmentCandidate(){
 if(candidateBusy)return;
 if(!namedPlans||$('sim-price-save').disabled)throw Error('保存構成または予定額を読み込めません。元のデータを確認してください。');
 if(priceDirty)throw Error('構成一覧の予定額と予算を先に保存してください。');
 if([...document.querySelectorAll('.sim-candidate-panel input[type=number]')].some(i=>i.validity.badInput))throw Error('予定額と予算を正しい数値で入力してください。');
 const price=priceAmount($('sim-candidate-price').value),budget=priceAmount($('sim-candidate-budget').value),currency=$('sim-candidate-currency').value,name=$('sim-candidate-name').value.trim();
 const version=generation,edited=editSequence,draft=equipmentDraftVersion,slot=selectedSlot,saved=clone(capturePlan());
 let text;if(equipmentMode==='rare'){readRareDraft();text=buildRareItem(rareDraft,slot,equipmentCatalog);saved.equipmentDrafts[slot]=clone(rareDraft);}else{text=restoreItemText($('sim-item-text').value,names,itemSource).trim();delete saved.equipmentDrafts[slot];}
 if(!text||text.length>100000)throw Error('比較する装備を入力してください。');
 const key=utility(slot)?'flasks':'items';saved.request[key]=[...(saved.request[key]||[]).filter(i=>i.slot!==slot),{slot,text,...(utility(slot)?{active:true}:{})}];
 saved.weaponSets=weaponSetState(saved.request,saved.equipmentDrafts,saved.weaponSets);
 const next=putNamedPlan(namedPlans,selectedPreset.id,name,saved),entry=next.at(-1);
 const nextPrices=clone(priceBook);nextPrices.budget={amount:budget,currency};nextPrices.entries=nextPrices.entries.filter(p=>p.id==='current'||next.some(n=>n.id===p.id));
 if(!nextPrices.entries.some(p=>p.id==='current'))nextPrices.entries.push({id:'current',amount:0,currency});
 nextPrices.entries.push({id:entry.id,amount:price,currency});parsePriceBook(JSON.stringify(nextPrices));
 candidateBusy=true;$('sim-candidate-save').disabled=true;$('sim-candidate-status').textContent='装備を計算して候補を保存しています…';
 try{
  const computed=await rpc('calculate',saved.request);
  if(version!==generation||edited!==editSequence||draft!==equipmentDraftVersion||slot!==selectedSlot){if(version===generation)$('sim-candidate-status').textContent='構成か編集欄が変わりました。候補を確認して、もう一度追加してください。';return;}
  if(computed.item_errors?.some(e=>e.slot===slot))throw Error('この装備は計算に読み込めません。編集欄を確認してください。');
  const nk=namedPlanKey(selectedPreset.id),pk=priceBookKey(selectedPreset.id),oldNamed=localStorage.getItem(nk),oldPrices=localStorage.getItem(pk);
  if(oldNamed!==namedStorageSnapshot||oldPrices!==priceStorageSnapshot)throw Error('別のタブで保存が変わりました。構成を開き直して最新の内容を確認してください。');
  const namedText=JSON.stringify({version:1,plans:next}),priceText=JSON.stringify(nextPrices);
  try{localStorage.setItem(nk,namedText);localStorage.setItem(pk,priceText);}catch(error){
   try{if(localStorage.getItem(nk)===namedText)oldNamed===null?localStorage.removeItem(nk):localStorage.setItem(nk,oldNamed);if(localStorage.getItem(pk)===priceText)oldPrices===null?localStorage.removeItem(pk):localStorage.setItem(pk,oldPrices);}catch{}
   throw Error('候補の保存を完了できませんでした。構成一覧と予定額を確認してください。');
  }
  renderWorkspace(entry.id);$('sim-plan-name').value=entry.name;$('sim-compare-a').value='current';$('sim-compare-b').value=entry.id;$('sim-compare-enemy').value=plan.request.enemy_tier||'none';$('sim-workspace').open=true;
  await compareNamedPlans();$('sim-candidate-status').textContent='比較候補を保存しました。今の装備・自動保存は変更していません。';$('sim-compare-result').scrollIntoView({block:'start'});trackSim('simulator_equipment_candidate',{slot});
 }finally{candidateBusy=false;$('sim-candidate-save').disabled=false;}
}
function renderMobileSummary(next,status=''){
 const box=$('sim-mobile-summary');if(!box)return;box.hidden=!plan||$('sim-workbench').hidden;if(box.hidden)return;
 if(next&&!summaryBaseline)summaryBaseline=Object.fromEntries(statistics.map(([id])=>[id,displayStat(next,id)]));
 const base=baseline||summaryBaseline||{};
 const cell=(id,title)=>{const value=next?displayStat(next,id):null,delta=value!==null&&base[id]!=null?value-base[id]:null;return `<button type="button" data-mobile-detail="${id}"><span>${title}</span><b>${number(value,id)}</b><small>${delta===null?'—':`${delta>0?'+':''}${number(delta,id)}`}</small></button>`;};
 $('sim-mobile-summary-status').textContent=status||(baseline?'指定した基準との差':'構成を開いた時との差');
 box.setAttribute('aria-busy',String(!next));
 $('sim-mobile-summary-values').innerHTML=cell('CombinedDPS','DPS')+cell('Life','ライフ')+`<button type="button" data-mobile-detail="FireResist"><span>火・冷・雷耐性</span><b class="sim-mobile-resists">${['FireResist','ColdResist','LightningResist'].map(id=>next?number(statValue(next,id),id):'—').join(' / ')}</b><small>${['FireResist','ColdResist','LightningResist'].map(id=>{const v=next?statValue(next,id):null,d=v!=null&&base[id]!=null?v-base[id]:null;return d===null?'—':`${d>0?'+':''}${number(d,id)}`;}).join(' / ')}</small></button>`;
}
function changesHtml(a,b){
 const changes=comparisonChanges(a,b),name=text=>text?label(itemName(text)):'未装備';
 const list=(items,render)=>items.length?`<ul>${items.slice(0,80).map(v=>`<li>${render(v)}</li>`).join('')}</ul>${items.length>80?`<p>ほか${items.length-80}件の変更があります。</p>`:''}`:'<p>変更なし</p>';
 const gem=g=>g?`${label(catalog.gems.find(x=>x.skill_id===g.skill_id)?.name||g.skill_id)} Lv${g.level} / 品質${g.quality||0}`:'なし';
 const node=id=>a.request.tree_version===b.request.tree_version&&treeNodes.get(id)?label(treeNodes.get(id).name)+`（${id}）`:`ノード ${id}`;
 return `<details class="sim-input-changes"><summary>装備・ジェム・パッシブの変更内容</summary><p>AからBへの主な設定変更です。共通の敵条件で比較しています。</p><h5>装備 ${changes.equipment.length}部位</h5>${list(changes.equipment,v=>`<b>${esc(slots.find(s=>s[0]===v.slot)?.[1]||v.slot)}</b>：${esc(name(v.before))} → ${esc(name(v.after))}<details><summary>装備テキストを見比べる</summary><div class="sim-input-pair"><section><h6>A</h6><pre>${esc(localizeItemText(v.before,names).slice(0,6000)||'未装備')}</pre></section><section><h6>B</h6><pre>${esc(localizeItemText(v.after,names).slice(0,6000)||'未装備')}</pre></section></div>${v.before.length>6000||v.after.length>6000?'<p>長い装備テキストは先頭6000文字を表示しています。</p>':''}</details>`)}<h5>ジェム ${changes.gems.length}件</h5>${list(changes.gems,v=>`グループ${v.group+1}・ジェム${v.index+1}：${esc(gem(v.before))} → ${esc(gem(v.after))}`)}<h5>パッシブ</h5><p>追加 ${changes.passives.added.length}点 / 解除 ${changes.passives.removed.length}点 / 能力値変更 ${changes.passives.attributes.length}点</p>${list([...changes.passives.added.map(id=>({id,action:'追加'})),...changes.passives.removed.map(id=>({id,action:'解除'}))],v=>`${v.action}：${esc(node(v.id))}`)}${list(changes.passives.attributes,v=>`${esc(node(v.id))}：${esc(({str:'筋力',dex:'器用さ',int:'知性'})[v.before])} → ${esc(({str:'筋力',dex:'器用さ',int:'知性'})[v.after])}`)}<h5>そのほかの条件</h5>${list(changes.conditions,v=>esc(v)+'が変わっています。')}</details>`;
}
function comparisonPriceBook(){
 const book=clone(priceBook);
 if(incomingComparison&&[$('sim-compare-a').value,$('sim-compare-b').value].some(id=>id.startsWith('shared-'))){book.budget=clone(incomingComparison.prices.budget);book.entries.push(...incomingComparison.prices.entries.map(p=>({...p,id:'shared-'+p.id})));}
 return book;
}
async function shareComparison(){
 if(!comparisonSource)throw Error('先にA/B比較を行ってください。');
 const source=clone(comparisonSource),token=workspaceSequence,version=generation,link=await encodeComparisonLink(source);
 if(token!==workspaceSequence||version!==generation)return;
 const url=new URL('/simulator/',location.origin);url.searchParams.set('build',source.a.preset);url.hash='compare='+link;
 $('sim-compare-share-url').value=url.href;$('sim-compare-share-panel').hidden=false;$('sim-compare-share-status').textContent='URLを知っている人は、2つの構成と同じ条件で比較できます。';trackSim('simulator_comparison_share');
}
async function copyComparison(){
 try{await navigator.clipboard.writeText($('sim-compare-share-url').value);$('sim-compare-share-status').textContent='比較URLをコピーしました。';}catch{$('sim-compare-share-url').focus();$('sim-compare-share-url').select();$('sim-compare-share-status').textContent='URLを選択しました。コピー操作でコピーしてください。';}
}
async function openComparison(data,route,isExample=false){
 data=validateComparison(data);const preset=presets.find(p=>p.id===data.a.preset);
 if(!preset||data.a.request.character.class_name!==preset.class)throw Error('比較するビルドを確認できません。');
 await selectPreset(preset.id,{fromHistory:true,shared:data.a});if(route!==locationSequence||!result||selectedPreset?.id!==preset.id)return;
 incomingComparison=clone(data);renderWorkspace();$('sim-workspace').open=true;$('sim-imported-comparison').hidden=false;$('sim-imported-title').textContent=isExample?'装備交換の計算例を確認中':'共有されたA/B比較を確認中';
 $('sim-compare-a').value='shared-a';$('sim-compare-b').value='shared-b';$('sim-compare-enemy').value=data.enemy;
 await compareNamedPlans();
}

let backupPreview=null,backupExpected=null;
function downloadJson(value,filename){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.addEventListener('click',event=>{
 const id=event.target.closest('button')?.id;
 try{
  if(id==='sim-backup-export'){
   const data=simulatorBackup(localStorage,presets);if(!data.entries.length)throw Error('このブラウザには保存した構成・価格がありません。');
   downloadJson(data,'poe2-all-builds-backup.json');$('sim-backup-status').textContent='保存済みの全ビルドを書き出しました。メモ・構成名も含むため、共有先に注意してください。';
  }
  if(id==='sim-backup-cancel'){backupPreview=null;$('sim-backup-preview').hidden=true;}
  if(id==='sim-backup-restore'){
   if(!backupPreview)throw Error('復元するファイルを選んでください。');
   restoreSimulatorBackup(localStorage,backupPreview,backupExpected);++generation;++calculation;plan=null;result=null;selectedPreset=null;editHistory=null;summaryBaseline=null;backupPreview=null;$('sim-backup-preview').hidden=true;renderResume();$('sim-backup-status').textContent='復元しました。保存した構成の一覧から続きが開けます。';
  }
 }catch(error){$('sim-backup-status').textContent=error.message;}
});
document.addEventListener('change',async event=>{
 if(event.target.id!=='sim-backup-file')return;
 backupPreview=null;$('sim-backup-preview').hidden=true;const file=event.target.files?.[0];event.target.value='';if(!file)return;
 try{
  if(file.size>20000000)throw Error('バックアップは20MB以内で選んでください。');
  const parsed=parseSimulatorBackup(await file.text(),presets);if(!parsed.entries.length)throw Error('復元する保存がありません。');
  backupPreview=parsed;backupExpected=new Map(parsed.entries.map(e=>[e.key,localStorage.getItem(e.key)]));
  const groups=presets.filter(p=>parsed.entries.some(e=>e.preset===p.id));
  $('sim-backup-content').innerHTML='<p>ファイルに含まれる保存欄を置き換えます。含まれない保存欄は保持します。</p><ul>'+groups.map(p=>{const entries=parsed.entries.filter(e=>e.preset===p.id),named=entries.find(e=>e.type==='named');return `<li>${esc(p.name)}：自動保存${entries.some(e=>e.type==='auto')?'あり':'なし'}、名前付き${named?parseNamedPlans(named.value,p.id).length:0}件、価格${entries.some(e=>e.type==='prices')?'あり':'なし'}（既存の保存欄${entries.filter(e=>backupExpected.get(e.key)!==null).length}件を置換）</li>`;}).join('')+'</ul>';
  $('sim-backup-preview').hidden=false;$('sim-backup-status').textContent='内容を確認してから復元してください。先に今のバックアップを書き出すと安心です。';
 }catch(error){$('sim-backup-status').textContent=error.message;}
});

function decisionTable(rows,caption){
 const ids=['CombinedDPS','Life','FireResist','ColdResist','LightningResist'];
 return `<div class="sim-table-scroll" tabindex="0" role="region" aria-label="${esc(caption)}"><table><caption>${esc(caption)}</caption><thead><tr><th scope="col">候補・変更</th>${ids.map(id=>`<th scope="col">${statistics.find(s=>s[0]===id)[1]}</th>`).join('')}<th scope="col">確認事項</th></tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${esc(row.name)}${row.cost?`<small class="sim-candidate-cost">${esc(row.cost)}</small>`:''}</th>${ids.map(id=>{const v=row.values[id],d=row.deltas?.[id];return `<td>${number(v,id)}${d!=null?`<small class="sim-candidate-delta">${d>0?'+':''}${number(d,id)}</small>`:''}</td>`;}).join('')}<td>${esc(row.warning||'報告なし')}</td></tr>`).join('')}</tbody></table></div>`;
}
function decisionValues(next,request){const values=Object.fromEntries(['CombinedDPS','Life','FireResist','ColdResist','LightningResist'].map(id=>[id,displayStat(next,id,request)]));values.resistance=['FireResist','ColdResist','LightningResist'].every(id=>values[id]!=null)?Math.min(values.FireResist,values.ColdResist,values.LightningResist):null;return values;}
function decisionWarnings(next){return [next.item_errors?.length?'装備エラーあり':'',next.unsupported_modifiers?.length?'未対応効果あり':'',next.tree_effects?.warnings?.length?'ツリー要確認':''].filter(Boolean).join('・');}
function decisionDeltas(values,base){return Object.fromEntries(Object.entries(values).map(([id,v])=>[id,v!=null&&base[id]!=null?v-base[id]:null]));}
function renderCandidateTable(){
 if(!candidateTable)return;
 const rows=candidateOrder(candidateTable.rows,$('sim-multi-sort').value,$('sim-multi-budget').checked,candidateTable.budget);
 $('sim-multi-result').innerHTML=`<p>予算：${esc(priceText(candidateTable.budget))}。共通の敵：${esc(candidateTable.enemy)}。差分は今の構成からの変化です。予定額は構成全体の手入力額です。</p>${rows.length?decisionTable(rows,'保存した候補の一覧比較'):'<p>条件に合う候補がありません。予算・予定額・通貨を確認してください。</p>'}<p>価格順は予算と同じ通貨のみを並べ、別通貨・未設定は末尾に表示します。未対応効果や装備エラーのある数値は参考値です。</p>`;
}
async function compareCandidates(){
 if(priceDirty)throw Error('予定額・予算を保存してから一覧比較してください。');
 if(!namedPlans)throw Error('保存した構成を読み込めません。');
 const token=decisionSequence,run=++multiSequence,version=generation,edited=editSequence,enemy=$('sim-compare-enemy').value,book=clone(priceBook),choices=[{id:'current',name:'今の構成',saved:capturePlan()},...clone(namedPlans)];
 candidateTable=null;$('sim-multi-result').textContent='候補を順番に計算しています…';$('sim-multi-run').disabled=true;
 try{
  const rows=[];let base;
  for(const [index,choice]of choices.entries()){
   const request={...clone(choice.saved.request),enemy_tier:enemy};let values={},warning='';
   try{const next=await rpc('calculate',request);values=decisionValues(next,request);warning=decisionWarnings(next);}catch{warning='計算できません';}
   if(token!==decisionSequence||run!==multiSequence||version!==generation||edited!==editSequence)return;
   if(index===0)base=values;
   const price=book.entries.find(p=>p.id===choice.id);
   rows.push({index,name:choice.name,values,deltas:decisionDeltas(values,base),warning,price,cost:priceText(price)+' · '+budgetVerdict(price,book.budget)});
  }
  candidateTable={rows,budget:book.budget,enemy:$('sim-compare-enemy').selectedOptions[0].textContent};renderCandidateTable();
 }finally{$('sim-multi-run').disabled=false;}
}
async function calculateIsolatedChanges(){
 if(!comparisonSource)throw Error('先にA/B比較を行ってください。');
 const source=clone(comparisonSource),token=decisionSequence,run=++isolateSequence,version=generation,scenarios=isolatedChanges(source.a,source.b),box=$('sim-isolate-result');
 box.textContent='Aを基準に、変更を1つずつ試算しています…';$('sim-isolate-run').disabled=true;
 try{
  const baseResult=await rpc('calculate',source.a.request),base=decisionValues(baseResult,source.a.request),rows=[{name:'構成A（すべての試算の基準）',values:base,warning:decisionWarnings(baseResult)}];
  for(const scenario of scenarios){
   let values={},warning='';try{const next=await rpc('calculate',scenario.request);values=decisionValues(next,scenario.request);warning=decisionWarnings(next);}catch{warning='この組み合わせは計算できません';}
   if(token!==decisionSequence||run!==isolateSequence||version!==generation)return;
   rows.push({name:scenario.kind==='equipment'?(slots.find(s=>s[0]===scenario.label)?.[1]||scenario.label)+'だけ交換':scenario.label,values,deltas:decisionDeltas(values,base),warning});
  }
  if(token!==decisionSequence||run!==isolateSequence||version!==generation)return;
  box.innerHTML=`<p>各行はAにその変更だけを入れた独立した試算です。相互作用があるため、差分を足してもBの結果にはなりません。必要能力値・接続条件はゲーム内でも確認してください。</p>${decisionTable(rows,'変更を1つずつ試した結果')}${scenarios.length?'':'<p>試算対象の設定差はありません。</p>'}`;
 }finally{$('sim-isolate-run').disabled=false;}
}
document.addEventListener('click',async event=>{
 const id=event.target.closest('button')?.id;if(!['sim-multi-run','sim-isolate-run'].includes(id))return;
 try{if(id==='sim-multi-run')await compareCandidates();else await calculateIsolatedChanges();}catch(error){showError(error);$(id==='sim-multi-run'?'sim-multi-result':'sim-isolate-result').textContent=error.message;}
});
document.addEventListener('change',event=>{if(['sim-multi-sort','sim-multi-budget'].includes(event.target.id))renderCandidateTable();});

function renderFirstGuide(){
 if(!plan)return;
 $('sim-first-build').textContent=selectedPreset.name+'を選択中。';
 $('sim-first-input').textContent=`装備${plan.request.items?.length||0}部位を設定中。実際の装備・ジェムLvに合わせて入力してください。`;
 $('sim-first-compare').textContent=namedPlans?.length?`保存した候補は${namedPlans.length}件。A/B比較か一覧比較で確認できます。`:'まだ比較候補はありません。交換案を候補として保存すると比較できます。';
}
document.addEventListener('click',event=>{
 const id=event.target.closest('button')?.id;if(!plan)return;
 if(id==='sim-first-item'){setTab('items');selectedSlot='ring1';renderSlots();openItemEditor();}
 if(id==='sim-first-gems'){setTab('skills');$('sim-skills').scrollIntoView({block:'start'});}
 if(id==='sim-first-compare-open'){$('sim-workspace').open=true;$('sim-workspace').scrollIntoView({block:'start'});}
});
