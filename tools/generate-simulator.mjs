import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root = resolve(import.meta.dirname,'..');
const builds = JSON.parse(await readFile(resolve(root,'data/builds.json'),'utf8')).filter(b=>b.status==='verified');
const site = JSON.parse(await readFile(resolve(root,'data/site.json'),'utf8'));
const esc = s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const classNames = {monk:'Monk',mercenary:'Mercenary',warrior:'Warrior',sorceress:'Sorceress',huntress:'Huntress',ranger:'Ranger',witch:'Witch',druid:'Druid'};
const asc = {'マーシャルアーティスト':'Martial Artist','ジェムリング・リージョネア':'Gemling Legionnaire','スミス・オブ・キタヴァ':'Smith of Kitava','ディサイプル・オブ・ヴァラシュタ':'Disciple of Varashta','スピリットウォーカー':'Spirit Walker','デッドアイ':'Deadeye','インファーナリスト':'Infernalist','オラクル':'Oracle','リッチ':'Lich','ストームウィーバー':'Stormweaver'};
const skills = {
 'monk-whirling-assault':['Whirling Assault'],
 'mercenary-twister-gemling':['Twister'],
 'warrior-shield-wall-smith':['Shield Wall'],
 'sorceress-sand-fire':["Kelari's Deception","Ruzhan's Trap"],
 'huntress-companion':['Companion: {0}'],
 'ranger-ice-shot-deadeye':['Ice Shot'],
 'witch-minion-infernalist':['Skeletal Sniper'],
 'druid-plant-oracle':['Entangle','Thrashing Vines'],
 'witch-ed-contagion-lich':['Essence Drain','Contagion'],
 'mercenary-grenade-gemling':['Explosive Grenade'],
 'huntress-twister-spirit-walker':['Twister'],
 'sorceress-spark-stormweaver':['Spark','Comet']
};
const presets = builds.map((b,i)=>({id:b.id,name:b.name,class:classNames[b.classSlug],className:b.className,ascendancy:asc[b.ascendancy],ascendancyName:b.ascendancy,skills:skills[b.id],mainSkill:b.mainSkill,path:`/builds/${b.classSlug}/${b.slug}/`}));
if(presets.some(p=>!p.class||!p.ascendancy||!p.skills))throw Error('Missing simulator preset mapping');
await writeFile(resolve(root,'data/simulator-presets.json'),JSON.stringify(presets,null,2)+'\n');
const names = JSON.parse(await readFile(resolve(root,'data/japanese-names.json'),'utf8')).names;
await writeFile(resolve(root,'data/simulator-names.json'),JSON.stringify(Object.fromEntries(Object.entries(names).map(([en,x])=>[en,x.ja])))+'\n');
// Pin module and data dependencies as well as the entry script. HTML asset hashing alone
// cannot invalidate a browser's cached ES-module imports or Worker scripts.
const hash = async path=>createHash('sha256').update(await readFile(resolve(root,path))).digest('hex').slice(0,10);
const modelHash=await hash('assets/simulator-model.js');
let worker=await readFile(resolve(root,'assets/simulator-worker.js'),'utf8');
worker=worker.replace(/\.\/simulator-model\.js(?:\?v=[a-f0-9]+)?/g,`./simulator-model.js?v=${modelHash}`);
await writeFile(resolve(root,'assets/simulator-worker.js'),worker);
let client=await readFile(resolve(root,'assets/simulator.js'),'utf8');
for(const [path,value] of [['./simulator-model.js',modelHash],['./simulator-worker.js',await hash('assets/simulator-worker.js')],['/data/simulator-presets.json',await hash('data/simulator-presets.json')],['/data/simulator-names.json',await hash('data/simulator-names.json')]]){
 client=client.replace(new RegExp(path.replaceAll('.','\\.')+'(?:\\?v=[a-f0-9]+)?','g'),`${path}?v=${value}`);
}
await writeFile(resolve(root,'assets/simulator.js'),client);
const cards = presets.map(p=>`<a class="sim-build-card" href="/simulator/?build=${esc(p.id)}" data-preset="${esc(p.id)}"><span>${esc(p.className)} / ${esc(p.ascendancyName)}</span><h2>${esc(p.name)}</h2><p>${esc(p.mainSkill)}</p><b>このビルドで作る <span aria-hidden="true">↗</span></b></a>`).join('');
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PoE2ビルドシミュレーター｜装備・ジェム・パッシブを編集</title><meta name="description" content="PoE2の掲載12ビルドから育成方針を選び、装備・スキル・パッシブをブラウザで編集。変更前後のDPS・ライフ・耐性を比較し、PoB2コードの読込・書出しと端末保存ができます。"><meta name="robots" content="index,follow"><link rel="canonical" href="${site.baseUrl}/simulator/"><meta property="og:title" content="PoE2ビルドシミュレーター"><meta property="og:description" content="ビルドを選んで、自分の装備・ジェム・パッシブを試す。"><meta property="og:url" content="${site.baseUrl}/simulator/"><meta property="og:type" content="website"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/simulator.css"><script type="module" src="/assets/simulator.js"></script></head><body class="simulator-page"><a class="sim-skip" href="#main">本文へ移動</a><header class="sim-header"><a class="sim-brand" href="/">P2 <span>POE2ビルドナビ</span></a><nav aria-label="メインメニュー"><a href="/builds/">ビルドガイド</a><a href="/guides/">攻略</a></nav></header><main id="main"><section id="sim-chooser" class="sim-chooser"><p class="sim-eyebrow">BUILD YOUR OWN</p><h1>自分の構成を、ここで試す。</h1><p class="sim-intro">まずは育成方針を選択。装備・ジェム・パッシブを変更して、数値の変化を確かめられます。</p><p class="sim-muted">初期設定は職業・アセンダンシー・主力スキルです。装備とパッシブを追加して、自分の構成に育ててください。</p><div class="sim-choice-tools"><label>職業で絞る<select id="sim-class-filter"><option value="">すべての職業</option>${[...new Map(presets.map(p=>[p.class,p.className])).entries()].map(([en,ja])=>`<option value="${en}">${ja}</option>`).join('')}</select></label><button type="button" id="sim-choose-import">PoB2コードから読み込む</button></div><div class="sim-build-grid">${cards}</div><section class="sim-explain"><h2>変更してから、買う・振るを決める</h2><p>装備の比較、サポートジェムの組み替え、パッシブの経路と必要ポイントを確認できます。保存はこのブラウザ内。PoB2コードや保存ファイルで別の端末にも持ち出せます。</p><p>対応データ：0.5.5.5。PoBR 0.0.46による参考計算です。未対応の効果・装備の読込エラーは計算結果の下に表示します。実際の戦闘や全ビルドでのPoB2との一致を保証するものではありません。</p></section></section>
<section id="sim-workbench" hidden><div class="sim-toolbar"><div><button id="sim-change-build" type="button" class="sim-text-button">← ビルドを選び直す</button><h2 id="sim-build-name"></h2><p id="sim-character-name" class="sim-muted"></p></div><div class="sim-actions"><button type="button" id="sim-import-open">読み込む</button><button type="button" id="sim-export-open">PoB2コード</button><button type="button" id="sim-download">保存ファイル</button><label class="sim-file-button">保存を読み込む<input type="file" id="sim-file" accept=".json,application/json"></label></div></div>
<div id="sim-status" role="status" aria-live="polite"></div><div id="sim-error" role="alert" hidden></div><div class="sim-layout"><aside class="sim-results" aria-label="計算結果"><div class="sim-results-top"><h3>計算結果</h3><span id="sim-save-status">この端末に自動保存</span></div><label class="sim-level-label">キャラクターLv<input id="sim-level" type="number" min="1" max="100" value="80"></label><div id="sim-stats"></div><button id="sim-baseline" type="button">この数値を比較の基準にする</button><p id="sim-engine-version" class="sim-muted"></p><details id="sim-diagnostics"><summary>計算の確認事項 <span id="sim-diagnostic-count"></span></summary><div id="sim-diagnostic-body"></div></details><a id="sim-guide-link" href="/builds/">参考ビルドガイドを開く</a></aside>
<div class="sim-editor"><nav class="sim-tabs" aria-label="編集する項目"><button type="button" data-tab="items" aria-pressed="true">装備</button><button type="button" data-tab="skills" aria-pressed="false">スキル</button><button type="button" data-tab="tree" aria-pressed="false">パッシブ</button><button type="button" data-tab="config" aria-pressed="false">計算条件</button></nav>
<section id="sim-items" class="sim-panel"><div class="sim-panel-heading"><h3>装備を選ぶ</h3><p>部位を選び、ユニークを探すか、ゲーム内でコピーした英語の装備情報を貼り付けます。</p></div><div class="sim-items-layout"><div id="sim-slots"></div><div><h4 id="sim-slot-title"></h4><label>ユニークを検索<input type="search" id="sim-unique-search" placeholder="日本語名・英語名"></label><label>候補<select id="sim-unique"><option value="">ユニークを選ぶ</option></select></label><div class="sim-unique-controls"><label>可変値の位置<select id="sim-roll"><option value="0.5">中間値</option><option value="0">最小値</option><option value="1">最大値</option></select></label><button id="sim-unique-draft" type="button">編集欄に入れる</button></div><label>装備のテキスト<textarea id="sim-item-text" rows="12" spellcheck="false" placeholder="Rarity: Rare&#10;装備名&#10;ベース名&#10;…"></textarea></label><div class="sim-actions"><button id="sim-item-apply" type="button" class="sim-primary">この装備を反映</button><button id="sim-item-remove" type="button">この部位を外す</button></div><p class="sim-muted">編集欄の内容は「反映」で計算に入ります。実際の可変値に合わせて変更できます。</p></div></div></section>
<section id="sim-skills" class="sim-panel" hidden><div class="sim-panel-heading"><h3>スキルとサポート</h3><p>計算する主力スキルを選び、ジェムの種類・Lv・品質を変更します。</p></div><div id="sim-skill-groups"></div><button type="button" id="sim-add-group">＋ スキルを追加</button></section>
<section id="sim-tree" class="sim-panel" hidden><div class="sim-panel-heading"><h3>パッシブを組む</h3><p>ドラッグで移動、＋/−で拡大縮小。ノードを選ぶと取得経路と必要ポイントを確認できます。</p></div><div class="sim-tree-controls"><label>ノードを検索<input id="sim-node-search" type="search" placeholder="日本語名・英語名・効果"></label><button type="button" id="sim-tree-plus" aria-label="パッシブツリーを拡大">＋</button><button type="button" id="sim-tree-minus" aria-label="パッシブツリーを縮小">−</button><button type="button" id="sim-tree-center">職業の開始点へ</button><button type="button" id="sim-tree-ascendancy">アセンダンシーへ</button></div><div id="sim-node-search-results"></div><div id="sim-tree-map" role="img" aria-label="パッシブツリー。ノードは検索欄からも選べます。"><svg id="sim-tree-svg" xmlns="http://www.w3.org/2000/svg"><g id="sim-tree-edges"></g><g id="sim-tree-nodes"></g></svg></div><div class="sim-tree-legend"><span>● 取得済み</span><span>○ 未取得</span><span id="sim-point-count"></span></div><section id="sim-node-detail"><h4>ノードを選んでください</h4><p>取得前に経路とコストを確認できます。外す場合は、つながらなくなるノードもまとめて確認します。</p></section><label>取得済みのキャンペーン報酬ポイント<input id="sim-quest-points" type="number" min="0" max="24" value="0"></label></section>
<section id="sim-config" class="sim-panel" hidden><div class="sim-panel-heading"><h3>計算条件</h3><p>敵と報酬の条件をそろえて比較してください。</p></div><label>敵の種類<select id="sim-enemy"><option value="none">通常の敵</option><option value="boss">ボス</option><option value="pinnacle">ピナクルボス</option><option value="uber">Uber</option></select></label><label class="sim-check"><input type="checkbox" id="sim-life-reward">溶岩の祠のライフ5%報酬を取得済み</label><label>追加の修飾効果（英語・1行に1つ）<textarea id="sim-extra-mods" rows="6" spellcheck="false" placeholder="+100 to maximum Life"></textarea></label><button type="button" id="sim-config-apply" class="sim-primary">条件を反映</button><label>構成のメモ<textarea id="sim-notes" rows="5" maxlength="20000"></textarea></label><details><summary>読み込んだPoB2のその他の条件</summary><pre id="sim-raw-config"></pre></details><p class="sim-muted">読み込んだコードのチャージ・状態異常などの設定は保持します。戦闘中の操作順やバフの稼働率は再現しません。</p></section></div></div></section>
<dialog id="sim-code-dialog"><form method="dialog"><button class="sim-dialog-close" aria-label="閉じる">×</button></form><h2 id="sim-code-title">PoB2コードを読み込む</h2><label>PoB2共有コード<textarea id="sim-code" rows="8" spellcheck="false" maxlength="1000000"></textarea></label><p id="sim-code-help">コードはこの端末で処理します。現在の構成に読み込むため、必要な構成は先に保存してください。</p><div class="sim-actions"><button type="button" id="sim-code-import" class="sim-primary">このコードを読み込む</button><button type="button" id="sim-code-copy" hidden>コードをコピー</button></div><p id="sim-code-message" role="status"></p></dialog><noscript><p class="sim-noscript">シミュレーターの操作にはJavaScriptが必要です。ビルドガイドはJavaScriptなしでも読めます。</p></noscript></main><aside class="sim-footer" aria-label="計算エンジンの出典"><a href="https://github.com/ackness/pobr/releases/tag/v0.0.46" target="_blank" rel="noopener noreferrer">計算エンジン：PoBR 0.0.46</a><a href="/assets/simulator-engine/v0.0.46/LICENSE.txt">MITライセンス</a><p>Game data © Grinding Gear Games. 非公式ツールです。</p></aside></body></html>\n`;
await mkdir(resolve(root,'simulator'),{recursive:true});
await writeFile(resolve(root,'simulator/index.html'),html);
for (const p of presets) {
  const file = resolve(root,`.${p.path}index.html`);
  let html = (await readFile(file,'utf8')).replace(/<!-- simulator-entry:start -->[\s\S]*?<!-- simulator-entry:end -->/g,'');
  html = html.replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>)/,`$1<!-- simulator-entry:start --><p class="simulator-entry"><a class="button button-secondary" href="/simulator/?build=${esc(p.id)}">このビルドでシミュレーターを開く →</a></p><!-- simulator-entry:end -->`);
  await writeFile(file,html);
}
for (const path of ['builds/index.html','index.html']) {
 const file=resolve(root,path); let html=(await readFile(file,'utf8')).replace(/<!-- simulator-entry:start -->[\s\S]*?<!-- simulator-entry:end -->/g,'');
 html=html.replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>)/,'$1<!-- simulator-entry:start --><p class="simulator-entry"><a class="button button-secondary" href="/simulator/">ビルドを選んでシミュレーション →</a></p><!-- simulator-entry:end -->');
 await writeFile(file,html);
}
console.log(`Simulator: ${presets.length} build choices and detail-page entry links`);
