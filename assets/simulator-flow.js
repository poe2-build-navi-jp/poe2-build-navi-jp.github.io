// Reuse the simulator's controls and state. Changing a view never applies a draft.
export function installSimulatorFlow(document) {
 const window=document.defaultView,workbench=document.getElementById('sim-workbench');
 if(!workbench||workbench.dataset.flow)return;
 workbench.dataset.flow='true';document.body.classList.add('sim-flow');
 const en=document.documentElement.lang==='en',text=(ja,english)=>en?english:ja;
 const make=(tag,className,content)=>{const element=document.createElement(tag);if(className)element.className=className;if(content)element.textContent=content;return element;};
 const button=(id,label)=>{const element=make('button','',label);element.type='button';element.id=id;return element;};
 const layout=workbench.querySelector('.sim-layout'),editor=workbench.querySelector('.sim-editor'),results=workbench.querySelector('.sim-results'),nav=workbench.querySelector('.sim-tabs'),toolbar=workbench.querySelector('.sim-toolbar');
 if(!layout||!editor||!results||!nav||!toolbar)return;
 const tabs=[...nav.querySelectorAll('[data-tab]')];let lastTab=tabs.find(tab=>tab.getAttribute('aria-pressed')==='true')?.dataset.tab||'items';
 const copy={items:text('部位を選び、写真・手入力・ユニークから装備を入れます。','Choose a slot, then use a photo, manual modifiers or a unique item.'),skills:text('主力ジェムとサポートを選び、レベルを手持ちに合わせます。','Choose your active and support gems, then set their levels.'),tree:text('ノードを選び、必要ポイントを確認して取得します。','Choose passives and review the point cost before allocating.'),config:text('敵や追加効果を設定して「条件を反映」を押します。','Set the enemy and extra effects, then apply your conditions.'),results:text('反映済みの構成の計算結果です。未反映の装備入力は含みません。','Results for your applied build. Unapplied item drafts are excluded.')};

 // Keep the character level, history and main actions within immediate reach.
 const character=make('div','sim-character-settings'),level=document.querySelector('.sim-level-label');
 level.firstChild.textContent='Lv';document.getElementById('sim-level').setAttribute('aria-label',text('キャラクターLv','Character level'));character.append(level);
 const saveStatus=make('span','sim-flow-save');saveStatus.id='sim-flow-save-status';character.append(saveStatus);toolbar.firstElementChild.append(character);
 const history=workbench.querySelector('.sim-edit-history');toolbar.append(history);
 for(const [id,symbol,label]of [['sim-history-undo','↶',text('変更を戻す','Undo change')],['sim-history-redo','↷',text('やり直す','Redo change')]]){const control=document.getElementById(id),icon=make('span','sim-history-symbol',symbol),caption=make('span','sim-history-label',control.textContent);icon.setAttribute('aria-hidden','true');control.setAttribute('aria-label',label);control.replaceChildren(icon,caption);}
 const actions=toolbar.querySelector('.sim-actions');
 const fileMenu=make('details','sim-flow-file-menu'),fileToggle=make('summary','',text('共有・ファイル','Share / files')),filePanel=make('div','sim-flow-file-panel');
 fileToggle.setAttribute('aria-label',text('共有・保存ファイルの操作','Sharing and build files'));fileMenu.append(fileToggle,filePanel);filePanel.append(...actions.children);actions.append(fileMenu);
 const openSaved=button('sim-flow-saved',text('保存・比較','Saved builds'));
 const help=button('sim-flow-help',text('使い方','Help'));actions.prepend(openSaved);actions.append(help);
 document.addEventListener('click',event=>{if(!fileMenu.contains(event.target)||['sim-share','sim-download'].includes(event.target.closest('button')?.id))fileMenu.open=false;});
 document.getElementById('sim-file').addEventListener('change',()=>fileMenu.open=false);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&fileMenu.open){fileMenu.open=false;fileToggle.focus();}});
 const optional=make('section','sim-flow-tools');optional.id='sim-flow-tools';optional.setAttribute('aria-labelledby','sim-flow-tools-title');
 const toolsTitle=make('h2','',text('保存・比較と便利な機能','Save, compare and more'));toolsTitle.id='sim-flow-tools-title';optional.append(toolsTitle);
 optional.append(make('p','sim-flow-tools-intro',text('必要なものだけ開いて使えます。編集中の構成は、この端末に自動保存されます。','Open only what you need. Your applied build is saved automatically on this device.')));
 layout.after(optional);
 for(const id of ['sim-workspace','sim-examples-panel','sim-goal-panel','sim-planner-panel','sim-community-panel','sim-first-workbench']){const section=document.getElementById(id);if(section){optional.append(section);if(id==='sim-first-workbench')section.open=false;}}
 openSaved.addEventListener('click',()=>{const saved=document.getElementById('sim-workspace');saved.open=true;saved.scrollIntoView({block:'start'});saved.querySelector('summary').focus({preventScroll:true});});
 help.addEventListener('click',()=>{const guide=document.getElementById('sim-first-workbench');guide.open=true;guide.scrollIntoView({block:'start'});guide.querySelector('summary').focus({preventScroll:true});});

 // One navigation strip for input and results, above both columns.
 nav.classList.add('sim-flow-nav');nav.setAttribute('aria-label',text('シミュレーターの画面','Simulator views'));toolbar.after(nav);
 for(const tab of tabs){tab.setAttribute('aria-controls','sim-'+tab.dataset.tab);tab.textContent={items:text('装備','Gear'),skills:text('ジェム','Gems'),tree:text('パッシブ','Passives'),config:text('条件','Config')}[tab.dataset.tab];}
 const resultButton=button('sim-view-results',text('計算結果','Results'));resultButton.setAttribute('aria-pressed','false');resultButton.setAttribute('aria-controls','sim-results-panel');nav.append(resultButton);
 results.id='sim-results-panel';results.setAttribute('tabindex','-1');
 const context=make('p','sim-flow-context');context.id='sim-flow-context';nav.after(context);
 const back=button('sim-flow-back',text('← 入力に戻る','← Back to editing'));back.className='sim-flow-back';results.prepend(back);
 function editing(tab=lastTab){lastTab=tab;layout.dataset.view='editing';resultButton.setAttribute('aria-pressed','false');context.textContent=copy[tab]||copy.items;for(const element of tabs)element.setAttribute('aria-pressed',String(element.dataset.tab===tab));}
 function showResults(){layout.dataset.view='results';resultButton.setAttribute('aria-pressed','true');for(const element of tabs)element.setAttribute('aria-pressed','false');context.textContent=copy.results;results.scrollIntoView({block:'start'});results.focus({preventScroll:true});}
 resultButton.addEventListener('click',showResults);
 back.addEventListener('click',()=>{tabs.find(tab=>tab.dataset.tab===lastTab)?.click();nav.scrollIntoView({block:'start'});});
 window.addEventListener('poe2:view-change',event=>editing(event.detail.tab));
 // Existing result shortcuts also switch out of the mobile editor view first.
 document.addEventListener('click',event=>{const target=event.target.closest('button');if(!target)return;if(['sim-mobile-more','sim-item-show-stats'].includes(target.id)||target.dataset.mobileDetail)showResults();if(target.id==='sim-mobile-edit')editing();},true);
 editing();

 // Make a text payload an optional check for uniques; paste/photo staging opens it.
 const source=document.getElementById('sim-item-source'),payload=make('details','sim-flow-payload');payload.id='sim-item-payload';payload.append(make('summary','',text('装備テキストを確認・修正','Review or edit item text')));source.before(payload);payload.append(source);
 window.addEventListener('poe2:equipment-mode',event=>{payload.hidden=event.detail.mode==='rare';payload.open=event.detail.mode==='paste';});
 const modes=document.querySelector('.sim-equipment-modes'),photo=document.querySelector('.sim-photo-entry');if(photo)modes.before(photo);
 for(const mode of modes.querySelectorAll('[data-equipment-mode]')){mode.setAttribute('aria-label',mode.textContent);mode.textContent={unique:text('ユニーク','Unique'),rare:text('レアを作成','Create rare'),paste:text('テキスト','Paste text')}[mode.dataset.equipmentMode];}

 // Keep only preview and apply in the sticky action bar. Destructive/reset actions
 // stay in the ordinary document flow, away from the main apply target.
 const apply=document.getElementById('sim-item-apply'),itemActions=apply.closest('.sim-actions'),secondary=make('div','sim-flow-secondary-actions');itemActions.after(secondary);
 const placeActions=()=>{for(const id of ['sim-item-remove','sim-item-reset']){const element=document.getElementById(id);if(element&&element.parentElement!==secondary)secondary.append(element);}const note=document.getElementById('sim-editor-draft-status');if(note&&note.parentElement!==itemActions)itemActions.prepend(note);};
 placeActions();
 const actionObserver=new window.MutationObserver(placeActions);actionObserver.observe(itemActions,{childList:true});

 // Ten main equipment slots first; the five utility slots are explicitly expandable.
 const slots=document.getElementById('sim-slots'),utility=button('sim-flow-utilities',text('フラスコ・チャームを表示','Show flasks and charms'));utility.setAttribute('aria-expanded','false');utility.setAttribute('aria-controls','sim-slots');slots.after(utility);
 utility.addEventListener('click',()=>{const expanded=utility.getAttribute('aria-expanded')!=='true';utility.setAttribute('aria-expanded',String(expanded));slots.toggleAttribute('data-utilities-open',expanded);utility.textContent=expanded?text('フラスコ・チャームを閉じる','Hide flasks and charms'):text('フラスコ・チャームを表示','Show flasks and charms');});

 const status=document.getElementById('sim-save-status'),refresh=()=>{const full=status.textContent;saveStatus.textContent=['この端末に保存済み','Saved on this device'].includes(full)?text('自動保存済み','Saved'):full;saveStatus.title=full;resultButton.disabled=tabs.every(tab=>tab.disabled);};
 const statusObserver=new window.MutationObserver(refresh);statusObserver.observe(status,{childList:true,subtree:true,characterData:true});statusObserver.observe(tabs[0],{attributes:true,attributeFilter:['disabled']});refresh();
 // Offer a clearly labelled, equipped sample without replacing a visitor's save.
 const chooser=document.querySelector('.sim-hero-inner'),entry=make('div','sim-flow-entry');
 const sample=make('a','sim-flow-sample',text('装備入りの見本で試す','Try an equipped sample'));sample.href=(en?'/en':'')+'/simulator/?build=mercenary-twister-gemling&example=complete-mercenary-twister-gemling';
 const resume=make('a','',text('保存した構成の続き','Continue a saved build'));resume.href='#sim-resume';entry.append(sample,resume);chooser.append(entry);
 return {editing,showResults,observers:[actionObserver,statusObserver]};
}
if(typeof document!=='undefined')installSimulatorFlow(document);
