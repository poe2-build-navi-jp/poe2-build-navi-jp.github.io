import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export const root=resolve(import.meta.dirname,'..');
const names=JSON.parse(await readFile(resolve(root,'data/japanese-names.json'),'utf8')).names;
const plain=s=>s.replace(/[’‘]/g,"'").replace(/\u00a0/g,' ');
const key=s=>plain(s).toLowerCase();
const escaped=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/'/g,"['’‘]").replace(/ /g,'[ \\u00a0]');
const entries=new Map(Object.entries(names).map(([english,{ja}])=>[key(english),ja]));
// Name boundaries exclude URL fragments, filenames and compound identifiers.
const pattern=new RegExp('(?<![A-Za-z0-9_@-])(?:'+Object.keys(names).sort((a,b)=>b.length-a.length).map(escaped).join('|')+')(?![A-Za-z0-9_@-])','g');
const trimJa=s=>s.normalize('NFKC').replace(/[\s・]/g,'').replace(/(?:I|II|III|IV|V)$/,'');
const jp=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

export function formatJapaneseNames(value,before='',after=''){
 if(!value||typeof value!=='string'||/^\s*(?:https?:\/\/|\/[-a-z0-9])/i.test(value))return value;
 const whole=before+value+after;
 const next=value.replace(pattern,(en,index)=>{
  const ja=entries.get(key(en));
  if(!ja)return en;
  const left=whole.slice(Math.max(0,before.length+index-90),before.length+index);
  const right=whole.slice(before.length+index+en.length,before.length+index+en.length+90);
  // Preserve quoted creator stage labels and avoid translating a suffix of a longer name.
  if(/\b[A-Z][A-Za-z'-]+ $/.test(left)&&!entries.has(key(left.match(/([A-Z][A-Za-z'-]+) $/)[1]))&&
     !/\b(?:Act|Tier|Lv|Skill|Rare|Unique|Magic|Normal|Any|Use|Early|Late|Mid|the|The|a|A) $/.test(left))return en;
  if(/^ [A-Z][A-Za-z'-]+\b/.test(right)&&!entries.has(key(right.match(/^ ([A-Z][A-Za-z'-]+)/)[1]))&&
     !/^ (?:I|II|III|IV|V|Lv|Tier|Set|Support|Plus)\b/.test(right))return en;
  if(/(?:https?:\/\/|www\.)\S*$/i.test(left)||/\.(?:png|webp|svg|json|js)\b/.test(right))return en;
  const j=trimJa(ja);
  const pre=left.match(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー・\sIVX]+)\s*(?:[（(/／：:]|[＋+])\s*$/u)?.[1];
  if(pre&&trimJa(pre).endsWith(j))return en;
  const post=right.match(/^\s*(?:[（(/／：:]|[＋+])\s*([^）)\n／/]{1,60})/)?.[1];
  if(post&&jp.test(post)&&trimJa(post).startsWith(j))return en;
  // Avoid an unnecessary nested parenthesis for an English gloss already next to its Japanese text.
  if(/[（(]\s*$/.test(left)&&/^\s*[）)]/.test(right)&&left.replace(/[（(]\s*$/,'').endsWith(ja))return en;
  if(/[（(]\s*$/.test(left)&&/^\s*[）)]/.test(right))return ja+' / '+en;
  return ja+'（'+en+'）';
 });
 return next!==value?next.replace(/（英語名）/g,''):value;
}
