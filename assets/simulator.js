import {newPlan, parseSave, makeSave, statValue, treeEdges, localizeItemText, restoreItemText, rareBasesForSlot, buildRareItem, passiveDescriptions, applyTreeAllocation, modifierJapanese, localizeModifiers, parseJapaneseModifiers, passiveComparison, weaponSetState, selectWeaponSet, drawableTreeEdges, acquiredTreeState} from './simulator-model.js?v=2ac2d4f1c0';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const clone = value => structuredClone(value);
const [presets,localization,equipmentCatalog,routeCatalog] = await Promise.all(['/data/simulator-presets.json?v=5a1df9b8e3','/data/simulator-localization.json?v=3f5c9b399b','/data/simulator-equipment.json?v=0f1b3fa2e3','/data/simulator-routes.json?v=856fb198d8'].map(async url => {
 const r=await fetch(url);if(!r.ok)throw Error('ビルド一覧を読み込めません。再読み込みしてください。');return r.json();
})).catch(error=>{$('sim-chooser').insertAdjacentHTML('beforeend',`<p role="alert">${esc(error.message)}</p>`);throw error;});
const names=localization.names;
const label=name=>name==='Companion: {0}'?'コンパニオン（召喚対象を設定）':name==='Spectre: {0}'?'スペクター（召喚対象を設定）':names[name] || name;
const nodeStats=node=>passiveDescriptions(node,localization,plan?.request.attribute_choices || {},!plan?.request.tree_version||plan.request.tree_version==='0_5');
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
let allocatedState=new Set(),highlightState=new Set(),selectedState=null,treeSearch=[];
const elementNS='http://www.w3.org/2000/svg';
function setCurrentTree(nodes){
 if(currentTree===nodes)return;
 currentTree=nodes;treeNodes=new Map(nodes.map(n=>[n.skill,n]));treeConnections=drawableTreeEdges(nodes);
 treeSearch=nodes.map(n=>({node:n,text:`${n.skill} ${n.name} ${label(n.name)} ${nodeStats(n).join(' ')}`.toLowerCase()}));
 $('sim-tree-nodes').replaceChildren();$('sim-tree-edges').replaceChildren();renderedNodes.clear();renderedEdges.clear();
}

function rpc(action,payload) {
 return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});worker.postMessage({id,action,payload});});
}
function engine() {
 if(bootPromise)return bootPromise;
 if(!window.Worker || !window.DecompressionStream || !window.WebAssembly) return Promise.reject(Error('このブラウザは計算機能に対応していません。最新のSafari・Chrome・Edgeをご利用ください。'));
 worker=new Worker(new URL('./simulator-worker.js?v=e8cca230da',import.meta.url),{type:'module'});
 worker.onmessage=({data})=>{if(data.progress){$('sim-status').textContent=data.progress;return;}const task=pending.get(data.id);if(!task)return;pending.delete(data.id);data.error?task.reject(Error(data.error)):task.resolve(data.result);};
 worker.onerror=()=>{for(const task of pending.values())task.reject(Error('計算処理を続けられません。ページを再読み込みしてください。'));pending.clear();};
 bootPromise=rpc('boot').then(data=>{catalog=data;return data;});return bootPromise;
}
function showError(error){const message=error.message || String(error);$('sim-error').textContent=message;$('sim-error').hidden=false;$('sim-tree-error-message').textContent=message;$('sim-tree-error').hidden=!treeFullscreen;}
function clearError(){$('sim-error').hidden=true;$('sim-error').textContent='';$('sim-tree-error').hidden=true;$('sim-tree-error-message').textContent='';}
function save() {
 if(!plan)return;
 try{localStorage.setItem(`poe2-simulator:v1:${selectedPreset.id}`,JSON.stringify(makeSave(selectedPreset.id,plan.request,plan.questPoints,plan.notes,plan.equipmentDrafts || {},plan.weaponSets || null)));$('sim-save-status').textContent='この端末に保存済み';$('sim-tree-save-state').textContent='この端末に保存済み';return true;}
 catch{$('sim-save-status').textContent='端末保存ができません。保存ファイルを使ってください。';$('sim-tree-save-state').textContent=$('sim-save-status').textContent;return false;}
}
let calculating=false,queuedCalculation=null;
function recalculate() {
 if(!plan)return Promise.resolve();
 const token=++calculation,version=generation;
 clearError();$('sim-tree-save-state').textContent='再計算しています…';$('sim-item-result').setAttribute('aria-busy','true');$('sim-stats').setAttribute('aria-busy','true');$('sim-baseline').disabled=true;$('sim-status').textContent='変更を再計算しています…';
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
  }catch(error){if(job.token===calculation&&job.version===generation){result=null;$('sim-tree-live-stats').textContent='この構成は計算できません。';$('sim-tree-save-state').textContent='計算に失敗しました。構成の設定を確認してください。';$('sim-stats').innerHTML='<p>この構成は計算できません。</p>';showError(error);}}
  finally{if(job.token===calculation&&job.version===generation){$('sim-item-result').setAttribute('aria-busy','false');$('sim-stats').setAttribute('aria-busy','false');$('sim-baseline').disabled=!result;}job.resolve();}
 }}finally{calculating=false;}
}
function commit(){++editSequence;preview=null;save();void recalculate();}
const statistics=[['CombinedDPS','選択スキルのDPS'],['Life','最大ライフ'],['EnergyShield','エナジーシールド'],['Mana','最大マナ'],['Armour','アーマー'],['Evasion','回避力'],['SpiritUnreserved','未予約スピリット'],['FireResist','火耐性'],['ColdResist','冷気耐性'],['LightningResist','雷耐性'],['ChaosResist','混沌耐性'],['Str','筋力'],['Dex','器用さ'],['Int','知性']];
const integerFormat=new Intl.NumberFormat('ja-JP',{maximumFractionDigits:0}),decimalFormat=new Intl.NumberFormat('ja-JP',{maximumFractionDigits:1});
function number(value,id){if(value===null||!Number.isFinite(value))return'—';return (id.includes('DPS')?decimalFormat:integerFormat).format(value)+(/Resist/.test(id)?'%':'');}
function unsupportedLabel(value){
 const text=String(value),match=/^Tree:(\d+):\s*(.*)$/.exec(text),node=match&&treeNodes.get(+match[1]);if(node){const index=node.stats.indexOf(match[2]);return `${label(node.name)}：${index>=0?(nodeStats(node)[index] || '一部の効果は計算未対応です。'):'一部の効果は計算未対応です。'}`;}
 return localizeModifiers([text],equipmentCatalog,names);
}
function renderResults(){
 const hasSkill=!!result.main_skill;
 $('sim-stats').innerHTML=statistics.map(([id,title],i)=>{
  let value=statValue(result,id);if(i===0&&!hasSkill)value=null;
  const old=baseline?.[id],delta=old!==null&&old!==undefined&&value!==null?value-old:null;
  return `<div class="sim-stat${i===0?' primary':''}"><span>${title}</span><div><b>${number(value,id)}</b>${delta!==null?`<small class="${delta<0?'negative':''}">${delta>0?'+':''}${number(delta,id)}</small>`:''}</div></div>`;
 }).join('');
 const starts=new Set(Object.values(result.tree_effects?.class_starts || {})),normalPoints=(plan.request.allocated_nodes || []).filter(id=>!starts.has(id)&&!treeNodes.get(id)?.ascendancy_id).length;
 const diagnostics=[...(normalPoints>plan.request.character.level-1+plan.questPoints?['選択した通常パッシブが現在Lvと報酬ポイントの上限を超えています。']:[]),...(result.unsupported_modifiers || []).map(v=>`未対応の効果：${unsupportedLabel(v)}`),...(result.item_errors || []).map(v=>`装備を計算から除外：${slots.find(s=>s[0]===v.slot)?.[1] || '装備'}。装備データの形式を確認してください。`),...(result.tree_effects?.warnings || []),...(plan.request.allocated_nodes || []).filter(id=>{const n=treeNodes.get(id);return n&&!n.stats.length&&n.kind==='notable';}).map(id=>`${label(treeNodes.get(id).name)}：対応データに効果の定義がありません。個別の能力は計算に含まれません。`)];
 $('sim-diagnostic-count').textContent=`（${diagnostics.length}件）`;
 $('sim-diagnostic-body').innerHTML=`<p>${hasSkill?'選択したスキルと現在の計算条件の結果です。':'計算対象のダメージスキルがありません。スキルと必要な武器・召喚対象を設定してください。'}</p>${diagnostics.length?`<p>以下の効果は数値に含まれない場合があります。</p><ul>${diagnostics.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:'<p>エンジンから未対応効果・装備エラーの報告はありません。全機構の再現を保証する判定ではありません。</p>'}`;
 $('sim-diagnostics').open=diagnostics.length>0;
 $('sim-engine-version').textContent=`対応データ ${result.provenance?.data_version || catalog.runtime.dataVersion}`;
 renderItemResult();$('sim-tree-live-stats').textContent=['Life','Armour','Evasion','CombinedDPS'].map(id=>`${statistics.find(s=>s[0]===id)[1]} ${number(statValue(result,id),id)}`).join(' · ');
 $('sim-character-name').textContent=`${label(plan.request.character.class_name)} / ${label(plan.request.character.ascendancy_name)} · 装備・パッシブは自分の設定`;
}
async function selectPreset(id,{fromHistory=false}={}){
 if(treeFullscreen){save();restoreTreeEditor();}
 const preset=presets.find(p=>p.id===id);if(!preset){showChooser();return;}
 const version=++generation;++calculation;selectedPreset=preset;passiveResetBackup=null;$('sim-passives-undo').hidden=true;plan=null;result=null;baseline=null;preview=null;selectedNode=null;
 $('sim-chooser').hidden=true;$('sim-workbench').hidden=false;$('sim-build-name').textContent=preset.name;$('sim-guide-link').href=preset.path;
 $('sim-status').textContent='計算画面を準備しています…';clearError();$('sim-item-editor').hidden=true;$('sim-item-list').hidden=false;
 $('sim-stats').innerHTML='<p>準備中…</p>';
 for(const element of $('sim-workbench').querySelectorAll('button,input,select,textarea'))if(element.id!=='sim-change-build')element.disabled=true;
 if(!fromHistory){const u=new URL(location.href);u.searchParams.set('build',id);history.pushState({},'',u.pathname+u.search);}
 try{
  await engine();if(version!==generation)return;
  let recoveryError;
  try{const saved=localStorage.getItem(`poe2-simulator:v1:${id}`);if(saved){const data=parseSave(saved);plan={request:data.request,questPoints:data.questPoints || 0,notes:data.notes || '',equipmentDrafts:data.equipmentDrafts || {},weaponSets:data.weaponSets || null};}}
  catch(error){recoveryError=Error('前回の保存を読み込めませんでした。新しい試作を表示しています。以前の保存ファイルがあれば「保存を読み込む」で復元できます。');}
  plan ||= {request:newPlan(preset,catalog.gems),questPoints:0,notes:''};
  const nodes=!plan.request.tree_version||plan.request.tree_version==='0_5'?catalog.tree:await rpc('tree',plan.request.tree_version);if(version!==generation)return;setCurrentTree(nodes);loadTemplate();
  for(const element of $('sim-workbench').querySelectorAll('button,input,select,textarea'))element.disabled=false;
  renderInputs();await recalculate();if(version!==generation)return;renderTree();
  if(recoveryError)showError(recoveryError);else save();
 }catch(error){if(version===generation)showError(error);}
}
function showChooser(){if(treeFullscreen){save();restoreTreeEditor();}generation++;calculation++;$('sim-chooser').hidden=false;$('sim-workbench').hidden=true;const u=new URL(location.href);u.searchParams.delete('build');history.pushState({},'',u.pathname+u.search);$('sim-chooser').scrollIntoView({block:'start'});}
function renderInputs(){
 $('sim-level').value=plan.request.character.level;$('sim-tree-level').value=plan.request.character.level;
 $('sim-enemy').value=plan.request.enemy_tier || 'none';
 $('sim-life-reward').checked=!!plan.request.config_inputs?.['questInterlude 2Khari CrossingMolten Shrine'];
 $('sim-extra-mods').value=localizeModifiers(plan.request.extra_modifiers || [],equipmentCatalog,names);$('sim-config-modifier').innerHTML=equipmentCatalog.modifiers.map(m=>`<option value="${m.id}">${esc(m.label)}</option>`).join('');$('sim-notes').value=plan.notes;
 $('sim-quest-points').value=plan.questPoints;
 renderSlots();renderSkills();setTab(activeTab);
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
 editorBaseline=result?Object.fromEntries(statistics.map(([id])=>[id,statValue(result,id)])):null;
 $('sim-item-list').hidden=true;$('sim-item-editor').hidden=false;
 const bases=rareBasesForSlot(selectedSlot,equipmentCatalog),saved=plan.equipmentDrafts?.[selectedSlot];
 rareDraft=saved&&bases.some(b=>b.id===saved.baseId)?clone(saved):{baseId:bases[0]?.id || '',name:`自作の${slots.find(s=>s[0]===selectedSlot)?.[1] || '装備'}`,level:80,quality:20,modifiers:[]};
 renderRareEditor();setEquipmentMode(saved&&bases.length?'rare':'unique');renderItemResult();
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
 $('sim-item-result-values').innerHTML='<dl>'+ids.map(id=>{const value=statValue(result,id),old=editorBaseline?.[id],delta=value!==null&&old!==undefined&&old!==null?value-old:null;return `<div><dt>${statistics.find(s=>s[0]===id)[1]}</dt><dd>${number(value,id)}${delta?`<small>${delta>0?'+':''}${number(delta,id)}</small>`:''}</dd></div>`;}).join('')+'</dl>';
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
 if(!gemOptionCache.has(support))gemOptionCache.set(support, `<option value="">${support?'サポート':'スキル'}を選ぶ</option>`+catalog.gems.filter(g=>g.is_support===support).map(g=>`<option value="${esc(g.skill_id)}">${esc(label(g.name))}</option>`).join(''));
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
 if(selected&&!catalog.gems.some(g=>g.skill_id===selected)&&old)target.prepend(old);
 target.value=selected;target.dataset.optionsLoaded='true';
}
document.addEventListener('focusin',event=>expandGemOptions(event.target));
document.addEventListener('pointerdown',event=>expandGemOptions(event.target));
function renderSkills(){
 $('sim-skill-groups').innerHTML=(plan.request.socket_groups || []).map((group,index)=>`<section class="sim-gem-group" data-group="${index}"><div class="sim-gem-group-head"><label class="sim-check"><input type="radio" name="main-skill" data-main="${index}"${(plan.request.main_socket_group || 0)===index?' checked':''}>計算する主力</label><button type="button" data-remove-group="${index}" aria-label="スキル組${index+1}を削除">組を削除</button></div>${group.gems.map((gem,j)=>{
 const entry=catalog.gems.find(g=>g.skill_id===gem.skill_id);const support=entry?.is_support || false;
 const summoner=catalog.minions.summoners.find(s=>s.skill_id===gem.skill_id);const monsters=summoner?catalog.minions.monsters.filter(m=>!m.name.startsWith('[DNT]')&&summoner.minion_ids.includes(m.id)):[];
 return `<div class="sim-gem-row" data-gem="${j}"><label>${support?'サポート':'スキル'}<select data-gem-field="skill_id" data-support="${support}">${!entry?`<option value="${esc(gem.skill_id)}">${esc(label(gem.name_spec || gem.skill_id))}（未解決）</option>`:''}${gemOptions(support,gem.skill_id)}</select></label><label>Lv<input data-gem-field="level" type="number" min="1" max="40" value="${gem.level}"></label><label>品質<input data-gem-field="quality" type="number" min="0" max="30" value="${gem.quality}"></label><button type="button" data-remove-gem="${j}" aria-label="ジェム${j+1}を削除">×</button></div>${monsters.length?`<label>召喚する対象<select data-minion="${j}"><option value="">対象を選ぶ</option>${monsters.map(m=>`<option value="${esc(m.id)}"${gem.minion===m.id?' selected':''}>${esc(label(m.name))}</option>`).join('')}</select></label>`:''}`;
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
function nodeClasses(id){const node=treeNodes.get(id);return [node.kind,startState.has(id)?'start':'',allocatedState.has(id)?'allocated':'',highlightState.has(id)?'preview':'',selectedState===id?'selected':'',templateVisible&&templateNodes.has(id)?'template':''].filter(Boolean).join(' ');}
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
 const changed=new Set([...allocatedState,...allocated,...startState,...starts].filter(id=>allocatedState.has(id)!==allocated.has(id)||startState.has(id)!==starts.has(id)));
 const nodeChanges=new Set([...changed,...[...highlightState,...highlight].filter(id=>highlightState.has(id)!==highlight.has(id)),selectedState,selectedNode]);
 allocatedState=allocated;startState=starts;highlightState=highlight;selectedState=selectedNode;
 for(const id of nodeChanges){const node=renderedNodes.get(id);if(node)node.setAttribute('class',nodeClasses(id));}
 if(changed.size)for(const line of renderedEdges.values()){const a=+line.dataset.from,b=+line.dataset.to;if(changed.has(a)||changed.has(b))line.classList.toggle('allocated',isOwnedEdge(a,b));}
 const chosen=[...allocated],used=chosen.filter(id=>!treeNodes.get(id)?.ascendancy_id).length,limit=plan.request.character.level-1+plan.questPoints;$('sim-tree-budget-summary').textContent=`通常ポイント ${used} / ${limit} · ${used>limit?`${used-limit}ポイント超過しています。レベル・報酬ポイントを確認するか、ノードを外してください。`:`あと${limit-used}ポイント取得できます。`}`;$('sim-tree-budget-summary').classList.toggle('sim-budget-over',used>limit);$('sim-passives-reset').disabled=chosen.length===0;$('sim-point-count').textContent=`取得済み ${chosen.length}ノード · 通常 ${chosen.filter(id=>!treeNodes.get(id)?.ascendancy_id).length} / ${plan.request.character.level-1+plan.questPoints}pt · アセンダンシー ${chosen.filter(id=>treeNodes.get(id)?.ascendancy_id).length}ノード`;renderTemplateSummary();
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
 templateImport={request,points,edited,version};const changes=[['Life','最大ライフ'],['Armour','アーマー'],['Evasion','回避力'],['CombinedDPS','DPS']].map(([key,name])=>`${name}：${number(statValue(result,key),key)} → ${number(statValue(next,key),key)}`).join('<br>');
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
function nodeDetail(id,{reveal=true}={}){
 $('sim-node-inspector').open=true;if(treeFullscreen)$('sim-tree-settings').open=false;
 selectedNode=id;preview=null;++editSequence;const node=treeNodes.get(id);if(!node)return;
 const allocated=isAllocatedNode(node),start=Object.values(result?.tree_effects?.class_starts || {}).includes(id)||node.kind==='ascendancy_start',decorative=node.kind==='mastery';
 $('sim-node-detail').innerHTML=`<h4 tabindex="-1">${esc(label(node.name))}</h4><p>${passiveKind(node)} · ${start?'開始点（取得数に含めません）':allocated?'取得済み':'未取得'}${node.ascendancy_id?' · アセンダンシー':''}</p><ul>${nodeStats(node).map(s=>`<li>${esc(s)}</li>`).join('')}</ul>${node.name==='Attribute'?`<label>このノードの能力値<select id="sim-node-attribute"><option value="str">筋力 +5</option><option value="dex">器用さ +5</option><option value="int">知性 +5</option></select></label>`:''}${!start&&!decorative?`<div class="sim-actions"><button type="button" id="sim-node-preview" class="sim-primary">${allocated?'外す範囲と変化を確認':'取得経路と変化を確認'}</button></div>`:''}<div id="sim-node-preview-result" aria-live="polite"></div>`;
 if($('sim-node-attribute'))$('sim-node-attribute').value=plan.request.attribute_choices?.[id] || 'str';renderTreeState();
 if(reveal&&!treeFullscreen){$('sim-node-detail').querySelector('h4').focus({preventScroll:true});$('sim-node-detail').scrollIntoView({block:'nearest',behavior:'instant'});}
}
async function previewNode(){
 const id=selectedNode,version=generation,token=++editSequence,source=clone(plan.request);
 $('sim-node-preview-result').textContent='経路と能力の変化を計算しています…';
 try{
 const action=source.allocated_nodes?.includes(id)?'refund':'allocate',next=await rpc('edit',{request:source,node:id,mode:0,action,quest_points:plan.questPoints});
 if(id!==selectedNode||version!==generation||token!==editSequence)return;
 if(!next.valid){$('sim-node-preview-result').innerHTML='<p role="status">この変更は適用できません。接続経路・職業・通常／アセンダンシーのポイント上限を確認してください。</p>';return;}
 const request=applyTreeAllocation(source,next.result.allocation),calculated=await rpc('calculate',request);
 if(id!==selectedNode||version!==generation||token!==editSequence)return;
 preview={...next,request};
 const changed=[...next.result.added,...next.result.removed],delta=statistics.map(([key,title])=>{const before=statValue(result,key),after=statValue(calculated,key);return before!==null&&after!==null&&Math.abs(after-before)>.00001?`<li>${title}：${number(before,key)} → ${number(after,key)}（${after>before?'+':''}${number(after-before,key)}）</li>`:'';}).join('');
 const unresolved=changed.filter(n=>{const node=treeNodes.get(n);return node&&!node.stats.length&&!['mastery','ascendancy_start','jewel_socket'].includes(node.kind);});
 $('sim-node-preview-result').innerHTML=`<p>追加 ${next.result.added.length}ノード / 解除 ${next.result.removed.length}ノード<br>通常ポイント ${next.result.points_used} / ${next.result.points_max}</p><h5>反映後のステータス</h5>${delta?`<ul>${delta}</ul>`:'<p>表示中の数値に変化はありません。条件付き効果や必要な装備・スキルも確認してください。</p>'}${unresolved.length?'<p role="status">効果の定義がないノードを含みます。その個別効果は計算に含まれません。</p>':''}${calculated.unsupported_modifiers?.length?'<p role="status">未対応の効果があります。詳細は計算の確認事項を確認してください。</p>':''}<details><summary>変更される全ノードの能力</summary>${changed.map(n=>{const node=treeNodes.get(n);return node?`<h5>${next.result.added.includes(n)?'＋':'−'} ${esc(label(node.name))}</h5><ul>${nodeStats(node).map(line=>`<li>${esc(line)}</li>`).join('')}</ul>`:'';}).join('')}</details><button type="button" id="sim-node-apply" class="sim-primary">この変更を反映</button>`;renderTreeState();
 }catch(error){if(token===editSequence){$('sim-node-preview-result').textContent='変更を計算できませんでした。';showError(error);}}
}

function download(){const blob=new Blob([JSON.stringify(makeSave(selectedPreset.id,plan.request,plan.questPoints,plan.notes,plan.equipmentDrafts || {},plan.weaponSets || null),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`poe2-${selectedPreset.id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
// All inputs stay on this origin; no character or code upload is performed.
document.addEventListener('click',async event=>{
 const target=event.target.closest('button,a');if(!target)return;
 try{
  if(target.id==='menu-button'){const open=$('site-nav').classList.toggle('is-open');target.setAttribute('aria-expanded',String(open));return;}
  if(target.dataset.preset){event.preventDefault();await selectPreset(target.dataset.preset);return;}
  if(target.id==='sim-change-build'){save();showChooser();return;}
  if(!plan)return;
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
   plan.request.allocated_nodes=[];plan.request.attribute_choices={};if(plan.request.weapon_swap)plan.request.weapon_swap.exclusive_nodes=[[],[]];selectedNode=null;preview=null;commit();renderTreeState();renderNodeCatalog();$('sim-passives-undo').hidden=false;$('sim-node-detail').innerHTML='<h4>取得済み0から始めます</h4><p>参考ルートは目安です。自分でノードを選び、取得経路を確認して反映してください。</p>';return;
  }
  if(target.id==='sim-passives-undo'&&passiveResetBackup){plan.request.allocated_nodes=passiveResetBackup.allocated_nodes;plan.request.attribute_choices=passiveResetBackup.attribute_choices;plan.request.character.level=passiveResetBackup.level ?? plan.request.character.level;plan.questPoints=passiveResetBackup.questPoints ?? plan.questPoints;if(passiveResetBackup.weapon_swap)plan.request.weapon_swap=passiveResetBackup.weapon_swap;passiveResetBackup=null;$('sim-passives-undo').hidden=true;renderInputs();commit();renderTreeState();renderNodeCatalog();$('sim-node-detail').innerHTML='<h4>取得状態を戻しました</h4><p>ノードを選ぶと能力と取得状態を確認できます。</p>';return;}
  if(target.dataset.slot){selectedSlot=target.dataset.slot;renderSlots();openItemEditor();return;}
  if(target.id==='sim-item-back'){closeItemEditor();return;}
  if(target.dataset.equipmentMode){setEquipmentMode(target.dataset.equipmentMode);return;}
  if(target.id==='sim-rare-add'){readRareDraft();if(rareDraft.modifiers.length>=10)throw Error('オプションは10行まで追加できます。');const def=equipmentCatalog.modifiers.find(m=>!rareDraft.modifiers.some(x=>x.id===m.id));rareDraft.modifiers.push({id:def.id,values:[...def.default]});renderRareModifiers();return;}
  if(target.dataset.rareRemove!==undefined){readRareDraft();rareDraft.modifiers.splice(+target.dataset.rareRemove,1);renderRareModifiers();return;}
  if(target.id==='sim-item-show-stats'){$('sim-stats').scrollIntoView({block:'start',behavior:'instant'});return;}
  if(target.id==='sim-unique-draft'){const value=$('sim-unique').value;if(!value)return;const drafted=await rpc('unique',{id:+value,roll:+$('sim-roll').value});itemSource=drafted.text;$('sim-item-text').value=localizeItemText(itemSource,names);return;}
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
   commit();renderSlots();$('sim-rare-dirty').textContent='変更を反映して再計算しています…';return;
  }
  if(target.dataset.removeGroup!==undefined){plan.request.socket_groups.splice(+target.dataset.removeGroup,1);plan.request.main_socket_group=Math.max(0,Math.min(plan.request.main_socket_group || 0,plan.request.socket_groups.length-1));renderSkills();commit();return;}
  if(target.dataset.removeGem!==undefined){const group=plan.request.socket_groups[+target.closest('[data-group]').dataset.group];group.gems.splice(+target.dataset.removeGem,1);renderSkills();commit();return;}
  if(target.dataset.addSupport!==undefined){const group=plan.request.socket_groups[+target.dataset.addSupport];if(group.gems.length>=6)throw Error('この画面では1組につき主力1個＋サポート5個まで追加できます。');group.gems.push({skill_id:catalog.gems.find(g=>g.is_support).skill_id,level:1,quality:0});renderSkills();commit();return;}
  if(target.id==='sim-add-group'){if(plan.request.socket_groups.length>=20)throw Error('スキル組は20個までです。');plan.request.socket_groups.push({enabled:true,main_active_skill:1,gems:[{skill_id:catalog.gems.find(g=>!g.is_support&&g.name==='Spark').skill_id,level:1,quality:0}]});renderSkills();commit();return;}
  if(target.id==='sim-template-import'){await previewTemplateImport();return;}
  if(target.id==='sim-template-import-cancel'){++templateImportSequence;templateImport=null;$('sim-template-import-preview').replaceChildren();return;}
  if(target.id==='sim-template-import-apply'&&templateImport){if(templateImport.version!==generation||templateImport.edited!==editSequence)throw Error('構成が変更されました。もう一度反映内容を確認してください。');passiveResetBackup={allocated_nodes:clone(plan.request.allocated_nodes || []),attribute_choices:clone(plan.request.attribute_choices || {}),weapon_swap:clone(plan.request.weapon_swap || null),level:plan.request.character.level,questPoints:plan.questPoints};plan.request=templateImport.request;plan.questPoints=templateImport.points;templateImport=null;selectedNode=null;preview=null;$('sim-template-import-preview').textContent='参考ツリーを反映して保存しました。';$('sim-passives-undo').hidden=false;renderInputs();commit();renderTreeState();renderNodeCatalog();return;}
  if(target.id==='sim-template-focus'){focusTemplate();return;}
  if(target.id==='sim-template-next'){const id=templateRoute?.steps[templateStep].nodes.find(id=>!plan.request.allocated_nodes?.includes(id));if(id!==undefined){const node=treeNodes.get(id);view.x=node.x;view.y=node.y;view.w=2600;view.h=2000;updateView();nodeDetail(id);}return;}
  if(target.dataset.nodeResult){nodeDetail(+target.dataset.nodeResult);const n=treeNodes.get(+target.dataset.nodeResult);view.x=n.x;view.y=n.y;view.w=4000;view.h=3000;updateView();return;}
  if(target.id==='sim-node-preview'){await previewNode();return;}
  if(target.id==='sim-node-apply'&&preview?.valid){plan.request=preview.request;const id=selectedNode;commit();nodeDetail(id,{reveal:false});renderNodeCatalog();return;}
  if(target.id==='sim-node-prev'||target.id==='sim-node-next'){nodePage+=target.id==='sim-node-next'?1:-1;renderNodeCatalog();return;}
  if(target.id==='sim-tree-overview'){fitTree();return;}
  if(target.id==='sim-tree-reference'){if(templateRoute)focusTemplate();else $('sim-tree-settings').open=true;return;}
  if(target.id==='sim-tree-center'){centerTree();return;}
  if(target.id==='sim-tree-ascendancy'){const cls=catalog.meta.classes.find(c=>c.name===plan.request.character.class_name),asc=cls?.ascendancies?.find(a=>a.name===plan.request.character.ascendancy_name),node=currentTree.find(n=>n.kind==='ascendancy_start'&&n.ascendancy_id===asc?.id);if(node){view.x=node.x;view.y=node.y;view.w=4200;updateView();}else throw Error('この構成のアセンダンシー開始点が見つかりません。');return;}
  if(['sim-tree-plus','sim-tree-minus'].includes(target.id)){const factor=target.id==='sim-tree-plus'?.7:1.4;view.w=Math.max(800,Math.min(60000,view.w*factor));view.h=view.w*.76;updateView();return;}
  if(target.id==='sim-baseline'){if(result){baseline=Object.fromEntries(statistics.map(([id])=>[id,statValue(result,id)]));renderResults();$('sim-status').textContent='比較の基準を設定しました。以降の変更との差分を表示します。';}return;}
  if(target.id==='sim-config-add'){const def=equipmentCatalog.modifiers.find(m=>m.id===$('sim-config-modifier').value);if(def){const area=$('sim-extra-mods');area.value=[area.value.trim(),modifierJapanese(def,def.default)].filter(Boolean).join('\n');area.focus();}return;}
  if(target.id==='sim-config-apply'){const modifiers=parseJapaneseModifiers($('sim-extra-mods').value,equipmentCatalog,names,plan.request.extra_modifiers || []);plan.request.enemy_tier=$('sim-enemy').value;plan.request.config_inputs ||= {};plan.request.config_inputs['questInterlude 2Khari CrossingMolten Shrine']=$('sim-life-reward').checked;plan.request.extra_modifiers=modifiers;$('sim-extra-mods').value=localizeModifiers(modifiers,equipmentCatalog,names);commit();return;}
  if(target.id==='sim-download')download();
 }catch(error){showError(error);}
});
document.addEventListener('change',async event=>{
 const target=event.target;
 if(target.id==='sim-class-filter'){for(const card of document.querySelectorAll('[data-preset]'))card.hidden=!!target.value&&presets.find(p=>p.id===card.dataset.preset).class!==target.value;return;}
 if(!plan)return;
 try{
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
   const next=await rpc('calculate',saved.request),nodes=await rpc('tree',saved.request.tree_version || null);
   plan={request:saved.request,questPoints:saved.questPoints || 0,notes:saved.notes || '',equipmentDrafts:saved.equipmentDrafts || {},weaponSets:saved.weaponSets || null};passiveResetBackup=null;$('sim-passives-undo').hidden=true;setCurrentTree(nodes);loadTemplate();result=next;baseline=null;selectedNode=null;preview=null;renderInputs();renderTree();renderResults();closeItemEditor();save();target.value='';
  }
 }catch(error){showError(error);}
});
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
 drag=null;if(!cancelled&&gesture?.mode==='pan'&&!gesture.moved&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<=6&&gesture.node)nodeDetail(+gesture.node,{reveal:false});
}
treeSvg.addEventListener('pointerup',event=>endTreePointer(event));
for(const type of ['pointercancel','lostpointercapture'])treeSvg.addEventListener(type,event=>endTreePointer(event,true));
window.addEventListener('blur',()=>{drag=null;treePointers.clear();});
treeSvg.addEventListener('wheel',event=>{event.preventDefault();event.stopPropagation();const rect=treeMap.getBoundingClientRect(),point={x:event.clientX,y:event.clientY};zoomTreeAt(view.w*(event.deltaY>0?1.12:.89),point,rect,treeWorldPoint(point.x,point.y,rect));},{passive:false});
window.addEventListener('popstate',()=>{if(treeFullscreen){save();restoreTreeEditor();}const id=new URLSearchParams(location.search).get('build');if(id)void selectPreset(id,{fromHistory:true});else{generation++;calculation++;$('sim-chooser').hidden=false;$('sim-workbench').hidden=true;}});
const initial=new URLSearchParams(location.search).get('build');if(initial)void selectPreset(initial,{fromHistory:true});

window.addEventListener('resize',()=>{if(activeTab==='tree')updateView();});

document.addEventListener('keydown',event=>{if(!treeFullscreen)return;if(event.key==='Escape'){event.preventDefault();void closeTreeEditor();}else if(event.key==='Tab'){const targets=[...$('sim-tree').querySelectorAll('button,input,select,textarea,summary,[tabindex="0"]')].filter(e=>!e.disabled&&e.getClientRects().length);if(!targets.length)return;const first=targets[0],last=targets.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});

$('sim-tree-settings').addEventListener('toggle',()=>{if(treeFullscreen&&$('sim-tree-settings').open)$('sim-node-inspector').open=false;});
