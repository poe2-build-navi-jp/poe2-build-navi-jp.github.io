import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),read=p=>readFile(resolve(root,p),'utf8');
const guides=JSON.parse(await read('data/strategy-guides.json')),data=JSON.parse(await read('data/simulator-examples.json'));
const titles={CombinedDPS:'選択スキルのDPS',Life:'最大ライフ',Armour:'アーマー',Evasion:'回避力',FireResist:'火耐性',ColdResist:'冷気耐性',LightningResist:'雷耐性',ChaosResist:'混沌耐性'};
const number=(v,id)=>new Intl.NumberFormat('ja-JP',{maximumFractionDigits:id==='CombinedDPS'?1:0}).format(v)+(/Resist/.test(id)?'%':'');
for(const guide of guides.filter(g=>g.comparisonExample)){
 const example=data.comparisons.find(c=>c.id===guide.comparisonExample);if(!example)throw Error('Missing comparison '+guide.comparisonExample);
 const file=`guides/${guide.slug}/index.html`,html=await read(file),url=`/simulator/?build=${example.a.preset}&amp;comparison=${example.id}`;
 const content=`<div class="simulator-demo" data-comparison-example="${example.id}"><p><b>計算エンジン ${example.verification.engine} / 対応データ ${example.verification.data}</b></p><table><caption>Lv80・通常の敵・1部位だけを交換した計算例</caption><thead><tr><th scope="col">項目</th><th scope="col">構成A</th><th scope="col">構成B</th><th scope="col">B − A</th></tr></thead><tbody>${example.verification.stats.map(s=>`<tr><th scope="row">${titles[s.id]}</th><td>${number(s.a,s.id)}</td><td>${number(s.b,s.id)}</td><td>${s.b>s.a?'+':''}${number(s.b-s.a,s.id)}</td></tr>`).join('')}</tbody></table><p>追加出費の仮入力：A 0 / B ${example.prices.entries.find(p=>p.id==='b').amount} 高貴なオーブ。予算の仮入力：${example.prices.budget.amount} 高貴なオーブ。</p><p><a class="button button-secondary" href="${url}">この装備交換をシミュレーターで試す →</a></p></div>`;
 if(!html.includes('<!-- simulator-demo:start -->'))throw Error('Missing comparison article marker: '+file);
 await writeFile(resolve(root,file),html.replace(/<!-- simulator-demo:start -->[\s\S]*?<!-- simulator-demo:end -->/,`<!-- simulator-demo:start -->${content}<!-- simulator-demo:end -->`));
}
console.log('Rendered two reproducible equipment comparison articles');
