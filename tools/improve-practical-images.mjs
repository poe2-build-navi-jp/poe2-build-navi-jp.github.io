import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const builds=JSON.parse(await readFile(resolve(root,'data/builds.json'),'utf8'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function wrap(text,limit){let lines=[],line='',size=0;for(const ch of text){const unit=/[ -~]/.test(ch)?0.57:1;if(size+unit>limit){lines.push(line);line='';size=0;}line+=ch;size+=unit;}if(line)lines.push(line);return lines;}
const text=(lines,x,y,size,color='#e9eef5',weight=400)=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}">${lines.map((l,i)=>`<tspan x="${x}" dy="${i?size*1.45:0}">${esc(l)}</tspan>`).join('')}</text>`;
function diagram(title,subtitle,steps,mobile,patch){
 const w=mobile?720:1200,pad=mobile?32:48,gap=24,cols=mobile?1:2,cw=(w-pad*2-gap*(cols-1))/cols;
 const titleLines=wrap(title,mobile?18:29);const start=90+titleLines.length*54+72;
 let y=start,body='',n=0;
 for(let i=0;i<steps.length;i+=cols){
  const group=steps.slice(i,i+cols).map(s=>({...s,lines:wrap(s.action,(cw-44)/30)}));
  const h=Math.max(...group.map(s=>100+s.lines.length*44));
  for(let c=0;c<group.length;c++){
   const s=group[c],x=pad+c*(cw+gap);n++;
   body+=`<rect x="${x}" y="${y}" width="${cw}" height="${h}" rx="18" fill="#172536" stroke="#365067"/><circle cx="${x+36}" cy="${y+36}" r="19" fill="#e6b45f"/>${text([String(n)],x+27,y+43,21,'#101827',700)}${text([s.label],x+68,y+45,28,'#91cae8',700)}${text(s.lines,x+22,y+100,30)}`;
  }
  y+=h+gap;
 }
 const height=y+78;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">${esc(subtitle)}。${steps.map((s,i)=>esc(`${i+1} ${s.label}：${s.action}`)).join('。')}</desc><g font-family="sans-serif"><rect width="${w}" height="${height}" rx="24" fill="#0d1724"/><path d="M${pad} 36h70" stroke="#e6b45f" stroke-width="5"/>${text(['POE2 BUILD NAVI'],pad+86,43,19,'#e6b45f',700)}${text(titleLines,pad,104,38,'#ffffff',700)}${text(wrap(subtitle,mobile?24:45),pad,104+titleLines.length*54,25,'#bdcbd9')}${body}${text([`Patch ${patch} · 掲載データに基づく独自図解`],pad,height-39,21,'#a7b9cc')}</g></svg>`;
}
const ids=['ranger-ice-shot-deadeye','witch-minion-infernalist','warrior-shield-wall-smith','monk-whirling-assault','witch-ed-contagion-lich'];
for(const b of builds.filter(b=>ids.includes(b.id))){
 const steps=b.levelingStages.map(s=>({label:s.label,action:s.nowActions[0]}));
 for(const mobile of [false,true])await writeFile(resolve(root,`images/poe2/builds/poe2-${b.slug}-leveling-roadmap${mobile?'-mobile':''}.svg`),diagram(b.name,'育成順序と各段階で最初に確認すること',steps,mobile,b.version));
}
const site=JSON.parse(await readFile(resolve(root,'data/site.json'),'utf8'));
const steps=[{label:'職業・ビルド',action:'使っている職業とビルドを選ぶ'},{label:'現在Lv',action:'例：Lv37と入力する'},{label:'対応する段階',action:'Lv31〜40の育成手順を開く'},{label:'今やること3つ',action:'スキル・装備・パッシブの優先行動を確認する'}];
for(const mobile of [false,true])await writeFile(resolve(root,`images/poe2/guides/poe2-leveling-guide${mobile?'-mobile':''}.svg`),diagram('現在Lvから育成を再開','Lv37を入力した場合の案内例',steps,mobile,site.siteVersion));
console.log('Improved 6 practical diagrams, with 6 separate mobile compositions.');
