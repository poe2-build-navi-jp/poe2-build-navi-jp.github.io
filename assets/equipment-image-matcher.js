import {createSkillMatcher,escapeSkillText,skipSkillElement} from './skill-icon-matcher.js?v=884cd24193';
export const equipmentKey=value=>String(value||'').normalize('NFKC').replace(/[’‘]/g,"'").toLowerCase().trim();

export function equipmentTextIdentity(text){
 const lines=String(text||'').trim().split(/\r?\n/).map(line=>line.trim());
 const rarity=/^(?:Rarity|レアリティ):/i.test(lines[0]||'');
 const normal=/^(?:Rarity:\s*Normal|レアリティ:\s*ノーマル)$/i.test(lines[0]||'');
 const name=lines[rarity?1:0]||'',base=rarity&&!normal?lines[2]||'':name;
 const variants=lines.filter(line=>/^Variant:/.test(line)).map(line=>line.slice(8).trim());
 const selected=Number(lines.find(line=>/^Selected Variant:/.test(line))?.split(':')[1]);
 let variant=variants[selected-1]||'';
 if(!variant&&equipmentKey(name)==='guiding palm')variant=lines.find(line=>/Purity of (?:Fire|Ice|Lightning)/.test(line))||'';
 return {name,base:/^[-=]+$/.test(base)?'':base,variant};
}

export function createEquipmentMatcher(entries){
 const exact=new Map();
 for(const entry of entries)for(const name of entry.names){const k=equipmentKey(name);if(!exact.has(k))exact.set(k,[]);exact.get(k).push(entry);}
 const lookup=(name,base='',variant='')=>{
  if(equipmentKey(name)==='guiding palm'&&variant){
   const kind=/\b(?:Cold|Ice)\b/i.test(variant)?'Eye':/\bFire\b/i.test(variant)?'Heart':/\bLightning\b/i.test(variant)?'Mind':null;
   if(kind)return lookup('Guiding Palm of the '+kind);
  }
  const candidates=exact.get(equipmentKey(name))||[];
  const unique=candidates.filter(entry=>entry.kind==='unique');
  const typed=unique.find(entry=>entry.baseNames?.some(value=>equipmentKey(value)===equipmentKey(base)));
  if(typed)return typed;
  if(unique.length===1)return unique[0];
  if(unique.length&&unique.every(entry=>entry.src===unique[0].src))return unique[0];
  const ownBase=candidates.find(entry=>entry.kind==='base');
  return ownBase||(exact.get(equipmentKey(base))||[]).find(entry=>entry.kind==='base')||null;
 };
 const prose=createSkillMatcher(entries.filter(entry=>entry.prose!==false).map(entry=>({...entry,support:entry.kind==='base'})));
 return {lookup,matches:prose.matches};
}
export const equipmentImageHtml=entry=>`<img class="equipment-icon" src="${escapeSkillText(entry.src)}" width="32" height="48" alt="" aria-hidden="true" loading="lazy" decoding="async"${entry.imageTitle?` title="${escapeSkillText(entry.imageTitle)}"`:''}>`;
export function equipmentTextHtml(value,matcher){
 let out='',position=0;
 for(const {start,end,entry} of matcher.matches(value)){
  out+=escapeSkillText(value.slice(position,start));
  out+=`<span class="equipment-name" data-equipment-image="${escapeSkillText(entry.id)}">${equipmentImageHtml(entry)}${escapeSkillText(value.slice(start,end))}</span>`;position=end;
 }
 return out+escapeSkillText(value.slice(position));
}
export const skipEquipmentElement=(tag,attrs)=>skipSkillElement(tag,attrs)||attrs['data-equipment-image']!==undefined||attrs['data-equipment-selected']!==undefined||/(?:^|\s)equipment-(?:name|preview)(?:\s|$)/.test(attrs.class||'');
