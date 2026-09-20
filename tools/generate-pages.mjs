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
  partial: "一部の段階を確認中（不足箇所は各段階に表示）",
  "needs-review": "対応パッチ変更箇所を再確認中",
  draft: "下書き"
};

const ssfLabel = (build) => build.ssf === true ? "確認済み" : build.ssf === false ? "非対応" : "未確認";
const passiveSource = (build) => build.sources?.find((source) => /レベリング|build|guide|Mobalytics|Maxroll/i.test(`${source.name} ${source.type}`)) || build.sources?.[0];

function roadmapHtml(build) {
  const source = passiveSource(build);
  return `<section id="roadmap" class="static-roadmap" aria-labelledby="roadmap-title"><div class="section-head"><p class="section-kicker">LEVELING ROADMAP</p><h2 id="roadmap-title">PoE2 ${escapeHtml(build.name)}のLv1〜Endgame育成手順</h2><p>現在Lvの段階だけを最初に開きます。全8段階の本文はHTML内にあり、先の育成手順も確認できます。</p></div>${build.levelingStages.map((stage, index) => `<details data-stage-index="${index}"${index === 0 ? " open" : ""}><summary><span>${escapeHtml(stage.label)}</span><span class="current-stage-marker" hidden>あなたはここ</span></summary><div class="roadmap-stage-body"><ol class="stage-actions">${stage.nowActions.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ol><dl>${[["主力",stage.mainSkill],["サポート",stage.supports],["パッシブ",stage.passivePriority],["優先装備",stage.gearPriority],["交換候補",stage.replaceGear],["注意点",stage.caution],[`${index === build.levelingStages.length - 1 ? "完成条件" : `次の段階へ進む条件`}`,stage.transitionCondition]].map(([key,value]) => `<dt>${key}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl>${source ? `<div class="passive-source"><span>原典段階：${escapeHtml(stage.passivePriority)}</span><a class="button-secondary" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">この段階のパッシブツリーを見る</a></div>` : ""}<label class="progress-check stage-complete"><input type="checkbox">この育成段階を完了した</label></div></details>`).join("")}</section>`;
}

function detailPage(build) {
  const title = `PoE2 ${build.version} ${build.name} ビルド｜Lv1〜Endgame育成`;
  const description = `PoE2 ${build.version}対応、${build.name}のスキル・サポート・パッシブ・装備とLv1〜Endgame育成手順。現在Lvから今やること3つを確認できます。`;
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
        <div><p id="build-class" class="eyebrow">${escapeHtml(build.className)} / ${escapeHtml(build.ascendancy)}</p><h1 id="build-name">PoE2 ${escapeHtml(build.name)} ビルド｜${escapeHtml(build.version)}育成</h1><p id="build-skill" class="lead">メインスキル：${escapeHtml(build.mainSkill)}</p><p class="status-note" data-build-status="${escapeHtml(build.status)}">${escapeHtml(statusLabels[build.status] || "状態未登録")}</p><div class="build-overview"><p><b>おすすめ：</b>${escapeHtml(build.audience)}</p><p><b>弱点：</b>${escapeHtml(build.weaknesses?.[0] || "未登録")}</p><p><b>操作：</b>${escapeHtml(build.difficulty)}　<b>SSF：</b>${ssfLabel(build)}</p></div><div id="fact-grid" class="fact-grid"><div class="fact">対応パッチ：${escapeHtml(build.version)}</div><div class="fact">資料確認日：${escapeHtml(build.updatedAt)}</div></div></div>
        <section class="level-card" aria-labelledby="level-title"><div class="level-number"><h2 id="level-title">現在Lv</h2><output id="level-output" for="level-input level-range">Lv1</output></div><div class="level-controls"><button id="level-minus" type="button" aria-label="レベルを1下げる">−</button><input id="level-input" type="number" inputmode="numeric" min="1" max="100" value="1" aria-label="現在レベル"><button id="level-plus" type="button" aria-label="レベルを1上げる">＋</button></div><input id="level-range" type="range" min="1" max="100" value="1" aria-label="現在レベルのスライダー"><div class="range-labels"><span>Lv1</span><span>Lv100</span></div><p class="disclaimer">この端末に自動保存されます。</p></section>
      </div>
    </section>
    <div class="detail-main">
      <section id="now" class="now-panel" aria-labelledby="now-title"><div class="now-stage"><small>あなたは現在ここ</small><strong id="now-stage">Lv1〜10</strong></div><div class="now-actions"><p id="now-source-label" class="section-kicker">${verified ? "掲載資料から整理した優先行動" : "確認済み範囲から整理した優先行動"}</p><h2 id="now-title">今やること</h2><div class="priority-list"><div class="priority-item"><b>最優先</b><span data-now-action></span></div><div class="priority-item"><b>次</b><span data-now-action></span></div><div class="priority-item"><b>その次</b><span data-now-action></span></div></div><p id="now-next" class="disclaimer"></p></div></section>
      <section class="progress-card" aria-labelledby="progress-title"><div class="progress-head"><div><p class="section-kicker">MY PROGRESS</p><h2 id="progress-title">現在段階のチェック進捗</h2></div><strong id="progress-percent">0%</strong></div><div class="progress-track" aria-hidden="true"><span id="progress-bar"></span></div><div id="progress-checks" class="progress-checks"></div><p id="progress-next" class="next-advice"></p><p class="disclaimer">ビルド全体の強さではなく、現在段階で確認する7項目の進捗です。チェック状態はこの端末に保存されます。</p></section>
      <section class="trouble-card" aria-labelledby="trouble-title"><p class="section-kicker">TROUBLE CHECK</p><h2 id="trouble-title">困ったとき</h2><p>現在のビルドとLvに合わせて、最初に確認する3項目を表示します。</p><div id="trouble-buttons" class="trouble-buttons"><button type="button" data-trouble="death">すぐ死ぬ</button><button type="button" data-trouble="damage">火力が出ない</button><button type="button" data-trouble="mana">マナが足りない</button><button type="button" data-trouble="boss">ボスに勝てない</button><button type="button" data-trouble="speed">周回が遅い</button><button type="button" data-trouble="gear">装備が分からない</button></div><div id="trouble-result" class="trouble-result" aria-live="polite"><p>困りごとを選んでください。</p></div></section>
      ${roadmapHtml(build)}
      <section class="build-faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(build.name)}ビルドのよくある質問</h2><details><summary>このビルドはどんな人向け？</summary><p>${escapeHtml(build.audience)}</p></details><details><summary>始める前に知る弱点は？</summary><p>${escapeHtml(build.weaknesses?.[0] || "確認中")}</p></details><details><summary>今のレベルで何をすればいい？</summary><p>ページ上部の現在Lvへ入力すると、該当する育成段階と優先行動3つが自動表示されます。</p></details></section>
      <section class="related" aria-labelledby="build-guides-title"><h2 id="build-guides-title">${escapeHtml(build.name)}のパッシブ・装備で迷ったとき</h2><div class="related-links"><a href="/guides/resistance/">耐性を確認する</a><a href="/guides/passive-tree/">パッシブの振り方</a><a href="/guides/increase-damage/">火力が出ない</a><a href="/guides/mapping/">Mappingの始め方</a><a href="/gear-check/?build=${encodeURIComponent(build.id)}&amp;level=1&amp;concern=purchase">装備診断を開く</a></div></section>
      <section class="related"><h2>関連ビルドと次のページ</h2><div id="related-links" class="related-links">${relatedHtml}</div><div class="section-cta"><a class="button-secondary" href="/classes/${build.classSlug}/">${escapeHtml(build.className)}のビルド</a><a class="button-secondary" href="/leveling/">別のLv・ビルドから探す</a><a class="button-secondary" href="/tier-list/">Tierで比較</a><a class="button-secondary" href="/league-starter/">スターターを比較</a><a class="button-secondary" href="/beginner-guide/">初心者攻略ガイド</a></div></section>
      <section class="sources" aria-labelledby="sources-title"><h2 id="sources-title">確認した情報源</h2><p>文章は転載せず、掲載資料を確認して初心者向けの手順へ再構成しています。</p><ul id="source-list" class="source-list">${(build.sources || []).map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.name)}</a><span>${escapeHtml(source.type)}・確認日 ${escapeHtml(source.checkedAt)}</span></li>`).join("")}</ul></section>
    </div>
  </main>
  <a class="mobile-sticky" href="#now">現在Lvから今やることを見る</a>
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
  const title = `PoE2 ${classData.name}おすすめビルド・育成｜序盤からEndgame`;
  const description = `PoE2 ${classData.name}の特徴、初心者向けビルド、序盤Lv1〜30の育成を確認し、現在Lvから今やること3つへ進めます。対応パッチ0.5.5。`;
  const url = `${baseUrl}/classes/${classData.slug}/`;
  const breadcrumb = JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":`${baseUrl}/`},{"@type":"ListItem","position":2,"name":classData.name,"item":url}]});
  const cards = classBuilds.map((build) => `<article class="class-build-card"><div><span class="verified">${escapeHtml(build.version)}</span><p>${escapeHtml(build.ascendancy)}</p><h2>${escapeHtml(build.name)}</h2><p><b>主力：</b>${escapeHtml(build.mainSkill)}</p><p><b>こんな人向け：</b>${escapeHtml(build.audience)}</p><p><b>先に知る弱点：</b>${escapeHtml(build.weaknesses?.[0] || "確認中")}</p></div><a class="button" href="/builds/${build.classSlug}/${build.slug}/">このビルドで育てる</a></article>`).join("");
  const latest = classBuilds.map((build) => build.updatedAt).sort().at(-1) || "未登録";
  const patch = classBuilds[0]?.version || "0.5.5";
  const selectionGuide = classBuilds.length === 1
    ? `<section class="content-action"><h2>現在掲載中のおすすめビルド</h2><p>${escapeHtml(classBuilds[0].name)}は、${escapeHtml(classBuilds[0].audience)}。現在Lvを入力すると今やること3つを確認できます。</p></section>`
    : `<section class="content-action"><h2>${escapeHtml(classData.name)}はどのビルドを選ぶ？</h2><ul>${classBuilds.map((build) => `<li><a href="/builds/${build.classSlug}/${build.slug}/"><b>${escapeHtml(build.name)}</b></a><span>${escapeHtml(build.audience)}</span></li>`).join("")}</ul></section>`;
  const earlyGuide = classBuilds.map((build) => `<article class="early-build-card"><h3>${escapeHtml(build.name)}</h3><p><b>Lv1〜10：</b>${escapeHtml(build.levelingStages[0].mainSkill)}</p><p><b>Lv11〜20：</b>${escapeHtml(build.levelingStages[1].mainSkill)}</p><p><b>Lv21〜30：</b>${escapeHtml(build.levelingStages[2].mainSkill)}</p><a class="button-secondary" href="/builds/${build.classSlug}/${build.slug}/?level=1#roadmap">序盤の育成手順を見る</a></article>`).join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index,follow"><meta name="google-adsense-account" content="${publisher}"><link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="POE2ビルドナビ"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary"><link rel="stylesheet" href="/assets/styles.css?v=20260909-1"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}" crossorigin="anonymous"></script><script type="application/ld+json">${breadcrumb.replaceAll("<", "\\u003c")}</script></head><body><a class="skip-link" href="#main">本文へ移動</a><header class="site-header"><a class="brand" href="/"><span class="brand-mark">P2</span><span>POE2<br>ビルドナビ</span></a><nav class="site-nav page-nav"><a href="/tier-list/">Tier</a><a href="/league-starter/">スターター</a><a href="/builds/">ビルド</a><a href="/beginner-guide/">初心者ガイド</a></nav></header><nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li>${escapeHtml(classData.name)}</li></ol></nav><main id="main" class="page-main"><section class="class-page-hero"><p class="section-kicker">CHOOSE A BUILD</p><h1>PoE2 ${escapeHtml(classData.name)}おすすめビルド・育成</h1><p class="class-lead">${escapeHtml(classData.tagline)}。このページでは、掲載中のおすすめビルドとLv1〜30の育て方を確認できます。</p><div class="class-tags">${classData.combatStyle.map((style) => `<span>${escapeHtml(style)}</span>`).join("")}</div><div class="status-note">対応パッチ ${escapeHtml(patch)}・最終確認 ${escapeHtml(latest)}</div></section><div class="class-page-body"><section><h2>${escapeHtml(classData.name)}はどんな職業？</h2><p>${escapeHtml(classData.description)}</p></section><div class="pros-cons"><section class="info-card"><h2>この職業はこんな人向け</h2><ul>${classData.beginnerPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul></section><section class="info-card"><h2>${escapeHtml(classData.name)}は初心者向け？</h2><p>掲載ビルドは現在Lv別の育成手順を確認できます。${escapeHtml(classData.caution)}</p></section></div>${selectionGuide}<section class="class-early"><h2>${escapeHtml(classData.name)}の序盤Lv1〜30の育て方</h2><p>掲載ビルドの確認済み手順を、Lv1〜10 → Lv11〜20 → Lv21〜30の順に進めてください。</p><div class="early-build-grid">${earlyGuide}</div></section><section class="class-builds"><p class="section-kicker">STEP 2 / CHOOSE A BUILD</p><h2>${escapeHtml(classData.name)}の掲載ビルド</h2>${cards || "<p>現在、根拠を確認できたビルドはありません。</p>"}</section><aside class="next-box"><b>次の順番</b><p>ビルドを選ぶ → 現在Lvを入力 → 今日やること3つを確認</p></aside><section class="related"><h2>比較・初心者ガイド</h2><div class="related-links"><a href="/leveling/">別のビルド・Lvから育成を探す</a><a href="/tier-list/">目的別Tierで比較</a><a href="/league-starter/">リーグスターターを見る</a><a href="/beginner-guide/">初心者攻略ガイド</a></div></section></div></main></body></html>`;
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
await import('./inject-analytics.mjs');
