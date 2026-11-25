import {JOURNAL_KEY, JOURNAL_LIMIT, parseJournal, makeJournalRecord, savedBuildHeaders, relevantNotices} from './simulator-library-model.js?v=aee355aa91';
import {EncryptedBuildSync, IframeTransport, SYNC_CREDENTIAL_KEY} from './simulator-sync.js?v=acae935b76';
import {newSyncCode} from './simulator-sync-crypto.js?v=6d43b0469b';

const en = document.documentElement.lang === 'en';
const t = (ja, english) => en ? english : ja;
const $ = id => document.getElementById(id);
const escape = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const SEEN_KEY = 'poe2-simulator:updates-seen:v1';
const time = value => new Intl.DateTimeFormat(en?'en-GB':'ja-JP', {dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
let bridge = null, sync = null, notices = [], shownNotices = [], deleteId = '', revokeReady = false, debounce = 0, connecting = false, pendingRefresh = false;
const conditionLabels = {level:t('レベル','Level'),questPoints:t('報酬ポイント','Quest points'),className:t('職業','Class'),ascendancy:t('アセンダンシー','Ascendancy'),
  enemy:t('敵','Enemy'),configuration:t('一時効果・計算設定','Temporary effects and configuration'),tree:t('ツリーの版','Tree version'),weaponSet:t('武器セット','Weapon set'),mainSkill:t('主力スキル','Main skill')};
const enemyNames={none:t('通常の敵','Normal enemy'),boss:t('ボス','Boss'),pinnacle:t('ピナクルボス','Pinnacle boss'),uber:t('ウーバーボス','Uber boss')};
const statNames={CombinedDPS:t('選択スキルのDPS','Selected skill DPS'),Life:t('最大ライフ','Maximum life'),EnergyShield:t('エナジーシールド','Energy shield'),Mana:t('最大マナ','Maximum mana'),Armour:t('アーマー','Armour'),Evasion:t('回避力','Evasion'),SpiritUnreserved:t('未予約スピリット','Unreserved spirit'),FireResist:t('火耐性','Fire resistance'),ColdResist:t('冷気耐性','Cold resistance'),LightningResist:t('雷耐性','Lightning resistance'),ChaosResist:t('混沌耐性','Chaos resistance'),Str:t('筋力','Strength'),Dex:t('器用さ','Dexterity'),Int:t('知性','Intelligence')};
const currencyNames={exalted:t('高貴なオーブ','Exalted Orbs'),divine:t('神のオーブ','Divine Orbs'),chaos:t('カオスオーブ','Chaos Orbs')};
function recordedConditions(record){
  const preset=bridge.presets.find(p=>p.id===record.preset),config=c=>Object.fromEntries(Object.entries(c).map(([key,value])=>[
    key==='questInterlude 2Khari CrossingMolten Shrine'?t('ライフの永久報酬','Permanent life reward'):key,
    typeof value==='boolean'?(value?t('有効','Enabled'):t('無効','Disabled')):value]));
  const conditions=c=>Object.fromEntries(Object.entries(c).map(([key,value])=>[conditionLabels[key],
    key==='enemy'?enemyNames[value]||value:key==='className'?preset.className:key==='ascendancy'?preset.ascendancyName:
    key==='mainSkill'?bridge.skillName?.(value)||value:key==='configuration'?config(value):value]));
  const price=p=>p?.amount==null?t('未入力','Not entered'):`${p.amount} ${currencyNames[p.currency]||p.currency}`;
  return {A:conditions(record.conditions.a),B:conditions(record.conditions.b),[t('購入予定額A','Planned cost A')]:price(record.source.prices.entries.find(p=>p.id==='a')),
    [t('購入予定額B','Planned cost B')]:price(record.source.prices.entries.find(p=>p.id==='b')),[t('予算','Budget')]:price(record.source.prices.budget)};
}
function errorText(cause) {
  if (cause.message === 'SYNC_LEGACY_PAUSED') return t('以前の保管庫は停止中です。11月17日9時以降に再試行できます。端末内の保存は残っています。', 'The previous vault is unavailable. Retry after 00:00 UTC on November 17. Local saves are intact.');
  if (cause.message === 'SYNC_LEGACY_EMPTY') return t('この端末に移せる保存構成がありません。「以前の保管庫から読み込む」で復旧するか、保存構成のある端末から同期してください。', 'There are no local builds to transfer. Restore the previous vault, or sync from a device that has your saves.');
  if (cause.status === 402) return t('同期サービスが一時停止しています。自動再試行を停止しました。端末内の保存は利用できます。', 'The sync service is temporarily unavailable. Automatic retries are paused. Local saves remain available.');
  if (cause.status === 403) return t('接続コードが違うか、保管庫が無効化されています。端末内の保存は残っています。','The code is incorrect or the vault was revoked. Local saves remain available.');
  if (cause.status === 429) return t('同期サービスの利用上限に達しました。自動再試行を停止しました。端末内の保存は利用できます。','The sync service reached its usage limit. Automatic retries are paused. Local saves remain available.');
  if (cause.status === 409) return t('別の端末でも更新されました。最新の内容を読み直して同期します。','Another device updated the vault. Sync will reconcile with the latest revision.');
  if (cause.message === 'SYNC_CAPACITY') return t('同期容量の2MiBを超えています。構成や記録をファイルに書き出して整理してください。端末内の保存は残っています。','The vault exceeds its 2 MiB limit. Export and organize saved builds or records. Local data is intact.');
  if (/12|JOURNAL_CAPACITY|JOURNAL_FORMAT/.test(cause.message)) return t('同期先の保存枠が足りないか、記録を読み込めません。構成は各ビルド12件、比較記録は40件までです。元の保存は保持しています。','A save limit was exceeded or a record could not be read. The limits are 12 saves per build and 40 comparison records. Existing data is intact.');
  return t('読み込み・保存ができませんでした。端末内の保存を残しています。通信状態と保存容量を確認して再試行してください。','The operation failed. Local data is intact. Check connectivity and storage, then retry.');
}
function syncStatus(info) {
  if (!sync?.keys && !['revoked','disconnected'].includes(info.state)) return;
  if(info.state==='synced'&&pendingRefresh)pendingRefresh=bridge.refresh()===false;
  let text = '';
  if (info.state === 'syncing') text = t('同期しています…','Syncing…');
  else if (info.state === 'synced') text = t(`${info.count}件を同期済み · ${time(info.at)}`,`${info.count} records synced · ${time(info.at)}`)
    + (info.conflicts ? t(`。競合した${info.conflicts}件は別名コピーで保持しました。`,` · ${info.conflicts} conflicting edits were kept as separate copies.`) : '');
  else if (info.state === 'changed') { text = t('同期中にこの端末の保存が変わりました。編集内容を保持して再同期します。','Local saves changed during sync. They were kept and will sync again.'); scheduleSync(); }
  else if (info.state === 'revoked') text = t('現在の保管庫を無効化しました。端末内の保存と以前のサーバーの保管庫は残っています。','The current vault was revoked. Local saves and the previous server’s vault remain separate.');
  else if (info.state === 'disconnected') text = t('この端末の接続を解除しました。端末内の保存は利用できます。','This device was disconnected. Local saves remain available.');
  else if (info.state === 'error') { text = errorText(info.cause); if (info.cause.status === 409) scheduleSync(4000); }
  if(pendingRefresh)text+=t(' 予定額を編集中のため、一覧の切替を保留しています。',' List refresh is deferred while you edit prices.');
  $('sim-sync-status').textContent = text;
  renderConnection();
}
function renderConnection() {
  const connected = !!sync?.keys;
  $('sim-sync-setup').hidden = connected;
  $('sim-sync-connected').hidden = !connected;
  $('sim-sync-recovery').value = sync?.code || '';
}
function scheduleSync(delay = 1800) {
  clearTimeout(debounce);
  if (!sync?.keys || sync.paused || document.hidden || !navigator.onLine) return;
  debounce = setTimeout(() => {void sync.sync().catch(() => {});}, delay);
}
function loadSeen() {
  const raw = localStorage.getItem(SEEN_KEY);
  if (!raw) return {};
  if (raw.length > 100000) throw Error('SEEN_FORMAT');
  const value = JSON.parse(raw);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function renderUpdates() {
  if (!bridge) return;
  try {
    const records = savedBuildHeaders(localStorage, bridge.presets), seen = loadSeen();
    const runtime = bridge.read().runtime;
    const mismatches = records.filter(r => r.kind === 'plan' && (r.value.saved.engine !== runtime.release || r.value.saved.calculation && r.value.saved.calculation.dataVersion !== runtime.dataVersion));
    const extra = mismatches.length ? [{id:`calculation-${runtime.release}-${runtime.dataVersion}`,revision:1,date:new Date().toISOString().slice(0,10),
      presets:[...new Set(mismatches.map(r=>r.preset))],title:{ja:'保存後に計算データが更新されています',en:'Calculation data changed after these builds were saved'},
      body:{ja:`${mismatches.length}件の構成は以前の計算データで保存されています。開き直して再計算し、比較記録の版も確認してください。`,en:`${mismatches.length} saved builds use earlier calculation data. Reopen and recalculate them, and check the versions in your comparison records.`},href:(en?'/en':'')+'/simulator/#sim-workspace'}] : [];
    const revised=bridge.presets.filter(p=>records.some(r=>r.preset===p.id&&r.value.saved.calculation?.guideRevision&&r.value.saved.calculation.guideRevision!==p.contentRevision))
      .map(p=>({id:`guide-${p.id}-${p.contentRevision}`,revision:1,date:new Date().toISOString().slice(0,10),presets:[p.id],
        title:{ja:p.name+'の育成ガイドが更新されています',en:p.name+' guide has been updated'},
        body:{ja:'保存後にスキル・装備・育成方針の案内が変わっています。記事を確認してから、手元の構成へ必要な変更を反映してください。',en:'Skill, equipment or progression guidance has changed since this build was saved. Review the guide before adapting your saved configuration.'},href:p.path}));
    shownNotices = relevantNotices([...notices, ...extra, ...revised], records, seen);
    window.Poe2SimulatorNotices = shownNotices;
    const unread = shownNotices.filter(n=>n.unread).length;
    $('sim-update-count').textContent = unread ? t(`${unread}件の新着`,`${unread} unread`) : '';
    $('sim-updates-seen').disabled = !unread;
    $('sim-update-list').innerHTML = shownNotices.length ? shownNotices.map(notice=>`<article data-update-id="${escape(notice.id)}"><time datetime="${escape(notice.date)}">${escape(notice.date)} · ${notice.unread?t('未読','Unread'):t('既読','Read')}</time><h4>${escape(notice.title[en?'en':'ja'])}</h4><p>${escape(notice.body[en?'en':'ja'])}</p><a href="${escape(notice.href)}">${t('変更内容と確認範囲を見る','Read the changes and verification scope')}${en&&!notice.href.startsWith('/en/')?' (Japanese)':''}</a></article>`).join('')
      : `<p>${records.some(r=>r.kind==='plan')?t('保存構成に関係する新しい案内はありません。','There are no relevant notices for your saved builds.'):t('構成に名前を付けて保存すると、関連する更新をここで確認できます。','Save a named build to see relevant updates here.')}</p>`;
    window.dispatchEvent(new window.CustomEvent('poe2:update-notices'));
  } catch (cause) { $('sim-update-list').textContent = errorText(cause); }
}
async function loadUpdates() {
  try {
    const response = await fetch('/data/saved-build-updates.json?v=1d87580541');
    if (!response.ok) throw Error('NOTICES_FETCH');
    const data = await response.json();
    if (data.version !== 1 || !Array.isArray(data.notices)) throw Error('NOTICES_FORMAT');
    notices = data.notices; $('sim-updates-retry').hidden = true; renderUpdates();
  } catch {
    $('sim-update-list').textContent = t('更新案内を取得できませんでした。保存機能は利用できます。','Notices could not be loaded. Saved builds remain available.');
    $('sim-updates-retry').hidden = false;
  }
}
function journal() { return parseJournal(localStorage.getItem(JOURNAL_KEY), bridge.presets); }
function writeJournal(records, expected) {
  if (localStorage.getItem(JOURNAL_KEY) !== expected) throw Error('JOURNAL_CONFLICT');
  const text = JSON.stringify({version:1, records}); parseJournal(text, bridge.presets);
  localStorage.setItem(JOURNAL_KEY, text);
  renderJournal(); scheduleSync();
}
function renderJournal() {
  if (!bridge) return;
  try {
    const records = journal(); $('sim-journal-count').textContent = `${records.length}/${JOURNAL_LIMIT}`;
    $('sim-journal-list').innerHTML = records.length ? records.map(record=>{
      const differences = record.conditions.differences.map(k=>conditionLabels[k]).join(t('、',', '));
      const rows = record.snapshot.rows;
      return `<details class="sim-journal-record"><summary>${escape(record.name)} · ${escape(time(record.createdAt))}</summary><p><b>${differences?t('参考比較・条件違い','Reference comparison — conditions differ'):t('比較条件が一致','Comparison conditions match')}</b>${differences?'：'+escape(differences):''}</p><p>${t('参考計算・実測値ではありません。','Calculated reference values; these are not gameplay measurements.')} ${t('エンジン','Engine')} ${escape(record.engine)} / ${t('データ','Data')} ${escape(record.dataVersion)}</p><p>A: Lv${record.conditions.a.level} / B: Lv${record.conditions.b.level} · ${t('敵','Enemy')}: ${escape(enemyNames[record.source.enemy]||record.source.enemy)}</p>${record.snapshot.warning?`<p>${t('未対応効果・装備エラーの報告を含む比較です。','This comparison includes unsupported effects or equipment errors.')}</p>`:''}<div class="sim-library-table" tabindex="0" role="region" aria-label="${t('記録した比較数値','Recorded comparison values')}"><table><caption>${t('保存時点の計算結果','Calculation results at the time of saving')}</caption><thead><tr><th>${t('項目','Stat')}</th><th>A</th><th>B</th><th>B − A</th></tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${escape(statNames[row.id]||row.title)}</th><td>${escape(row.a)}</td><td>${escape(row.b)}</td><td>${escape(row.delta)}</td></tr>`).join('')}</tbody></table></div><details><summary>${t('記録した条件・予算をすべて見る','View all recorded conditions and budgets')}</summary><pre>${escape(JSON.stringify(recordedConditions(record),null,2))}</pre></details><button type="button" data-journal-open="${record.id}">${t('構成を開いて再計算','Reopen and recalculate')}</button><button type="button" data-journal-export="${record.id}">${t('記録を書き出す','Export record')}</button><button type="button" data-journal-delete="${record.id}">${t('削除を確認','Review deletion')}</button></details>`;
    }).join('') : `<p>${t('比較記録はまだありません。','No comparison records yet.')}</p>`;
    $('sim-journal-save').disabled = !bridge.read().comparison;
  } catch (cause) { $('sim-journal-list').textContent = errorText(cause); $('sim-journal-save').disabled = true; }
}
function download(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value,null,2)], {type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function initialize() {
  if (bridge || !window.Poe2SimulatorLibrary || !$('sim-library')) return;
  bridge = window.Poe2SimulatorLibrary;
  sync = new EncryptedBuildSync({storage:localStorage, presets:bridge.presets, transport:new IframeTransport(),
    conflictSuffix:t('（競合コピー）',' (conflict copy)'), onStatus:syncStatus,
    onApplied:() => {pendingRefresh=bridge.refresh()===false; renderJournal(); renderUpdates();}});
  renderJournal(); void loadUpdates();
  try {if (await sync.restore()) {renderConnection(); scheduleSync(100);}} catch(cause) {$('sim-sync-status').textContent=errorText(cause);}
}
window.addEventListener('poe2:library-ready', () => void initialize());
window.addEventListener('poe2:workspace', () => {renderJournal(); renderUpdates();});
window.addEventListener('poe2:comparison', () => {if(bridge)$('sim-journal-save').disabled=!bridge.read().comparison;});
window.addEventListener('poe2:saved-builds', () => {renderUpdates(); scheduleSync();});
window.addEventListener('storage', event => {
  if (event.key === SYNC_CREDENTIAL_KEY && sync) {
    // A different tab disconnected or paired another vault. Do not keep sending with an old key.
    ++sync.epoch; sync.keys = null; sync.code = ''; sync.cache = null; sync.pending = null;
    void sync.restore().then(()=>{renderConnection();scheduleSync();}).catch(cause=>{$('sim-sync-status').textContent=errorText(cause);});
  } else if (event.key?.startsWith('poe2-simulator:')) {renderJournal();renderUpdates();scheduleSync();}
});
document.addEventListener('visibilitychange', () => {if(!document.hidden)scheduleSync(300);});
window.addEventListener('online',()=>scheduleSync(100));
window.addEventListener('focus',()=>scheduleSync(300));
window.addEventListener('offline',()=>{if(sync?.keys)$('sim-sync-status').textContent=t('オフラインです。端末内の保存を使い、再接続したときに同期します。','Offline. Use local saves; syncing resumes after reconnection.');});
setInterval(()=>scheduleSync(100),60000);
document.addEventListener('change',event=>{if(event.target.id==='sim-library-align'){$('sim-journal-save').disabled=true;}});
document.addEventListener('click', async event => {
  const button = event.target.closest('button'); if(!button||!bridge)return;
  const id = button.id;
  const recognized = id.startsWith('sim-sync-') || id.startsWith('sim-journal-') || id.startsWith('sim-updates-')
    || button.dataset.journalOpen || button.dataset.journalExport || button.dataset.journalDelete;
  if(!recognized)return;
  let statusBox = id.startsWith('sim-sync-') ? $('sim-sync-status') : $('sim-journal-status');
  button.disabled = true;
  try {
    if(id==='sim-updates-retry'){await loadUpdates();return;}
    if(id==='sim-updates-seen'){
      const seen=loadSeen(); for(const notice of shownNotices)seen[notice.id]=notice.revision;
      localStorage.setItem(SEEN_KEY,JSON.stringify(seen));window.dispatchEvent(new window.CustomEvent('poe2:updates-seen'));renderUpdates();return;
    }
    if(id==='sim-journal-save'){
      statusBox=$('sim-journal-save-status');
      const state=bridge.read(),expected=localStorage.getItem(JOURNAL_KEY),records=journal();
      if(!state.comparison)throw Error('JOURNAL_STALE');
      if(records.length>=JOURNAL_LIMIT)throw Error('JOURNAL_CAPACITY');
      const name=$('sim-journal-name').value.trim()||t('構成の比較','Build comparison');
      const record=makeJournalRecord(state.comparison.source,state.comparison.snapshot,name,state.runtime,bridge.presets);
      writeJournal([record,...records],expected);
      statusBox.textContent=t('比較の条件と数値を記録しました。下の「比較記録」から開けます。','Conditions and values recorded. Open the comparison journal below.');return;
    }
    if(button.dataset.journalOpen){const record=journal().find(r=>r.id===button.dataset.journalOpen);if(record)await bridge.open(record.source);return;}
    if(button.dataset.journalExport){const record=journal().find(r=>r.id===button.dataset.journalExport);if(record)download({format:'poe2-comparison-record',version:1,record},'poe2-comparison-record.json');return;}
    if(button.dataset.journalDelete){deleteId=button.dataset.journalDelete;const record=journal().find(r=>r.id===deleteId);$('sim-journal-delete-name').textContent=t('削除する記録：','Delete record: ')+(record?.name||'');$('sim-journal-delete-panel').hidden=false;return;}
    if(id==='sim-journal-delete-cancel'){deleteId='';$('sim-journal-delete-panel').hidden=true;return;}
    if(id==='sim-journal-delete-confirm'){
      const expected=localStorage.getItem(JOURNAL_KEY);writeJournal(journal().filter(r=>r.id!==deleteId),expected);
      deleteId='';$('sim-journal-delete-panel').hidden=true;statusBox.textContent=t('比較記録を削除しました。','Comparison record deleted.');return;
    }
    if(id==='sim-sync-create'||id==='sim-sync-join'){
      if(connecting)return;connecting=true;
      try{await sync.connect(id==='sim-sync-create'?newSyncCode():$('sim-sync-code').value.trim(),id==='sim-sync-create');$('sim-sync-code').value='';}
      finally{connecting=false;renderConnection();}return;
    }
    if(id==='sim-sync-now'){await sync.sync({manual:true});return;}
    if(id==='sim-sync-import-legacy'){try{await sync.importLegacy(sync.keys?sync.code:$('sim-sync-code').value.trim());}finally{renderConnection();}return;}
    if(id==='sim-sync-copy'){
      try{await navigator.clipboard.writeText(sync.code);statusBox.textContent=t('接続コードをコピーしました。人に渡さず、別の端末に入力してください。','Connection code copied. Keep it private and enter it on your other device.');}
      catch{$('sim-sync-recovery').focus();$('sim-sync-recovery').select();statusBox.textContent=t('接続コードを選択しました。コピーしてください。','Connection code selected. Copy it to your other device.');}return;
    }
    if(id==='sim-sync-disconnect'){sync.disconnect();renderConnection();return;}
    if(id==='sim-sync-revoke'){
      if(!revokeReady){revokeReady=true;button.textContent=t('もう一度押して無効化する','Press again to revoke');return;}
      await sync.revoke();revokeReady=false;button.textContent=t('保管庫を無効化','Revoke this vault');renderConnection();return;
    }
  }catch(cause){statusBox.textContent=errorText(cause);}
  finally{button.disabled=false;}
});
void initialize();
