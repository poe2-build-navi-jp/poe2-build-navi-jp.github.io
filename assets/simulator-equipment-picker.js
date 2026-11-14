import {equipmentIcons} from './equipment-icon-data.js?v=5019a2af24';
import {createEquipmentMatcher,equipmentImageHtml} from './equipment-icon-matcher.js?v=3f38429302';
const matcher=createEquipmentMatcher(equipmentIcons),sessions=new WeakMap();
export const normalizeEquipmentSearch=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60)).replace(/[\s'’‘]+/g,'');
export function searchEquipment(options,query,kind) {
 const terms=String(query).trim().split(/\s+/).map(normalizeEquipmentSearch).filter(Boolean);
 return options.map(option=>({...option,image:kind==='base'?matcher.base(option.value):matcher.unique(Number(option.value))})).filter(option=>{
  const text=normalizeEquipmentSearch([option.label,option.image?.name,...option.image?.names||[]].join(' '));return terms.every(term=>text.includes(term));
 });
}
export function openEquipmentPicker({document,options,kind,selected,onSelect,returnFocus,query=''}) {
 let state=sessions.get(document);
 if(!state){
  const en=document.documentElement.lang==='en',copy=en?{title:'Choose equipment by image',close:'Close',search:'Search equipment',placeholder:'Japanese, English or hiragana',more:'Show more',empty:'No matches. Try a shorter name.',note:'Selecting prepares the editor. Apply when you are ready.',count:(shown,total)=>`${shown} of ${total} results`}:{title:'装備を画像から選ぶ',close:'閉じる',search:'装備名で検索',placeholder:'日本語・英語・ひらがなに対応',more:'続きを表示',empty:'見つかりません。短い名前でも検索できます。',note:'選ぶと編集欄に入ります。「この装備を反映」で適用できます。',count:(shown,total)=>`${total}件中 ${shown}件を表示`};
  const dialog=document.createElement('dialog');dialog.id='sim-equipment-picker';dialog.className='sim-equipment-picker';dialog.setAttribute('aria-labelledby','sim-equipment-picker-title');
  dialog.innerHTML='<div class="sim-equipment-picker-head"><h2 id="sim-equipment-picker-title"></h2><button type="button" data-equipment-close></button></div><p data-equipment-note></p><label for="sim-equipment-search"></label><input id="sim-equipment-search" type="search" autocomplete="off" aria-controls="sim-equipment-options"><p role="status" data-equipment-count></p><div class="sim-equipment-scroll"><div id="sim-equipment-options"></div><button type="button" data-equipment-more></button></div>';
  dialog.querySelector('h2').textContent=copy.title;dialog.querySelector('[data-equipment-close]').textContent=copy.close;dialog.querySelector('[data-equipment-note]').textContent=copy.note;dialog.querySelector('label').textContent=copy.search;dialog.querySelector('input').placeholder=copy.placeholder;dialog.querySelector('[data-equipment-more]').textContent=copy.more;
  document.querySelector('main').append(dialog);
  state={dialog,copy,input:dialog.querySelector('input'),list:dialog.querySelector('#sim-equipment-options'),count:dialog.querySelector('[data-equipment-count]'),more:dialog.querySelector('[data-equipment-more]')};
  state.render=()=>{
   const matches=searchEquipment(state.options,state.input.value,state.kind),shown=matches.slice(0,state.limit);state.list.replaceChildren();
   for(const option of shown){const button=document.createElement('button');button.type='button';button.dataset.equipmentChoice=option.value;button.setAttribute('aria-pressed',String(option.value===state.selected));
    if(option.image)button.insertAdjacentHTML('beforeend',equipmentImageHtml(option.image));
    const span=document.createElement('span'),name=document.createElement('strong');name.textContent=option.label;span.append(name);if(option.image&&option.label!==option.image.name){const small=document.createElement('small');small.textContent=option.image.name;span.append(small);}button.append(span);state.list.append(button);
   }
   if(!shown.length){const p=document.createElement('p');p.textContent=copy.empty;state.list.append(p);}
   state.count.textContent=copy.count(shown.length,matches.length);state.more.hidden=shown.length===matches.length;
  };
  const close=()=>dialog.close();
  dialog.addEventListener('close',()=>state.returnFocus?.isConnected&&state.returnFocus.focus({preventScroll:true}));
  dialog.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-equipment-close'))close();else if(button.hasAttribute('data-equipment-more')){state.limit+=36;state.render();}else if(button.hasAttribute('data-equipment-choice')){const value=button.dataset.equipmentChoice;close();state.onSelect(value);}});
  state.input.addEventListener('input',()=>{state.limit=36;state.render();state.list.parentElement.scrollTop=0;});sessions.set(document,state);
 }
 Object.assign(state,{options,kind,selected,onSelect,returnFocus,limit:36});state.input.value=query;state.render();state.list.parentElement.scrollTop=0;state.dialog.showModal();
 (document.defaultView.matchMedia?.('(max-width: 720px)').matches?state.dialog.querySelector('[data-equipment-close]'):state.input).focus({preventScroll:true});
}
