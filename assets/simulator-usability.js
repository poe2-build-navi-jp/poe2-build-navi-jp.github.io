const norm=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60)).replace(/\s+/g,'');
export function installSimulatorUsability(document) {
 if(!document.querySelector('#sim-chooser'))return;
 const window=document.defaultView,en=document.documentElement.lang==='en',copy=en?{count:n=>`${n} builds`,picker:'Choose by image',base:'Browse base images',ready:'Changes are applied with “Apply this item”.',dirty:'Draft changed · apply to update stats',reset:'Reset draft',life:'+ Life',resist:'+ Elemental resistances',shortcut:'Ctrl / ⌘ + Enter to apply',loading:'Opening equipment…',error:'Could not open equipment images. Use the name selector or try again.'}:{count:n=>`${n}件のビルド`,picker:'画像から選ぶ',base:'ベース画像から選ぶ',ready:'入力後に「この装備を反映」で能力値が変わります。',dirty:'未反映の入力があります・反映すると能力値が変わります',reset:'入力をやり直す',life:'＋ ライフ',resist:'＋ 全元素耐性',shortcut:'Ctrl / ⌘ ＋ Enter で反映',loading:'装備一覧を開いています…',error:'画像一覧を開けません。名前の選択欄を使うか、もう一度お試しください。'};
 const query=document.querySelector('#sim-build-search'),filter=document.querySelector('#sim-class-filter'),cards=[...document.querySelectorAll('[data-preset]')];
 function filterBuilds(){const terms=(query?.value||'').trim().split(/\s+/).map(norm).filter(Boolean);let shown=0;for(const card of cards){const text=norm(card.textContent+' '+(card.dataset.buildKeywords||''));card.hidden=!!filter.value&&card.dataset.buildClass!==filter.value||!terms.every(term=>text.includes(term));if(!card.hidden)shown++;}const count=document.querySelector('#sim-build-count');if(count)count.textContent=copy.count(shown);const empty=document.querySelector('#sim-build-empty');if(empty)empty.hidden=shown!==0;}
 query?.addEventListener('input',filterBuilds);
 filter?.addEventListener('change',event=>{event.stopImmediatePropagation();filterBuilds();},true);
 document.querySelector('#sim-build-reset')?.addEventListener('click',()=>{query.value='';filter.value='';filterBuilds();query.focus();});filterBuilds();
 const editor=document.querySelector('#sim-item-editor'),apply=document.querySelector('#sim-item-apply'),actions=apply.closest('.sim-actions');actions.classList.add('sim-item-actions');
 const note=document.createElement('p');note.id='sim-editor-draft-status';note.className='sim-editor-draft-status';note.setAttribute('role','status');note.textContent=copy.ready;actions.before(note);
 const reset=document.createElement('button');reset.id='sim-item-reset';reset.type='button';reset.textContent=copy.reset;actions.append(reset);
 const dirty=()=>{note.textContent=copy.dirty;note.dataset.dirty='true';};
 document.addEventListener('sim-equipment-applied',()=>{note.textContent=copy.ready;delete note.dataset.dirty;});
 editor.addEventListener('input',event=>{if(!event.target.matches('input[type=search]'))dirty();});editor.addEventListener('change',event=>{if(event.target.matches('#sim-rare-base,[data-rare-mod]'))dirty();if(event.target.matches('#sim-unique,#sim-roll'))note.textContent=en?'Choose “Load into editor” to use this item and roll.':'選んだ装備・可変値は「編集欄に入れる」で更新できます。';});
 const quick=document.createElement('div');quick.className='sim-quick-modifiers';for(const [key,label]of [['life',copy.life],['all_res',copy.resist]]){const button=document.createElement('button');button.type='button';button.dataset.rareQuick=key;button.textContent=label;quick.append(button);}document.querySelector('#sim-rare-modifiers').before(quick);
 let pickerSequence=0;
 for(const [id,kind,label]of [['sim-unique','unique',copy.picker],['sim-rare-base','base',copy.base]]){
  const select=document.getElementById(id),button=document.createElement('button');button.type='button';button.className='sim-equipment-find';button.textContent=label;button.setAttribute('aria-haspopup','dialog');select.closest('label').after(button);
  button.addEventListener('click',async()=>{
   const token=++pickerSequence,slot=document.querySelector('#sim-slot-title').textContent,previousNote=note.textContent,panel=select.closest(kind==='unique'?'#sim-unique-editor':'#sim-rare-editor');button.disabled=true;note.textContent=copy.loading;
   try{const {openEquipmentPicker}=await import('./simulator-equipment-picker.js?v=6562060afd');if(token!==pickerSequence||editor.hidden||panel.hidden||slot!==document.querySelector('#sim-slot-title').textContent)return;
    const field=kind==='unique'?document.querySelector('#sim-unique-search'):null,initialQuery=field?.value||'',selected=select.value;
    if(initialQuery){field.value='';field.dispatchEvent(new window.Event('input',{bubbles:true}));}
    const options=[...select.options].filter(option=>option.value!=='').map(option=>({value:option.value,label:option.textContent}));
    if(initialQuery){field.value=initialQuery;field.dispatchEvent(new window.Event('input',{bubbles:true}));select.value=selected;}
    openEquipmentPicker({document,options,kind,selected,query:initialQuery,returnFocus:button,onSelect:value=>{if(editor.hidden||panel.hidden||slot!==document.querySelector('#sim-slot-title').textContent)return;if(field?.value){field.value='';field.dispatchEvent(new window.Event('input',{bubbles:true}));}select.value=value;select.dispatchEvent(new window.Event('change',{bubbles:true}));if(kind==='unique')document.querySelector('#sim-unique-draft').click();else dirty();}});note.textContent=previousNote;
   }catch{note.textContent=copy.error;}finally{button.disabled=false;if(note.textContent===copy.loading)note.textContent=previousNote;}
  });
 }
 document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&!editor.hidden&&!document.querySelector('dialog[open]')&&editor.contains(event.target)&&!apply.disabled){event.preventDefault();apply.click();}});
 apply.title=copy.shortcut;
 const observe=window.MutationObserver?new window.MutationObserver(records=>{if(records.some(record=>record.type==='attributes'&&record.attributeName==='hidden'&&record.target===editor)){pickerSequence++;note.textContent=copy.ready;delete note.dataset.dirty;}const count=document.querySelectorAll('#sim-rare-modifiers [data-rare-row]').length;for(const button of quick.querySelectorAll('button'))button.disabled=count>=10&&!document.querySelector(`#sim-rare-modifiers [data-rare-mod] option[value="${button.dataset.rareQuick}"]:checked`);}):null;
 observe?.observe(editor,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
 if(window.ResizeObserver){const summary=document.querySelector('#sim-mobile-summary');new window.ResizeObserver(()=>document.documentElement.style.setProperty('--sim-summary-space',`${summary.getBoundingClientRect().height+8}px`)).observe(summary);}
 return {filterBuilds,observer:observe};
}
if(typeof document!=='undefined')installSimulatorUsability(document);
