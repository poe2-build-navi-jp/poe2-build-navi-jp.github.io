import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {FOOTER,ICON_BLOCK} from './site-chrome.mjs';
import {applyGuideReadingLayout} from './guide-reading-layout.mjs';
const root=resolve(import.meta.dirname,'..');
const read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const entities=await read('data/core-entities.json'),builds=await read('data/builds.json'),site=await read('data/site.json');
// Verified per-build gear cards from the unique-gear guide; equipment pages reuse them (and their sources).
const gearGuide=(await read('data/strategy-guides.json')).find(g=>g.slug==='unique-gear');
const gearKey=v=>String(v).replace(/[’']/g,"'").toLowerCase();
const gearCards=(gearGuide?.sections||[]).filter(s=>s.buildId).flatMap(s=>(s.gearOptions||[]).map(o=>({...o,buildId:s.buildId})));
const strategyGuides=await read('data/strategy-guides.json');
const shopping=await read('data/unique-gear-shopping.json').catch(()=>({items:{}}));
// Matched leveling stages per skill, computed once for all skills: when two skills of the
// same build are used in (nearly) the same stages, their "how it is used per level band"
// tables come out near-identical, so the duplication is detected here and resolved below.
const skillRows=new Map();
for(const e of entities.filter(x=>x.kind==='skill')){
 const names=[e.name,e.englishName,...(e.aliases||[])];
 const rows=e.buildIds.map(id=>builds.find(b=>b.id===id&&b.status!=='draft')).filter(Boolean)
  .map(b=>[b,(b.levelingStages||[]).filter(s=>names.some(n=>`${s.mainSkill||''}${s.supports||''}`.includes(n)))])
  .filter(([,st])=>st.length);
 skillRows.set(e.slug,rows);
}
const stageSignature=rows=>new Set(rows.flatMap(([b,st])=>st.map(s=>`${b.id}|${s.label}`)));
// slug -> slug of the skill page that keeps the full table. The primary is the skill the
// shared build names first in its main-skill line; ties fall back to entity order.
const compactUsage=new Map();
for(const a of entities.filter(x=>x.kind==='skill')){
 for(const b of entities.filter(x=>x.kind==='skill')){
  if(a.slug>=b.slug)continue;
  const sa=stageSignature(skillRows.get(a.slug)||[]),sb=stageSignature(skillRows.get(b.slug)||[]);
  if(!sa.size||!sb.size)continue;
  const inter=[...sa].filter(x=>sb.has(x)).length,union=new Set([...sa,...sb]).size;
  if(inter/union<0.75)continue;
  const shared=(skillRows.get(a.slug)||[]).map(([bd])=>bd).find(bd=>(skillRows.get(b.slug)||[]).some(([x])=>x.id===bd.id));
  if(!shared)continue;
  const pos=e=>[e.name,e.englishName].map(n=>shared.mainSkill.indexOf(n)).filter(i=>i>=0);
  const pa=pos(a),pb=pos(b);
  const aFirst=pa.length&&pb.length?Math.min(...pa)<Math.min(...pb):pa.length>pb.length;
  compactUsage.set(aFirst?b.slug:a.slug,aFirst?a.slug:b.slug);
 }
}
const entityByName=new Map(entities.filter(e=>e.kind==='equipment').map(e=>[gearKey(e.englishName),e]));
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const path=e=>`/${e.kind==='skill'?'skills':'equipment'}/${e.slug}/`;
const image='/images/poe2/og/poe2-beginner-guide-og.webp';
const head=(title,description,url,schema)=>`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${url}"><meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${site.baseUrl}${image}"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/mobile.css"><link rel="stylesheet" href="/assets/strategy-articles.css">${ICON_BLOCK}<script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script></head><body><a class="skip-link" href="#main">本文へ移動</a><header class="site-header"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">P2</span><span>POE2<br>ビルドナビ</span></a><nav class="site-nav page-nav" aria-label="メインメニュー"><a href="/guides/">攻略ガイド</a><a href="/builds/">ビルド</a><a href="/leveling/">レベリング</a><a href="/search/">全体検索</a></nav></header><main id="main" class="page-main">`;
const crumb=(name,url,parentName,parentUrl)=>({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{name:'ホーム',item:site.baseUrl+'/'},{name:parentName,item:site.baseUrl+parentUrl},{name,item:url}].map((x,i)=>({'@type':'ListItem',position:i+1,...x}))});
for(const e of entities){
 if(!/^[a-z0-9-]+$/.test(e.slug)||!['skill','equipment'].includes(e.kind)||!e.sources?.length)throw Error('Invalid entity '+e.slug);
 const type=e.kind==='skill'?'スキル':'装備',parent=e.kind==='skill'?'/skills/':'/equipment/',url=site.baseUrl+path(e);
 const title=e.title||`PoE2 ${e.name}｜効果・必要条件・入手方法${e.buildIds.length?"と採用ビルド":""}`;
 const text=v=>esc(v).replace(/\[source:(\d+)\]/g,(_,n)=>{if(!e.sources[n-1])throw Error('Source '+e.slug);return `<sup><a href="#source-${n}" aria-label="資料${n}">[${n}]</a></sup>`});
 const selected=e.buildIds.map(id=>{const b=builds.find(b=>b.id===id&&b.status!=='draft');if(!b)throw Error('Build '+id);return b});
 const date=e.sources.map(s=>s.checkedAt).sort().at(-1);
 // Sources cited by reused gear cards are appended after the entity's own sources, numbered on.
 const sources=[...e.sources];
 const cite=refs=>refs.map(n=>{const s=gearGuide.sources[n-1];if(!s)throw Error('Gear source '+e.slug);let i=sources.findIndex(x=>x.url===s.url);if(i<0){sources.push(s);i=sources.length-1;}return `<sup><a href="#source-${i+1}" aria-label="資料${i+1}">[${i+1}]</a></sup>`;}).join('');
 const buildName=id=>{const b=builds.find(b=>b.id===id);return `<a href="/builds/${b.classSlug}/${b.slug}/">${esc(b.name)}</a>`;};
 const extra=[];
 if(e.kind==='equipment'){
  const own=gearCards.filter(o=>gearKey(o.name)===gearKey(e.englishName));
  if(own.length)extra.push(['usage','ビルドでの使い方',`<p>掲載ビルドの原典で、この装備をどの段階・どの目的で使っているかをまとめました。採用条件と、外したときの代わりも確認してください。</p>${own.map(o=>`<h3>${buildName(o.buildId)}（${esc(o.slot)}／${esc(o.phase)}）</h3><dl class="entity-usage">${[['用途',o.purpose],['採用条件',o.conditions],['弱点・交換で失うもの',o.tradeoff],['レア装備などの代替',o.rareAlternative],['掲載の根拠',o.basis]].map(([l,v])=>`<div><dt>${l}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="guide-evidence">根拠：${cite(o.sourceRefs)}</p>`).join('')}`]);
  if(selected.length)extra.push(['priorities','採用ビルドの装備の優先順位',`<p>この装備は単体で強さが決まるものではありません。採用しているビルドが、どの部位で何を優先しているかを先に確認してください。</p>${selected.map(b=>`<h3>${buildName(b.id)}</h3><ul>${(b.gearPriorities||[]).map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`).join('')}`]);
  const slots=new Set([...own.map(o=>o.slot),...(e.slot?[e.slot]:[])]);
  const others=gearCards.filter(o=>slots.has(o.slot)&&gearKey(o.name)!==gearKey(e.englishName));
  if(others.length){
   const seen=new Set();
   extra.push(['alternatives',`同じ部位（${[...slots].map(esc).join('・')}）のほかの候補`,`<p>掲載ビルドで同じ部位に使われているユニーク装備です。ビルドが違えば役割も違うため、自分のビルドの原典を優先してください。</p><ul>${others.filter(o=>{const k=gearKey(o.name)+o.buildId;if(seen.has(k))return false;seen.add(k);return true;}).map(o=>{const page=entityByName.get(gearKey(o.name));const name=esc(o.nameJa||o.name)+(o.nameJa?`（${esc(o.name)}）`:'');return `<li>${page?`<a href="${path(page)}">${name}</a>`:`<a href="/guides/unique-gear/#${esc(o.buildId)}">${name}</a>`}：${esc(o.purpose)}（${buildName(o.buildId)}、${esc(o.phase)}）${cite(o.sourceRefs)}</li>`;}).join('')}</ul>`]);
  }
  const relatedGuides=strategyGuides.filter(g=>g.slug===e.slug||(g.title||'').includes(e.name)||(g.related||[]).some(r=>r.url===path(e))||(g.quickLinks||[]).some(r=>r.url===path(e)));
  const guideTable=(g)=>{for(const s of g.sections||[])if(s.table&&s.table.rows&&s.table.rows.length)return s.table;return null;};
  if(relatedGuides.length)extra.push(['related-guide','詳しい入手方法・関連ガイド',relatedGuides.slice(0,2).map(g=>{const t=guideTable(g);return `<h3><a href="/guides/${g.slug}/">${esc(g.title)}</a></h3><p>${esc(g.summary||'')}</p>${(g.actions||[]).length?`<ol>${g.actions.map(a=>`<li>${esc(a)}</li>`).join('')}</ol>`:''}${t?`<p>${esc(t.caption||'手順の表')}</p><ul>${t.rows.map(r=>`<li>${r.map(c=>esc(c)).join('：')}</li>`).join('')}</ul>`:''}${(g.sections||[]).length?`<ul>${g.sections.slice(0,10).map(s=>`<li>${esc(s.heading)}</li>`).join('')}</ul>`:''}`;}).join('')]);
  const mateBuildIds=new Set([...selected.map(b=>b.id),...gearCards.filter(o=>gearKey(o.name)===gearKey(e.englishName)).map(o=>o.buildId)]);
  const mates=gearCards.filter(o=>mateBuildIds.has(o.buildId)&&gearKey(o.name)!==gearKey(e.englishName));
  if(mates.length){
   const seenMate=new Set();
   extra.push(['set-mates','同じビルドで一緒に挙げられている装備',`<p>同じビルドのおすすめ装備として、原典で一緒に挙げられているユニーク装備です。部位ごとに役割が違うため、まとめて更新する前提で確認してください。</p><ul>${mates.filter(o=>{const k=gearKey(o.name)+o.buildId;if(seenMate.has(k))return false;seenMate.add(k);return true;}).slice(0,6).map(o=>{const page=entityByName.get(gearKey(o.name));const name=esc(o.nameJa||o.name)+(o.nameJa?`（${esc(o.name)}）`:'');return `<li>${page?`<a href="${path(page)}">${name}</a>`:`<a href="/guides/unique-gear/#${esc(o.buildId)}">${name}</a>`}：${esc(o.purpose)}（${buildName(o.buildId)}、${esc(o.phase)}）</li>`;}).join('')}</ul>`]);
  }
  if(!selected.length){
   const cardBuilds=[...new Map(gearCards.filter(o=>gearKey(o.name)===gearKey(e.englishName)&&o.buildId).map(o=>[o.buildId,builds.find(b=>b.id===o.buildId)])).values()].filter(Boolean);
   if(cardBuilds.length)extra.push(['priorities','おすすめ装備に挙げたビルドの装備の優先順位',`<p>この装備は候補の1つです。挙げているビルドが装備全体で何を優先しているかを先に確認してください。</p>${cardBuilds.map(b=>`<h3>${buildName(b.id)}</h3><ul>${(b.gearPriorities||[]).map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`).join('')}`]);
  }
  const shopItem=(shopping.items||{})[e.englishName];
  if(shopItem?.obtain)extra.push(['obtain','入手先',`<p>${esc(shopItem.obtain)}</p>`]);
  const itemNames=[e.name,e.englishName];
  const gearNotes=[],seenGear=new Set();
  for(const b of selected){
   const fields=[];
   for(const s of b.levelingStages||[])for(const f of ['gearPriority','replaceGear','caution'])if(s[f])fields.push([s.label,s[f]]);
   for(const v of b.gearPriorities||[])fields.push(['装備の優先順位',v]);
   for(const [label,v] of fields)for(const part of String(v).split(/(?<=。)/)){const t=part.trim();if(t&&itemNames.some(n=>t.includes(n))&&!seenGear.has(t)){seenGear.add(t);gearNotes.push([b,label,t]);}}
  }
  if(gearNotes.length)extra.push(['gear-notes','ビルドの装備方針での扱い',`<p>掲載ビルドの装備方針のうち、この装備の名前に触れている記述を抜き出しました。</p><ul>${gearNotes.slice(0,5).map(([b,label,t])=>`<li>${buildName(b.id)}（${esc(label)}）：${esc(t)}</li>`).join('')}</ul>`]);
 }else{
  const names=[e.name,e.englishName,...(e.aliases||[])];
  const rows=skillRows.get(e.slug)||[];
  if(rows.length&&compactUsage.has(e.slug)){
   const primary=entities.find(x=>x.slug===compactUsage.get(e.slug));
   extra.push(['usage','レベル帯ごとの使われ方',`<p>このスキルは掲載ビルドでは${primary?`<a href="${path(primary)}">${esc(primary.name)}</a>`:''}と組み合わせて使うため、段階ごとの表はそちらのページにまとめました。ここでは使う段階だけを示します。</p>${rows.map(([b,st])=>`<h3>${buildName(b.id)}</h3><p>使う段階：${st.map(s=>esc(s.label)).join('、')}</p><p><a href="/builds/${b.classSlug}/${b.slug}/#roadmap">このビルドの育成手順を見る</a></p>`).join('')}`]);
  }else if(rows.length){
   extra.push(['usage','レベル帯ごとの使われ方',`<p>掲載ビルドの育成手順のうち、このスキルが登場するレベル帯を抜き出しました。サポートジェムの構成と、各段階の注意も合わせて確認できます。原典と確認日は各ビルド記事に掲載しています。</p>${rows.map(([b,st])=>`<h3>${buildName(b.id)}</h3><div class="table-scroll"><table class="entity-stages"><thead><tr><th scope="col">レベル帯</th><th scope="col">主な操作</th><th scope="col">サポート・補足</th></tr></thead><tbody>${st.map(s=>`<tr><th scope="row">${esc(s.label)}</th><td data-label="主な操作">${esc(s.mainSkill)}</td><td data-label="サポート・補足">${esc(s.supports)}${s.caution?`<br><span class="entity-caution">注意：${esc(s.caution)}</span>`:''}</td></tr>`).join('')}</tbody></table></div>`).join('')}`]);
   const prio=rows.map(([b,st])=>[b,st.filter(s=>s.passivePriority||s.gearPriority)]).filter(([,st])=>st.length);
   if(prio.length)extra.push(['stage-priorities','使う段階の装備・パッシブの優先',`<p>このスキルを使う段階で、掲載ビルドが優先している装備とパッシブです。スキル単体の効果だけでなく、段階ごとの前提と合わせて確認してください。</p>${prio.map(([b,st])=>`<h3>${buildName(b.id)}</h3><dl class="entity-usage">${st.map(s=>`<div><dt>${esc(s.label)}</dt><dd>${s.gearPriority?`装備：${esc(s.gearPriority)}`:''}${s.gearPriority&&s.passivePriority?'<br>':''}${s.passivePriority?`パッシブ：${esc(s.passivePriority)}`:''}</dd></div>`).join('')}</dl>`).join('')}`]);
  }
  const skillNotes=[],seenNote=new Set();
  for(const b of selected){
   for(const s of b.levelingStages||[]){
    const fields=[['caution',s.caution],['transitionCondition',s.transitionCondition],['nowActions',(s.nowActions||[]).join('。')]];
    for(const [,v] of fields){if(!v)continue;for(const part of String(v).split(/(?<=。)/)){const t=part.trim();if(t&&names.some(n=>t.includes(n))&&!seenNote.has(t)){seenNote.add(t);skillNotes.push([b,s.label,t]);}}}
   }
  }
  if(skillNotes.length)extra.push(['skill-notes','このスキルに触れた注意・切替条件',`<p>掲載ビルドの育成手順のうち、このスキルの名前に触れている注意と切替条件を抜き出しました。</p><ul>${skillNotes.slice(0,6).map(([b,label,t])=>`<li>${buildName(b.id)}（${esc(label)}）：${esc(t)}</li>`).join('')}</ul>`]);
  // For skills whose stage table is summarised on a partner skill's page (or that appear in
  // only a few stages), quote the clauses that name the skill so the page still carries its
  // own per-stage role instead of only a pointer.
  const totalStages=rows.reduce((n,[,st])=>n+st.length,0);
  if(compactUsage.has(e.slug)||totalStages<=3){
   const clauses=[],seenClause=new Set();
   for(const b of selected)for(const s of b.levelingStages||[])for(const v of [s.mainSkill,s.supports]){if(!v)continue;for(const part of String(v).split(/[、。]/)){const t=part.trim();if(t.length>=8&&names.some(n=>t.includes(n))&&!seenClause.has(t)){seenClause.add(t);clauses.push([b,s.label,t]);}}}
   if(clauses.length)extra.push(['skill-role','段階ごとの役割（記述の抜粋）',`<p>掲載ビルドの手順から、このスキルの名前に触れている記述を段階ごとに抜き出しました。</p><ul>${clauses.slice(0,8).map(([b,label,t])=>`<li>${buildName(b.id)}（${esc(label)}）：${esc(t)}</li>`).join('')}</ul>`]);
  }
 }
 for(const section of e.sections||[]){
  if(!/^[a-z0-9-]+$/.test(section.id))throw Error('Invalid section');
  const visual=section.image;
  extra.push([section.id,section.heading,`${(section.paragraphs||[]).map(v=>`<p>${text(v)}</p>`).join('')}${(section.bullets||[]).length?`<ul>${section.bullets.map(v=>`<li>${text(v)}</li>`).join('')}</ul>`:''}${section.after?`<p>${text(section.after)}</p>`:''}${visual?`<figure><a href="${esc(visual.src)}"><img src="${esc(visual.src)}" alt="${esc(visual.alt)}" width="${visual.width}" height="${visual.height}" loading="lazy" style="max-width:100%;height:auto"></a><figcaption>${esc(visual.caption)}（画像を開くと拡大できます）</figcaption></figure>`:''}`]);
 }
 const schema=[{'@context':'https://schema.org','@type':'Article',headline:title,description:e.summary,inLanguage:'ja',mainEntityOfPage:url,image:site.baseUrl+image,datePublished:date,dateModified:date,author:{'@type':'Organization',name:site.operatorName,url:site.baseUrl+'/about/'},publisher:{'@type':'Organization',name:site.siteName,url:site.baseUrl+'/'}},crumb(e.name,url,type+'一覧',parent)];
 const sections=[['effect','効果・役割'],['requirements','使うための条件'],['acquisition','入手方法'],['cautions','採用前の注意']];
 // Search-result description: the summary plus what the page covers, built only from the page's own data.
 const covers=`効果・使うための条件・入手方法${selected.length?`と、掲載ビルド${selected.length}本での使われ方`:''}をまとめています。`;
 const lead=`PoE2の${e.name}（${e.englishName}）：${e.summary}`;
 const description=[...`${lead}${covers}`].length<=120?`${lead}${covers}`:lead;
 let html=head(title,description,url,schema)+`<nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li><a href="${parent}">${type}一覧</a></li><li>${esc(e.name)}</li></ol></nav><article class="article-page strategy-article"><h1>${esc(title)}</h1><p class="lead">${esc(e.summary)}</p><p>英語名：${esc(e.englishName)}${e.aliases?.length?` ／ 別名：${e.aliases.map(esc).join('・')}`:''}</p><p>資料確認 <time datetime="${date}">${date}</time> · <a href="#sources">確認範囲と出典</a></p><nav class="guide-toc" aria-label="この記事の目次"><ul>${sections.map(([id,label])=>`<li><a href="#${id}">${label}</a></li>`).join('')}${extra.map(([id,label])=>`<li><a href="#${id}">${label}</a></li>`).join('')}<li><a href="#builds">${e.buildsNote?'構成の確認':'採用ビルド'}</a></li></ul></nav>`;
 html+=sections.map(([id,label])=>`<section id="${id}" class="strategy-section"><h2>${label}</h2><ul>${e[id].map(v=>`<li>${text(v)}</li>`).join('')}</ul></section>`).join('');
 html+=extra.map(([id,label,body])=>`<section id="${id}" class="strategy-section"><h2>${label}</h2>${body}</section>`).join('');
 html+=`<section id="builds"><h2>${e.buildsNote?'自分の構成で判断する':'掲載ビルドでの採用'}</h2><p>${e.buildsNote?esc(e.buildsNote):'候補装備や途中の育成用スキルを含みます。全段階の必須品という意味ではありません。ビルド記事の現在Lvと切替条件を確認してください。'}</p><ul>${selected.map(b=>`<li><a href="/builds/${b.classSlug}/${b.slug}/">${esc(b.name)}</a>：<a href="/builds/${b.classSlug}/${b.slug}/#roadmap">現在Lvの育成手順</a></li>`).join('')}</ul></section><section id="sources" class="sources"><h2>出典・確認した範囲</h2><p>仕様は各資料の確認範囲に基づきます。数値や要求値がジェムレベル・アイテム個体で変わる場合は、実物の表示を優先してください。購入価格や入手を保証するものではありません。</p><ol>${sources.map((s,i)=>`<li id="source-${i+1}"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">資料${i+1}：${esc(s.name)}</a>（確認 ${esc(s.checkedAt)}）<p>${esc(s.supports)}</p></li>`).join('')}</ol></section><aside class="next-box"><h2>次に確認する</h2><div class="related-links">${(e.relatedLinks||[]).map(l=>`<a href="${esc(l.href)}">${esc(l.label)}</a>`).join('')}<a href="${parent}">${type}一覧</a><a href="/search/">名前から全体検索</a><a href="/guides/${e.kind==='skill'?'skill-gems':'budget-gear-crafting'}/">${e.kind==='skill'?'スキルジェムの基本':'装備の買い方・作り方'}</a></div></aside></article></main>${FOOTER}</body></html>`;
 await mkdir(resolve(root,path(e).slice(1)),{recursive:true});await writeFile(resolve(root,path(e).slice(1),'index.html'),e.sections?applyGuideReadingLayout(html):html);
}
for(const kind of ['skill','equipment']){
 const name=kind==='skill'?'スキル':'装備',url=site.baseUrl+`/${kind==='skill'?'skills':'equipment'}/`,items=entities.filter(e=>e.kind===kind),title=`PoE2 ${name}一覧｜掲載ビルドで使う効果・条件・入手方法`;
 const schema=[{'@context':'https://schema.org','@type':'CollectionPage',name:title,url,mainEntity:{'@type':'ItemList',itemListElement:items.map((e,i)=>({'@type':'ListItem',position:i+1,name:e.name,url:site.baseUrl+path(e)}))}}];
 const recordGuides=['stuck-at-level-90','arbiter-of-ash-clear-record'].map(slug=>strategyGuides.find(g=>g.slug===slug)).filter(Boolean);
 const firstHand=`<aside class="next-box"><h2>運営者の実測・記録と評価基準</h2><p>掲載ビルドの評価は、海外ガイドの順位ではなく<a href="/rating-criteria/">このサイトの評価基準</a>に沿って付けています。運営者自身のプレイ記録も公開しています。</p><ul>${recordGuides.map(g=>`<li><a href="/guides/${g.slug}/">${esc(g.title)}</a>：${esc(String(g.summary||'').slice(0,120))}</li>`).join('')}</ul></aside>`;
 const html=head(title,`PoE2の掲載ビルドで使う${name}${items.length}件の一覧。${items.slice(0,4).map(e=>e.name).join('・')}など、効果・必要条件・入手方法と採用ビルドを日本語で確認できます。`,url,schema)+`<nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li>${name}一覧</li></ol></nav><article class="article-page"><h1>${title}</h1><p>${kind==='equipment'?'掲載ビルドや用途別に調べた装備':'掲載ビルドに登場するスキル'}から、確認できた${items.length}件を掲載しています。全${name}のデータベースではありません。</p><p>${kind==='skill'?'スキルは、掲載ビルドで主力または育成途中に使うものです。各ページでは効果と使う条件に加えて、ビルドのどのレベル帯で使うかを確認できます。':'装備は、掲載ビルドの原典にあるユニーク装備と、用途別に確認したベースアイテムです。各ページでは効果と必要条件に加えて、ビルドでの用途・採用条件・外したときの代わり、同じ部位のほかの候補を確認できます。'}</p><ul>${items.map(e=>{const slots=[...new Set([...gearCards.filter(o=>gearKey(o.name)===gearKey(e.englishName)).map(o=>o.slot),...(e.slot?[e.slot]:[])])];const used=e.buildIds.map(id=>builds.find(b=>b.id===id)).filter(Boolean);const srows=kind==='skill'?(skillRows.get(e.slug)||[]):[];const range=srows.map(([b,st])=>`${esc(b.name)}：${esc(st[0].label)}〜${esc(st[st.length-1].label)}`).join('、');const relGuide=kind==='equipment'?strategyGuides.find(g=>g.slug===e.slug||(g.title||'').includes(e.name)):null;return `<li><h2><a href="${path(e)}">${esc(e.name)}（${esc(e.englishName)}）</a></h2><p>${esc(e.summary)}</p><p>${slots.length?`部位：${slots.map(esc).join('・')}／`:''}${used.length?'採用ビルド：':'用途別の候補（特定ビルドでの採用は未確認）'}${used.map(b=>`<a href="/builds/${b.classSlug}/${b.slug}/">${esc(b.name)}</a>`).join('、')}</p>${range?`<p>使う段階：${range}</p>`:''}${relGuide?`<p>詳しい入手方法：<a href="/guides/${relGuide.slug}/">${esc(relGuide.title)}</a></p>`:''}</li>`;}).join('')}</ul>${firstHand}<p><a href="/search/">攻略・ビルドもまとめて探す</a> · <a href="/name-index/">ボス・クエスト・NPCの名前索引</a></p></article></main>${FOOTER}</body></html>`;
 await mkdir(resolve(root,kind==='skill'?'skills':'equipment'),{recursive:true});await writeFile(resolve(root,kind==='skill'?'skills':'equipment','index.html'),html);
}
// Add reciprocal, compact references without changing the build's current-level navigation.
for(const b of builds.filter(b=>b.status!=='draft')){
 const relevant=entities.filter(e=>e.buildIds.includes(b.id));if(!relevant.length)continue;
 const file=resolve(root,`builds/${b.classSlug}/${b.slug}/index.html`);let html=await readFile(file,'utf8');
 html=html.replace(/<!-- entity-links:start -->[\s\S]*?<!-- entity-links:end -->/g,'');
 const block=`<!-- entity-links:start --><section class="content-section" id="skill-equipment-reference"><h2>スキル・装備の効果と入手方法</h2><ul>${relevant.map(e=>`<li><a href="${path(e)}">${esc(e.name)}（${esc(e.englishName)}）</a></li>`).join('')}</ul></section><!-- entity-links:end -->`;
 html=html.replace('</main>',block+'</main>');await writeFile(file,html);
}
console.log(`Generated ${entities.length} skill/equipment references and two indexes.`);
for(const [page,label,href] of [['guides/skill-gems','掲載ビルドの主要スキルを調べる','/skills/'],['guides/equipment-basics','掲載ビルドの装備を調べる','/equipment/'],['dictionary/skill-gem','掲載ビルドの主要スキル一覧','/skills/'],['guides/unique-gear','ユニーク装備ごとの効果・必要条件を調べる','/equipment/']]){
 const file=resolve(root,`${page}/index.html`);let html;try{html=await readFile(file,'utf8');}catch{continue;} // Partial copies in tests may lack a page.html=html.replace(/<!-- entity-reference:start -->[\s\S]*?<!-- entity-reference:end -->/g,'');const block=`<!-- entity-reference:start --><p><a href="${href}">${label}：効果・条件・入手方法</a></p><!-- entity-reference:end -->`;html=html.replace('</article>',block+'</article>');await writeFile(file,html);
}
