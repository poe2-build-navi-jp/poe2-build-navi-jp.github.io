import {equipmentImages} from './equipment-image-data.js?v=474d410d9f';
import {createEquipmentMatcher,equipmentTextHtml,equipmentImageHtml,equipmentTextIdentity,skipEquipmentElement} from './equipment-image-matcher.js?v=19267ea324';

const matcher=createEquipmentMatcher(equipmentImages);
export function installEquipmentImages(document){
 const main=document.querySelector('main');if(!main)return null;
 const window=document.defaultView,en=document.documentElement.lang==='en';
 const excluded=node=>{for(let p=node.nodeType===1?node:node.parentElement;p&&p!==main;p=p.parentElement)if(skipEquipmentElement(p.localName,Object.fromEntries([...p.attributes].map(a=>[a.name,a.value]))))return true;return false;};
 function selected(root){
  const fields=[...(root.nodeType===1&&root.matches('[data-equipment-selected]')?[root]:[]),...root.querySelectorAll?.('[data-equipment-selected]')||[]];
  for(const field of fields){
   const image=matcher.lookup(field.dataset.equipmentSelected,field.dataset.equipmentBase,field.dataset.equipmentVariant);
   const old=field.querySelector(':scope > .equipment-icon');
   if(old?.getAttribute('src')!==image?.src){old?.remove();if(image)field.insertAdjacentHTML('afterbegin',equipmentImageHtml(image));}
   if(field.hasAttribute('data-equipment-preview')){
    field.hidden=!image;
    const caption=field.querySelector('figcaption');
    const text=image?.kind==='base'?(en?'Base item appearance':'ベース装備の画像'):(en?'Equipment image':'装備画像');
    if(caption&&caption.textContent!==text)caption.textContent=text;
   }
  }
 }
 function decorate(root){
  if(!root.isConnected)return;selected(root);
  const nodes=[];
  if(root.nodeType===3)nodes.push(root);
  else if(!excluded(root)){const walker=document.createTreeWalker(root,4);while(walker.nextNode())nodes.push(walker.currentNode);}
  for(const node of nodes){if(excluded(node)||!matcher.matches(node.data).length)continue;node.replaceWith(document.createRange().createContextualFragment(equipmentTextHtml(node.data,matcher)));}
 }
 function editor(){
  const field=document.querySelector('#sim-equipment-preview');if(!field)return;
  const rare=document.querySelector('[data-equipment-mode="rare"][aria-pressed="true"]');
  const option=document.querySelector(rare?'#sim-rare-base option:checked':'#sim-unique option:checked');
  const text=equipmentTextIdentity(document.querySelector('#sim-item-text')?.value||'');
  const name=option?.dataset.equipmentName||(!rare?text.name:'');
  const values={equipmentSelected:name||'',equipmentBase:option?.dataset.equipmentBase||text.base||'',equipmentVariant:!rare&&(!option?.dataset.equipmentName||name===text.name)?text.variant:''};
  for(const [key,value] of Object.entries(values))if(field.dataset[key]!==value)field.dataset[key]=value;
  selected(field);
 }
 decorate(main);editor();
 let scheduled=false;const pending=new Set();
 const observer=new window.MutationObserver(records=>{
  for(const record of records){
   if(record.type==='attributes')pending.add(record.target);
   else if(record.type==='characterData'){if(!excluded(record.target))pending.add(record.target);}
   else for(const node of record.addedNodes)if(node.nodeType===1&&node.matches('[data-equipment-selected]')||!excluded(node))pending.add(node);
  }
  if(scheduled||!pending.size)return;scheduled=true;
  (window.requestAnimationFrame?.bind(window)||window.setTimeout.bind(window))(()=>{
   scheduled=false;const roots=[...pending];pending.clear();for(const node of roots)if(!roots.some(other=>other!==node&&other.contains(node)))decorate(node);editor();
  });
 });
 observer.observe(main,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['data-equipment-selected','data-equipment-base','data-equipment-variant','aria-pressed']});
 main.addEventListener('change',editor);main.addEventListener('input',event=>{if(event.target.id==='sim-item-text')editor();});
 main.addEventListener('error',event=>{if(event.target.matches?.('img.equipment-icon'))event.target.hidden=true;},true);
 return observer;
}
if(typeof document!=='undefined')installEquipmentImages(document);
