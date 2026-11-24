import {HOME_KEY,SEEN_KEY,readHomeRecords,selectHomeRecord,resumeHref,checkedPresets,readHomeGoal,summarizeHomeGoal,readSeen,homeNotices} from './my-build-home-model.js?v=52fafd6df3';
import {installBuildActions} from './my-build-actions.js?v=e77759f767';
import {installGrowthHistory} from './my-build-growth.js?v=d75d03e102';

export function installMyBuildHome(document){
 const section=document.getElementById('my-build-home'),embedded=document.getElementById('my-build-presets');
 if(!section||!embedded||section.dataset.installed)return;
 section.dataset.installed='true';
 const window=document.defaultView,en=document.documentElement.lang==='en',t=(ja,english)=>en?english:ja;
 const find=selector=>section.querySelector(selector),make=(tag,content,className='')=>{const node=document.createElement(tag);if(content!==undefined)node.textContent=content;if(className)node.className=className;return node;};
 let presets;
 try{presets=checkedPresets(JSON.parse(embedded.textContent));}catch{return;}
 const select=find('#my-build-select'),grid=find('[data-my-build-grid]'),warning=find('[data-my-build-warning]'),goalBox=find('[data-my-build-goal]'),updatesBox=find('[data-my-build-updates]');
 let current=null,shown=[],choice=null,sequence=0,noticePromise=null,indexPromise=null,timer=0,viewTracked=false,preferenceWarning='';
 const track=(name,record=current)=>{if(record&&typeof window.gtag==='function')window.gtag('event',name,{source:document.querySelector('#sim-chooser')?'simulator':'home',build_id:record.preset,save_kind:record.kind});};
 const message=(box,content)=>box.replaceChildren(make('p',content,'my-build-help'));
 const storage=()=>window.localStorage;
 const actions=installBuildActions(find('[data-my-build-actions]'));
 const growth=installGrowthHistory(find('#my-build-growth'));
 const loadJSON=async url=>{
  const controller=new window.AbortController(),timeout=window.setTimeout(()=>controller.abort(),12000);
  try{const response=await window.fetch(url,{cache:'no-cache',credentials:'omit',signal:controller.signal});if(!response.ok)throw Error('HOME_FETCH');return await response.json();}finally{window.clearTimeout(timeout);}
 };
 const index=()=>indexPromise||=(loadJSON('/data/simulator-index.json?v=081a4b68e0'));
 const notices=()=>noticePromise||=(loadJSON('/data/saved-build-updates.json'));
 const retry=find('[data-my-build-retry]'),seenButton=find('[data-my-build-seen]');
 // Home page: a small square tile opens and closes the full panel. The choice is a per-browser convenience.
 const toggle=find('[data-my-build-toggle]'),panel=find('[data-my-build-panel]'),OPEN_KEY='poe2-my-build-home-open';
 let panelOpen=false;
 const applyPanel=()=>{if(!toggle||!panel)return;panel.hidden=!panelOpen;toggle.setAttribute('aria-expanded',String(panelOpen));toggle.classList.toggle('is-open',panelOpen);find('[data-my-build-tile-state]').textContent=panelOpen?t('閉じる','Close'):t('開く','Open');};
 if(toggle&&panel){
  try{panelOpen=storage().getItem(OPEN_KEY)==='1';}catch{}
  applyPanel();
  toggle.addEventListener('click',()=>{panelOpen=!panelOpen;try{storage().setItem(OPEN_KEY,panelOpen?'1':'0');}catch{}applyPanel();track(panelOpen?'my_build_home_open':'my_build_home_close');if(panelOpen&&window.getComputedStyle(panel).position!=='absolute')panel.scrollIntoView({block:'start',behavior:'instant'});void refresh();});
  section.addEventListener('keydown',event=>{if(event.key==='Escape'&&panelOpen){panelOpen=false;try{storage().setItem(OPEN_KEY,'0');}catch{}applyPanel();toggle.focus();}});
 }
 const showWarning=content=>{warning.textContent=content;};

 async function renderGoal(record,token){
  try{
   const goal=readHomeGoal(storage(),record);
   if(!goal){message(goalBox,t('目標を設定すると、ジェム・パッシブ・装備の残りを確認できます。','Set a target to see the remaining gems, passives and equipment.'));return;}
   const heading=make('p',goal.name,'my-build-goal-name');goalBox.replaceChildren(heading,make('p',t('目標の残りを確認しています…','Checking your target…'),'my-build-help'));
   const summary=summarizeHomeGoal(record,goal,await index());
   if(token!==sequence)return;
   const values=make('dl',undefined,'my-build-goal-counts');
   for(const [label,value]of [[t('ジェム','Gems'),summary.gems],[t('パッシブ','Passives'),summary.passives],[t('装備','Gear'),summary.equipment]]){const cell=make('div');cell.append(make('dt',label),make('dd',value===null?'—':String(value)));values.append(cell);}
   goalBox.replaceChildren(heading,make('p',t(`現在 Lv${summary.current} → 目標 Lv${summary.target}`,`Current Lv${summary.current} → target Lv${summary.target}`),'my-build-help'),values);
   if(summary.unverified)goalBox.append(make('p',t('未確認の項目あり。詳しい条件は目標画面で確認できます。','Some entries are unverified. Review the details on the target screen.'),'my-build-help'));
   else if(!summary.gems&&!summary.passives&&!summary.equipment&&summary.current>=summary.target)goalBox.append(make('p',t('設定した目標の項目は一致しています。','The configured target entries match.'),'my-build-match'));
  }catch{if(token===sequence){message(goalBox,t('目標の残りを確認できません。保存内容はそのままで、目標画面から確認できます。','Could not check the target. Your saves are intact; open the target screen to review it.'));retry.hidden=false;}}
 }

 async function renderUpdates(record,token){
  message(updatesBox,t('関連する更新を確認しています…','Checking updates for this build…'));seenButton.hidden=true;shown=[];
  find('[data-my-build-update-count]').textContent='';
  try{
   const rows=homeNotices(await notices(),record,readSeen(storage().getItem(SEEN_KEY)));
   if(token!==sequence)return;
   shown=rows;
   const unread=rows.filter(row=>row.unread).length;
   find('[data-my-build-update-count]').textContent=unread?t(`新着${unread}件`,`${unread} unread`):'';
   if(!rows.length){message(updatesBox,t('この構成に関係する更新案内はありません。','There are no relevant update notices for this build.'));return;}
   const list=make('ul',undefined,'my-build-notices');
   for(const row of rows){
    const item=make('li'),link=make('a',row.title[en?'en':'ja']);
    const url=new URL(row.href,window.location.origin);if(url.origin!==window.location.origin||!/^https?:$/.test(url.protocol))continue;
    link.href=url.pathname+url.search+url.hash;
    if(en&&!url.pathname.startsWith('/en/'))link.append(make('small',' (Japanese)'));
    if(row.unread)item.append(make('span',t('新着','New'),'my-build-new'));
    item.append(link);list.append(item);
   }
   updatesBox.replaceChildren(list);seenButton.hidden=!unread;
  }catch{if(token===sequence){message(updatesBox,t('更新案内を取得できません。保存した構成は開けます。','Updates could not be loaded. Your saved configuration can still be opened.'));retry.hidden=false;}}
 }

 async function refresh(){
  const token=++sequence;retry.hidden=true;
  let result,preferred;
  try{result=readHomeRecords(storage(),presets);preferred=choice?JSON.stringify({version:1,key:choice}):storage().getItem(HOME_KEY);}catch{
   actions.update(null);
   growth.update(null);
   section.hidden=false;grid.hidden=true;select.closest('label').hidden=true;showWarning(t('このブラウザーの保存を確認できません。ブラウザーの保存設定を確認してください。','Device saves could not be read. Check your browser’s storage settings.'));return;
  }
  current=selectHomeRecord(result.records,preferred);
  actions.update(current);
  growth.update(current?.preset);
  section.hidden=!current&&!result.problems.length;
  if(section.hidden)return;
  grid.hidden=!current;select.closest('label').hidden=!current;
  showWarning([result.problems.length?(current?t('一部の保存を読み込めませんでした。元の保存は変更せず、確認できた構成を表示しています。','Some saves could not be read. Original saves are unchanged; available configurations are shown.'):t('保存内容を読み込めませんでした。元の保存は変更していません。シミュレーターの保存欄で確認してください。','Saved data could not be read. Originals are unchanged; review them in the simulator’s saved-build section.')):'',preferenceWarning].filter(Boolean).join(' '));
  if(!current)return;
  const record=current;
  select.replaceChildren(...result.records.map(row=>{const option=make('option',(row.kind==='auto'?t('作業中','Working draft'):row.name)+' · '+row.meta.name+' · Lv'+row.saved.request.character.level);option.value=row.key;return option;}));select.value=record.key;
  find('[data-my-build-kind]').textContent=record.kind==='auto'?t('作業中の自動保存','Autosaved working draft'):t('名前付き保存','Named save');
  find('#my-build-name').textContent=record.kind==='auto'?record.meta.name:record.name;
  find('[data-my-build-preset]').textContent=record.kind==='auto'?record.meta.className:record.meta.name;
  find('[data-my-build-level]').textContent=String(record.saved.request.character.level);
  find('[data-my-build-equipment]').textContent=t(`${record.equipment}部位`,`${record.equipment} slots`);
  const savedDate=find('[data-my-build-date]');
  if(record.at){const time=make('time',new Intl.DateTimeFormat(en?'en-GB':'ja-JP',{dateStyle:'medium',timeStyle:'short'}).format(new Date(record.at)));time.dateTime=new Date(record.at).toISOString();savedDate.replaceChildren(document.createTextNode(t('保存：','Saved: ')),time);}else savedDate.textContent=t('保存日時は記録されていません。','No save date is recorded.');
  const tileMeta=find('[data-my-build-tile-meta]');if(tileMeta)tileMeta.textContent=(record.kind==='auto'?record.meta.name:record.name)+' · Lv'+record.saved.request.character.level;
  find('[data-my-build-resume]').href=resumeHref(record,en);
  find('[data-my-build-goal-open]').href=resumeHref(record,en,'goal');
  const growthLink=find('[data-my-build-growth-open]');if(growthLink)growthLink.href=resumeHref(record,en,'growth');
  const back=document.getElementById('sim-change-build');if(back){back.textContent=t('← マイビルド・一覧','← My builds / presets');back.setAttribute('aria-label',t('マイビルドホーム・ビルド一覧へ戻る','Back to My builds and presets'));}
  if(!viewTracked&&!section.closest('[hidden]')){track('my_build_home_view',record);viewTracked=true;}
  // The home stays light while editing; render the summaries when its chooser opens.
  if(section.closest('[hidden]')||panel?.hidden)return;
  await Promise.allSettled([renderGoal(record,token),renderUpdates(record,token)]);
 }
 const schedule=()=>{window.clearTimeout(timer);timer=window.setTimeout(()=>{void refresh();},80);};
 select.addEventListener('change',()=>{
  choice=select.value;
  try{storage().setItem(HOME_KEY,JSON.stringify({version:1,key:choice}));preferenceWarning='';}catch{preferenceWarning=t('表示する構成を記憶できません。保存した構成は変更していません。','The selected view could not be remembered. Your saved configurations are unchanged.');}
  void refresh();
 });
 find('[data-my-build-resume]').addEventListener('click',()=>track('my_build_home_resume'));
 find('[data-my-build-goal-open]').addEventListener('click',()=>track('my_build_home_goal'));
 retry.addEventListener('click',()=>{noticePromise=null;indexPromise=null;void refresh();});
 seenButton.addEventListener('click',()=>{
  try{const seen=readSeen(storage().getItem(SEEN_KEY));for(const row of shown)seen[row.id]=row.revision;const raw=JSON.stringify(seen);readSeen(raw);storage().setItem(SEEN_KEY,raw);window.dispatchEvent(new window.CustomEvent('poe2:updates-seen'));void refresh();}
  catch{showWarning(t('既読情報を保存できませんでした。構成と元の既読情報は保持しています。','Read status could not be saved. Configurations and the previous read status are intact.'));}
 });
 window.addEventListener('storage',event=>{if(!event.key||event.key===HOME_KEY||event.key.startsWith('poe2-simulator:')||event.key.startsWith('poe2-simulator-goal:')){if(event.key===HOME_KEY)choice=null;schedule();}});
 window.addEventListener('focus',schedule);window.addEventListener('pageshow',schedule);
 window.addEventListener('online',()=>{noticePromise=null;indexPromise=null;schedule();});
 for(const event of ['poe2:saved-builds','poe2:build-change','poe2:updates-seen'])window.addEventListener(event,schedule);
 const chooser=document.getElementById('sim-chooser'),observer=new window.MutationObserver(schedule);if(chooser)observer.observe(chooser,{attributes:true,attributeFilter:['hidden']});

 // A goal link is a read-only shortcut into the existing goal editor. The query
 // survives the simulator’s normal history updates, including named-save loads.
 const initial=new URL(window.location.href),homeView=initial.searchParams.get('home')==='growth'?'growth':'goal';let revealed=false;
 const revealGoal=()=>{const panel=document.getElementById('sim-'+homeView+'-panel');if(revealed||initial.searchParams.get('home')!==homeView||!panel||panel.hidden||window.Poe2SimulatorLibrary?.goalData()?.preset!==initial.searchParams.get('build'))return;revealed=true;panel.open=true;panel.scrollIntoView({block:'start'});panel.querySelector('summary')?.focus({preventScroll:true});};
 const targetObserver=new window.MutationObserver(revealGoal),target=document.getElementById('sim-'+homeView+'-panel');if(target)targetObserver.observe(target,{attributes:true,attributeFilter:['hidden']});const stats=document.getElementById('sim-stats');if(stats)targetObserver.observe(stats,{attributes:true,attributeFilter:['aria-busy']});window.addEventListener('poe2:build-change',revealGoal);revealGoal();
 return {ready:refresh(),refresh,observers:[observer,targetObserver]};
}
if(typeof document!=='undefined')installMyBuildHome(document);
