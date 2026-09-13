import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const builds = JSON.parse(await readFile(resolve(root, "data/builds.json"), "utf8"));
const classes = JSON.parse(await readFile(resolve(root, "data/classes.json"), "utf8"));
const publisher = "ca-pub-7738997902416481";
const baseUrl = "https://poe2-build-navi-jp.github.io";
const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const publicBuilds = builds.filter((build) => build.status !== "draft");
const statusLabels = {
  verified: "Lv1〜Endgameの主要情報を確認済み",
  partial: "一部確認済み・未確認項目だけ確認中",
  "needs-review": "パッチ変更のため再確認中",
  draft: "下書き"
};

function detailPage(build) {
  const title = `PoE2 ${build.name} ビルド｜Lv1からEndgame`;
  const description = `PoE2 ${build.name}のスキル・サポート・パッシブ・装備とLv1からEndgameまでの育成手順。現在Lvから次にやることを3つ確認できます。`;
  const url = `${baseUrl}/builds/${build.classSlug}/${build.slug}/`;
  const verified = build.status === "verified";
  const indexable = ["verified", "partial"].includes(build.status);
  const breadcrumb = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ホーム", item: `${baseUrl}/` },
      { "@type": "ListItem", position: 2, name: "ビルド一覧", item: `${baseUrl}/builds/` },
      { "@type": "ListItem", position: 3, name: build.className, item: `${baseUrl}/classes/${build.classSlug}/` },
      { "@type": "ListItem", position: 4, name: build.name, item: url }
    ]
  });
  const relatedBuilds = [
    ...publicBuilds.filter((item) => item.classSlug === build.classSlug && item.id !== build.id),
    ...publicBuilds.filter((item) => item.classSlug !== build.classSlug && item.id !== build.id)
  ].slice(0, 3);
  const relatedHtml = relatedBuilds.map((item) => `<a href="/builds/${item.classSlug}/${item.slug}/">${escapeHtml(item.name)}</a>`).join("");
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${indexable ? "index,follow" : "noindex,follow"}">
  <meta name="google-adsense-account" content="${publisher}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:site_name" content="POE2ビルドナビ">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${url}">
  <meta name="twitter:card" content="summary">
  <link rel="stylesheet" href="/assets/styles.css?v=20260909-1">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}" crossorigin="anonymous"></script>
  <script type="application/ld+json">${breadcrumb.replaceAll("<", "\\u003c")}</script>
  <script type="module" src="/assets/detail.js?v=20260909-1"></script>
</head>
<body>
  <a class="skip-link" href="#main">本文へ移動</a>
  <header class="site-header"><a class="brand" href="/" aria-label="POE2ビルドナビ ホーム"><span class="brand-mark" aria-hidden="true">P2</span><span>POE2<br>ビルドナビ</span></a><button id="menu-button" class="menu-button" type="button" aria-controls="site-nav" aria-expanded="false">メニュー</button><nav id="site-nav" class="site-nav" aria-label="メインメニュー"><a href="/tier-list/">Tier</a><a href="/league-starter/">スターター</a><a href="/builds/">ビルド一覧</a><a href="/gear-check/">装備診断</a><a href="/beginner-guide/">初心者ガイド</a></nav></header>
  <nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li><a href="/builds/">ビルド一覧</a></li><li><a id="breadcrumb-class" href="/classes/${build.classSlug}/">${escapeHtml(build.className)}</a></li><li id="breadcrumb-name">${escapeHtml(build.name)}</li></ol></nav>
  <main id="main">
    <section class="build-hero">
      <div class="build-hero-grid">
        <div><p id="build-class" class="eyebrow">${escapeHtml(build.className)} / ${escapeHtml(build.ascendancy)}</p><h1 id="build-name">${escapeHtml(build.name)}</h1><p id="build-skill" class="lead">メインスキル：${escapeHtml(build.mainSkill)}</p><p class="status-note" data-build-status="${escapeHtml(build.status)}">${escapeHtml(statusLabels[build.status] || "状態未登録")}</p><div id="fact-grid" class="fact-grid"></div></div>
        <section class="level-card" aria-labelledby="level-title"><div class="level-number"><h2 id="level-title">現在Lv</h2><output id="level-output" for="level-input level-range">Lv1</output></div><div class="level-controls"><button id="level-minus" type="button" aria-label="レベルを1下げる">−</button><input id="level-input" type="number" inputmode="numeric" min="1" max="100" value="1" aria-label="現在レベル"><button id="level-plus" type="button" aria-label="レベルを1上げる">＋</button></div><input id="level-range" type="range" min="1" max="100" value="1" aria-label="現在レベルのスライダー"><div class="range-labels"><span>Lv1</span><span>Lv100</span></div><p class="disclaimer">この端末に自動保存されます。</p></section>
      </div>
    </section>
    <div class="detail-main">
      <section id="now" class="now-panel" aria-labelledby="now-title"><div class="now-stage"><small>あなたは現在ここ</small><strong id="now-stage">Lv1〜10</strong></div><div class="now-actions"><p id="now-source-label" class="section-kicker">${verified ? "掲載資料から整理した優先行動" : "確認済み範囲から整理した優先行動"}</p><h2 id="now-title">今やること</h2><div class="priority-list"><div class="priority-item"><b>最優先</b><span data-now-action></span></div><div class="priority-item"><b>次</b><span data-now-action></span></div><div class="priority-item"><b>その次</b><span data-now-action></span></div></div><p id="now-next" class="disclaimer"></p></div></section>
      <section class="progress-card" aria-labelledby="progress-title"><div class="progress-head"><div><p class="section-kicker">MY PROGRESS</p><h2 id="progress-title">現在段階のチェック進捗</h2></div><strong id="progress-percent">0%</strong></div><div class="progress-track" aria-hidden="true"><span id="progress-bar"></span></div><div id="progress-checks" class="progress-checks"></div><p id="progress-next" class="next-advice"></p><p class="disclaimer">ビルド全体の強さではなく、現在段階で確認する7項目の進捗です。チェック状態はこの端末に保存されます。</p></section>
      <section class="trouble-card" aria-labelledby="trouble-title"><p class="section-kicker">TROUBLE CHECK</p><h2 id="trouble-title">困ったとき</h2><p>現在のビルドとLvに合わせて、最初に確認する3項目を表示します。</p><div id="trouble-buttons" class="trouble-buttons"><button type="button" data-trouble="death">すぐ死ぬ</button><button type="button" data-trouble="damage">火力が出ない</button><button type="button" data-trouble="mana">マナが足りない</button><button type="button" data-trouble="boss">ボスに勝てない</button><button type="button" data-trouble="speed">周回が遅い</button><button type="button" data-trouble="gear">装備が分からない</button></div><div id="trouble-result" class="trouble-result" aria-live="polite"><p>困りごとを選んでください。</p></div></section>
      <section id="roadmap" aria-labelledby="roadmap-title"><div class="section-head"><p class="section-kicker">LEVELING ROADMAP</p><h2 id="roadmap-title">Lv1 → Endgame育成ロードマップ</h2><p>各段階を選んで確認できます。サイト内の方針を先に読み、原典はノード位置の照合に使えます。</p></div><div id="stage-nav" class="stage-nav" aria-label="育成段階"></div><article class="stage-card"><p id="stage-status" class="${verified ? "verified" : "pending"}">${verified ? "この段階の主要情報を確認済み" : "未確認項目だけ確認中"}</p><h2 id="stage-heading">Lv1〜10</h2><p id="stage-next" class="disclaimer"></p><div id="stage-grid" class="stage-grid"></div></article></section>
      <div class="pros-cons"><section class="info-card"><h2>おすすめな人</h2><ul id="strength-list"></ul></section><section class="info-card"><h2>弱点</h2><ul id="weakness-list"></ul></section></div>
      <section class="build-faq" aria-labelledby="faq-title"><h2 id="faq-title">よくある質問</h2><details><summary>このビルドはどんな人向け？</summary><p>${escapeHtml(build.audience)}</p></details><details><summary>始める前に知る弱点は？</summary><p>${escapeHtml(build.weaknesses?.[0] || "確認中")}</p></details><details><summary>今のレベルで何をすればいい？</summary><p>ページ上部の現在Lvへ入力すると、該当する育成段階と優先行動3つが自動表示されます。</p></details></section>
      <section class="related"><h2>関連ビルドと次のページ</h2><div id="related-links" class="related-links">${relatedHtml}</div><div class="section-cta"><a class="button-secondary" href="/tier-list/">Tierで比較</a><a class="button-secondary" href="/league-starter/">スターターを比較</a><a class="button-secondary" href="/guides/beginner-build/">初心者向けの選び方</a></div></section>
      <section class="sources" aria-labelledby="sources-title"><h2 id="sources-title">確認した情報源</h2><p>文章は転載せず、掲載資料を確認して初心者向けの手順へ再構成しています。</p><ul id="source-list" class="source-list"></ul></section>
    </div>
  </main>
  <a class="mobile-sticky" href="#now">今やることを見る</a>
  <footer class="site-footer"><div class="footer-row"><div class="footer-brand"><span class="brand-mark" aria-hidden="true">P2</span><span>POE2<br>ビルドナビ</span></div><nav class="footer-links" aria-label="サイト情報"><a href="/about/">運営者情報</a><a href="/editorial-policy/">編集方針</a><a href="/privacy/">プライバシー</a><a href="/terms/">利用規約</a></nav></div><p class="fine">Path of Exile 2 is a trademark of Grinding Gear Games. This site is not affiliated with or endorsed by Grinding Gear Games.</p></footer>
</body>
</html>`;
}

for (const build of builds) {
  const directory = resolve(root, "builds", build.classSlug, build.slug);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "index.html"), detailPage(build));
}

function classPage(classData) {
  const classBuilds = publicBuilds.filter((build) => build.classSlug === classData.slug);
  const title = `POE2 ${classData.name}おすすめビルド・育成ガイド｜POE2ビルドナビ`;
  const description = `${classData.name}の特徴と初心者向けビルドを確認し、現在Lvから育成を始められます。対応パッチ0.5.5。`;
  const url = `${baseUrl}/classes/${classData.slug}/`;
  const breadcrumb = JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":`${baseUrl}/`},{"@type":"ListItem","position":2,"name":classData.name,"item":url}]});
  const cards = classBuilds.map((build) => `<article class="class-build-card"><div><span class="verified">${escapeHtml(build.version)}</span><p>${escapeHtml(build.ascendancy)}</p><h2>${escapeHtml(build.name)}</h2><p><b>主力：</b>${escapeHtml(build.mainSkill)}</p><p><b>こんな人向け：</b>${escapeHtml(build.audience)}</p><p><b>先に知る弱点：</b>${escapeHtml(build.weaknesses?.[0] || "確認中")}</p></div><a class="button" href="/builds/${build.classSlug}/${build.slug}/">このビルドで育てる</a></article>`).join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index,follow"><meta name="google-adsense-account" content="${publisher}"><link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="POE2ビルドナビ"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary"><link rel="stylesheet" href="/assets/styles.css?v=20260909-1"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}" crossorigin="anonymous"></script><script type="application/ld+json">${breadcrumb.replaceAll("<", "\\u003c")}</script></head><body><a class="skip-link" href="#main">本文へ移動</a><header class="site-header"><a class="brand" href="/"><span class="brand-mark">P2</span><span>POE2<br>ビルドナビ</span></a><nav class="site-nav page-nav"><a href="/builds/">ビルド</a><a href="/gear-check/">装備診断</a><a href="/beginner-guide/">初心者ガイド</a></nav></header><nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li>${escapeHtml(classData.name)}</li></ol></nav><main id="main" class="page-main"><section class="class-page-hero"><p class="section-kicker">CHOOSE A BUILD</p><h1>${escapeHtml(classData.name)}</h1><p class="class-lead">${escapeHtml(classData.tagline)}</p><div class="class-tags">${classData.combatStyle.map((style) => `<span>${escapeHtml(style)}</span>`).join("")}</div></section><div class="class-page-body"><section><h2>${escapeHtml(classData.name)}はどんな職業？</h2><p>${escapeHtml(classData.description)}</p></section><div class="pros-cons"><section class="info-card"><h2>こんな人におすすめ</h2><ul>${classData.beginnerPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul></section><section class="info-card"><h2>始める前の注意</h2><p>${escapeHtml(classData.caution)}</p></section></div><section class="class-builds"><p class="section-kicker">STEP 2 / CHOOSE A BUILD</p><h2>${escapeHtml(classData.name)}のビルド</h2>${cards || "<p>現在、根拠を確認できたビルドはありません。</p>"}</section><aside class="next-box"><b>次の順番</b><p>ビルドを選ぶ → 現在Lvを入力 → 今日やること3つを確認</p></aside></div></main></body></html>`;
}

for (const classData of classes) {
  const directory = resolve(root, "classes", classData.slug);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "index.html"), classPage(classData));
}

console.log(`Generated ${builds.length} build detail pages and ${classes.length} class pages.`);
await import('./generate-static-content.mjs');
await import('./generate-discovery-pages.mjs');
await import('./generate-seo-pages.mjs');
await import('./enhance-residual-pages.mjs');
