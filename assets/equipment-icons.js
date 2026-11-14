import {equipmentIcons} from './equipment-icon-data.js?v=5019a2af24';
import {createEquipmentMatcher,equipmentImageHtml,equipmentTextHtml,skipEquipmentElement} from './equipment-icon-matcher.js?v=3f38429302';

const matcher=createEquipmentMatcher(equipmentIcons);
export function installEquipmentIcons(document) {
  const main=document.querySelector('main');
  if(!main)return null;
  const window=document.defaultView;
  const excluded=node=>{
    for(let parent=node.nodeType===1?node:node.parentElement;parent;parent=parent.parentElement) {
      if(skipEquipmentElement(parent.localName,Object.fromEntries([...parent.attributes].map(a=>[a.name,a.value]))))return true;
      if(parent===main)break;
    }
    return false;
  };
  function setImage(field,entry) {
    const old=field.querySelector(':scope>.equipment-icon');
    if(old?.getAttribute('src')===entry?.src)return;
    old?.remove();
    if(entry)field.insertAdjacentHTML('afterbegin',equipmentImageHtml(entry));
  }
  function refreshEquipment() {
    for(const field of main.querySelectorAll('[data-equipment-text]'))setImage(field,matcher.fromItemText(field.dataset.equipmentText));
    for(const select of main.querySelectorAll('#sim-unique,#sim-rare-base')) {
      let field=select.parentElement;
      if(!field.classList.contains('equipment-select-field')) {
        const wrapper=document.createElement('span');wrapper.className='equipment-select-field';
        select.before(wrapper);wrapper.append(select);field=wrapper;
      }
      const entry=select.value?(select.id==='sim-rare-base'?matcher.base(select.value):matcher.unique(Number(select.value))||matcher.lookup(select.selectedOptions[0]?.textContent)):null;
      setImage(field,entry);
    }
  }
  function decorate(root) {
    if(!root.isConnected)return;
    const nodes=[];
    if(root.nodeType===3)nodes.push(root);
    else if(!excluded(root)) {
      const walker=document.createTreeWalker(root,4);
      while(walker.nextNode())nodes.push(walker.currentNode);
    }
    for(const node of nodes) {
      if(excluded(node)||!matcher.matches(node.data).length)continue;
      node.replaceWith(document.createRange().createContextualFragment(equipmentTextHtml(node.data,matcher)));
    }
  }
  decorate(main);refreshEquipment();
  let scheduled=false;
  const pending=new Set();
  const observer=new window.MutationObserver(records=>{
    let controls=false;
    for(const record of records) {
      if(record.type==='attributes'){controls=true;continue;}
      if(record.target.nodeType===1&&record.target.closest('#sim-slots,#sim-unique,#sim-rare-base'))controls=true;
      if(record.type==='characterData'){if(!excluded(record.target))pending.add(record.target);}
      else for(const node of record.addedNodes)if(!excluded(node))pending.add(node);
    }
    if(scheduled||(!pending.size&&!controls))return;
    scheduled=true;
    (window.requestAnimationFrame?.bind(window)||window.setTimeout.bind(window))(()=>{
      scheduled=false;const roots=[...pending];pending.clear();
      for(const node of roots)if(!roots.some(other=>other!==node&&other.contains(node)))decorate(node);
      refreshEquipment();
    });
  });
  observer.observe(main,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['data-equipment-text']});
  main.addEventListener('change',event=>{if(event.target.matches?.('#sim-unique,#sim-rare-base'))refreshEquipment();});
  main.addEventListener('error',event=>{if(event.target.matches?.('img.equipment-icon'))event.target.hidden=true;},true);
  return observer;
}
if(typeof document!=='undefined')installEquipmentIcons(document);
