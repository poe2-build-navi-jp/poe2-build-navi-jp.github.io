import {GROWTH_PREFIX,GROWTH_LIMIT,GROWTH_STATS,growthKey,parseGrowth,makeGrowth,appendGrowth,growthDifference,saveGrowth} from './my-build-growth-model.js?v=c76e92e114';

export function installGrowthHistory(section){
 if(!section)return {update(){}};
 const document=section.ownerDocument,window=document.defaultView,en=document.documentElement.lang==='en',t=(ja,english)=>en?english:ja;
 const find=selector=>section.querySelector(selector),make=(tag,text,className='')=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
 const box=find('[data-growth-view]'),status=find('[data-growth-status]'),retry=find('[data-growth-retry]'),undo=find('[data-growth-undo]'),states=new Map();let active=null;
 const names={CombinedDPS:t('選択スキルのDPS','Selected skill DPS'),Life:t('最大ライフ','Maximum life'),EnergyShield:t('エナジーシールド','Energy shield'),Armour:t('アーマー','Armour'),FireResist:t('火耐性','Fire resistance'),ColdResist:t('冷気耐性','Cold resistance'),LightningResist:t('雷耐性','Lightning resistance'),ChaosResist:t('混沌耐性','Chaos resistance')};
 const conditions={engine:t('計算エンジン','Engine'),data:t('計算データ','Calculation data'),tree:t('パッシブツリーの版','Passive tree version'),className:t('職業','Class'),ascendancy:t('アセンダンシー','Ascendancy'),mainSkill:t('主力スキル・召喚対象','Main skill / minion'),weaponSet:t('武器セット','Weapon set'),config:t('敵・一時効果などの設定','Enemy / temporary effects'),coverage:t('計算上の注意事項の有無','Presence of calculation diagnostics')};
 const number=(value,id)=>value===null?'—':new Intl.NumberFormat(en?'en-GB':'ja-JP',{maximumFractionDigits:id==='CombinedDPS'?1:0}).format(value)+(/Resist/.test(id)?'%':'');
 const date=at=>new Intl.DateTimeFormat(en?'en-GB':'ja-JP',{dateStyle:'short',timeStyle:'short'}).format(new Date(at));
 const describe=record=>date(record.at)+' · Lv'+record.level+(record.label?' · '+record.label:'');
 const storage=()=>window.localStorage;
 const errors={GROWTH_FORMAT:t('成長履歴を読み込めません。元の記録を保護するため編集を止めています。','Growth history could not be read. Editing is paused to protect your records.'),GROWTH_STALE:t('別の画面で履歴が更新されました。最新の履歴を確認して、もう一度操作してください。','History changed in another view. Review the latest history and try again.'),GROWTH_DUPLICATE:t('直前と同じ数値・条件のため、記録は追加していません。','These values and conditions match the last record. No duplicate was added.'),GROWTH_CAPACITY:t('30件まで記録できます。不要な記録を削除すると追加できます。','You can keep 30 records. Remove an unneeded record to add another.'),GROWTH_NOT_READY:t('計算が完了してから記録してください。','Wait for calculation to finish before recording.')};
 function read(state){
  try{const raw=storage().getItem(growthKey(state.preset));if(!state.broken&&raw===state.raw)return false;state.records=parseGrowth(raw,state.preset);if(raw!==state.raw)state.undo=null;state.raw=raw;state.broken=false;return true;}
  catch{state.broken=true;state.message=errors.GROWTH_FORMAT;return true;}
 }
 function render(){
  if(!active)return;const state=active,records=state.broken?[]:state.records,latest=records[0],wasOpen=box.querySelector('details')?.open;
  box.replaceChildren();find('[data-growth-count]').textContent=`${records.length}/${GROWTH_LIMIT}`;
  retry.hidden=!state.broken;undo.hidden=state.broken||!state.undo;status.textContent=state.message||'';
  if(state.broken)return;
  if(!latest){box.append(make('p',t('まだ記録はありません。シミュレーターの「今の状態を記録」から残せます。','No records yet. Use “Record current state” in the simulator to start.'),'growth-help'));return;}
  box.append(make('p',t('最新の記録：','Latest record: ')+describe(latest),'growth-latest'));
  let previous=records.find(row=>row.id===state.baseline&&row.id!==latest.id)||records[1];
  if(previous){
   const label=make('label',t('比べる過去の記録','Compare with a previous record'),'growth-baseline'),picker=make('select');
   picker.id=section.id+'-baseline';label.htmlFor=picker.id;
   for(const row of records.slice(1)){const option=make('option',describe(row));option.value=row.id;option.selected=row.id===previous.id;picker.append(option);}
   picker.addEventListener('change',()=>{state.baseline=picker.value;render();box.querySelector('select')?.focus();});label.append(picker);box.append(label);
  }else box.append(make('p',t('最初の記録です。次の記録を残すと変化が分かります。','This is your first record. Add another to see changes.'),'growth-help'));
  const diff=growthDifference(latest,previous);
  if(diff.differences.length)box.append(make('p',t('条件が異なるため数値は参考表示です。差分は出していません：','Conditions differ, so values are shown for reference without deltas: ')+diff.differences.map(key=>conditions[key]).join(en?', ':'、'),'growth-condition'));
  if(latest.warning||previous?.warning)box.append(make('p',t('未対応の効果・装備エラー等を含む記録があります。対応範囲内の計算値です。','A record includes unsupported effects or diagnostics. Values cover supported calculations.'),'growth-condition'));
  const level=make('p',previous?`Lv${previous.level} → Lv${latest.level}`:`Lv${latest.level}`,'growth-level');box.append(level);
  const values=make('dl',undefined,'growth-stats');
  for(const id of GROWTH_STATS){
   const row=make('div'),dd=make('dd');row.append(make('dt',names[id]));dd.append(make('b',number(latest.values[id],id)));
   const delta=diff.deltas?.[id];
   if(delta!==null&&delta!==undefined){const formatted=new Intl.NumberFormat(en?'en-GB':'ja-JP',{maximumFractionDigits:id==='CombinedDPS'?1:0}).format(delta);dd.append(make('span',(delta>0?'+':'')+formatted+(/Resist/.test(id)?(en?' pp':' pt'):''),'growth-delta'));}
   if(previous)dd.append(make('small',t('前の記録：','Previous: ')+number(previous.values[id],id)));
   row.append(dd);values.append(row);
  }
  box.append(values,make('p',t(`装備 ${latest.counts.gear}部位 · ジェム ${latest.counts.gems}個 · パッシブ ${latest.counts.passives}個`,`Gear: ${latest.counts.gear} slots · Gems: ${latest.counts.gems} · Passives: ${latest.counts.passives}`),'growth-help'));
  const details=make('details',undefined,'growth-records');details.open=!!wasOpen;details.append(make('summary',t(`これまでの記録（${records.length}件）`,`All records (${records.length})`)));
  const list=make('ol');for(const record of records){const row=make('li'),button=make('button',t('削除','Remove'));button.type='button';button.dataset.growthDelete=record.id;button.setAttribute('aria-label',t('記録を削除：','Remove record: ')+describe(record));row.append(make('span',describe(record)),button);list.append(row);}details.append(list);box.append(details);
 }
 function update(preset){
  if(!preset){active=null;return;}
  let state=states.get(preset);if(!state){state={preset,raw:undefined,records:[],undo:null,baseline:null,message:'',broken:false};states.set(preset,state);}
  const changed=read(state),switched=active!==state;active=state;if(changed||switched)render();
 }
 function write(records,message,removed=null){
  const state=active;
  try{state.raw=saveGrowth(storage(),state.preset,state.raw,records);state.records=records;state.undo=removed;state.message=message;render();window.dispatchEvent(new window.CustomEvent('poe2:growth',{detail:{preset:state.preset}}));return true;}
  catch(error){if(error.message==='GROWTH_STALE')read(state);state.message=errors[error.message]||t('記録できませんでした。既存の履歴と入力は残しています。保存容量を確認して再試行してください。','Could not save. History and your input are intact. Check storage and try again.');render();return false;}
 }
 function add(data,label){
  if(!active||active.broken)return false;
  try{
   if(data?.saved?.preset!==active.preset)throw Error('GROWTH_NOT_READY');
   const id=window.crypto.randomUUID?.()||Array.from(window.crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
   const record=makeGrowth(data,label,{id,at:new Date().toISOString()});return write(appendGrowth(active.records,record),t('今の計算結果を成長履歴に記録しました。','Current calculation recorded in growth history.'));
  }catch(error){active.message=errors[error.message]||t('記録の入力内容を確認してください。','Check the record input.');render();return false;}
 }
 box.addEventListener('click',event=>{const button=event.target.closest('[data-growth-delete]');if(!button||!active||active.broken)return;const before=active.records,next=before.filter(record=>record.id!==button.dataset.growthDelete);if(next.length===before.length)return;write(next,t('記録を削除しました。直後は「削除を戻す」で復元できます。','Record removed. Use Undo removal to restore it.'),before);});
 undo.addEventListener('click',()=>{if(active?.undo)write(active.undo,t('削除を戻しました。','Removal undone.'));});
 retry.addEventListener('click',()=>{if(active){active.message='';read(active);render();}});
 const refresh=()=>{if(active&&read(active))render();};
 window.addEventListener('storage',event=>{if(!event.key||event.key.startsWith(GROWTH_PREFIX))refresh();});window.addEventListener('poe2:growth',event=>{if(active?.preset===event.detail?.preset)refresh();});window.addEventListener('focus',refresh);
 return {update,add,get valid(){return !!active&&!active.broken;}};
}

export function installGrowthEditor(document){
 const section=document.getElementById('sim-growth-panel');if(!section||section.dataset.installed)return;section.dataset.installed='true';
 const window=document.defaultView,bridge=()=>window.Poe2SimulatorLibrary,history=installGrowthHistory(section),button=section.querySelector('[data-growth-save]'),input=section.querySelector('[data-growth-label]'),workbench=document.getElementById('sim-workbench');
 function refresh(){const preset=bridge()?.read()?.preset,visible=preset&&workbench&&!workbench.hidden;section.hidden=!visible;if(visible)history.update(preset);button.disabled=!visible||!history.valid||!bridge()?.growthData?.();}
 button.addEventListener('click',()=>{refresh();if(!button.disabled&&history.add(bridge().growthData(),input.value))input.value='';});
 const observer=new window.MutationObserver(refresh);for(const [node,attribute]of [[document.getElementById('sim-stats'),'aria-busy'],[workbench,'hidden']])if(node)observer.observe(node,{attributes:true,attributeFilter:[attribute]});
 for(const event of ['poe2:library-ready','poe2:workspace','poe2:build-change','poe2:growth'])window.addEventListener(event,refresh);refresh();return {history,refresh,observer};
}
if(typeof document!=='undefined')installGrowthEditor(document);
