const cards = [...document.querySelectorAll('.catalog-card')];
const select = document.getElementById('class-filter');
const search = document.getElementById('build-search');
const names = [...new Set(cards.map(card => card.dataset.class))];
const filters=[...document.querySelectorAll('#advanced-filters select')];
const selected=new Set();
const track=(name,data={})=>{if(typeof window.gtag==='function')window.gtag('event',name,data);};
names.forEach(name => {if(![...select.options].some(o=>o.value===name))select.append(new Option(name,name));});
const value=id=>document.getElementById(`filter-${id}`).value;
function render(){
 const query=search.value.trim().toLocaleLowerCase('ja');let count=0;
 cards.forEach(card=>{
  const d=card.dataset,n=Number(d.unlock),unlock=value('unlock');
  const levelMatch=!unlock||(unlock==='未確認'?!d.unlock:!!d.unlock&&(unlock==='Lv1から'?n===1:unlock==='Lv20まで'?n<=20:unlock==='Lv40まで'?n<=40:n>40));
  card.hidden=!!((select.value&&d.class!==select.value)||(query&&!card.textContent.toLocaleLowerCase('ja').includes(query))||(value('style')&&!d.styles.split(',').includes(value('style')))||(value('beginner')&&d.beginner!=='true')||(value('ssf')&&d.ssf!=='true')||(value('operation')&&d.operation!==value('operation'))||!levelMatch);
  if(!card.hidden)count++;
 });
 document.getElementById('result-count').textContent=`${count}件`;
 document.getElementById('filter-empty').hidden=count!==0;
 document.querySelectorAll('[data-class-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.classChoice===select.value)));
}
function compare(){
 document.getElementById('compare-status').textContent=`比較：${selected.size} / 3件${selected.size===3?'（上限です。外すと変更できます）':''}`;
 document.getElementById('show-compare').disabled=selected.size===0;
 const container=document.getElementById('comparison-cards');container.replaceChildren();
 const selectedCards=cards.filter(card=>selected.has(card.dataset.buildId));
 const readFacts=card=>new Map([...card.querySelectorAll('.unified-facts>div')].map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent]));
 const allFacts=selectedCards.map(readFacts);
 const priority=[['切替時期',['主力への切替目安']],['操作',['操作量','構成切替・操作の注意']],['装備・使用条件',['主力スキル使用条件','装備依存']],['SSF',['SSF']],['弱点',['弱点']]];
 const used=new Set([...priority.flatMap(([,keys])=>keys),'操作難易度']);
 const shared=allFacts.length>1?[...allFacts[0]].filter(([key,value])=>!used.has(key)&&allFacts.every(f=>f.get(key)===value)):[];
 const sharedKeys=new Set(shared.map(([key])=>key));
 const makeRow=(label,value)=>{const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);return row;};
 document.getElementById('comparison-shared')?.remove();
 cards.forEach(card=>{
  const button=card.querySelector('[data-compare]'),active=selected.has(card.dataset.buildId);
  button.setAttribute('aria-pressed',String(active));button.textContent=active?'比較から外す':'比較に追加';
  button.disabled=!active&&selected.size>=3;
  if(active){
   const article=document.createElement('article');article.className='ux-compare-card';
   const title=document.createElement('h3');title.textContent=card.querySelector('h2').textContent;
   const link=card.querySelector('a[href]').cloneNode(true);link.textContent='このビルドをLv1から育てる';link.href=link.pathname+'?level=1#now';
   const remove=document.createElement('button');remove.type='button';remove.textContent='比較から外す';remove.addEventListener('click',()=>{selected.delete(card.dataset.buildId);compare();});
   const values=readFacts(card),primary=document.createElement('dl');primary.className='unified-facts comparison-priority';
   priority.forEach(([label,keys])=>{
    const value=keys.map(k=>values.get(k)||'未確認').join('／');
    const row=makeRow(label,value);
    if(allFacts.length>1&&allFacts.some(f=>keys.map(k=>f.get(k)||'未確認').join('／')!==value))row.className='comparison-difference';
    primary.append(row);
   });
   const extra=document.createElement('details'),summary=document.createElement('summary'),secondary=document.createElement('dl');
   summary.textContent='その他の情報・確認資料';secondary.className='unified-facts';
   [...values].filter(([key])=>!used.has(key)&&!sharedKeys.has(key)).forEach(([key,value])=>secondary.append(makeRow(key,value)));
   extra.append(summary,secondary);const source=card.querySelector('.fact-source');if(source)extra.append(source.cloneNode(true));
   article.append(title,primary,link,remove,extra);container.append(article);
  }
 });
 if(shared.length){
  const common=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('dl');
  common.id='comparison-shared';common.className='comparison-shared';summary.textContent='選択したビルドに共通する情報';list.className='unified-facts';
  shared.forEach(([key,value])=>list.append(makeRow(key,value)));common.append(summary,list);container.after(common);
 }
 if(!selected.size)document.getElementById('build-comparison').hidden=true;
}
document.getElementById('advanced-filters').hidden=false;
cards.forEach(card=>{const b=card.querySelector('[data-compare]');b.hidden=false;b.addEventListener('click',()=>{const id=card.dataset.buildId;if(selected.has(id))selected.delete(id);else if(selected.size<3){selected.add(id);track('compare_add',{build_id:id});}compare();});});
document.getElementById('show-compare').addEventListener('click',()=>{const area=document.getElementById('build-comparison');area.hidden=false;area.focus();area.scrollIntoView({block:'start'});track('compare_view',{build_count:selected.size});});
function changed(event){render();track('filter_apply',{filter:event?.target?.id||'class',result_count:cards.filter(c=>!c.hidden).length});}
const choices=document.getElementById('class-choices');choices.replaceChildren();
['',...names].forEach(name=>{const b=document.createElement('button');b.type='button';b.dataset.classChoice=name;b.textContent=name||'すべて';b.addEventListener('click',()=>{select.value=name;changed();});choices.append(b);});
search.addEventListener('input',render);search.addEventListener('change',changed);select.addEventListener('change',changed);filters.forEach(s=>s.addEventListener('change',changed));
document.getElementById('reset-filters').addEventListener('click',()=>{[select,search,...filters].forEach(c=>c.value='');changed();});
document.getElementById('relax-filter').addEventListener('click',()=>{const active=[...filters,select,search].find(c=>c.value);if(active)active.value='';changed();});
render();compare();
