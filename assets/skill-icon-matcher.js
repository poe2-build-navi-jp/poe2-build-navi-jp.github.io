// Shared by the static renderer and the browser. Only exact catalog names are annotated.
export const escapeSkillText = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const key = value => value.normalize('NFKC').replace(/[’‘]/g,"'").toLowerCase();
const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/['’‘]/g,"['’‘]");
const japanese = value => /[\u3040-\u30ff\u3400-\u9fff]/.test(value);

export function createSkillMatcher(entries) {
  const exact=new Map(),aliases=new Map(),pairedNames=new Map();
  const fold=value=>value.replace(/[’‘]/g,"'").replace(/\u00a0/g,' ').toLowerCase();
  for(const entry of entries) {
    for(const name of entry.names) {
      exact.set(key(name),entry);
      // Short support names are ordinary words, too. Prose needs a verified name pair.
      if(entry.availability!=='internal'&&!entry.support&&name.length>=3&&!aliases.has(key(name)))aliases.set(key(name),{name,entry});
    }
    pairedNames.set(entry,[...entry.names].sort((a,b)=>b.length-a.length));
  }
  const ordered=[...aliases.values()].sort((a,b)=>b.name.length-a.name.length);
  const pattern=ordered.length?new RegExp(ordered.map(({name})=>escapePattern(name)).join('|'),'gi'):null;
  const beforeBoundary=(name,before)=>japanese(name)?/[ァ-ヺー]/.test(before):/[A-Za-z0-9_@-]/.test(before);
  const urlAt=(value,start,end)=>/(?:https?:\/\/|www\.)\S*$/.test(value.slice(0,start))||/^\.(?:webp|png|json|js)\b/.test(value.slice(end));
  function matches(value) {
    if(!value)return [];
    const found=[];
    // Resolve parentheses through the exact-name index. This accepts either language order
    // and bracket style without compiling thousands of near-identical regular expressions.
    for(const paren of value.matchAll(/[（(]([^（）()\n]{1,160})[）)]/g)) {
      const entry=exact.get(key(paren[1].trim()));
      if(!entry||entry.availability==='internal')continue;
      const left=value.slice(0,paren.index).trimEnd(),end=paren.index+paren[0].length;
      for(const name of pairedNames.get(entry)) {
        const start=left.length-name.length;
        if(start<0||!fold(left).endsWith(fold(name))||beforeBoundary(name,value[start-1]||'')||urlAt(value,start,end))continue;
        found.push({start,end,entry});break;
      }
    }
    if(pattern) {
      pattern.lastIndex=0;
      for(const match of value.matchAll(pattern)) {
        const item=aliases.get(key(match[0])),start=match.index,end=start+match[0].length;
        if(!item||found.some(pair=>start<pair.end&&end>pair.start))continue;
        if(beforeBoundary(match[0],value[start-1]||'')||beforeBoundary(match[0],value[end]||'')||urlAt(value,start,end))continue;
        found.push({start,end,entry:item.entry});
      }
    }
    return found.sort((a,b)=>a.start-b.start);
  }
  return {matches,lookup:value=>exact.get(key(value||''))||exact.get(key(value||'').replace(/: \{0\}$/,''))};
}

export const skillImageHtml = entry => `<img class="skill-icon" src="${escapeSkillText(entry.src)}" width="32" height="32" alt="" aria-hidden="true" loading="lazy" decoding="async"${entry.imageTitle?` title="${escapeSkillText(entry.imageTitle)}"`:''}>`;
export function skillTextHtml(value, matcher) {
  let output='',position=0;
  for(const {start,end,entry} of matcher.matches(value)) {
    output+=escapeSkillText(value.slice(position,start));
    output+=`<span class="skill-name" data-skill-icon="${escapeSkillText(entry.id)}">${skillImageHtml(entry)}${escapeSkillText(value.slice(start,end))}</span>`;
    position=end;
  }
  return output+escapeSkillText(value.slice(position));
}

export const skipSkillTags=new Set(['head','script','style','svg','math','pre','code','textarea','input','select','option','noscript','template','nav','blockquote','q','cite','button']);
export function skipSkillElement(tag,attrs) {
  return skipSkillTags.has(tag)||attrs.contenteditable!==undefined||attrs['data-skill-icon']!==undefined||
    attrs['data-skill-selected']!==undefined||attrs.translate==='no'||attrs['aria-live']||attrs.role==='status'||
    /^(?:sources?|source-list)(?:-|$)/.test(attrs.id||'')||attrs['aria-labelledby']==='sources-title'||
    /(?:^|\s)(?:source-link|rating-quote|guide-share-box|breadcrumbs|skill-name)(?:\s|$)/.test(attrs.class||'');
}
