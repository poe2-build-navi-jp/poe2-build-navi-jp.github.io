import {newPlan, parseSave, makeSave, statValue, treeEdges} from './simulator-model.js?v=0194a81d11';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const clone = value => structuredClone(value);
const [presets,names] = await Promise.all(['/data/simulator-presets.json?v=0ccac17a2f','/data/simulator-names.json?v=ad066e41ef'].map(async url => {
 const r=await fetch(url);if(!r.ok)throw Error('ビルド一覧を読み込めません。再読み込みしてください。');return r.json();
})).catch(error=>{$('sim-chooser').insertAdjacentHTML('beforeend',`<p role="alert">${esc(error.message)}</p>`);throw error;});
const label = name => name==='Companion: {0}' ? 'コンパニオン（召喚対象を設定）' : names[name] ? `${names[name]}（${name}）` : name;
let worker,bootPromise,catalog,plan,result,baseline,selectedPreset,generation=0,calculation=0,sequence=0;
let selectedSlot='helmet',selectedNode=null,preview=null,activeTab='items',view={x:0,y:0,w:8500,h:6500},currentTree=[];
const pending = new Map();
function rpc(action,payload) {
 return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});worker.postMessage({id,action,payload});});
}
function engine() {
 if(bootPromise)return bootPromise;
 if(!window.Worker || !window.DecompressionStream || !window.WebAssembly) return Promise.reject(Error('このブラウザは計算機能に対応していません。最新のSafari・Chrome・Edgeをご利用ください。'));
 worker=new Worker(new URL('./simulator-worker.js?v=1fc636144e',import.meta.url),{type:'module'});
 worker.onmessage=({data})=>{if(data.progress){$('sim-status').textContent=data.progress;return;}const task=pending.get(data.id);if(!task)return;pending.delete(data.id);data.error?task.reject(Error(data.error)):task.resolve(data.result);};
 worker.onerror=()=>{for(const task of pending.values())task.reject(Error('計算処理を続けられません。ページを再読み込みしてください。'));pending.clear();};
 bootPromise=rpc('boot').then(data=>{catalog=data;return data;});return bootPromise;
}
function showError(error){$('sim-error').textContent=error.message || String(error);$('sim-error').hidden=false;}
function clearError(){$('sim-error').hidden=true;$('sim-error').textContent='';}
function save() {
 if(!plan)return;
 try{localStorage.setItem(`poe2-simulator:v1:${selectedPreset.id}`,JSON.stringify(makeSave(selectedPreset.id,plan.request,plan.questPoints,plan.notes)));$('sim-save-status').textContent='この端末に保存済み';}
 catch{$('sim-save-status').textContent='端末保存ができません。保存ファイルを使ってください。';}
}
async function recalculate() {
 if(!plan)return;
 const token=++calculation,version=generation;
 clearError();$('sim-stats').innerHTML='<p>再計算中…</p>';$('sim-stats').setAttribute('aria-busy','true');$('sim-baseline').disabled=true;
 try{
  const next=await rpc('calculate',clone(plan.request));
  if(token!==calculation||version!==generation)return;
  result=next;renderResults();renderTreeState();$('sim-status').textContent='変更を計算しました。';
 }catch(error){if(token===calculation&&version===generation){result=null;$('sim-stats').innerHTML='<p>この構成は計算できません。</p>';showError(error);}}
 finally{if(token===calculation){$('sim-stats').setAttribute('aria-busy','false');$('sim-baseline').disabled=!result;}}
}
function commit(){preview=null;save();void recalculate();}
const statistics=[['CombinedDPS','選択スキルのDPS'],['Life','最大ライフ'],['EnergyShield','エナジーシールド'],['Mana','最大マナ'],['SpiritUnreserved','未予約スピリット'],['FireResist','火耐性'],['ColdResist','冷気耐性'],['LightningResist','雷耐性'],['ChaosResist','混沌耐性'],['Str','筋力'],['Dex','器用さ'],['Int','知性']];
function number(value,id){if(value===null||!Number.isFinite(value))return'—';return new Intl.NumberFormat('ja-JP',{maximumFractionDigits:id.includes('DPS')?1:0}).format(value)+(/Resist/.test(id)?'%':'');}
function renderResults(){
 const hasSkill=!!result.main_skill;
 $('sim-stats').innerHTML=statistics.map(([id,title],i)=>{
  let value=statValue(result,id);if(i===0&&!hasSkill)value=null;
  const old=baseline?.[id],delta=old!==null&&old!==undefined&&value!==null?value-old:null;
  return `<div class="sim-stat${i===0?' primary':''}"><span>${title}</span><div><b>${number(value,id)}</b>${delta!==null?`<small class="${delta<0?'negative':''}">${delta>0?'+':''}${number(delta,id)}</small>`:''}</div></div>`;
 }).join('');
 const starts=new Set(Object.values(result.tree_effects?.class_starts || {})),normalPoints=(plan.request.allocated_nodes || []).filter(id=>!starts.has(id)&&!currentTree.find(n=>n.skill===id)?.ascendancy_id).length;
 const diagnostics=[...(normalPoints>plan.request.character.level-1+plan.questPoints?['選択した通常パッシブが現在Lvと報酬ポイントの上限を超えています。']:[]),...(result.unsupported_modifiers || []).map(v=>`未対応の効果：${v}`),...(result.item_errors || []).map(v=>`装備を計算から除外：${v.slot} / ${v.message}`),...(result.tree_effects?.warnings || [])];
 $('sim-diagnostic-count').textContent=`（${diagnostics.length}件）`;
 $('sim-diagnostic-body').innerHTML=`<p>${hasSkill?'選択したスキルと現在の計算条件の結果です。':'計算対象のダメージスキルがありません。スキルと必要な武器・召喚対象を設定してください。'}</p>${diagnostics.length?`<p>以下の効果は数値に含まれない場合があります。</p><ul>${diagnostics.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:'<p>エンジンから未対応効果・装備エラーの報告はありません。全機構の再現を保証する判定ではありません。</p>'}`;
 $('sim-diagnostics').open=diagnostics.length>0;
 $('sim-engine-version').textContent=`対応データ ${result.provenance?.data_version || catalog.runtime.dataVersion}`;
 $('sim-character-name').textContent=`${label(plan.request.character.class_name)} / ${label(plan.request.character.ascendancy_name)} · 装備・パッシブは自分の設定`;
}
async function selectPreset(id,{fromHistory=false}={}){
 const preset=presets.find(p=>p.id===id);if(!preset){showChooser();return;}
 const version=++generation;++calculation;selectedPreset=preset;plan=null;result=null;baseline=null;preview=null;selectedNode=null;
 $('sim-chooser').hidden=true;$('sim-workbench').hidden=false;$('sim-build-name').textContent=preset.name;$('sim-guide-link').href=preset.path;
 $('sim-status').textContent='計算画面を準備しています…';clearError();
 $('sim-stats').innerHTML='<p>準備中…</p>';
 for(const element of $('sim-workbench').querySelectorAll('button,input,select,textarea'))if(element.id!=='sim-change-build')element.disabled=true;
 if(!fromHistory){const u=new URL(location.href);u.searchParams.set('build',id);history.pushState({},'',u.pathname+u.search);}
 try{
  await engine();if(version!==generation)return;
  let recoveryError;
  try{const saved=localStorage.getItem(`poe2-simulator:v1:${id}`);if(saved){const data=parseSave(saved);plan={request:data.request,questPoints:data.questPoints || 0,notes:data.notes || ''};}}
  catch(error){recoveryError=Error('前回の保存を読み込めませんでした。新しい試作を表示しています。以前の保存ファイルがあれば「保存を読み込む」で復元できます。');}
  plan ||= {request:newPlan(preset,catalog.gems),questPoints:0,notes:''};
  currentTree=await rpc('tree',plan.request.tree_version || null);if(version!==generation)return;
  for(const element of $('sim-workbench').querySelectorAll('button,input,select,textarea'))element.disabled=false;
  renderInputs();renderTree();await recalculate();if(version!==generation)return;
  if(recoveryError)showError(recoveryError);else save();
 }catch(error){if(version===generation)showError(error);}
}
function showChooser(){generation++;calculation++;$('sim-chooser').hidden=false;$('sim-workbench').hidden=true;const u=new URL(location.href);u.searchParams.delete('build');history.pushState({},'',u.pathname+u.search);$('sim-chooser').scrollIntoView({block:'start'});}
function renderInputs(){
 $('sim-level').value=plan.request.character.level;
 $('sim-enemy').value=plan.request.enemy_tier || 'none';
 $('sim-life-reward').checked=!!plan.request.config_inputs?.['questInterlude 2Khari CrossingMolten Shrine'];
 $('sim-extra-mods').value=(plan.request.extra_modifiers || []).join('\n');$('sim-notes').value=plan.notes;
 $('sim-raw-config').textContent=JSON.stringify(plan.request.config_inputs || {},null,2);$('sim-quest-points').value=plan.questPoints;
 renderSlots();renderSkills();setTab(activeTab);
}
function setTab(name){activeTab=name;for(const button of document.querySelectorAll('[data-tab]'))button.setAttribute('aria-pressed',String(button.dataset.tab===name));for(const panel of ['items','skills','tree','config'])$(`sim-${panel}`).hidden=panel!==name;if(name==='tree')updateView();}
const slots=[['weapon1','メイン武器'],['weapon2','サブ武器・盾'],['helmet','兜'],['body','鎧'],['gloves','手袋'],['boots','靴'],['belt','ベルト'],['amulet','アミュレット'],['ring1','指輪1'],['ring2','指輪2'],['Flask 1','フラスコ1'],['Flask 2','フラスコ2'],['Charm 1','チャーム1'],['Charm 2','チャーム2'],['Charm 3','チャーム3']];
const utility=slot=>/^(Flask|Charm) /.test(slot);
const itemList=()=>utility(selectedSlot)?(plan.request.flasks ||= []):(plan.request.items ||= []);
function itemName(text){const lines=text.trim().split('\n');return /^Rarity:/i.test(lines[0])?lines[1] || '未装備':lines[0] || '未装備';}
function renderSlots(){
 $('sim-slots').innerHTML=slots.map(([id,title])=>{const item=(utility(id)?plan.request.flasks:plan.request.items)?.find(i=>i.slot===id);return `<button type="button" data-slot="${id}" aria-pressed="${id===selectedSlot}">${title}<small>${esc(item?label(itemName(item.text)):'未装備')}</small></button>`;}).join('');
 $('sim-slot-title').textContent=slots.find(s=>s[0]===selectedSlot)?.[1];$('sim-item-text').value=itemList().find(i=>i.slot===selectedSlot)?.text || '';renderUniques();
}
function renderUniques(){
 const q=$('sim-unique-search').value.trim().toLowerCase();
 const types=selectedSlot==='weapon1'?['bow','crossbow','mace','sceptre','spear','staff','talisman','wand']:selectedSlot==='weapon2'?['focus','quiver','shield','wand','sceptre','mace','spear']:selectedSlot.startsWith('ring')?['ring']:utility(selectedSlot)?['flask']:[selectedSlot];
 const matches=catalog.uniques.filter(u=>types.includes(u.item_type)&&`${u.name} ${names[u.name] || ''}`.toLowerCase().includes(q));
 $('sim-unique').innerHTML='<option value="">ユニークを選ぶ</option>'+matches.map(u=>`<option value="${u.id}">${esc(label(u.name))}</option>`).join('');
 $('sim-unique-draft').disabled=/^Charm/.test(selectedSlot);
}
function gemOptions(support,selected){return `<option value="">${support?'サポート':'スキル'}を選ぶ</option>`+catalog.gems.filter(g=>g.is_support===support).map(g=>`<option value="${esc(g.skill_id)}"${g.skill_id===selected?' selected':''}>${esc(label(g.name))}</option>`).join('');}
function renderSkills(){
 $('sim-skill-groups').innerHTML=(plan.request.socket_groups || []).map((group,index)=>`<section class="sim-gem-group" data-group="${index}"><div class="sim-gem-group-head"><label class="sim-check"><input type="radio" name="main-skill" data-main="${index}"${(plan.request.main_socket_group || 0)===index?' checked':''}>計算する主力</label><button type="button" data-remove-group="${index}" aria-label="スキル組${index+1}を削除">組を削除</button></div>${group.gems.map((gem,j)=>{
 const entry=catalog.gems.find(g=>g.skill_id===gem.skill_id);const support=entry?.is_support || false;
 const summoner=catalog.minions.summoners.find(s=>s.skill_id===gem.skill_id);const monsters=summoner?catalog.minions.monsters.filter(m=>summoner.minion_ids.includes(m.id)):[];
 return `<div class="sim-gem-row" data-gem="${j}"><label>${support?'サポート':'スキル'}<select data-gem-field="skill_id">${!entry?`<option value="${esc(gem.skill_id)}">${esc(gem.name_spec || gem.skill_id)}（未解決）</option>`:''}${gemOptions(support,gem.skill_id)}</select></label><label>Lv<input data-gem-field="level" type="number" min="1" max="40" value="${gem.level}"></label><label>品質<input data-gem-field="quality" type="number" min="0" max="30" value="${gem.quality}"></label><button type="button" data-remove-gem="${j}" aria-label="ジェム${j+1}を削除">×</button></div>${monsters.length?`<label>召喚する対象<select data-minion="${j}"><option value="">対象を選ぶ</option>${monsters.map(m=>`<option value="${esc(m.id)}"${gem.minion===m.id?' selected':''}>${esc(label(m.name))}</option>`).join('')}</select></label>`:''}`;
 }).join('')}<label class="sim-check"><input type="checkbox" data-enabled="${index}"${group.enabled?' checked':''}>このスキル組を有効にする</label><button type="button" class="sim-add-support" data-add-support="${index}">＋ サポートを追加</button></section>`).join('');
}
function renderTree(){
 $('sim-tree-edges').innerHTML=treeEdges(currentTree).map(e=>`<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" data-from="${e.from}" data-to="${e.to}"/>`).join('');
 $('sim-tree-nodes').innerHTML=currentTree.filter(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)).map(n=>`<circle cx="${n.x}" cy="${n.y}" r="${n.kind==='keystone'?65:n.kind==='notable'?48:n.kind==='ascendancy_start'?80:28}" class="${n.kind}" data-node="${n.skill}"><title>${esc(label(n.name))}</title></circle>`).join('');
 centerTree();renderTreeState();
}
function centerTree(){const root=result?.tree_effects?.class_starts?.[plan?.request.character.class_name.toLowerCase()];const node=currentTree.find(n=>n.skill===root);if(node){view.x=node.x;view.y=node.y;}else{view.x=0;view.y=0;}view.w=8500;view.h=6500;updateView();}
function updateView(){const rect=$('sim-tree-map').getBoundingClientRect();if(rect.width>0&&rect.height>0)view.h=view.w*rect.height/rect.width;$('sim-tree-svg').setAttribute('viewBox',`${view.x-view.w/2} ${view.y-view.h/2} ${view.w} ${view.h}`);}
function renderTreeState(){
 if(!plan)return;
 const allocated=new Set(plan.request.allocated_nodes || []),highlight=new Set(preview?.result?.path || []);
 const root=result?.tree_effects?.class_starts?.[plan.request.character.class_name.toLowerCase()];if(root)allocated.add(root);
 const cls=catalog.meta.classes.find(c=>c.name===plan.request.character.class_name),asc=cls?.ascendancies?.find(a=>a.name===plan.request.character.ascendancy_name);
 const ascRoot=currentTree.find(n=>n.kind==='ascendancy_start'&&n.ascendancy_id===asc?.id);if(ascRoot)allocated.add(ascRoot.skill);
 const toggle=(element,name,value)=>{if(element.classList.contains(name)!==value)element.classList.toggle(name,value);};
 for(const circle of [...$('sim-tree-nodes').children]){const id=+circle.dataset.node;toggle(circle,'allocated',allocated.has(id));toggle(circle,'preview',highlight.has(id));toggle(circle,'selected',id===selectedNode);}
 for(const edge of [...$('sim-tree-edges').children])toggle(edge,'allocated',allocated.has(+edge.dataset.from)&&allocated.has(+edge.dataset.to));
 $('sim-point-count').textContent=`選択ノード ${(plan.request.allocated_nodes || []).length} / 通常ポイント上限 ${plan.request.character.level-1+plan.questPoints}（別枠ノードを含む）`;
}
function nodeDetail(id){selectedNode=id;preview=null;const node=currentTree.find(n=>n.skill===id);if(!node)return;const allocated=plan.request.allocated_nodes?.includes(id);$('sim-node-detail').innerHTML=`<h4>${esc(label(node.name))}</h4><ul>${node.stats.map(s=>`<li>${esc(s)}</li>`).join('')}</ul><p>ノードID：${id}${node.ascendancy_id?' / アセンダンシー':''}</p><div class="sim-actions"><button type="button" id="sim-node-preview" class="sim-primary">${allocated?'外す範囲を確認':'取得経路を確認'}</button></div><div id="sim-node-preview-result"></div>${allocated&&node.name==='Attribute'?`<label>能力値ノードの選択<select id="sim-node-attribute"><option value="str">筋力</option><option value="dex">器用さ</option><option value="int">知性</option></select></label>`:''}`;if($('sim-node-attribute'))$('sim-node-attribute').value=plan.request.attribute_choices?.[id] || 'str';renderTreeState();}
async function previewNode(){
 const id=selectedNode,version=generation;
 try{const action=plan.request.allocated_nodes?.includes(id)?'refund':'allocate';const next=await rpc('edit',{request:clone(plan.request),node:id,mode:0,action,quest_points:plan.questPoints});if(id!==selectedNode||version!==generation)return;preview=next;
 $('sim-node-preview-result').innerHTML=next.valid?`<p>追加 ${next.result.added.length}ノード / 解除 ${next.result.removed.length}ノード<br>通常ポイント ${next.result.points_used} / ${next.result.points_max}</p><button type="button" id="sim-node-apply" class="sim-primary">この変更を反映</button>`:`<p role="status">この変更は適用できません：${esc(next.reason)}</p>`;renderTreeState();}catch(error){showError(error);}
}
function download(){const blob=new Blob([JSON.stringify(makeSave(selectedPreset.id,plan.request,plan.questPoints,plan.notes),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`poe2-${selectedPreset.id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
// All inputs stay on this origin; no character or code upload is performed.
document.addEventListener('click',async event=>{
 const target=event.target.closest('button,a');if(!target)return;
 try{
  if(target.id==='menu-button'){const open=$('site-nav').classList.toggle('is-open');target.setAttribute('aria-expanded',String(open));return;}
  if(target.dataset.preset){event.preventDefault();await selectPreset(target.dataset.preset);return;}
  if(target.id==='sim-change-build'){save();showChooser();return;}
  if(!plan)return;
  if(target.dataset.tab){setTab(target.dataset.tab);return;}
  if(target.dataset.slot){selectedSlot=target.dataset.slot;renderSlots();return;}
  if(target.id==='sim-unique-draft'){const value=$('sim-unique').value;if(!value)return;const drafted=await rpc('unique',{id:+value,roll:+$('sim-roll').value});$('sim-item-text').value=drafted.text;return;}
  if(target.id==='sim-item-apply'||target.id==='sim-item-remove'){
   const list=itemList(),index=list.findIndex(i=>i.slot===selectedSlot);if(index>=0)list.splice(index,1);const text=$('sim-item-text').value.trim();if(target.id==='sim-item-apply'&&text){if(text.length>100000)throw Error('装備テキストが長すぎます。');list.push({slot:selectedSlot,text,...(utility(selectedSlot)?{active:true}:{})});}commit();renderSlots();return;}
  if(target.dataset.removeGroup!==undefined){plan.request.socket_groups.splice(+target.dataset.removeGroup,1);plan.request.main_socket_group=Math.max(0,Math.min(plan.request.main_socket_group || 0,plan.request.socket_groups.length-1));renderSkills();commit();return;}
  if(target.dataset.removeGem!==undefined){const group=plan.request.socket_groups[+target.closest('[data-group]').dataset.group];group.gems.splice(+target.dataset.removeGem,1);renderSkills();commit();return;}
  if(target.dataset.addSupport!==undefined){const group=plan.request.socket_groups[+target.dataset.addSupport];if(group.gems.length>=6)throw Error('この画面では1組につき主力1個＋サポート5個まで追加できます。');group.gems.push({skill_id:catalog.gems.find(g=>g.is_support).skill_id,level:1,quality:0});renderSkills();commit();return;}
  if(target.id==='sim-add-group'){if(plan.request.socket_groups.length>=20)throw Error('スキル組は20個までです。');plan.request.socket_groups.push({enabled:true,main_active_skill:1,gems:[{skill_id:catalog.gems.find(g=>!g.is_support&&g.name==='Spark').skill_id,level:1,quality:0}]});renderSkills();commit();return;}
  if(target.dataset.nodeResult){nodeDetail(+target.dataset.nodeResult);const n=currentTree.find(n=>n.skill===+target.dataset.nodeResult);view.x=n.x;view.y=n.y;view.w=4000;view.h=3000;updateView();return;}
  if(target.id==='sim-node-preview'){await previewNode();return;}
  if(target.id==='sim-node-apply'&&preview?.valid){plan.request.allocated_nodes=preview.result.allocation.shared;if(plan.request.weapon_swap){plan.request.weapon_swap.exclusive_nodes=preview.result.allocation.exclusive;plan.request.allocated_nodes=[...new Set([...preview.result.allocation.shared,...preview.result.allocation.exclusive[(plan.request.weapon_swap.active||1)-1]])];}const id=selectedNode;commit();nodeDetail(id);return;}
  if(target.id==='sim-tree-center'){centerTree();return;}
  if(target.id==='sim-tree-ascendancy'){const cls=catalog.meta.classes.find(c=>c.name===plan.request.character.class_name),asc=cls?.ascendancies?.find(a=>a.name===plan.request.character.ascendancy_name),node=currentTree.find(n=>n.kind==='ascendancy_start'&&n.ascendancy_id===asc?.id);if(node){view.x=node.x;view.y=node.y;view.w=4200;updateView();}else throw Error('この構成のアセンダンシー開始点が見つかりません。');return;}
  if(['sim-tree-plus','sim-tree-minus'].includes(target.id)){const factor=target.id==='sim-tree-plus'?.7:1.4;view.w=Math.max(800,Math.min(60000,view.w*factor));view.h=view.w*.76;updateView();return;}
  if(target.id==='sim-baseline'){if(result){baseline=Object.fromEntries(statistics.map(([id])=>[id,statValue(result,id)]));renderResults();$('sim-status').textContent='比較の基準を設定しました。以降の変更との差分を表示します。';}return;}
  if(target.id==='sim-config-apply'){plan.request.enemy_tier=$('sim-enemy').value;plan.request.config_inputs ||= {};plan.request.config_inputs['questInterlude 2Khari CrossingMolten Shrine']=$('sim-life-reward').checked;plan.request.extra_modifiers=$('sim-extra-mods').value.split('\n').map(s=>s.trim()).filter(Boolean);if(plan.request.extra_modifiers.length>100)throw Error('追加の修飾効果は100行までです。');commit();return;}
  if(target.id==='sim-download')download();
 }catch(error){showError(error);}
});
document.addEventListener('change',async event=>{
 const target=event.target;
 if(target.id==='sim-class-filter'){for(const card of document.querySelectorAll('[data-preset]'))card.hidden=!!target.value&&presets.find(p=>p.id===card.dataset.preset).class!==target.value;return;}
 if(!plan)return;
 try{
  if(target.id==='sim-level'){const n=Number(target.value);if(!Number.isInteger(n)||n<1||n>100){target.value=plan.request.character.level;throw Error('Lvは1〜100で入力してください。');}plan.request.character.level=n;commit();}
  if(target.id==='sim-quest-points'){const n=Number(target.value);if(!Number.isInteger(n)||n<0||n>24){target.value=plan.questPoints;throw Error('報酬ポイントは0〜24で入力してください。');}plan.questPoints=n;preview=null;save();renderTreeState();}
  if(target.dataset.main!==undefined){plan.request.main_socket_group=+target.dataset.main;commit();}
  if(target.dataset.enabled!==undefined){plan.request.socket_groups[+target.dataset.enabled].enabled=target.checked;commit();}
  if(target.dataset.gemField){const group=plan.request.socket_groups[+target.closest('[data-group]').dataset.group],gem=group.gems[+target.closest('[data-gem]').dataset.gem],key=target.dataset.gemField;if(key==='skill_id'){gem.skill_id=target.value;delete gem.minion;delete gem.minion_skill;delete gem.stat_set_index;renderSkills();}else{const n=Number(target.value),max=key==='level'?40:30,min=key==='level'?1:0;if(!Number.isInteger(n)||n<min||n>max){target.value=gem[key];throw Error(`${key==='level'?'Lv':'品質'}は${min}〜${max}で入力してください。`);}gem[key]=n;}commit();}
  if(target.dataset.minion!==undefined){const group=plan.request.socket_groups[+target.closest('[data-group]').dataset.group];group.gems[+target.dataset.minion].minion=target.value || null;commit();}
  if(target.id==='sim-node-attribute'){plan.request.attribute_choices ||= {};plan.request.attribute_choices[selectedNode]=target.value;commit();}
  if(target.id==='sim-file'){
   const file=target.files[0];if(!file)return;if(file.size>2000000)throw Error('保存ファイルは2MBまでです。');const saved=parseSave(await file.text());
   const next=await rpc('calculate',saved.request),nodes=await rpc('tree',saved.request.tree_version || null);
   plan={request:saved.request,questPoints:saved.questPoints || 0,notes:saved.notes || ''};currentTree=nodes;result=next;baseline=null;selectedNode=null;preview=null;renderInputs();renderTree();renderResults();save();target.value='';
  }
 }catch(error){showError(error);}
});
$('sim-notes').addEventListener('input',()=>{if(plan){plan.notes=$('sim-notes').value;save();}});
$('sim-unique-search').addEventListener('input',()=>{if(catalog)renderUniques();});
$('sim-node-search').addEventListener('input',()=>{
 const q=$('sim-node-search').value.trim().toLowerCase();const found=q?currentTree.filter(n=>`${n.skill} ${n.name} ${names[n.name] || ''} ${n.stats.join(' ')}`.toLowerCase().includes(q)).slice(0,25):[];
 $('sim-node-search-results').innerHTML=found.map(n=>`<button type="button" data-node-result="${n.skill}">${esc(label(n.name))}</button>`).join('')+(q&&!found.length?'<p>一致するノードがありません。</p>':'');
});
let drag;
$('sim-tree-svg').addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY,vx:view.x,vy:view.y,moved:false,node:event.target.closest('[data-node]')?.dataset.node};$('sim-tree-svg').setPointerCapture(event.pointerId);});
$('sim-tree-svg').addEventListener('pointermove',event=>{if(!drag)return;const rect=$('sim-tree-svg').getBoundingClientRect(),dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;view.x=drag.vx-dx*view.w/rect.width;view.y=drag.vy-dy*view.h/rect.height;updateView();});
$('sim-tree-svg').addEventListener('pointerup',()=>{if(drag&&!drag.moved&&drag.node)nodeDetail(+drag.node);drag=null;});
$('sim-tree-svg').addEventListener('pointercancel',()=>{drag=null;});
$('sim-tree-svg').addEventListener('wheel',event=>{event.preventDefault();const factor=event.deltaY>0?1.12:.89;view.w=Math.max(800,Math.min(60000,view.w*factor));view.h=view.w*.76;updateView();},{passive:false});
window.addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('build');if(id)void selectPreset(id,{fromHistory:true});else{generation++;calculation++;$('sim-chooser').hidden=false;$('sim-workbench').hidden=true;}});
const initial=new URLSearchParams(location.search).get('build');if(initial)void selectPreset(initial,{fromHistory:true});

window.addEventListener('resize',()=>{if(activeTab==='tree')updateView();});
