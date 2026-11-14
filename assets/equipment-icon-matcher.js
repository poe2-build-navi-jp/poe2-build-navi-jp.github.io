import {createSkillMatcher,escapeSkillText,skipSkillElement} from './skill-icon-matcher.js?v=4b20b1824e';

export function createEquipmentMatcher(entries) {
  const matcher=createSkillMatcher(entries);
  const bases=new Map(entries.filter(entry=>entry.baseId).map(entry=>[entry.baseId,entry]));
  const uniques=new Map(entries.filter(entry=>entry.uniqueId!==undefined).map(entry=>[entry.uniqueId,entry]));
  return {...matcher,base:id=>bases.get(id),unique:id=>uniques.get(id),fromItemText(text) {
    // Only the item header identifies artwork. Modifier lines may mention other items.
    const header=String(text||'').split(/\r?\n/).slice(0,8);
    const separator=header.findIndex(line=>/^[-=]{3,}/.test(line));
    const lines=separator<0?header:header.slice(0,separator);
    const found=lines.map(line=>matcher.lookup(line.trim())).filter(Boolean);
    let unique=found.find(entry=>entry.kind==='unique');
    if(unique?.name==='Grand Spectrum')unique=entries.find(entry=>entry.name===unique.name&&lines.includes(entry.itemBase))||unique;
    if(unique?.name==='Guiding Palm') {
      const variant=String(text).match(/(?:^|\n)Grants Skill:[^\n]*Purity of (Fire|Ice|Lightning)/)?.[1];
      if(variant)unique=matcher.lookup('Guiding Palm of the '+({Fire:'Heart',Ice:'Eye',Lightning:'Mind'}[variant]))||unique;
    }
    return unique||found.find(entry=>entry.kind==='base');
  }};
}

export const equipmentImageHtml=entry=>`<img class="equipment-icon" src="${escapeSkillText(entry.src)}" width="40" height="40" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
export function equipmentTextHtml(value,matcher) {
  let output='',position=0;
  for(const {start,end,entry} of matcher.matches(value)) {
    output+=escapeSkillText(value.slice(position,start));
    output+=`<span class="equipment-name" data-equipment-icon="${escapeSkillText(entry.id)}">${equipmentImageHtml(entry)}${escapeSkillText(value.slice(start,end))}</span>`;
    position=end;
  }
  return output+escapeSkillText(value.slice(position));
}
export function skipEquipmentElement(tag,attrs) {
  return skipSkillElement(tag,attrs)||attrs['data-equipment-icon']!==undefined||attrs['data-equipment-text']!==undefined||
    /(?:^|\s)(?:equipment-name|equipment-select-field)(?:\s|$)/.test(attrs.class||'');
}
