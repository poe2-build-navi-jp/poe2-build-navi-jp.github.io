import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root = new URL('../', import.meta.url);
const read = async path => readFile(new URL(path, root), 'utf8');
const index = JSON.parse(await read('data/simulator-index.json'));
const presets = JSON.parse(await read('data/simulator-presets.json'));
const names = JSON.parse(await read('data/simulator-names.json'));
const catalog = {
  version: 1, treeVersion: index.treeVersion, dataVersion: index.dataVersion,
  classes: index.classes, nodes: Object.keys(index.nodes).map(Number),
  presets: presets.map(preset => ({id: preset.id, class: preset.class, name: preset.name})),
  gems: Object.fromEntries(Object.entries(index.gems).map(([id, gem]) => [id, {
    name: gem.name, nameJa: names[gem.name] || gem.name, support: gem.support,
  }])),
  configKeys: ['questInterlude 2Khari CrossingMolten Shrine'],
};
await writeFile(new URL('data/community-catalog.json', root), JSON.stringify(catalog) + '\n');
for (const name of ['community-model.js', 'community-ui.js', 'community-transport.js', 'community-page.js', 'simulator-community.js']) {
  let source = await read('assets/' + name);
  for (const match of [...source.matchAll(/from '(\.\/(?:community|simulator)-[a-z-]+\.js)(?:\?v=[a-f0-9]+)?'/g)]) {
    const hash = createHash('sha256').update(await read('assets/' + match[1].slice(2))).digest('hex').slice(0, 10);
    source = source.replace(match[0], "from '" + match[1] + '?v=' + hash + "'");
  }
  for (const path of ['data/community-catalog.json']) {
    const hash = createHash('sha256').update(await read(path)).digest('hex').slice(0, 10);
    source = source.replace(new RegExp('/' + path.replaceAll('.', '\\.') + '(?:\\?v=[a-f0-9]+)?', 'g'), '/' + path + '?v=' + hash);
  }
  await writeFile(new URL('assets/' + name, root), source);
}
const base = 'https://poe2-build-navi-jp.github.io';
for (const en of [false, true]) {
  const t = (ja, english) => en ? english : ja;
  const prefix = en ? '/en' : '';
  const title = t('PoE2 みんなのビルド｜構成の投稿・検索・共有', 'PoE2 community builds | Publish and explore configurations');
  const description = t('装備・ジェム・パッシブをまとめたPoE2の構成を投稿。スキル・予算・用途で探し、シミュレーターで確認して共有できます。', 'Publish a Path of Exile 2 configuration with equipment, gems and passives. Find builds by skill, budget and purpose, then inspect them in the simulator.');
  const directory = new URL((en ? 'en/' : '') + 'community/', root);
  await mkdir(directory, {recursive: true});
  await writeFile(new URL('index.html', directory), `<!doctype html>
<html lang="${en ? 'en' : 'ja'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><meta name="description" content="${description}"><meta name="robots" content="index,follow"><link rel="canonical" href="${base}${prefix}/community/">
<link rel="alternate" hreflang="ja" href="${base}/community/"><link rel="alternate" hreflang="en" href="${base}/en/community/"><link rel="alternate" hreflang="x-default" href="${base}/community/">
<meta property="og:type" content="website"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${base}${prefix}/community/">
<link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/community.css"><script type="module" src="/assets/community-page.js"></script>
</head><body class="community-body"><header class="site-header"><a class="brand" href="/">POE2 ${t('ビルドナビ', 'BUILD NAVI')}</a><nav class="site-nav page-nav" aria-label="${t('メインメニュー', 'Main navigation')}"><a href="${prefix}/simulator/">${t('シミュレーター', 'Simulator')}</a><a href="${en ? '' : '/en'}/community/">${t('English', '日本語')}</a></nav></header>
<main class="community-page"><nav aria-label="${t('パンくず', 'Breadcrumb')}"><a href="/">${t('ホーム', 'Home')}</a> / ${t('みんなのビルド', 'Community builds')}</nav>
<section class="community-intro"><p class="community-eyebrow">COMMUNITY BUILDS</p><h1>${t('みんなのビルド', 'Builds from the community')}</h1><p>${t('スキル・予算・用途で構成を探す。気になる投稿はシミュレーターで確認して、そのまま共有できます。', 'Find configurations by skill, budget and purpose. Inspect a snapshot in the simulator and share the post.')}</p><p class="community-help">${t('利用者が公開する入力例です。対応データ版と計算条件を確認して使ってください。', 'These are community input snapshots. Check the supported data version and calculation conditions before using them.')}</p></section>
<div id="community-app"><p role="status">${t('投稿を読み込んでいます…', 'Loading builds…')}</p></div><noscript>${t('投稿の検索と公開にはJavaScriptを有効にしてください。', 'Enable JavaScript to search and publish builds.')}</noscript>
<p><a href="/privacy/#community-privacy">${t('公開内容と個人情報の取り扱い', 'Privacy and public sharing')}</a></p></main></body></html>\n`);
}
const privacyFile = new URL('privacy/index.html', root);
let privacy = await readFile(privacyFile, 'utf8');
privacy = privacy.replace(/<!-- community-privacy:start -->[\s\S]*?<!-- community-privacy:end -->/g, '');
const block = '<!-- community-privacy:start --><section id="community-privacy"><h2>任意のビルド公開・通報</h2><p>「みんなのビルド」で公開内容を確認し、一般公開のチェックを入れて投稿した場合だけ、ビルド名・投稿者名・説明・予算・用途と、反映済みの装備・ジェム・パッシブ・レベル・敵・計算条件をChatGPT Sites上のCloudflare D1へ保存し、誰でも閲覧できる状態にします。以前のAppDeploy投稿は元のサーバーに残り、元の共有URL・管理コードで確認や取り下げを選ぶと以前のサービスにも接続します。個人メモ、編集中の装備入力、同期用の接続コードは公開用データに含めません。説明や装備の名前に個人情報を入力しないでください。</p><p>投稿の管理コードは端末のlocalStorageに保存し、投稿・自分の投稿確認・取り下げ時にサービスへ送信します。サーバーにはコードのハッシュを保存します。別のコードに切り替えると、以前のコードも端末内で切替用に保持します。コードを知る人は投稿を取り下げられます。共有URLにコードは含めません。紛失したコードを運営から復旧することはできません。</p><p>取り下げ時は稼働中の公開構成と一覧を削除します。再送による復活を防ぐため、投稿ID・管理用ハッシュ・処理履歴は保持します。第三者がすでにコピーした内容までは取り消せません。通報は理由・補足・対象投稿ID・重複防止用識別子を運営確認用として非公開で保存します。ホスティング事業者は通信元IP等のアクセス情報を処理する場合があります。暗号化した端末間同期の保管庫とは別のサービスです。</p><p lang="en">Publishing is optional and requires a preview and explicit consent. Public snapshots include the displayed title, author, description, budget and applied build inputs. Private notes, equipment-editor drafts and sync codes are excluded. Keep your management code private; it allows withdrawal. Withdrawal removes the live public snapshot, while a hashed processing receipt prevents replay. Reports are stored privately for review.</p></section><!-- community-privacy:end -->';
privacy = privacy.replace(/(<h2\b[^>]*>Google Analytics<\/h2>)/, block + '$1');
await writeFile(privacyFile, privacy);
console.log('Generated bilingual community pages and privacy disclosure');
