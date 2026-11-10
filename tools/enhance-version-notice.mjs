// Idempotent: flags builds whose data `version` differs from the live game version
// (`data/site.json` gameVersion). While they match, this removes every notice (no-op).
// On a major release, set gameVersion (e.g. "1.0") and rerun: each unverified build page
// gets a notice and hub pages get a banner. Titles that name the old version switch to
// "…【1.0対応確認中】" (see version-title.mjs); rankings are not touched.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {esc} from './build-facts.mjs';
import {applyVersionTitle} from './version-title.mjs';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const save=(p,s)=>writeFile(resolve(root,p),s);
const site=JSON.parse(await read('data/site.json'));
const builds=JSON.parse(await read('data/builds.json')).filter(b=>b.status!=='draft');
const game=site.gameVersion;
if(!game)throw new Error('data/site.json: gameVersion missing');
const isOutdated=b=>b.version!==game;
const outdated=builds.filter(isOutdated);
const strip=html=>html.replace(/<!-- version-notice:start -->[\s\S]*?<!-- version-notice:end -->/g,'');

for(const b of builds){
 const path=`builds/${b.classSlug}/${b.slug}/index.html`;
 let html=strip(await read(path));
 html=applyVersionTitle(html,isOutdated(b)?b.version:null,game);
 if(isOutdated(b)){
  const notice=`<!-- version-notice:start --><p class="version-notice" role="note"><b>PoE2 ${esc(game)}では未確認：</b>このページは${esc(b.version)}の資料で作成した育成手順です。スキル名・解禁Lv・装備条件が${esc(game)}で変わっている可能性があります。公式パッチノートと${esc(game)}対応の元ガイドで確認できたものから更新します。<a href="/poe2-1-0/">${esc(game)}の確認済み情報</a></p><!-- version-notice:end -->`;
  if(!html.includes('<div class="build-overview">'))throw new Error(`${path}: build-overview anchor missing`);
  html=html.replace('<div class="build-overview">',`${notice}<div class="build-overview">`);
 }
 await save(path,html);
}

const hubs=['index.html','beginner-builds/index.html','builds/index.html','tier-list/index.html','best-builds/index.html','league-starter/index.html','leveling/index.html','classes/index.html',...[...new Set(builds.map(b=>b.classSlug))].map(c=>`classes/${c}/index.html`)];
for(const path of hubs){
 let html=strip(await read(path));
 html=applyVersionTitle(html,outdated.length?outdated[0].version:null,game);
 if(outdated.length){
  const versions=[...new Set(outdated.map(b=>b.version))].join('・');
  const banner=`<!-- version-notice:start --><aside class="version-banner" role="note"><p><b>PoE2 ${esc(game)}が公開されています。</b>掲載${builds.length}ビルドのうち${outdated.length}件は${esc(versions)}の情報で、${esc(game)}では未確認です。各ビルドページに確認状況を表示しています。</p><a href="/poe2-1-0/">${esc(game)}の確認済み情報を見る</a></aside><!-- version-notice:end -->`;
  const main=html.match(/<main\b[^>]*>/);
  if(!main)throw new Error(`${path}: <main> missing`);
  html=html.replace(main[0],`${main[0]}${banner}`);
 }
 await save(path,html);
}
console.log(`Version notice: game ${game}, ${outdated.length}/${builds.length} builds not verified for it`);

const review=JSON.parse(await read('data/patch-review.json'));
if(review.checkedAt!==site.latestPatchCheckedAt)throw Error('Patch review dates disagree');
for(const patch of review.patches)if(new URL(patch.url).hostname!=='www.pathofexile.com')throw Error('Patch reviews require official sources');
const reviewBlock=`<!-- patch-review:start --><details class="version-notice patch-review"><summary>最新パッチの確認内容：${esc(site.latestPatch)}</summary><p>公式差分の確認：<time datetime="${esc(review.checkedAt)}">${esc(review.checkedAt)}</time>。${esc(review.scope)}</p><ul>${review.patches.map(p=>`<li><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.version)}</a>（${esc(p.publishedDate)}公開）<p>${esc(p.summary)}</p><p>${esc(p.impact)}</p>${p.remaining?`<p>${esc(p.remaining)}</p>`:''}</li>`).join('')}</ul><p>掲載ビルドの基準：${esc(review.gameVersion)}。計算エンジンのデータ：${esc(review.engineDataVersion)}。確認した差分だけを反映し、育成資料の原典照合日は各記事に残しています。</p></details><!-- patch-review:end -->`;
for(const path of ['index.html','guides/index.html','simulator/index.html','poe2-1-0/index.html']){
 let html=(await read(path)).replace(/<!-- patch-review:start -->[\s\S]*?<!-- patch-review:end -->/g,'');
 html=html.replace('</main>',reviewBlock+'</main>');await save(path,html);
}
