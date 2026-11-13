import {skillIcons} from './skill-icon-data.js?v=e02be58c1b';
import {createSkillMatcher,skillTextHtml,skillImageHtml,skipSkillElement} from './skill-icon-matcher.js?v=afb5bc697b';

const matcher=createSkillMatcher(skillIcons);
export function installSkillIcons(document) {
  const main=document.querySelector('main');
  if(!main)return null;
  const window=document.defaultView;
  const excluded=node=>{
    for(let parent=node.nodeType===1?node:node.parentElement;parent&&parent!==main;parent=parent.parentElement) {
      if(skipSkillElement(parent.localName,Object.fromEntries([...parent.attributes].map(a=>[a.name,a.value]))))return true;
    }
    return false;
  };
  function selected(root) {
    const fields=[...(root.nodeType===1&&root.matches('[data-skill-selected]')?[root]:[]),...root.querySelectorAll?.('[data-skill-selected]')||[]];
    for(const field of fields) {
      const entry=matcher.lookup(field.dataset.skillSelected),old=field.querySelector('.skill-icon');
      if(old?.getAttribute('src')===entry?.src)continue;
      old?.remove();
      if(entry)field.insertAdjacentHTML('afterbegin',skillImageHtml(entry));
    }
  }
  function decorate(root) {
    if(!root.isConnected)return;
    selected(root);
    const nodes=[];
    if(root.nodeType===3)nodes.push(root);
    else if(!excluded(root)) {
      const walker=document.createTreeWalker(root,4);
      while(walker.nextNode())nodes.push(walker.currentNode);
    }
    for(const node of nodes) {
      if(excluded(node)||!matcher.matches(node.data).length)continue;
      const fragment=document.createRange().createContextualFragment(skillTextHtml(node.data,matcher));
      node.replaceWith(fragment);
    }
  }
  decorate(main);
  // Re-annotate only changed text/subtrees, including level changes and rendered gem rows.
  let scheduled=false;
  const pending=new Set();
  const observer=new window.MutationObserver(records=>{
    for(const record of records) {
      if(record.type==='characterData') {if(!excluded(record.target))pending.add(record.target);}
      else for(const node of record.addedNodes)if(node.nodeType===1&&node.matches('[data-skill-selected]')||!excluded(node))pending.add(node);
    }
    if(scheduled||!pending.size)return;
    scheduled=true;
    (window.requestAnimationFrame?.bind(window)||window.setTimeout.bind(window))(()=>{
      scheduled=false;
      const roots=[...pending];pending.clear();
      for(const node of roots)if(!roots.some(other=>other!==node&&other.contains(node)))decorate(node);
    });
  });
  observer.observe(main,{childList:true,characterData:true,subtree:true});
  // Keep the original skill name legible if an image is unavailable.
  main.addEventListener('error',event=>{if(event.target.matches?.('img.skill-icon'))event.target.hidden=true;},true);
  return observer;
}

if(typeof document!=='undefined')installSkillIcons(document);
