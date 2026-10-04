// Idempotent. Internal links for discovery:
// (1) "このページに出てくる用語" — on build, class, guide, dictionary and /what-is-poe2/ pages
//     in the sitemap, lists the dictionary terms that appear in the page's own main text.
// (2) On build pages, a static list of the six trouble guides and the basics guides inside the
//     "困ったとき" card, so those guides are reachable without JavaScript.
// (3) On the build-choice hubs, links to the event-league guide and the 1.0 build status.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {insertBlock} from './block-order.mjs';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const terms=JSON.parse(await read('data/dictionary.json'));
const sitemap=await read('sitemap.xml');
const paths=[...sitemap.matchAll(/<loc>https:\/\/poe2-build-navi-jp\.github\.io\/([^<]*)<\/loc>/g)].map(m=>m[1])
 .filter(p=>/^(builds\/[^/]+\/[^/]+|classes\/[^/]+|guides\/[^/]+|dictionary\/[^/]+|what-is-poe2)\/$/.test(p));
// Words that mark each term in running text (ASCII ones must stand alone).
const ALIASES={build:['ビルド'],dps:['DPS'],'skill-gem':['スキルジェム'],'support-gem':['サポートジェム','サポート(?!ー|パック)'],'passive-tree':['パッシブ'],resistance:['耐性'],mapping:['Mapping','マッピング'],endgame:['Endgame','エンドゲーム'],'league-starter':['リーグスターター'],ssf:['SSF'],ascendancy:['アセンダンシー'],spirit:['Spirit','スピリット'],'energy-shield':['エナジーシールド','ES']};
const patterns=Object.fromEntries(Object.entries(ALIASES).map(([slug,words])=>[slug,new RegExp(words.map(w=>/^[A-Za-z]+$/.test(w)?`(?<![A-Za-z])${w}(?![A-Za-z])`:w).join('|'))]));
const TROUBLE=[['すぐ死ぬ','/guides/why-i-die/'],['火力が出ない','/guides/increase-damage/'],['マナが足りない','/guides/mana-problem/'],['ボスに勝てない','/guides/cant-beat-boss/'],['周回が遅い','/guides/slow-mapping/'],['装備の更新','/guides/gear-upgrade/']];
const BASICS=[['スキルジェム','/guides/skill-gems/'],['サポートジェム','/guides/support-gems/'],['装備の見方','/guides/equipment-basics/'],['キャンペーン終了後','/guides/after-campaign/']];
const HUB_LINKS=[['Forbidden Rites初心者ガイド','/guides/forbidden-rites-beginner/'],['1.0のビルド対応状況','/poe2-1-0/build-status/']];
const HUBS={'league-starter/index.html':HUB_LINKS,'tier-list/index.html':HUB_LINKS,'best-builds/index.html':HUB_LINKS,'leveling/index.html':[['キャンペーン終了後にすること','/guides/after-campaign/'],...HUB_LINKS]};
const strip=html=>html.replace(/<!-- term-links:start -->[\s\S]*?<!-- term-links:end -->/g,'').replace(/<!-- trouble-guides:start -->[\s\S]*?<!-- trouble-guides:end -->/g,'');
let linked=0;
for(const path of paths){
 const file=`${path}index.html`;
 let html=strip(await read(file));
 const main=html.match(/<main[\s\S]*<\/main>/)?.[0]??'';
 const text=main.replace(/<!-- (one-link|build-history):start -->[\s\S]*?<!-- \1:end -->/g,'').replace(/<(script|nav)\b[\s\S]*?<\/\1>/g,'').replace(/<[^>]+>/g,' ');
 const self=path.startsWith('dictionary/')?path.split('/')[1]:null;
 const found=terms.filter(t=>t.slug!==self&&patterns[t.slug]?.test(text));
 if(found.length){
  html=insertBlock(html,'</main>','term-links',`<!-- term-links:start --><section class="term-links-block" aria-labelledby="term-links-title"><h2 id="term-links-title">このページに出てくる用語</h2><ul class="term-links">${found.map(t=>`<li><a href="/dictionary/${t.slug}/">${esc(t.term)}</a>：${esc(t.oneLine)}</li>`).join('')}</ul></section><!-- term-links:end -->`);
  linked++;
 }
 if(path.startsWith('builds/')){
  const card=html.indexOf('<section class="trouble-card"');
  const end=card===-1?-1:html.indexOf('</section>',card);
  if(end===-1)throw new Error(`${file}: trouble card not found`);
  html=`${html.slice(0,end)}<!-- trouble-guides:start --><p class="trouble-guides">困りごと別のガイド：${TROUBLE.map(([label,url])=>`<a href="${url}">${label}</a>`).join('・')}</p><p class="trouble-guides">基本の確認：${BASICS.map(([label,url])=>`<a href="${url}">${label}</a>`).join('・')}</p><!-- trouble-guides:end -->${html.slice(end)}`;
 }
 await writeFile(resolve(root,file),html);
}
for(const [file,links] of Object.entries(HUBS)){
 let html=(await read(file)).replace(/<!-- hub-links:start -->[\s\S]*?<!-- hub-links:end -->/g,'');
 const start=html.indexOf('<div class="related-links">');
 const end=start===-1?-1:html.indexOf('</div>',start);
 if(end===-1)throw new Error(`${file}: related links not found`);
 html=`${html.slice(0,end)}<!-- hub-links:start -->${links.map(([label,url])=>`<a href="${url}">${label}</a>`).join('')}<!-- hub-links:end -->${html.slice(end)}`;
 await writeFile(resolve(root,file),html);
}
console.log(`Term links: ${linked}/${paths.length} pages`);
