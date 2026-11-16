// OCR is deliberately conservative: no fuzzy numbers, inferred rolls or guessed bases.
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compact = s => s.normalize('NFKC').replace(/\s/g, '').toLowerCase();
const number = '([0-9]+(?:\\.[0-9]+)?)';
const aliases = {
  life: ['最大ライフ'], mana: ['最大マナ'], es: ['最大エナジーシールド'],
  armour: ['アーマー'], evasion: ['回避力'], spirit: ['スピリット'],
  fire_res: ['火耐性'], cold_res: ['冷気耐性'], lightning_res: ['雷耐性'], chaos_res: ['混沌耐性'], all_res: ['全ての元素耐性', '全元素耐性'],
  str: ['筋力'], dex: ['器用さ'], int: ['知性'], attributes: ['全ての能力値'], accuracy: ['命中力'],
  armour_pct: ['アーマー'], evasion_pct: ['回避力'], es_pct: ['エナジーシールド', '最大エナジーシールド'],
  move_speed: ['移動スピード'], attack_speed: ['アタックスピード'], cast_speed: ['キャストスピード'],
  crit_chance: ['クリティカルヒット率'], crit_damage: ['クリティカルダメージボーナス'],
  physical_pct: ['物理ダメージ'], spell_pct: ['スペルダメージ'], elemental_pct: ['元素ダメージ'],
  mana_regen: ['マナ自動回復レート'], skill_levels: ['全てのスキルレベル'],
};
export function normalizePhotoText(value) {
  if (typeof value !== 'string' || value.length > 20000) throw Error('text-size');
  return value.normalize('NFKC').replace(/\r/g, '').replace(/[−–—]/g, '-').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}
function matchModifier(line, catalog) {
  const c = compact(line);
  for (const def of catalog.modifiers) {
    const patterns = [escape(compact(def.template)).replace(/\\\{\d+\\\}/g, number)];
    const label = escape(compact(def.label));
    patterns.push(label + '[:：]?\\+?' + number + (def.default.length === 2 ? '[~〜～-]' + number : '') + (def.unit ? '%' : ''));
    for (const a of aliases[def.id] || []) {
      const name = escape(a), pct = /increased/.test(def.template);
      if (pct) {
        patterns.push(name + '(?:が)?' + number + '%増加(?:する)?');
        patterns.push(number + '%(?:の)?' + name + '増加');
      } else {
        const unit = def.unit ? '%' : '';
        patterns.push(name + '(?:が)?[:：]?\\+' + number + unit);
        patterns.push('\\+' + number + unit + '(?:の)?' + name);
      }
    }
    const element = {physical_flat:'物理',fire_flat:'火',cold_flat:'冷気',lightning_flat:'雷',chaos_flat:'混沌'}[def.id];
    if (element) patterns.push(number + '(?:[~〜～-]|から)' + number + '(?:の)?' + element + 'ダメージを追加(?:する)?');
    if (def.id === 'life_regen') patterns.push('毎秒(?:ライフを)?' + number + '(?:の)?ライフ(?:を)?(?:自動)?回復(?:する)?');
    for (const p of patterns) {
      const match = c.match(new RegExp('^' + p + '$', 'i'));
      if (!match) continue;
      const values = match.slice(1).map(Number);
      if (values.length !== def.default.length || values.some(v=>!Number.isFinite(v)||v>100000) || values.length===2&&values[0]>values[1]) return null;
      return {id:def.id, label:def.label, values, text:def.template.replace(/\{(\d+)\}/g,(_,i)=>String(values[+i]))};
    }
  }
  return null;
}
export function inspectEquipmentPhoto(value, catalog) {
  const raw = normalizePhotoText(value), lines = raw.split('\n').map(s=>s.trim()).filter(Boolean);
  if (lines.length > 150) throw Error('text-size');
  const found = {raw, baseId:'', quality:'', level:'', modifiers:[], unresolved:[], properties:[]};
  for (const line of lines) {
    if (/^[-_=─━]{2,}$/.test(line)) continue;
    const base = catalog.bases.find(b=>[b.name,b.label].some(s=>compact(s)===compact(line)));
    if (base) { found.baseId=base.id; continue; }
    let m;
    if ((m=compact(line).match(/^(?:quality|品質)[:：]?\+?(\d+)%?(?:\(augmented\)|\(増加\))?$/)) && +m[1]<=30) {found.quality=m[1];continue;}
    if ((m=compact(line).match(/^(?:itemlevel|アイテムレベル)[:：]?(\d+)$/)) && +m[1]>=1&&+m[1]<=100) {found.level=m[1];continue;}
    // Displayed totals must not be added again as modifiers. The engine derives them
    // from the selected base, quality and options; keep them visible for comparison.
    if (/^(?:Armour|Evasion Rating|Energy Shield|Physical Damage|Elemental Damage|Critical Hit Chance|Attacks per Second|アーマー|回避力|エナジーシールド|物理ダメージ|元素ダメージ|クリティカルヒット率|秒間アタック回数)\s*[:：]/i.test(line)) {found.properties.push(line);continue;}
    const mod = matchModifier(line,catalog);
    if (mod) {found.modifiers.push({...mod,source:line});continue;}
    if (/^(?:Rarity|レアリティ|Item Class|アイテムクラス)\s*[:：]/i.test(line)) continue;
    found.unresolved.push(line);
  }
  return found;
}
export function equipmentPhotoText({baseId,name,quality,level,rarity='RARE',modifiers},catalog) {
  const base=catalog.bases.find(b=>b.id===baseId);
  if (!base) throw Error('base');
  name=String(name||'').trim();
  if (!name||name.length>80||/[\r\n]/.test(name)||!['NORMAL','MAGIC','RARE','UNIQUE'].includes(rarity)) throw Error('name');
  for (const [value,min,max] of [[quality,0,30],[level,1,100]]) if(value!==''&&(!/^\d+$/.test(String(value))||+value<min||+value>max)) throw Error('value');
  if (!Array.isArray(modifiers)||!modifiers.length||modifiers.length>30) throw Error('modifiers');
  const options=modifiers.map(mod=>{
    const def=catalog.modifiers.find(d=>d.id===mod.id);
    if(!def||!Array.isArray(mod.values)||mod.values.length!==def.default.length||mod.values.some(v=>!Number.isFinite(v)||v<0||v>100000)||mod.values.length===2&&mod.values[0]>mod.values[1])throw Error('value');
    return def.template.replace(/\{(\d+)\}/g,(_,i)=>String(mod.values[+i]));
  });
  return [`Rarity: ${rarity}`,name,base.name,...(level!==''?[`Item Level: ${+level}`]:[]),...(quality!==''?[`Quality: ${+quality}`]:[]),'Implicits: 0',...options].join('\n');
}
