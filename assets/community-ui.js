import {publicPost, publicSnapshot, PUBLIC_PURPOSES, PUBLIC_CURRENCIES} from './community-model.js?v=ea87b2cb4c';
import {encodePlanLink} from './simulator-model.js?v=161ef63cbd';
const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export const OWNER_KEY = 'poe2-community-owner:v1';
const CODE_HISTORY_KEY = 'poe2-community-codes:v1';
const REPORTER_KEY = 'poe2-community-reporter:v1';
const validCode = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
function randomCode() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
function storedCode(key) {
  const original = localStorage.getItem(key);
  if (original) {
    if (!validCode(original)) throw Error('PUBLIC_LOCAL_CODE');
    return original;
  }
  const code = randomCode();
  localStorage.setItem(key, code);
  if (localStorage.getItem(key) !== code) throw Error('PUBLIC_LOCAL_CODE');
  return code;
}
export function communityMarkup(en = false) {
  const t = (ja, english) => en ? english : ja;
  const option = (value, label) => '<option value="' + value + '">' + label + '</option>';
  return [
    '<section class="community-search" aria-labelledby="community-search-title"><h2 id="community-search-title">' + t('投稿を探す', 'Find a build') + '</h2>',
    '<form id="community-search-form"><div class="community-filters">',
    '<label>' + t('スキル', 'Skill') + '<select id="community-skill"><option value="">' + t('すべてのスキル', 'All skills') + '</option></select></label>',
    '<label>' + t('用途', 'Purpose') + '<select id="community-purpose">' + option('', t('すべての用途', 'All purposes')) +
      option('leveling', t('育成', 'Leveling')) + option('mapping', t('マップ周回', 'Mapping')) + option('boss', t('ボス', 'Bossing')) + option('all', t('汎用', 'General')) + '</select></label>',
    '<label>' + t('予算の上限（任意）', 'Maximum budget (optional)') + '<input id="community-budget-max" type="number" min="0" max="1000000" step="any" inputmode="decimal"></label>',
    '<label>' + t('通貨', 'Currency') + '<select id="community-budget-currency">' + option('divine', t('神のオーブ', 'Divine Orbs')) +
      option('exalted', t('高貴なオーブ', 'Exalted Orbs')) + option('chaos', t('カオスオーブ', 'Chaos Orbs')) + '</select></label>',
    '<label class="community-search-name">' + t('ビルド名・投稿者名', 'Build or author name') + '<input id="community-query" maxlength="80" type="search"></label></div>',
    '<button type="submit">' + t('この条件で探す', 'Search') + '</button><button id="community-reset" type="button">' + t('条件をリセット', 'Reset filters') + '</button></form>',
    '<p class="community-help">' + t('予算は投稿者の入力額です。同じ通貨の投稿で比較します。価格未入力の投稿は上限指定時に表示しません。', 'Budgets are entered by authors. Filtering compares the same currency and excludes unknown budgets when a maximum is set.') + '</p>',
    '<p id="community-list-status" role="status" aria-live="polite"></p><div id="community-list" class="community-grid"></div>',
    '<button id="community-more" type="button" hidden>' + t('さらに投稿を探す', 'Search more posts') + '</button></section>',
    '<section id="community-detail" class="community-detail" hidden aria-label="' + t('投稿の詳細', 'Build details') + '"></section>',
    '<details id="community-compose" class="community-compose"><summary>' + t('構成を投稿する', 'Publish a build') + '</summary>',
    '<p>' + t('公開する内容を確認してから投稿できます。投稿後に元の構成を編集しても、投稿内容は固定して残ります。', 'Review the public contents before publishing. Editing the original save later does not change the published snapshot.') + '</p>',
    '<form id="community-compose-form" novalidate><fieldset id="community-compose-fields"><legend>' + t('投稿内容', 'Post details') + '</legend>',
    '<label>' + t('公開する構成', 'Configuration to publish') + '<select id="community-source"></select></label>',
    '<label>' + t('保存ファイルを読み込む（任意）', 'Import a save file (optional)') + '<input id="community-import" type="file" accept=".json,application/json"></label>',
    '<p class="community-help">' + t('見本は下書きに読み込むだけです。この操作では投稿されません。個人メモや編集中の装備入力は送信しません。', 'Reference builds only populate a draft. They are not published by selecting them. Private notes and equipment-editor drafts are not sent.') + '</p>',
    '<div class="community-filters"><label>' + t('ビルド名', 'Build title') + '<input id="community-title" maxlength="60" required></label>',
    '<label>' + t('投稿者名（任意）', 'Author name (optional)') + '<input id="community-nickname" maxlength="30" autocomplete="off"></label>',
    '<label>' + t('用途', 'Purpose') + '<select id="community-post-purpose">' + option('mapping', t('マップ周回', 'Mapping')) +
      option('boss', t('ボス', 'Bossing')) + option('leveling', t('育成', 'Leveling')) + option('all', t('汎用', 'General')) + '</select></label>',
    '<label>' + t('予算（任意）', 'Budget (optional)') + '<input id="community-post-budget" type="number" min="0" max="1000000" step="any" inputmode="decimal"></label>',
    '<label>' + t('通貨', 'Currency') + '<select id="community-post-currency">' + option('divine', t('神のオーブ', 'Divine Orbs')) +
      option('exalted', t('高貴なオーブ', 'Exalted Orbs')) + option('chaos', t('カオスオーブ', 'Chaos Orbs')) + '</select></label></div>',
    '<label>' + t('使い方・説明（公開されます）', 'Play notes and description (public)') + '<textarea id="community-description" maxlength="1200" rows="4"></textarea></label>',
    '<button id="community-review" type="button">' + t('公開する内容を確認', 'Review public contents') + '</button>',
    '<div id="community-preview" hidden></div><label class="community-check"><input id="community-consent" type="checkbox">' +
      t('表示した構成・説明・投稿者名を一般公開する', 'Make the displayed build, description and author name public') + '</label>',
    '<button id="community-publish" type="submit">' + t('確認した内容を公開する', 'Publish reviewed build') + '</button></fieldset></form>',
    '<p id="community-post-status" role="status" aria-live="polite"></p></details>',
    '<details id="community-manage" class="community-manage"><summary>' + t('自分の投稿・管理コード', 'My posts and management code') + '</summary>',
    '<p>' + t('同じ管理コードで公開できる構成は10件までです。コードを持つ人は投稿を取り下げられるため、共有URLやXに入れず、本人が控えてください。', 'A management code can hold up to 10 public builds. Anyone with the code can withdraw them, so keep it private and out of shared links and X posts.') + '</p>',
    '<button id="community-mine-refresh" type="button">' + t('自分の投稿を確認', 'Load my posts') + '</button>',
    '<button id="community-show-code" type="button">' + t('管理コードを表示', 'Show management code') + '</button>',
    '<div id="community-code-box" hidden><label>' + t('管理コード', 'Management code') + '<input id="community-code" readonly type="text" autocomplete="off"></label>',
    '<button id="community-copy-code" type="button">' + t('管理コードをコピー', 'Copy management code') + '</button></div>',
    '<details><summary>' + t('別の端末の管理コードを使う', 'Use a code from another device') + '</summary>',
    '<label>' + t('控えてある管理コード', 'Saved management code') + '<input id="community-restore-code" type="password" autocomplete="off" autocapitalize="off" spellcheck="false"></label>',
    '<button id="community-restore" type="button">' + t('このコードで自分の投稿を確認', 'Load posts with this code') + '</button></details>',
    '<div id="community-history-box" hidden><label>' + t('この端末で使った別のコード', 'Other codes used on this device') + '<select id="community-code-history"></select></label><button id="community-use-history" type="button">' + t('選んだコードに切り替える', 'Switch to selected code') + '</button></div>',
    '<p id="community-manage-status" role="status"></p><div id="community-mine"></div></details>',
  ].join('');
}
export async function mountCommunity(root, {api, catalog, getSources, publicBase, simulatorBase, en = false}) {
  const t = (ja, english) => en ? english : ja;
  const $ = id => root.querySelector('#community-' + id);
  root.innerHTML = communityMarkup(en);
  const purposeName = value => ({leveling: t('育成', 'Leveling'), mapping: t('マップ周回', 'Mapping'), boss: t('ボス', 'Bossing'), all: t('汎用', 'General')})[value] || value;
  const currencyName = value => ({divine: t('神のオーブ', 'Divine Orbs'), exalted: t('高貴なオーブ', 'Exalted Orbs'), chaos: t('カオスオーブ', 'Chaos Orbs')})[value] || value;
  const gemName = id => en ? catalog.gems[id]?.name || id : catalog.gems[id]?.nameJa || catalog.gems[id]?.name || id;
  const cost = budget => budget?.amount == null ? t('予算未入力', 'Budget unknown') : budget.amount + ' ' + currencyName(budget.currency);
  let sources = [], prepared = null, cursor = null, filters = {}, listing = 0, detailSequence = 0, currentDetail = null;
  function codeHistory() {
    const raw = JSON.parse(localStorage.getItem(CODE_HISTORY_KEY) || '[]');
    if (!Array.isArray(raw) || raw.some(code => !validCode(code))) throw Error('PUBLIC_LOCAL_CODE');
    return raw;
  }
  function updateHistory() {
    const active = localStorage.getItem(OWNER_KEY);
    const codes = codeHistory().filter(code => code !== active);
    $('history-box').hidden = codes.length === 0;
    $('code-history').innerHTML = codes.map((code, i) => '<option value="' + escape(code) + '">' + t('保存コード ', 'Saved code ') + (i + 1) + ' · …' + escape(code.slice(-6)) + '</option>').join('');
  }
  async function switchCode(code) {
    if (!validCode(code)) throw Error('PUBLIC_LOCAL_CODE');
    await api('mine', {token: code});
    const active = localStorage.getItem(OWNER_KEY);
    const codes = [...new Set([...codeHistory(), ...(validCode(active) ? [active] : []), code])];
    localStorage.setItem(CODE_HISTORY_KEY, JSON.stringify(codes));
    localStorage.setItem(OWNER_KEY, code);
    if (localStorage.getItem(OWNER_KEY) !== code) throw Error('PUBLIC_LOCAL_CODE');
    $('code-box').hidden = true; updateHistory(); await mine();
  }
  const pageUrl = id => new URL('?build=' + encodeURIComponent(id), publicBase).href;
  const localUrl = id => location.pathname + '?build=' + encodeURIComponent(id);
  const errorText = cause => {
    const code = cause.message || '';
    if (code === 'PUBLIC_LEGACY_PAUSED') return t('以前の投稿サーバーは停止中です。11月17日9時以降に再確認できます。投稿や管理コードは削除していません。', 'The previous post server is unavailable. Try again after 00:00 UTC on November 17. Posts and management codes have not been deleted.');
    if (cause.status === 402) return t('公開サービスが一時停止しています。入力と端末内の保存構成は保持しています。時間をおいて再試行してください。', 'The public service is temporarily unavailable. Your inputs and local saves are intact. Try again later.');
    if (code === 'PUBLIC_LOCAL_CODE') return t('管理コードを端末に保存できません。控えたコードで復元するか、端末の保存設定を確認してください。投稿内容は変更していません。', 'The management code could not be saved on this device. Restore a saved code or check local storage. No post was changed.');
    if (/PUBLIC_(INPUT|BUDGET|SKILL|GEM|NODE|PRESET|TREE|JEWELS|SIZE)/.test(code)) return t('構成や入力内容を確認してください。対応中のデータ版・スキルを使い、ジュエルなし・64KB以下の構成を選べます。入力と元の保存は保持しています。', 'Check the inputs and build. Use supported data and skills, no jewels, and a snapshot under 64 KB. Your inputs and original save are intact.');
    if (cause.status === 404) return t('投稿が見つかりません。取り下げられた可能性があります。', 'This post was not found. It may have been withdrawn.');
    if (cause.status === 403) return t('この管理コードでは取り下げできません。投稿した本人のコードを確認してください。', 'This code cannot withdraw the post. Use the author’s management code.');
    if (cause.status === 429) return t('投稿件数またはサービスの利用上限に達しました。自分の投稿を整理するか、時間をおいて再試行してください。', 'A post or service limit was reached. Review your posts or retry later.');
    if (cause.status === 409) return t('投稿の状態が変わりました。自分の投稿を確認してから再試行してください。', 'The post state changed. Check your posts before retrying.');
    return t('通信できませんでした。入力は保持しています。投稿結果が不明な場合は自分の投稿を確認するか、同じ内容で再試行できます。', 'The request failed. Your inputs are intact. If publishing may have succeeded, check your posts or retry the same reviewed snapshot.');
  };
  function invalidate() {
    prepared = null; $('preview').hidden = true; $('consent').checked = false;
  }
  function sourceOptions() {
    $('source').innerHTML = '<option value="">' + t('公開する構成を選択', 'Choose a build to publish') + '</option>' +
      sources.map(source => '<option value="' + escape(source.id) + '">' + escape(source.name) + '</option>').join('');
  }
  const skills = Object.entries(catalog.gems).filter(([, gem]) => !gem.support)
    .sort((a, b) => gemName(a[0]).localeCompare(gemName(b[0]), en ? 'en' : 'ja'));
  $('skill').insertAdjacentHTML('beforeend', skills.map(([id]) => '<option value="' + escape(id) + '">' + escape(gemName(id)) + '</option>').join(''));
  function card(post, own = false) {
    return '<article class="community-card" data-public-post="' + escape(post.id) + '"><div class="community-badges"><span>' +
      escape(purposeName(post.purpose)) + '</span><span>' + escape(cost(post.budget)) + '</span></div><h3>' + escape(post.title) +
      '</h3><p>' + escape(gemName(post.primarySkill)) + ' · Lv' + post.level + '</p><small>' +
      t('投稿者', 'Author') + ': ' + escape(post.nickname) + ' · ' + escape(post.dataVersion) + '</small><div class="community-actions"><a href="' +
      escape(localUrl(post.id)) + '" data-community-open="' + escape(post.id) + '">' + t('構成を見る', 'View build') + '</a>' +
      (own ? '<button type="button" data-community-withdraw="' + escape(post.id) + '">' + t('取り下げる', 'Withdraw') + '</button>' : '') + '</div></article>';
  }
  async function list(more = false) {
    const sequence = ++listing;
    $('list-status').textContent = t('投稿を読み込んでいます…', 'Loading posts…');
    try {
      const response = await api('list', {filters, ...(more && cursor ? {nextToken: cursor} : {})});
      if (sequence !== listing) return;
      cursor = response.nextToken || null;
      if (!more) $('list').replaceChildren();
      $('list').insertAdjacentHTML('beforeend', response.posts.map(post => card(post)).join(''));
      $('more').hidden = !cursor;
      $('list-status').textContent = $('list').children.length
        ? t($('list').children.length + '件を表示しています。', $('list').children.length + ' posts shown.')
        : cursor ? t('このページに一致する投稿はありません。「さらに投稿を探す」で続きも確認できます。', 'No matches on this page. Search more posts to check the next page.')
          : Object.values(filters).some(value => value !== '' && value != null)
            ? t('条件に一致する投稿はありません。条件を変えて探せます。', 'No matching posts. Try different filters.')
            : t('まだ投稿がありません。保存した構成を最初に投稿できます。', 'No posts yet. You can publish the first saved build.');
      if (response.legacyNotice) $('list-status').textContent += t(' 復旧後の投稿を表示しています。以前の投稿は旧サーバー復旧後、元の共有URL・管理コードから確認できます。', ' Showing posts made since recovery. Earlier posts remain accessible through their original share URLs and management codes when the previous server is available.');
    } catch (cause) {
      if (sequence === listing) $('list-status').textContent = errorText(cause);
    }
  }
  async function mine() {
    try {
      const response = await api('mine', {token: storedCode(OWNER_KEY)});
      $('mine').innerHTML = response.posts.map(post => card(post, true)).join('');
      $('manage-status').textContent = response.posts.length ? t(response.posts.length + '件の投稿を管理できます。', 'Manage ' + response.posts.length + ' posts.')
        : t('この管理コードの投稿はありません。', 'No posts for this management code.');
      if (response.partial) $('manage-status').textContent = t('現在確認できる投稿は', 'Currently available posts: ') + response.posts.length + t('件です。以前の投稿サーバーに接続できないため、過去の投稿は未確認です。管理コードは残しています。', '. The previous server is unavailable, so earlier posts could not be checked. Your management code is intact.');
    } catch (cause) { $('manage-status').textContent = errorText(cause); }
  }
  async function detail(id, updateAddress = true) {
    if (!/^[a-z0-9-]{20,50}$/.test(id)) return;
    const sequence = ++detailSequence;
    $('detail').hidden = false; $('detail').textContent = t('構成を読み込んでいます…', 'Loading build…');
    if (updateAddress) history.replaceState({}, '', localUrl(id));
    try {
      const post = await api('read', {id});
      if (sequence !== detailSequence) return;
      const clean = publicPost(post, catalog);
      currentDetail = {...clean, id, createdAt: post.createdAt};
      const summary = clean.snapshot.request;
      let link = null;
      try {
        link = new URL(simulatorBase); link.searchParams.set('build', clean.snapshot.preset);
        link.hash = 'plan=' + await encodePlanLink(clean.snapshot);
      } catch { link = null; }
      if (sequence !== detailSequence) return;
      const share = new URL('https://twitter.com/intent/tweet');
      share.searchParams.set('text', clean.title + ' | POE2ビルドナビ'); share.searchParams.set('url', pageUrl(id));
      $('detail').innerHTML = '<h2>' + escape(clean.title) + '</h2><p>' + escape(gemName(clean.primarySkill)) + ' · Lv' + summary.character.level +
        ' · ' + escape(purposeName(clean.purpose)) + ' · ' + escape(cost(clean.budget)) + '</p><small>' + t('投稿者', 'Author') + ': ' +
        escape(clean.nickname) + ' · ' + escape(clean.dataVersion) + '</small><p class="community-description">' + escape(clean.description) + '</p>' +
        '<p class="community-help">' + t('利用者が公開した入力例です。実プレイ・計算結果はサイト側で検証していません。シミュレーターで条件を確認できます。', 'This is a community-submitted input snapshot. Gameplay and calculated results have not been verified by the site. Review the conditions in the simulator.') + '</p>' +
        (link ? '<div class="community-actions"><a class="community-primary" href="' + escape(link.href) + '">' + t('シミュレーターで確認する', 'Inspect in simulator') + '</a>' : '<p class="community-help">' + t('この構成は共有リンクの上限を超えています。公開構成を保存して、シミュレーターでファイルを読み込めます。', 'This snapshot exceeds the simulator link limit. Download it and import the file in the simulator.') + '</p><div class="community-actions">') +
        '<button id="community-download" type="button">' + t('公開構成をファイルに保存', 'Download public snapshot') + '</button><a href="' + escape(share.href) + '" target="_blank" rel="noopener">' + t('Xで共有', 'Share on X') +
        '</a><button type="button" id="community-copy-link">' + t('投稿URLをコピー', 'Copy post URL') + '</button></div>' +
        '<details><summary>' + t('公開した装備・ジェム・パッシブ・計算条件', 'Published equipment, gems, passives and conditions') +
        '</summary><pre>' + escape(JSON.stringify(clean.snapshot.request, null, 2)) + '</pre></details>' +
        '<details><summary>' + t('この投稿を通報する', 'Report this post') + '</summary><label>' + t('理由', 'Reason') +
        '<select id="community-report-reason"><option value="misleading">' + t('内容の誤り', 'Misleading content') +
        '</option><option value="abuse">' + t('迷惑・不適切な内容', 'Abusive content') + '</option><option value="privacy">' +
        t('個人情報', 'Private information') + '</option><option value="other">' + t('その他', 'Other') +
        '</option></select></label><label>' + t('補足（任意・300文字まで）', 'Details (optional, 300 characters)') +
        '<textarea id="community-report-note" maxlength="300" rows="2"></textarea></label><button id="community-report" type="button">' +
        t('通報を送る', 'Send report') + '</button><p id="community-report-status" role="status"></p></details>';
      $('detail').scrollIntoView({block: 'start', behavior: 'instant'});
    } catch (cause) {
      if (sequence === detailSequence) $('detail').textContent = errorText(cause);
    }
  }
  function review() {
    const source = sources.find(source => source.id === $('source').value);
    if (!source || !$('title').value.trim()) throw Error('PUBLIC_INPUT');
    const amount = $('post-budget').value.trim() === '' ? null : Number($('post-budget').value);
    const post = publicPost({
      version: 1, title: $('title').value, nickname: $('nickname').value, description: $('description').value,
      purpose: $('post-purpose').value, budget: {amount, currency: $('post-currency').value}, snapshot: source.saved,
    }, catalog);
    prepared = {id: crypto.randomUUID(), post};
    $('consent').checked = false;
    $('preview').hidden = false;
    $('preview').innerHTML = '<h3>' + t('この内容を公開します', 'Public preview') + '</h3><p><b>' + escape(post.title) + '</b><br>' +
      escape(gemName(post.primarySkill)) + ' · Lv' + post.snapshot.request.character.level + ' · ' + escape(cost(post.budget)) + '</p>' +
      '<p>' + t('公開対象：ビルド名・投稿者名・説明・予算・用途と、反映済みの装備・ジェム・パッシブ・レベル・敵・計算条件。', 'Public fields: title, author, description, budget, purpose, and applied equipment, gems, passives, level, enemy and calculation settings.') +
      '</p><details><summary>' + t('送信する内容をすべて確認', 'Inspect the complete public payload') + '</summary><pre>' +
      escape(JSON.stringify(post, null, 2)) + '</pre></details>';
    $('post-status').textContent = t('内容を確認して、一般公開のチェックを入れると投稿できます。', 'Review the contents and check the public-sharing box before publishing.');
  }
  root.addEventListener('input', event => { if (event.target.closest('#community-compose-form') && event.target.id !== 'community-consent') invalidate(); });
  root.addEventListener('change', async event => {
    if (event.target.id === 'community-source') invalidate();
    if (event.target.id === 'community-import') {
      try {
        const file = event.target.files[0];
        if (!file) return;
        if (file.size > 200000) throw Error('PUBLIC_SIZE');
        const saved = publicSnapshot(JSON.parse(await file.text()), catalog);
        sources = [...sources.filter(source => source.id !== 'imported'), {id: 'imported', name: t('読み込んだ保存ファイル', 'Imported save'), saved}];
        sourceOptions(); $('source').value = 'imported'; invalidate();
        $('post-status').textContent = t('保存ファイルを下書きに読み込みました。まだ公開されていません。', 'Save imported into the draft. It has not been published.');
      } catch (cause) { $('post-status').textContent = errorText(cause); }
    }
  });
  root.addEventListener('submit', async event => {
    if (event.target.id === 'community-search-form') {
      event.preventDefault();
      const maximum = $('budget-max').value.trim() === '' ? null : Number($('budget-max').value);
      if (maximum != null && (!Number.isFinite(maximum) || maximum < 0)) {
        $('list-status').textContent = t('予算の上限を0以上で入力してください。', 'Enter a nonnegative maximum budget.'); return;
      }
      filters = {skill: $('skill').value, purpose: $('purpose').value, maximum, currency: $('budget-currency').value, query: $('query').value};
      await list();
    }
    if (event.target.id === 'community-compose-form') {
      event.preventDefault();
      if (!prepared || !$('consent').checked) {
        $('post-status').textContent = t('公開する内容を確認して、一般公開のチェックを入れてください。', 'Review the public contents and check the public-sharing box.'); return;
      }
      $('compose-fields').disabled = true;
      const pending = prepared;
      try {
        const result = await api('publish', {id: pending.id, token: storedCode(OWNER_KEY), consent: true, post: pending.post});
        $('post-status').textContent = t('公開しました。管理コードを控えると別の端末でも取り下げできます。', 'Published. Save the management code to withdraw the post from another device.');
        invalidate(); await list(); await detail(result.id); await mine();
      } catch (cause) { $('post-status').textContent = errorText(cause); }
      finally { $('compose-fields').disabled = false; }
    }
  });
  root.addEventListener('click', async event => {
    const open = event.target.closest('[data-community-open]');
    if (open) { event.preventDefault(); await detail(open.dataset.communityOpen); return; }
    const button = event.target.closest('button');
    if (!button) return;
    const id = button.id;
    try {
      if (id === 'community-review') review();
      if (id === 'community-more') await list(true);
      if (id === 'community-reset') { $('search-form').reset(); filters = {}; await list(); }
      if (id === 'community-mine-refresh') await mine();
      if (id === 'community-show-code') { $('code').value = storedCode(OWNER_KEY); $('code-box').hidden = !$('code-box').hidden; }
      if (id === 'community-copy-code') {
        try { await navigator.clipboard.writeText(storedCode(OWNER_KEY)); $('manage-status').textContent = t('管理コードをコピーしました。本人だけが使う場所に控えてください。', 'Management code copied. Keep it private.'); }
        catch { $('code').focus(); $('code').select(); }
      }
      if (id === 'community-restore') {
        const code = $('restore-code').value.trim();
        await switchCode(code); $('restore-code').value = '';
      }
      if (id === 'community-use-history') await switchCode($('code-history').value);
      if (button.dataset.communityWithdraw) {
        const postId = button.dataset.communityWithdraw;
        if (button.dataset.confirm !== 'true') {
          button.dataset.confirm = 'true'; button.textContent = t('もう一度押して取り下げる', 'Press again to withdraw'); return;
        }
        button.disabled = true;
        try {
          await api('withdraw', {id: postId, token: storedCode(OWNER_KEY)});
          if (currentDetail?.id === postId) { $('detail').hidden = true; currentDetail = null; }
          await mine(); await list();
          $('manage-status').textContent = t('取り下げました。元の保存構成はそのままです。', 'Withdrawn. Your original saved build is intact.');
        } finally { button.disabled = false; }
      }
      if (id === 'community-copy-link' && currentDetail) {
        try { await navigator.clipboard.writeText(pageUrl(currentDetail.id)); button.textContent = t('コピーしました', 'Copied'); }
        catch {
          const field = document.createElement('input'); field.readOnly = true; field.value = pageUrl(currentDetail.id); $('detail').append(field); field.focus(); field.select();
        }
      }
      if (id === 'community-download' && currentDetail) {
        const url = URL.createObjectURL(new Blob([JSON.stringify(currentDetail.snapshot, null, 2)], {type: 'application/json'}));
        const link = document.createElement('a'); link.href = url; link.download = 'poe2-public-build.json'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      if (id === 'community-report' && currentDetail) {
        button.disabled = true;
        try {
          await api('report', {id: currentDetail.id, reporter: storedCode(REPORTER_KEY), reason: $('report-reason').value, note: $('report-note').value});
          $('report-status').textContent = t('通報を受け付けました。内容を確認するために保管します。', 'Report received and saved for review.');
        } catch (cause) { $('report-status').textContent = errorText(cause); }
        finally { button.disabled = false; }
      }
    } catch (cause) {
      (button.closest('#community-manage') ? $('manage-status') : $('post-status')).textContent = errorText(cause);
    }
  });
  try { sources = await getSources(); sourceOptions(); }
  catch { $('post-status').textContent = t('端末の構成一覧を読み込めませんでした。保存ファイルを選ぶと読み込めます。', 'Local saves could not be read. You can import a save file.'); }
  if (new URLSearchParams(location.search).get('compose') === '1') $('compose').open = true;
  try { updateHistory(); } catch { /* Management reports corrupt storage when used. */ }
  const id = new URLSearchParams(location.search).get('build');
  await list(); if (id) await detail(id, false);
  return {reloadSources: async () => {sources = await getSources(); sourceOptions(); invalidate();}};
}
