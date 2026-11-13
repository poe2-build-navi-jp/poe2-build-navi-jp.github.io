// Shared by the static renderer and the browser. Only exact catalog names are annotated.
export const escapeSkillText = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const key = value => value.normalize('NFKC').replace(/[’‘]/g,"'").toLowerCase();
const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/['’‘]/g,"['’‘]");
const japanese = value => /[\u3040-\u30ff\u3400-\u9fff]/.test(value);

export function createSkillMatcher(entries) {
  const exact = new Map(), aliases = new Map();
  const add = (name, entry, paired=false) => {
    const normalized=key(name);
    if(!aliases.has(normalized))aliases.set(normalized,{name,entry,paired});
  };
  for(const entry of entries) {
    for(const name of entry.names)exact.set(key(name),entry);
    const ja=entry.names.filter(japanese), en=entry.names.filter(name=>!japanese(name));
    for(const a of ja)for(const b of en) {
      add(`${a}（${b}）`,entry,true);add(`${a} (${b})`,entry,true);
      add(`${a}（${b.replaceAll("'",'’')}）`,entry,true);
    }
    // Short support names such as "Rage" and "憤怒" are ordinary words, too.
    // In prose, only their explicitly paired names identify them unambiguously.
    if(!entry.support)for(const name of entry.names)if(name.length>=3)add(name,entry);
  }
  const ordered=[...aliases.values()].sort((a,b)=>b.name.length-a.name.length);
  const pattern=new RegExp(ordered.map(({name})=>escapePattern(name)).join('|'),'gi');
  function matches(value) {
    if(!value||!ordered.length)return [];
    pattern.lastIndex=0;
    const found=[];
    for(const match of value.matchAll(pattern)) {
      const item=aliases.get(key(match[0])), start=match.index, end=start+match[0].length;
      if(!item)continue;
      const before=value[start-1]||'',after=value[end]||'';
      if(!item.paired && (japanese(match[0])
        ? /[ァ-ヺー]/.test(before)||/[ァ-ヺー]/.test(after)
        : /[A-Za-z0-9_@-]/.test(before)||/[A-Za-z0-9_@-]/.test(after)))continue;
      // Never touch URLs or filenames displayed as text.
      if(/(?:https?:\/\/|www\.)\S*$/.test(value.slice(0,start))||/^\.(?:webp|png|json|js)\b/.test(value.slice(end)))continue;
      found.push({start,end,entry:item.entry});
    }
    return found;
  }
  return {matches,lookup:value=>exact.get(key(value||'').replace(/: \{0\}$/,''))};
}

export const skillImageHtml = entry => `<img class="skill-icon" src="${escapeSkillText(entry.src)}" width="32" height="32" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
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
