import {skillIcons} from './skill-icon-data.js?v=e02be58c1b';
import {createSkillMatcher,skillImageHtml,escapeSkillText} from './skill-icon-matcher.js?v=afb5bc697b';

const matcher=createSkillMatcher(skillIcons);
const sessions=new WeakMap();
// Let hiragana, katakana, full-width characters and either language find the same skill.
export const normalizeSkillSearch=value=>String(value).normalize('NFKC').toLowerCase().replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60)).replace(/[\s'’‘]+/g,'');
export function searchSkills(gems,label,query,support){
 const terms=String(query).trim().split(/\s+/).map(normalizeSkillSearch).filter(Boolean);
 return gems.filter(gem=>!gem.ui_hidden&&gem.is_support===support).filter(gem=>{
  const image=matcher.lookup(gem.name);
  const text=normalizeSkillSearch([label(gem.name),gem.name,...image?.names||[]].join(' '));
  return terms.every(term=>text.includes(term));
 });
}

export function openSkillPicker({document,gems,label,support,selected,onSelect,returnFocus}){
 let state=sessions.get(document);
 if(!state){
  const en=document.documentElement.lang==='en';
  const copy=en?{title:'Find a skill',support:'Find a support',close:'Close',search:'Search by name',placeholder:'Japanese or English name',empty:'No matches. Try a shorter name.',more:'Show more',selected:'Selected',count:(shown,total)=>`${shown} of ${total} results`}:{title:'スキルを画像・名前で探す',support:'サポートを画像・名前で探す',close:'閉じる',search:'名前で検索',placeholder:'日本語・英語・ひらがなで検索',empty:'見つかりません。短い名前でも検索できます。',more:'続きを表示',selected:'選択中',count:(shown,total)=>`${total}件中 ${shown}件を表示`};
  const dialog=document.createElement('dialog');dialog.id='sim-skill-picker';dialog.className='sim-skill-picker';dialog.setAttribute('aria-labelledby','sim-skill-picker-title');
  dialog.innerHTML=`<div class="sim-skill-picker-head"><h2 id="sim-skill-picker-title"></h2><button type="button" data-picker-close>${copy.close}</button></div><label for="sim-skill-search">${copy.search}</label><input id="sim-skill-search" type="search" autocomplete="off" spellcheck="false" placeholder="${copy.placeholder}" aria-controls="sim-skill-options"><p id="sim-skill-count" role="status" aria-live="polite"></p><div class="sim-skill-scroll"><div id="sim-skill-options" class="sim-skill-options"></div><button type="button" data-picker-more>${copy.more}</button></div>`;
  document.querySelector('main').append(dialog);
  state={dialog,copy,input:dialog.querySelector('input'),list:dialog.querySelector('#sim-skill-options'),count:dialog.querySelector('#sim-skill-count'),more:dialog.querySelector('[data-picker-more]')};
  state.render=()=>{
   const matches=searchSkills(state.gems,state.label,state.input.value,state.support),shown=matches.slice(0,state.limit);
   state.list.innerHTML=shown.map(gem=>{
    const image=matcher.lookup(gem.name),name=state.label(gem.name),current=gem.skill_id===state.selected;
    return `<button type="button" class="sim-skill-option" data-picker-skill="${escapeSkillText(gem.skill_id)}" aria-pressed="${current}">${image?skillImageHtml(image):''}<span><strong>${escapeSkillText(name)}</strong>${name!==gem.name?`<small>${escapeSkillText(gem.name)}</small>`:''}${current?`<small class="sim-skill-current">${copy.selected}</small>`:''}</span></button>`;
   }).join('')||`<p class="sim-skill-empty">${copy.empty}</p>`;
   state.count.textContent=copy.count(shown.length,matches.length);state.more.hidden=shown.length===matches.length;
  };
  const close=()=>{dialog.close();if(state.returnFocus?.isConnected)state.returnFocus.focus({preventScroll:true});};
  state.input.addEventListener('input',()=>{state.limit=40;state.render();state.list.parentElement.scrollTop=0;});
  dialog.addEventListener('click',event=>{
   const button=event.target.closest('button');if(!button)return;
   if(button.hasAttribute('data-picker-close'))close();
   else if(button.hasAttribute('data-picker-more')){state.limit+=40;state.render();}
   else if(button.dataset.pickerSkill){const id=button.dataset.pickerSkill;close();state.onSelect(id);}
  });
  sessions.set(document,state);
 }
 Object.assign(state,{gems,label,support,selected,onSelect,returnFocus,limit:40});
 state.input.value='';state.dialog.querySelector('h2').textContent=support?state.copy.support:state.copy.title;
 state.render();state.list.parentElement.scrollTop=0;state.dialog.showModal();
 // Leave the software keyboard closed until the user taps Search on a phone.
 const phone=document.defaultView.matchMedia?.('(max-width: 720px)').matches;
 (phone?state.dialog.querySelector('[data-picker-close]'):state.input).focus({preventScroll:true});
}
