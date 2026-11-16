import {readFile, writeFile} from 'node:fs/promises';
import {parse, parseFragment, serialize} from 'parse5';
import {createHash} from 'node:crypto';
import {growthMarkup} from './my-build-growth-layout.mjs';
const root = new URL('../', import.meta.url);
const presets=JSON.parse(await readFile(new URL('data/simulator-presets.json',root),'utf8'));
const noticesFile=new URL('data/saved-build-updates.json',root),noticeCatalog=JSON.parse(await readFile(noticesFile,'utf8'));
noticeCatalog.guideRevisions=Object.fromEntries(presets.map(p=>[p.id,p.contentRevision]));
await writeFile(noticesFile,JSON.stringify(noticeCatalog,null,2)+'\n');
for(const name of ['simulator-library-model.js','simulator-sync.js','simulator-library.js','simulator-goal-model.js','simulator-goal.js','simulator-impact-model.js','simulator-impact.js','simulator-planner-model.js','simulator-planner.js']){
  const file=new URL('assets/'+name,root);let source=await readFile(file,'utf8');
  for(const match of [...source.matchAll(/from '(\.\/simulator-[a-z-]+\.js)(?:\?v=[a-f0-9]+)?'/g)]){
    const hash=createHash('sha256').update(await readFile(new URL('assets/'+match[1].slice(2),root))).digest('hex').slice(0,10);
    source=source.replace(match[0],`from '${match[1]}?v=${hash}'`);
  }
  if(name==='simulator-library.js'){
    const hash=createHash('sha256').update(await readFile(new URL('data/saved-build-updates.json',root))).digest('hex').slice(0,10);
    source=source.replace(/\/data\/saved-build-updates\.json(?:\?v=[a-f0-9]+)?/g,'/data/saved-build-updates.json?v='+hash);
  }
  for (const path of ['data/simulator-index.json', 'data/simulator-names.json']) {
    const hash = createHash('sha256').update(await readFile(new URL(path, root))).digest('hex').slice(0, 10);
    source = source.replace(new RegExp('/' + path.replaceAll('.', '\\.') + '(?:\\?v=[a-f0-9]+)?', 'g'), '/' + path + '?v=' + hash);
  }
  await writeFile(file,source);
}
const examples = JSON.parse(await readFile(new URL('data/simulator-examples.json', root), 'utf8'));
const enExamples = JSON.parse(await readFile(new URL('data/simulator-examples-en.json', root), 'utf8'));
const escape = v => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
for (const en of [false, true]) {
  const t = (ja, english) => en ? english : ja;
  const file = new URL((en ? 'en/' : '') + 'simulator/index.html', root);
  let html = await readFile(file, 'utf8');
  html = html.replace(/<!-- sim-library:[\s\S]*?<!-- \/sim-library -->/g, '');
  const doc = parse(html), nodes = new Map();
  let head, body;
  function walk(n) {if(n.tagName === 'head')head=n;if(n.tagName === 'body')body=n;const id=n.attrs?.find(a=>a.name==='id')?.value;if(id)nodes.set(id,n);for(const c of n.childNodes||[])walk(c);}
  walk(doc);
  function fragment(parent, content, before = null) {
    const parts = parseFragment(`<!-- sim-library:enhancement -->${content}<!-- /sim-library -->`).childNodes;
    for (const node of parts) node.parentNode = parent;
    const index = before ? parent.childNodes.indexOf(before) : parent.childNodes.length;
    parent.childNodes.splice(index, 0, ...parts);
  }
  fragment(head, '<link rel="stylesheet" href="/assets/simulator-library.css">');
  fragment(body, '<script type="module" src="/assets/simulator-library.js"></script>');
  fragment(nodes.get('sim-workspace').parentNode,growthMarkup(en,true),nodes.get('sim-workspace'));
  fragment(body, '<script type="module" src="/assets/simulator-goal.js"></script>');
  fragment(body, '<script type="module" src="/assets/simulator-impact.js"></script>');
  fragment(body, '<script type="module" src="/assets/simulator-planner.js"></script>');
  fragment(body, '<script type="module" src="/assets/simulator-community.js"></script>');
  fragment(nodes.get('sim-workspace').parentNode, '<details id="sim-community-panel" class="sim-workspace"><summary>' + t('構成を公開・みんなのビルド', 'Publish a build / community builds') + '</summary><p>' + t('現在の入力を投稿用に準備できます。次の画面で内容を確認して、一般公開を選ぶまで投稿されません。', 'Prepare your open draft for publishing. It stays private until you review the next page and explicitly publish it.') + '</p><div class="sim-actions"><button id="sim-community-prepare" type="button" disabled>' + t('現在の構成を投稿用に準備', 'Prepare this draft for publishing') + '</button><a href="' + (en ? '/en' : '') + '/community/">' + t('みんなのビルドを探す', 'Explore community builds') + '</a></div><p id="sim-community-status" role="status"></p></details>', nodes.get('sim-workspace'));
  fragment(nodes.get('sim-workspace').parentNode, [
    '<details id="sim-planner-panel" class="sim-workspace sim-planner-panel" hidden><summary>' + t('ゲーム内プランナーへ書き出す', 'Export to the in-game Build Planner') + '</summary>',
    '<p>' + t('現在の入力か名前付き保存から、スキル・サポート・パッシブを公式の.build形式に変換します。', 'Convert skills, supports and passives from your open draft or a named save into the official .build format.') + '</p>',
    '<label>' + t('書き出す構成', 'Configuration') + '<select id="sim-planner-source"></select></label>',
    '<div class="sim-planner-controls"><label>' + t('ビルド名', 'Build name') + '<input id="sim-planner-name" maxlength="140"></label>',
    '<label>' + t('作者名（任意）', 'Author (optional)') + '<input id="sim-planner-author" maxlength="80" autocomplete="off"></label>',
    '<label>' + t('表示を開始するLv', 'Show from level') + '<input id="sim-planner-from" type="number" min="1" max="100" value="1" inputmode="numeric"></label>',
    '<label>' + t('表示を終了するLv', 'Show through level') + '<input id="sim-planner-to" type="number" min="1" max="100" value="100" inputmode="numeric"></label></div>',
    '<label class="sim-planner-check"><input id="sim-planner-passives" type="checkbox" checked>' + t('パッシブを含める', 'Include passives') + '</label>',
    '<label class="sim-planner-check"><input id="sim-planner-skills" type="checkbox" checked>' + t('スキルとサポートを含める', 'Include skills and supports') + '</label>',
    '<p class="sim-library-help">' + t('現在の入力を指定したレベル範囲の見本として出力します。装備・計算条件・個人メモは含めません。', 'This exports a snapshot for the selected level range. Equipment, calculation settings and private notes are excluded.') + '</p>',
    '<button id="sim-planner-check" type="button" disabled>' + t('書き出す内容を確認', 'Review export') + '</button><div id="sim-planner-preview"></div>',
    '<label id="sim-planner-partial-row" class="sim-planner-check" hidden><input id="sim-planner-partial" type="checkbox">' + t('表示された未対応項目を除いて書き出す', 'Export without the listed unsupported entries') + '</label>',
    '<button id="sim-planner-download" type="button" disabled>' + t('.buildをダウンロード', 'Download .build') + '</button><p id="sim-planner-status" role="status" aria-live="polite"></p>',
    '<details><summary>' + t('ゲームで読み込む手順・対応範囲', 'Loading the file and compatibility') + '</summary><ol><li>' +
      t('PCでは、保存した.buildを次のフォルダに入れます。', 'On PC, place the downloaded .build in the folder below.') +
      '<pre>Documents/My Games/Path of Exile 2/BuildPlanner</pre></li><li>' +
      t('ゲーム内のBuild Plannerでビルド名を選びます。公式サイトで自分の.buildをアップロードして使う方法もあります。', 'Select the build name in the in-game Build Planner. You can also upload your .build on the official website.') +
      '</li></ol><p class="sim-library-help">' +
      t('公式のVersion 1（Experimental）形式を参照しています。IDと形式は収録データで検証していますが、ゲーム内実機での読み込みは未確認です。', 'Uses the official Version 1 experimental format. IDs and structure are checked against the bundled data; loading in the game client has not been tested.') +
      '</p><a href="https://www.pathofexile.com/developer/docs/game#build-planner" target="_blank" rel="noopener">' +
      t('公式の仕様・使い方', 'Official format and instructions') + '</a></details></details>',
  ].join(''), nodes.get('sim-workspace'));
  fragment(nodes.get('sim-workspace').parentNode, `<details id="sim-goal-panel" class="sim-workspace sim-goal-panel" hidden><summary>${t('目標ビルドまでの不足を確認','Check what is missing from your target build')} <span id="sim-goal-count"></span></summary><p>${t('完成見本や保存構成を目標にして、今の構成との差を確認できます。照合するのは編集画面で反映した入力内容です。','Choose a reference or named save as your target and check the gaps in your current build. The check uses inputs you have applied in the editor.')}</p><div class="sim-goal-picker"><label>${t('目標にする構成','Target configuration')}<select id="sim-goal-select"><option value="">${t('ビルドを選ぶと目標を設定できます','Select a build to choose a target')}</option></select></label><button id="sim-goal-set" type="button" disabled>${t('この端末の目標にする','Set target on this device')}</button></div><p id="sim-goal-options-help" class="sim-library-help"></p><p id="sim-goal-status" role="status" aria-live="polite"></p><div id="sim-goal-active" hidden><h3 id="sim-goal-name"></h3><label class="sim-goal-matched"><input id="sim-goal-show-matched" type="checkbox">${t('一致した項目も表示','Show matching entries too')}</label><div id="sim-goal-result"></div><p class="sim-library-help">${t('目標に入力された項目を照合します。装備の違いは性能の優劣を示しません。火力・耐久はA/B比較でも確認できます。','Only entries configured in the target are checked. Equipment differences do not rank performance. Use A/B comparison to check damage and defences.')}</p></div><button id="sim-goal-clear" type="button" hidden>${t('この端末の目標設定を解除','Clear target on this device')}</button><p class="sim-library-help">${t('目標設定はこの端末に保存します。目標に選んだ構成の内容は、選び直すまで固定して保持します。','The target preference is saved on this device. Its inputs remain fixed until you select a target again.')}</p></details>`, nodes.get('sim-workspace'));
  const compare = nodes.get('sim-compare-plans');
  fragment(compare.parentNode, `<label class="sim-library-align"><input id="sim-library-align" type="checkbox" checked>${t('Aのレベル・報酬ポイント・一時効果に揃えて比較','Use A’s level, quest points and temporary effects for both builds')}</label><p class="sim-library-help">${t('敵は比較欄で共通指定。保存元は変更しません。主力スキル・武器セットが違う場合は参考比較と表示します。','The selected enemy applies to both builds. Original saves stay intact. Different main skills or weapon sets are flagged in the record.')}</p>`, compare);
  fragment(nodes.get('sim-compare-export'), `<label class="sim-library-name">${t('比較記録の名前','Comparison record name')}<input id="sim-journal-name" maxlength="60" autocomplete="off" placeholder="${t('例：指輪交換・ボス用','Example: boss ring swap')}"></label><button type="button" id="sim-journal-save">${t('この比較を記録する','Save this comparison')}</button><p id="sim-journal-save-status" role="status"></p>`);
  const cards = (en ? enExamples : examples).examples.filter(e=>e.verification?.inputComplete);
  const completions = cards.length ? `<section class="sim-library-complete"><h3>${t('装備・ジェム・パッシブを揃えた見本','Fully entered equipment, gems and passives')}</h3><p>${t('0.5.5用の参考完成構成です。計算と入力条件を確認済み。仮装備を含み、実プレイ・1.0での強さは未検証です。','Reference configurations for 0.5.5. Inputs and calculations were checked. Equipment includes synthetic examples; gameplay performance and 1.0 compatibility are unverified.')}</p><div class="sim-build-grid">${cards.map(e=>`<a class="sim-build-card" href="${en?'/en':''}/simulator/?build=${escape(e.preset)}&amp;example=${escape(e.id)}"><span>${t('計算・入力確認済み','Inputs and calculation checked')}</span><h4>${escape(e.title)}</h4><p>Lv${e.level} · ${e.saved.request.items.length}${t('部位',' item slots')} · ${e.saved.request.socket_groups[0].gems.length-1}${t('サポート',' supports')}</p><b>${t('内容を確認して試す →','Review and try →')}</b></a>`).join('')}</div></section>` : '';
  const workbench = nodes.get('sim-workbench');
  fragment(workbench.parentNode, `<section id="sim-library" class="sim-library" aria-labelledby="sim-library-title"><h2 id="sim-library-title">${t('保存した構成を使い続ける','Keep your saved builds useful')}</h2>${completions}<details id="sim-updates-panel"><summary>${t('保存構成に関係する更新','Updates relevant to saved builds')} <span id="sim-update-count"></span></summary><p>${t('名前を付けて保存した構成が対象です。アプリ・サイトを開いたときに案内します。','Notices apply to named saves and are checked while this app or page is open.')}</p><div id="sim-update-list" role="status"></div><button id="sim-updates-seen" type="button">${t('表示中の案内を既読にする','Mark these notices as read')}</button><button id="sim-updates-retry" type="button" hidden>${t('案内を再読み込み','Retry loading notices')}</button></details><details id="sim-journal-panel"><summary>${t('比較記録','Comparison journal')} <span id="sim-journal-count"></span></summary><p>${t('A/B比較の下で記録できます。保存時の計算値と条件を残します。開き直すと現在のデータで再計算します。','Save a record below the A/B results. Recorded values and conditions remain frozen; reopening recalculates with current data.')}</p><div id="sim-journal-list"></div><p id="sim-journal-status" role="status"></p><div id="sim-journal-delete-panel" hidden><p id="sim-journal-delete-name"></p><button type="button" id="sim-journal-delete-confirm">${t('この記録を削除','Delete this record')}</button><button type="button" id="sim-journal-delete-cancel">${t('戻る','Cancel')}</button></div></details><details id="sim-sync-panel"><summary>${t('スマホ・PCで構成を同期','Sync builds between phone and PC')}</summary><p>${t('名前付き構成と比較記録を自動同期します。一時編集中の構成はそのまま使えます。','Automatically sync named saves and comparison records while keeping your active draft in place.')}</p><p id="sim-sync-status" role="status" aria-live="polite">${t('未接続。端末内の保存は利用できます。','Not connected. Local saves remain available.')}</p><div id="sim-sync-setup"><button id="sim-sync-create" type="button">${t('新しく同期を始める','Create a sync vault')}</button><label>${t('他の端末の接続コード','Connection code from another device')}<input id="sim-sync-code" type="password" autocomplete="off" autocapitalize="off" spellcheck="false"></label><button id="sim-sync-join" type="button">${t('このコードで接続','Connect with this code')}</button></div><div id="sim-sync-connected" hidden><button id="sim-sync-now" type="button">${t('今すぐ同期','Sync now')}</button><details><summary>${t('別の端末をつなぐ・復旧コード','Connect another device / recovery code')}</summary><p>${t('別の端末のこの欄へ入力してください。コードを知る人は保存内容を読めるので、人に渡さず控えてください。','Enter this code in the same panel on your other device. Anyone with the code can read the vault, so keep it private and save a recovery copy.')}</p><input id="sim-sync-recovery" readonly autocomplete="off" spellcheck="false" aria-label="${t('復旧用の接続コード','Recovery connection code')}"><button id="sim-sync-copy" type="button">${t('コードをコピー','Copy code')}</button></details><button id="sim-sync-disconnect" type="button">${t('この端末の接続を解除','Disconnect this device')}</button><details><summary>${t('現在の保管庫の同期を解除する','Revoke the current vault')}</summary><p>${t('現在の保管庫の暗号文を削除し、読み書きを停止します。端末内の構成は残ります。以前のサーバーの保管庫は別に残り、この操作では無効化されません。','Delete the current vault’s encrypted snapshot and disable access. Local saves remain. The previous server’s vault is separate and is not revoked by this action.')}</p><button id="sim-sync-revoke" type="button">${t('保管庫を無効化','Revoke this vault')}</button></details></div><details><summary>${t('以前の保管庫を復旧','Restore a previous vault')}</summary><p>${t('以前のサーバーにだけある保存を、現在の保管庫に追加します。端末に保存された接続コード、または上の接続コード欄を使います。異なる編集は競合コピーとして残します。以前の保管庫は削除しません。','Add saves held only by the previous server to the current vault. Use the remembered code or the connection-code field above. Different edits are kept as conflict copies. The previous vault is retained.')}</p><button id="sim-sync-import-legacy" type="button">${t('以前の保管庫から読み込む','Import the previous vault')}</button></details><p class="sim-library-help">${t('内容は暗号化して保管。同期はシミュレーターを開いている間に行います。通信できないときは端末内に保存し、再接続時に同期します。容量2MiB。','Data is encrypted before upload. Sync runs while the simulator is open. Offline edits stay on your device and sync after reconnection. Vault limit: 2 MiB.')}</p></details></section>`);
  await writeFile(file, serialize(doc) + '\n');
}
// Describe the opt-in storage behavior alongside the existing local-storage policy.
const privacyFile=new URL('privacy/index.html',root);
let privacy=await readFile(privacyFile,'utf8');
privacy=privacy.replace(/<!-- simulator-sync-privacy:start -->[\s\S]*?<!-- simulator-sync-privacy:end -->/g,'')
 .replace('この情報は本サイトのサーバーへ送信しません。','通常の端末内保存は端末内で行います。任意の端末間同期を有効にした場合の取り扱いは次のとおりです。');
const privacyBlock='<!-- simulator-sync-privacy:start --><section id="simulator-sync-privacy"><h2>任意のビルド同期</h2><p>シミュレーターで「新しく同期を始める」または接続コードによる接続を選んだ場合だけ、名前付きの構成と比較記録を端末間で同期します。構成名・メモ・装備・ジェム・パッシブ・比較条件を端末で暗号化し、ChatGPT Sites上のCloudflare D1へ暗号文として保存します。以前のAppDeploy保管庫は残り、接続コードで明示的に読み戻す場合だけ以前のサービスへ接続します。一時編集中の自動保存、記事の閲覧履歴、他の端末内設定は同期対象に含めません。</p><p>サーバーには保管庫の識別子、認証用トークンのハッシュ、更新番号、暗号文を保存します。復旧用の接続コードと復号鍵はサーバーへ送りません。接続コードはこの端末のlocalStorageに保存し、保管庫を読むために利用します。同期リクエストにコードや構成本文を解析イベントとして添付しません。ホスティング事業者は通信元IPなどのアクセス情報を処理する場合があります。</p><p>接続コードを知る人は保存内容を復号できます。コードを紛失すると運営からの復旧はできません。「この端末の接続を解除」で端末の接続情報を消せます。「保管庫を無効化」で稼働中の保管庫の暗号文を削除し、同じコードでの読み書きを停止します。以前のAppDeploy保管庫は別に残るため、この操作では無効化されません。各端末に残る構成は、構成の削除機能で個別に管理できます。</p><p lang="en">Cross-device sync is optional. Named builds and comparison records are encrypted on your device before storage on Cloudflare D1 hosted by ChatGPT Sites. Previous AppDeploy vaults are retained and accessed only for an explicit restore. The recovery code and decryption key are not sent to the server. Keep the code private: it grants access to the vault. Disconnecting removes this device’s connection; revoking the vault removes its live encrypted snapshot and disables the code. This does not revoke a separate vault on the previous server. Local saves remain on each device.</p></section><!-- simulator-sync-privacy:end -->';
if(!/<h2\b[^>]*>Google Analytics<\/h2>/.test(privacy))throw Error('Privacy insertion point missing');
privacy=privacy.replace(/(<h2\b[^>]*>Google Analytics<\/h2>)/,privacyBlock+'$1').replace('最終更新：2026年11月10日。','最終更新：2026年11月16日。');
await writeFile(privacyFile,privacy);
console.log('Enhanced Japanese and English simulator libraries');
