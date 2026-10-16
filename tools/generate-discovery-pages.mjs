import { restoreMobileSummary } from './mobile-summary.mjs';
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const [allBuilds, classes, discovery] = await Promise.all([
  readJson("data/builds.json"),
  readJson("data/classes.json"),
  readJson("data/discovery.json")
]);
const buildSearchComparison = await readJson("data/build-search-comparison.json");
const builds = allBuilds.filter((build) => build.status !== "draft");
const base = "https://poe2-build-navi-jp.github.io";
const publisher = "ca-pub-7738997902416481";
const esc = (value) => String(value ?? "確認中").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const buildUrl = (build) => `/builds/${build.classSlug}/${build.slug}/`;
const byId = (id) => {
  const build = builds.find((item) => item.id === id);
  if (!build) throw new Error(`Unknown build id: ${id}`);
  return build;
};
const absolute = (path) => `${base}${path}`;

const header = (current = "") => `<header class="site-header"><a class="brand" href="/" aria-label="POE2ビルドナビ ホーム"><span class="brand-mark" aria-hidden="true">P2</span><span>POE2<br>ビルドナビ</span></a><nav class="site-nav page-nav" aria-label="メインメニュー"><a href="/tier-list/"${current === "tier" ? ' aria-current="page"' : ""}>Tier</a><a href="/league-starter/"${current === "starter" ? ' aria-current="page"' : ""}>スターター</a><a href="/builds/"${current === "builds" ? ' aria-current="page"' : ""}>ビルド</a><a href="/beginner-guide/">初心者ガイド</a></nav></header>`;

function breadcrumb(items) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absolute(item.path)
    }))
  }).replaceAll("<", "\\u003c");
}

function head({ title, description, path, type = "article", crumbs, assetVersion = "discovery-2" }) {
  const url = absolute(path);
  return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="google-adsense-account" content="${publisher}"><link rel="canonical" href="${url}"><meta property="og:type" content="${type}"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="POE2ビルドナビ"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary"><link rel="stylesheet" href="/assets/styles.css?v=${assetVersion}"><link rel="stylesheet" href="/assets/mobile.css?v=${assetVersion}"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}" crossorigin="anonymous"></script><script type="application/ld+json">${breadcrumb(crumbs)}</script>`;
}

function shell({ title, description, path, current, kicker, h1, intro, content, crumbs, statusLabel = "対応環境", assetVersion }) {
  return `<!doctype html><html lang="ja"><head>${head({ title, description, path, crumbs, assetVersion })}${current === "beginner" ? '<style>@media(max-width:680px){.discovery-page>#purpose-picks,.discovery-page>#featured-builds{scroll-margin-top:80px}}</style>' : ""}</head><body><a class="skip-link" href="#main">本文へ移動</a>${header(current)}<main id="main" class="page-main"><nav class="breadcrumbs" aria-label="パンくず"><ol>${crumbs.map((item, index) => `<li>${index === crumbs.length - 1 ? esc(item.name) : `<a href="${item.path}">${esc(item.name)}</a>`}</li>`).join("")}</ol></nav><section class="page-hero discovery-hero"><p class="section-kicker">${esc(kicker)}</p><h1>${esc(h1)}</h1><p>${esc(intro)}</p><div class="update-strip"><span>${esc(statusLabel)}：${esc(discovery.patchVersion)}</span><span><a href="${esc(discovery.latestPatchSource)}" target="_blank" rel="noopener noreferrer">最新確認：${esc(discovery.latestPatch)}</a></span><span>最終確認：${esc(discovery.latestPatchCheckedAt)}</span></div></section><article class="article-page discovery-page">${content}</article></main></body></html>`;
}

function compactBuildCard(build, label = "ビルド詳細を見る", tags = []) {
  const ssf = build.reviewedFacts?.ssfNote || (build.ssf === true ? "確認済み" : build.ssf === false ? "非対応" : "未確認");
  const tagsHtml = tags.length ? `<div class="build-tags" aria-label="用途">${tags.map((tag) => `<span>${esc(tag)}</span>`).join("")}</div>` : "";
  return `<article class="discovery-card"><p class="build-meta">${esc(build.className)} / ${esc(build.ascendancy)}</p><h3>${esc(build.name)}</h3>${tagsHtml}<p><b>おすすめ：</b>${esc(build.audience)}</p><p><b>弱点：</b>${esc(build.weaknesses?.[0])}</p><dl><div><dt>主力</dt><dd>${esc(build.mainSkill)}</dd></div><div><dt>操作</dt><dd>${esc(build.difficulty)}</dd></div><div><dt>SSF</dt><dd>${ssf}</dd></div><div><dt>対応</dt><dd>${esc(build.version)}・${esc(build.updatedAt)}</dd></div></dl><a class="button" href="${buildUrl(build)}">${esc(label)}</a></article>`;
}

function choiceCard(label, buildId, reason, cta = "このビルドを確認する") {
  const build = byId(buildId);
  return `<article class="purpose-card"><p class="section-kicker">${esc(label)}</p><h3>${esc(build.name)}</h3><p>${esc(reason)}</p><a class="button" href="${buildUrl(build)}">${esc(cta)}</a></article>`;
}

const featured = discovery.featuredBuildIds.map(byId);
const featuredHtml = `<section id="featured-builds" class="section featured-builds" aria-labelledby="featured-title"><div class="section-head"><p class="section-kicker">BEGINNER PICKS / 詳細比較</p><h2 id="featured-title">初心者におすすめのビルド</h2><p><b>詳細比較用：</b>おすすめ理由・弱点・操作・SSFを見比べてから選べます。</p></div><div class="discovery-grid">${featured.map((build) => compactBuildCard(build, undefined, discovery.featuredBuildTags?.[build.id] ?? [])).join("")}</div><div class="section-cta"><a class="button" href="/builds/">全${builds.length}ビルドを見る</a><a class="button-secondary" href="/tier-list/">目的別Tierを見る</a><a class="button-secondary" href="/league-starter/">リーグスターターを見る</a></div></section>`;
const topChoices = `<section id="purpose-picks" class="section section-soft" aria-labelledby="purpose-picks-title"><div class="section-head"><p class="section-kicker">QUICK ANSWER / 即決</p><h2 id="purpose-picks-title">PoE2おすすめビルド5選｜迷ったら戦い方で選ぶ</h2><p>初めてなら召喚、弓、近接、魔法、継続ダメージから選びます。各候補の向いている人・弱点・主力への切替時期を確認してから、現在Lvの育成手順へ進んでください。</p></div><div class="purpose-grid">${[
  choiceCard("初心者・安全重視", "witch-minion-infernalist", "ミニオンに攻撃を任せやすく、自分は回避と位置取りへ集中できます。"),
  choiceCard("弓で遊びたい", "ranger-ice-shot-deadeye", "Lv31からアイスショットへ切り替える時期と、序盤の育成手順が明確です。"),
  choiceCard("近接で遊びたい", "monk-whirling-assault", "移動しながら攻撃でき、Lv41の主力切替まで段階別に確認できます。"),
  choiceCard("魔法で遊びたい", "sorceress-spark-stormweaver", "Lv1から同じSparkを撃ち続けられ、操作の簡単さも原典に明記されています。Endgameの自動発動コメットにはSpirit 121以上が必要です。"),
  choiceCard("継続ダメージ", "witch-ed-contagion-lich", "継続ダメージを広げる構成。SSFでの完成形は未確認です。")
].join("")}</div><div class="section-cta"><a class="button-secondary" href="/best-builds/">目的別おすすめを見る</a><a class="button-secondary" href="/tier-list/">初心者Tierで比較する</a><a class="button-secondary" href="/league-starter/">リーグスターターを見る</a></div></section>`;

const beginnerEntry = `<section id="purpose-picks" class="section section-soft beginner-builds-entry" aria-labelledby="purpose-picks-title"><span id="featured-builds" class="legacy-anchor" aria-hidden="true"></span><div class="section-head"><p class="section-kicker">BEGINNER BUILDS</p><h2 id="purpose-picks-title">初心者おすすめビルドを選ぶ</h2><p>戦い方別の5候補と、おすすめ理由・弱点・切替時期の詳しい比較を専用ページにまとめました。</p></div><div class="section-cta"><a class="button" href="/beginner-builds/">初心者おすすめビルドを見る</a><a class="button-secondary" href="/beginner-builds/#featured-builds">詳しく比較する</a></div></section>`;

let home = restoreMobileSummary(await readFile(resolve(root, "index.html"), "utf8"));
home = home.replace(/<section id="featured-builds"[\s\S]*?<\/section>/g, "");
home = home
  .replace(/<title>.*?<\/title>/, "<title>PoE2 ビルド｜0.5.5おすすめ・最強ビルドを比較できる日本語ビルドサイト</title>")
  .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="Path of Exile 2（PoE2）0.5.5のおすすめビルドを日本語で比較できるビルドサイト。全12ビルドを遠距離・近接・魔法・召喚の戦い方で一覧にし、初心者向けTier、最強ビルドの目的別比較、現在Lvから今やること3つを確認できます。">')
  .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="PoE2 ビルド｜0.5.5おすすめ・最強ビルドを比較できる日本語ビルドサイト">')
  .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="Path of Exile 2（PoE2）0.5.5のおすすめビルドを日本語で比較。全12ビルドを戦い方で一覧にし、現在Lvから今やること3つを確認できます。">')
  .replace(/<section class="hero(?: hero-focused)?"[\s\S]*?<\/section>\s*(?:<section id="purpose-picks"[\s\S]*?<\/section>\s*)?(?:<section id="featured-builds"[\s\S]*?<\/section>\s*)?<section id="choose-class"/, `<section class="hero hero-focused" aria-labelledby="hero-title"><div><p class="eyebrow">PATH OF EXILE 2 / JAPANESE BUILD GUIDE</p><h1 id="hero-title">PoE2 0.5.5 おすすめビルド｜職業別・初心者向け</h1><p class="lead">目的別にビルドを選び、現在Lvを入力すると、スキル・装備・パッシブの「今やること」を3つ表示します。</p><div class="journey-steps" aria-label="使い方"><span><b>1</b>おすすめを選ぶ</span><span><b>2</b>ビルドを開く</span><span><b>3</b>現在Lvを入力</span><span><b>4</b>今やること3つ</span></div><div class="hero-actions"><a class="button" href="/beginner-builds/">初心者おすすめビルド</a><a class="button-secondary" href="#choose-class">職業から選ぶ</a></div><div class="status-note">対応環境 <span id="site-version">${esc(discovery.patchVersion)}</span>・<a href="${esc(discovery.latestPatchSource)}" target="_blank" rel="noopener noreferrer">最新確認 ${esc(discovery.latestPatch)}</a>・最終確認 <span id="last-updated">${esc(discovery.latestPatchCheckedAt)}</span></div></div></section>${beginnerEntry}<section id="choose-class"`)
  .replace("<h2 id=\"classes-title\">まず職業を選んでください</h2>", "<h2 id=\"classes-title\">職業から探す</h2>")
  .replace(/<p>おすすめを見ても決められない場合は、好きな戦い方から職業を選べます。<\/p>|<p>ビルド名が分からなくても大丈夫です。好きな戦い方から職業を選べます。<\/p>/, "<p>好きな戦い方から職業を選び、掲載ビルドへ進めます。</p>")
  .replace(/(<a id="quick-link"[^>]*>)[^<]*(<\/a>)/, "$1現在Lvから今やることを見る$2")
  .replace(/<section class="section section-soft" aria-labelledby="quality-title">[\s\S]*?<\/section>/, `<section class="section section-soft" aria-labelledby="quality-title"><div class="section-head"><p class="section-kicker">SEARCH GUIDES</p><h2 id="quality-title">目的から探す</h2><p>検索した目的から、ビルド詳細のLv入力まで迷わず進めます。</p></div><div class="tool-grid"><a class="tool-card" href="/beginner-builds/"><span>BEGINNER</span><strong>初心者おすすめビルド</strong><p>戦い方別の候補から最初の1体を選びます。</p></a><a class="tool-card" href="/classes/"><span>CLASS</span><strong>おすすめクラスを選ぶ</strong><p>遠距離・召喚・近接・耐久から職業を選びます。</p></a><a class="tool-card" href="/leveling/"><span>LEVELING</span><strong>現在Lvから育成を見る</strong><p>職業とビルドを選び、今やること3つへ進みます。</p></a><a class="tool-card" href="/league-starter/"><span>EARLY GAME</span><strong>序盤おすすめビルド</strong><p>序盤の育てやすさからスターターを比較します。</p></a><a class="tool-card" href="/tier-list/"><span>TIER</span><strong>初心者Tierで比較</strong><p>育てやすさと操作条件で候補を絞ります。</p></a><a class="tool-card" href="/best-builds/"><span>BEST BY PURPOSE</span><strong>目的別おすすめビルド</strong><p>周回・ボス・防御・操作から候補を選びます。</p></a><a class="tool-card" href="/poe2-1-0/"><span>VERSION 1.0</span><strong>正式版・無料化情報</strong><p>確定情報と未確定情報を分けて確認します。</p></a><a class="tool-card" href="/builds/"><span>ALL BUILDS</span><strong>掲載ビルド一覧</strong><p>確認済みの${builds.length}ビルドを職業と名前で探します。</p></a></div></section>`);
const buildAnswers = `<section id="build-answers" class="section section-soft" aria-labelledby="build-answers-title"><div class="section-head"><h2 id="build-answers-title">PoE2のビルド選びでよくある質問</h2></div><div class="guide-grid"><article class="info-card"><h3>PoE2のビルドとは？</h3><p>Path of Exile 2（PoE2）のビルドとは、主力スキル・サポート・パッシブ・装備を組み合わせたキャラクターの育成構成です。完成時の装備だけでなく、序盤のスキルと途中の切替手順も確認して選びます。</p><a href="/beginner-guide/">初心者向けの選び方を見る</a></article><article class="info-card"><h3>初心者はどのビルドを選ぶ？</h3><p>当サイトの掲載候補では、召喚ならミニオン・インファーナリスト、弓ならアイスショット・デッドアイ、盾を使うならシールドウォール・スミスを案内しています。主力の解禁Lv・操作量・装備条件を比較してください。</p><a href="/beginner-builds/">初心者おすすめビルドと注意点を見る</a></article><article class="info-card"><h3>最新の最強ビルドはどこで確認する？</h3><p>周回・ボス・防御などの目的別候補は、比較ページで確認できます。全ビルドを同じ予算・条件で実測した最強順位ではありません。比較後は、選んだビルドで現在Lvを入力し、今やること3つへ進みます。</p><a href="/best-builds/">目的別おすすめと比較の根拠を見る</a><p>公式パッチの最新確認は${esc(discovery.latestPatch)}（${esc(discovery.latestPatchCheckedAt)}）です。この日付は全ビルドの再検証日ではありません。各ビルドの対応パッチ・育成資料の確認日・段階ごとの未確認箇所を確認してください。</p></article></div><p>掲載内容は各ビルドの資料・対応パッチに基づきます。ゲームの公式運営サイトではありません。<a href="/editorial-policy/">情報の確認方法と編集方針</a></p></section>`;
home = home.replace(/<section id="build-answers"[\s\S]*?<\/section>/g, "");
home = home.replace('</main>', `${buildAnswers}</main>`);
// Refresh the existing hero independently: resumed home pages no longer match the bootstrap layout.
// Keep the proven title and current-level flow; broad build searches need the catalog and purpose comparison too.
home = home
  .replace(/(<h1 id="hero-title">)[\s\S]*?(<\/h1>)/, "$1PoE2 0.5.5 おすすめビルド｜職業別・初心者向け$2")
  .replace(/(<section class="hero hero-focused"[\s\S]*?<p class="lead">)[\s\S]*?(<\/p>)/, `$1PoE2の日本語ビルドガイド。掲載${builds.length}ビルドを職業・戦い方で比較し、現在Lvを入力すると、スキル・装備・パッシブの「今やること」を3つ確認できます。$2`)
  .replace(/<p id="home-build-routes">[\s\S]*?<\/p>/g, "")
  .replace(/(<section class="hero hero-focused"[\s\S]*?<p class="lead">[\s\S]*?<\/p>)/, `$1<p id="home-build-routes"><a href="/builds/">全${builds.length}ビルドを職業・条件で比較</a> ／ <a href="/best-builds/">最強ビルドを探すなら：周回・ボス・防御の目的別候補</a></p>`);
// enhance-build-ux moves the resume section right after the quick picks, so the hero pattern above
// no longer matches on a regenerated page; refresh the quick picks on their own.
home = home.replace(/<section id="purpose-picks"[\s\S]*?<\/section>/, beginnerEntry);
home = home.replace(/href="#purpose-picks"/g, 'href="/beginner-builds/"');
home = home.replace(/<a href="[^"]+" target="_blank" rel="noopener noreferrer">最新確認 [^<]+<\/a>・最終確認 <span id="last-updated">[^<]+<\/span>/, `<a href="${esc(discovery.latestPatchSource)}" target="_blank" rel="noopener noreferrer">最新確認 ${esc(discovery.latestPatch)}</a>・最終確認 <span id="last-updated">${esc(discovery.latestPatchCheckedAt)}</span>`);
await writeFile(resolve(root, "index.html"), home);

// Keep the homepage short; the original choices and comparison cards live here.
await mkdir(resolve(root, "beginner-builds"), { recursive: true });
await writeFile(resolve(root, "beginner-builds/index.html"), shell({
  title: "PoE2 初心者おすすめビルド｜0.5.5の選び方・比較",
  description: "PoE2 0.5.5の初心者おすすめビルドを、召喚・弓・近接・魔法・継続ダメージから選べます。向いている人、弱点、主力への切替時期を比較し、現在Lvの育成手順へ進めます。",
  path: "/beginner-builds/", current: "beginner", kicker: "BEGINNER BUILDS",
  h1: "PoE2 0.5.5 初心者おすすめビルド",
  intro: "まずは戦い方から候補を選び、気になるビルドのおすすめ理由・弱点・切替時期を確認してください。掲載内容と評価は各ビルドの確認資料に基づきます。",
  content: `<nav class="section-cta" aria-label="このページの内容"><a class="button" href="#purpose-picks">戦い方から選ぶ</a><a class="button-secondary" href="#featured-builds">詳しく比較する</a></nav>${topChoices}${featuredHtml}<section class="related"><h2>次に進む</h2><div class="related-links"><a href="/">トップページに戻る</a><a href="/beginner-guide/">育成の基本を読む</a><a href="/league-starter/">序盤・低資産の条件で選ぶ</a><a href="/best-builds/">周回・ボスなど目的で選ぶ</a></div></section>`,
  crumbs: [{ name: "ホーム", path: "/" }, { name: "初心者おすすめビルド", path: "/beginner-builds/" }]
}));

const tierSections = ["S", "A", "B", "C"].map((tier) => {
  const entries = discovery.tiers[tier];
  const cards = entries.length ? entries.map(({ id, reason }) => {
    const build = byId(id);
    return `<article class="tier-card"><div class="tier-badge tier-${tier.toLowerCase()}">${tier}</div><div><p class="build-meta">${esc(build.className)} / ${esc(build.ascendancy)}</p><h3>${esc(build.name)}</h3><p class="tier-reason">${esc(reason)}</p><div class="tier-columns"><div><b>強み</b><p>${esc(build.strengths[0])}</p></div><div><b>弱み</b><p>${esc(build.weaknesses[0])}</p></div></div><ul class="tier-facts"><li>初心者適性：${esc(build.audience)}</li><li>周回・ボス・防御：同条件の数値比較は未採点</li><li>予算：${esc(build.budget)}</li><li>操作：${esc(build.difficulty)}</li></ul><a class="button" href="${buildUrl(build)}?level=1#now">このビルドをLv1から育てる</a></div></article>`;
  }).join("") : '<p class="empty-tier">現在、この基準でCに分類したビルドはありません。</p>';
  return `<section class="tier-section" aria-labelledby="tier-${tier.toLowerCase()}"><h2 id="tier-${tier.toLowerCase()}">${tier} Tier</h2>${cards}</section>`;
}).join("");

const tierChoices = `<section class="content-action choice-summary"><h2>結論だけ知りたい人向け</h2><div class="purpose-grid">${[
  choiceCard("初心者・弓", "ranger-ice-shot-deadeye", "序盤からLv31のアイスショット切替まで手順が明確です。"),
  choiceCard("安全性重視", "warrior-shield-wall-smith", "盾を軸に育成でき、主力へ移るLv22も確認できます。"),
  choiceCard("召喚で安全に", "witch-minion-infernalist", "攻撃をミニオンへ任せ、回避と位置取りへ集中しやすい構成です。"),
  choiceCard("近接・機動力", "monk-whirling-assault", "移動攻撃を使い、近接でテンポよく進めたい人向けです。")
].join("")}</div></section>`;
const tierContent = `${tierChoices}<section class="content-action"><h2>このTierの見方</h2><p>育成しやすさ、操作、途中切替、確認資料を基準に比較しています。上の目的別候補で絞った後、Tier表で強みと弱点を確認してください。</p></section>${tierSections}<section><h2>評価基準</h2><ul><li>同じパッチ0.5.5の資料であること</li><li>8段階の育成手順を確認できること</li><li>初心者が注意すべき操作・切替・弱点が明記されていること</li><li>資料が不足する候補は上位へ断定しないこと</li></ul><p><a href="/editorial-policy/">編集方針と情報確認方法を見る</a></p></section><section class="related"><h2>別の基準で選ぶ</h2><div class="related-links"><a href="/best-builds/">周回・ボス・防御など目的別で選ぶ</a><a href="/league-starter/">低資産で始める候補を見る</a><a href="/leveling/">現在Lvから育成を見る</a></div></section>`;
await mkdir(resolve(root, "tier-list"), { recursive: true });
await writeFile(resolve(root, "tier-list/index.html"), shell({ title: "PoE2 0.5.5初心者向けビルドTier｜育てやすさ比較", description: "PoE2 0.5.5の初心者向けビルドを、育成の始めやすさ・操作・構成切替・資料確認状況で暫定比較。各ビルドは現在Lvから育成できます。", path: "/tier-list/", current: "tier", kicker: "TIER LIST / PATCH 0.5.5", h1: "PoE2 0.5.5初心者向けビルドTier", intro: "初心者が最初の1体を選ぶための暫定Tierです。強さだけの順位ではなく、Lv1から迷わず進められるかを重視します。", content: tierContent, crumbs: [{ name: "ホーム", path: "/" }, { name: "Tierリスト", path: "/tier-list/" }] }));

const starterCards = builds.filter((build) => build.leagueStarter).map((build) => `<article class="starter-card"><div><p class="build-meta">${esc(build.className)} / ${esc(build.ascendancy)}</p><h2>${esc(build.name)}</h2><p>${esc(build.audience)}</p><ul><li>主力：${esc(build.mainSkill)}</li><li>操作：${esc(build.difficulty)}</li><li>SSF：${esc(build.reviewedFacts?.ssfNote || (build.ssf === true ? "確認済み" : "未確認"))}</li><li>価格：固定相場を断定しません</li></ul><p><b>序盤の使いやすさ：</b>Lv1〜10は${esc(build.levelingStages[0].mainSkill)}で進めます。</p><p><b>先に知る弱点：</b>${esc(build.weaknesses[0])}</p></div><a class="button" href="${buildUrl(build)}?level=1#roadmap">Lv1〜10の育成を見る</a></article>`).join("");
const starterChoices = `<section class="content-action choice-summary"><h2>迷ったらこの候補</h2><div class="purpose-grid">${[
  choiceCard("初心者", "witch-minion-infernalist", "ミニオンへ攻撃を任せやすく、回避へ集中できます。"),
  choiceCard("弓", "ranger-ice-shot-deadeye", "序盤構成とLv31の主力切替が明確です。"),
  choiceCard("近接・耐久", "warrior-shield-wall-smith", "盾を使い、耐久を意識して進めたい人向けです。"),
  choiceCard("SSF", "witch-minion-infernalist", "原典がSSF向けの序盤からEndgameまでの育成を案内しています。")
].join("")}</div></section>`;
const starterContent = `${starterChoices}<section class="content-action"><h2>選定条件</h2><p>掲載資料でリーグ開始から育成できることを確認できる候補です。高額ユニークへの依存やSSF適性が確認できない場合は、そのまま明記しています。</p></section><div class="starter-list">${starterCards}</div><aside class="next-box"><b>決められない場合</b><p>遠距離・近接・操作・重視項目から4問で候補を絞れます。</p><a class="button" href="/class-check/">4問診断を始める</a></aside><section class="related"><h2>別の基準で選ぶ</h2><div class="related-links"><a href="/best-builds/">目的別おすすめを見る</a><a href="/tier-list/">初心者向けTierを見る</a><a href="/leveling/">現在Lvから育成を見る</a></div></section>`;
await mkdir(resolve(root, "league-starter"), { recursive: true });
await writeFile(resolve(root, "league-starter/index.html"), shell({ title: "PoE2リーグスターター・序盤おすすめビルド", description: "PoE2初心者向けスタータービルドを比較。序盤の使いやすさ、装備依存、SSF、育成切替を確認し、Lv1〜10の手順へ直接進めます。", path: "/league-starter/", current: "starter", kicker: "LEAGUE STARTER", h1: "PoE2リーグスターター・序盤おすすめビルド", intro: "最初のキャラクターで序盤から育成できる、0.5.5対応の候補を比較します。固定価格や未確認の強さは断定しません。", content: starterContent, crumbs: [{ name: "ホーム", path: "/" }, { name: "リーグスターター", path: "/league-starter/" }] }));

const levelingClassOptions = classes.filter((classData) => builds.some((build) => build.classSlug === classData.slug)).map((classData) => `<option value="${esc(classData.slug)}">${esc(classData.name)}</option>`).join("");
const levelingBuildOptions = builds.map((build) => `<option value="${esc(buildUrl(build))}" data-class="${esc(build.classSlug)}">${esc(build.name)}</option>`).join("");
const levelingStages = [["Lv1〜10",1],["Lv11〜20",11],["Lv21〜30",21],["Lv31〜40",31],["Lv41〜65",41],["Lv66〜75",66],["Lv76〜90",76],["Lv91〜100",91]].map(([label, level]) => `<button type="button" data-level="${level}">${label}</button>`).join("");
const levelingBuildCards = builds.map((build) => `<article><p>${esc(build.className)} / ${esc(build.ascendancy)}</p><h3>${esc(build.name)}</h3><p><b>Lv1〜10の主力：</b>${esc(build.levelingStages[0].mainSkill)}</p><span>育成8段階のスキル・装備・切替条件を確認できます。未確認の項目は個別ページに明記しています。</span><a href="${buildUrl(build)}?level=1#now">このビルドをLv1から育てる</a></article>`).join("");
const levelingHelp = `<section aria-labelledby="leveling-steps"><h2 id="leveling-steps">PoE2のレベリングは何から確認する？</h2><p>レベリングは、レベルを上げながらキャラクターの構成を育てることです。このガイドでは、ビルド別に使うスキル・装備・パッシブと、次の構成へ移る条件を確認できます。</p><ol><li><b>現在Lvの「今やること3つ」を読む。</b>まずその段階の優先行動を確認します。</li><li><b>現在段階の詳細を開く。</b>主力、サポート、パッシブ、優先装備、注意点を照合します。</li><li><b>切替条件を確認して次へ進む。</b>Lvだけでなく、Act進行・必要なスキルや装備など、ビルド固有の条件を確認してください。</li></ol><p>経験値効率を実測した狩場ランキングや最速ルートは掲載していません。現在の構成で育成を進めるための手順を案内します。</p></section><section aria-labelledby="leveling-questions"><h2 id="leveling-questions">レベリング中によくある疑問</h2><h3>完成形の主力スキルを序盤から使う？</h3><p>ビルドによって異なります。下の一覧でLv1〜10の主力を確認し、個別ページで切替時期と条件を読んでください。「スキルを使える条件」と「そのビルドで切り替える推奨時期」は同じとは限りません。</p><h3>現在Lvとキャンペーンの進み具合が合わないときは？</h3><p>このナビのLv帯は育成段階を開く目安です。Lvに達しても、キャンペーン終了やMapping到達を意味しません。切替条件を満たしていない場合は、前の段階も開いて現在の構成を確認してください。</p><h3>火力不足や倒されやすさで進めないときは？</h3><p>個別ビルドの「困ったとき」で症状を選ぶと、ビルドとLvに応じた確認項目が出ます。装備の更新で迷う場合は、個別ページから装備診断へ進めます。</p><div class="related-links"><a href="/guides/increase-damage/">火力が出ないときの確認手順</a><a href="/guides/resistance/">耐性の確認方法</a><a href="/guides/mapping/">Mapping開始時の確認項目</a></div><h3>どのパッチの育成手順？</h3><p>対応パッチと育成手順の確認日は各ビルドの冒頭に表示しています。パッチノートの確認日とは区別し、資料や未確認項目は個別ページで確認してください。</p></section>`;
const levelingContent = `<section class="content-action" id="leveling-start"><h2>現在Lvからレベリング手順を探す</h2><p>職業 → ビルド → 現在Lvの順に選びます。たとえばLv37なら、個別ページのLv31〜40と「今やること3つ」を直接開けます。</p><form id="leveling-form" class="leveling-form"><label>職業<select id="leveling-class">${levelingClassOptions}</select></label><label>ビルド<select id="leveling-build">${levelingBuildOptions}</select></label><label>現在Lv<input id="leveling-level" type="number" min="1" max="100" value="1" inputmode="numeric"></label><a id="leveling-cta" class="button" href="/builds/monk/whirling-assault/?level=1#now">現在Lvから今やることを見る</a></form><div class="leveling-stages" aria-label="レベル帯から選ぶ">${levelingStages}</div><p>Lv帯ボタンは入力の補助です。Act進行や主力への切替条件は、個別ページの現在段階で確認してください。</p><p>ビルドが未定なら、<a href="/league-starter/">序盤から育てるスターター候補</a>、職業から選ぶなら<a href="/classes/">おすすめクラス</a>へ進めます。</p></section>${levelingHelp}<section><h2>ビルド別の序盤スキルと育成ガイド</h2><p>同じ職業でも序盤の主力や切替条件は異なります。使っているビルドを選び、Lv1からの手順を確認してください。途中から再開する場合は<a href="#leveling-start">上の現在Lv入力</a>を使えます。</p><div class="seo-build-list">${levelingBuildCards}</div></section><section class="related"><h2>まだビルドが決まっていない場合</h2><div class="related-links"><a href="/classes/">おすすめクラスから選ぶ</a><a href="/beginner-guide/">初心者向けビルドから選ぶ</a><a href="/best-builds/">目的別おすすめから選ぶ</a><a href="/league-starter/">序盤スターターから選ぶ</a></div></section><script type="module" src="/assets/leveling.js?v=20260919-1"></script>`;
await mkdir(resolve(root, "leveling"), { recursive: true });
await writeFile(resolve(root, "leveling/index.html"), shell({ title: "PoE2レベリング・育成ガイド｜現在Lvから次にやること", description: "PoE2のレベリングを職業・ビルド・現在Lvから案内。序盤の主力スキル、装備・パッシブの優先事項、構成の切替条件を確認し、Lv1〜Endgameの「今やること3つ」へ進めます。", path: "/leveling/", current: "", kicker: "LEVELING GUIDE", h1: "PoE2レベリングガイド｜現在Lvから次にやること", intro: "PoE2のレベリングで迷ったら、使っているビルドと現在Lvから育成手順を確認。スキル・装備・パッシブの「今やること」を3つに絞って表示します。", content: levelingContent, crumbs: [{ name: "ホーム", path: "/" }, { name: "レベリング・育成", path: "/leveling/" }] }));

// Source dates belong to the specific claim, not to this page's editing date.
const bestBuilds = buildSearchComparison.candidates;
const candidateSources = candidate => candidate.sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.scope)}</a>（原典確認：<time datetime="${esc(source.checkedAt)}">${esc(source.checkedAt)}</time>）</li>`).join("");
const bestBuildCards = bestBuilds.map(candidate => {
  const { label, id, reason, anchor, stage, conditions, budget } = candidate;
  const build = byId(id);
  const tags = discovery.buildTags?.[id] ?? [];
  return `<article class="purpose-card" id="best-${esc(anchor)}"><p class="section-kicker">${esc(label)}</p><h3>${esc(build.name)}</h3><div class="build-tags" aria-label="特徴">${tags.map((tag) => `<span>${esc(tag)}</span>`).join("")}</div><p><b>選定理由：</b>${esc(reason)}</p><dl class="best-build-conditions"><div><dt>比較する段階</dt><dd>${esc(stage)}</dd></div><div><dt>装備・切替条件</dt><dd>${esc(conditions)}</dd></div><div><dt>予算の確認範囲</dt><dd>${esc(budget)}</dd></div></dl><p><b>注意：</b>${esc(build.weaknesses[0])}</p><p class="fact-source">掲載パッチ：${esc(build.version)} ／ 育成手順の資料確認：${esc(build.updatedAt)}</p><details class="best-build-sources"><summary>この候補の根拠と確認日</summary><ul class="source-list">${candidateSources(candidate)}</ul></details><p><a href="/guides/unique-gear/#${esc(id)}">このビルドのユニーク装備と代替レアを見る</a></p><a class="button" href="${buildUrl(build)}?level=1#now">現在Lvから今やることを見る</a></article>`;
}).join("");
const tierByBuildId = new Map(Object.entries(discovery.tiers).flatMap(([tier, entries]) => entries.map(({ id }) => [id, tier])));
const purposeByBuildId = new Map(builds.map(build => [build.id, bestBuilds.filter(candidate => candidate.id === build.id).map(candidate => candidate.label).join("・")]));
const bestComparisonRows = builds.map((build) => {
  const purpose = purposeByBuildId.get(build.id);
  const tags = discovery.buildTags?.[build.id] ?? [];
  const mapping = purpose === "周回" || tags.includes("周回") ? "周回候補" : "未評価";
  const boss = purpose === "ボス" ? "ボス候補" : "未評価";
  const defence = purpose === "防御重視" || tags.includes("耐久重視") ? "防御候補" : "未評価";
  const starter = build.reviewedFacts?.ssfNote || (build.ssf === true ? "掲載資料でSSF確認済み（詳細で段階を確認）" : build.ssf === false ? "非対応" : "未確認");
  return `<tr><th scope="row"><a href="${buildUrl(build)}?level=1#now">${esc(build.name)}</a><small>${esc(build.ascendancy)}</small><a class="comparison-cta" href="${buildUrl(build)}?level=1#now">現在Lvから育成を見る</a></th><td data-label="職業">${esc(build.className)}</td><td data-label="総合用途">${esc(purpose ? `${purpose}候補` : "育成手順掲載")}</td><td data-label="マッピング">${mapping}</td><td data-label="ボス">${boss}</td><td data-label="初心者">初心者Tier ${esc(tierByBuildId.get(build.id) ?? "未評価")}</td><td data-label="SSFの確認範囲">${starter}</td><td data-label="防御">${defence}</td><td data-label="操作">${esc(build.difficulty)}</td></tr>`;
}).join("");
const bestComparison = `<section id="best-comparison" aria-labelledby="best-compare-title"><h2 id="best-compare-title">掲載ビルドの確認済み特徴を比較</h2><p>星や推測点数は使わず、現在の掲載資料にある用途・初心者Tier・SSF・操作条件だけを並べます。「未評価」は弱いという意味ではなく、同じ条件で比較できる資料がない項目です。SSFは予算の安さを示す評価ではありません。</p><div class="comparison-scroll" tabindex="0" aria-label="掲載ビルド比較表。横にスクロールできます"><table class="comparison-table"><thead><tr><th>ビルド</th><th>職業</th><th>総合用途</th><th>マッピング</th><th>ボス</th><th>初心者</th><th>SSFの確認範囲</th><th>防御</th><th>操作</th></tr></thead><tbody>${bestComparisonRows}</tbody></table></div><p class="comparison-note"><b>高投資時の伸び代：</b>全ビルドを同じ装備予算・同じ条件で比較できる資料がないため、現在は順位を付けていません。</p></section>`;
const bestAnswer = `<section id="best-answer" class="content-action"><h2>結論：目的別のおすすめ候補</h2><p>PoE2の最強ビルドを探すなら、掲載候補では周回に<a href="#best-mapping">アイスショット・デッドアイ</a>、Endgameのボス戦に<a href="#best-bossing">ワーリングアサルト</a>、防御を重視した序盤に<a href="#best-defense">シールドウォール・スミス</a>を比較します。初心者・SSFは<a href="#best-beginner">ミニオン・インファーナリスト</a>、通常周回の操作量を減らすなら<a href="#best-simple-controls">植物オラクル</a>が候補です。</p><p>同じ予算・装備・育成段階での実測順位ではありません。${esc(discovery.patchVersion)}向けの掲載資料から、得意な用途と成立条件を分けて選んでいます。</p><p class="fact-source">比較ページ編集：<time datetime="${esc(buildSearchComparison.editedAt)}">${esc(buildSearchComparison.editedAt)}</time>。原典の文章確認日を候補ごとに記載し、ゲーム内の実測日とは区別しています。<a href="${esc(discovery.latestPatchSource)}" target="_blank" rel="noopener noreferrer">公式パッチノート確認：${esc(discovery.latestPatch)}（${esc(discovery.latestPatchCheckedAt)}）</a>は、全ビルドの再検証日ではありません。</p></section>`;
const bestBudget = `<section id="best-budget"><h2>低予算・SSF・高投資で選び方はどう変わる？</h2><ul><li><b>低予算：</b>購入する装備の価格と、狙う育成段階を確認します。植物オラクルは低予算構成、シールドウォールはマップ序盤の装備を整えやすいという資料がありますが、必要通貨額は未検証です。</li><li><b>SSF：</b>取引を使わずに必要装備を揃える条件を確認します。掲載するThyworm版ミニオンはSSF向けの育成資料があります。アイスショットはMapping序盤の範囲に限られ、同じ意味ではありません。</li><li><b>高投資：</b>完成形で使う装備・スキル・パッシブを一式で確認します。同じ予算でのDPS・攻略速度の比較資料がないため、高投資の最強順位は未検証です。</li></ul><p>ユニーク装備は、採用する構成の必須条件か任意の強化かを分けます。<a href="/guides/unique-gear/">ビルド別ユニーク装備の用途・条件・代替レア</a>を確認し、必要な耐性や能力値が崩れないか見てください。</p></section>`;
const bestContent = `${bestAnswer}<nav class="section-cta" aria-label="目的別ビルド比較の目次"><a class="button-secondary" href="#best-candidates">目的別候補と条件</a><a class="button-secondary" href="#best-budget">低予算・SSF・高投資</a><a class="button-secondary" href="#best-comparison">全${builds.length}ビルドを比較</a></nav><section id="best-candidates" aria-labelledby="best-candidates-title"><h2 id="best-candidates-title">目的別候補の強み・装備条件・注意点</h2><div class="purpose-grid">${bestBuildCards}</div></section>${bestBudget}${bestComparison}<section><h2>Tier・リーグスターターとの違い</h2><div class="pros-cons"><section class="info-card"><h3>初心者向けTier</h3><p>Lv1からの育てやすさ、操作、構成切替、資料確認状況を重視します。戦闘力の総合順位ではありません。</p><a href="/tier-list/">初心者向けTierを見る</a></section><section class="info-card"><h3>リーグスターター</h3><p>資産が少ない序盤から育成できるか、装備依存やSSF情報を重視します。</p><a href="/league-starter/">リーグスターターを見る</a></section></div></section><section id="best-faq"><h2>最強ビルド選びでよくある質問</h2><h3>初心者でも最強ビルドを選べば楽に進める？</h3><p>完成形が強くても、序盤のスキルや装備が揃う前の操作感は異なります。主力の解禁Lvと構成の切替条件を先に見て、<a href="/beginner-builds/">初心者向けの候補</a>から続けやすい戦い方を選んでください。</p><h3>最強ビルドはパッチが変わっても同じ？</h3><p>同じとは限りません。各候補の掲載パッチと資料確認日を確認してください。公式パッチノートを確認しただけでは、すべてのビルドを再検証したことにはなりません。</p><h3>全ビルドを職業から探すには？</h3><p><a href="/">PoE2ビルドの総合案内</a>から職業を選ぶか、<a href="/builds/">掲載ビルド一覧</a>でスキル・操作・育成条件を比較できます。</p></section><section id="best-methodology"><h2>選定と更新の方針</h2><ul><li>掲載中かつLv1〜Endgameの主要情報を確認できたビルドだけを対象にします。</li><li>同条件の実測DPS順位は作らず、既存資料で確認できる用途・操作・装備条件を使います。</li><li>原典の作者・育成段階・装備条件が違う記述を、同じ構成の性能として合算しません。</li><li>パッチ変更時は公式ノートと各ビルドの段階別資料を再確認します。</li></ul><p>比較の編集：オカピ研究所。<a href="/editorial-policy/">編集方針と情報確認方法を見る</a></p></section><section class="related"><h2>ビルドを決めた後</h2><div class="related-links"><a href="/leveling/">別のビルド・現在Lvから探す</a><a href="/classes/">職業から選び直す</a><a href="/builds/">掲載中の全ビルドを見る</a></div></section>`;
const bestEvidence = `<section aria-labelledby="best-evidence-title"><h2 id="best-evidence-title">PoE2で最強のビルドは？比較の根拠</h2><p>当サイトの用途別候補は掲載資料に基づく編集上の案内です。各候補の「この候補の根拠と確認日」から、主張に対応する原典へ進めます。ゲーム内で同じ予算・同じ装備条件を揃えた実測順位ではありません。</p><p>個別ビルドには段階別の手順と出典を掲載しています。比較後は現在Lvを入力し、次にやることを3つ確認してください。</p></section>`;
const bestTitle = `PoE2 最強ビルド｜${discovery.patchVersion}最新・周回・ボス・予算別おすすめ比較`;
const bestDescription = `PoE2の最強ビルドを目的別に選ぶ比較ガイド。掲載${builds.length}ビルドから周回・ボス・防御・初心者の候補を案内し、育成段階、装備条件、低予算とSSFの違い、原典と確認日を掲載。対応${discovery.patchVersion}。`;
const bestPath = "/best-builds/";
const uniqueCandidates = [...new Set(bestBuilds.map(candidate => candidate.id))].map(byId);
const bestSchema = {
  "@context": "https://schema.org", "@type": "CollectionPage", "@id": `${absolute(bestPath)}#webpage`,
  url: absolute(bestPath), name: bestTitle, description: bestDescription, inLanguage: "ja",
  mainEntity: { "@type": "ItemList", name: "用途別のおすすめビルド候補（順位ではありません）", itemListOrder: "https://schema.org/ItemListUnordered", numberOfItems: uniqueCandidates.length, itemListElement: uniqueCandidates.map(build => ({"@type": "ListItem", name: build.name, url: absolute(buildUrl(build))})) }
};
await mkdir(resolve(root, "best-builds"), { recursive: true });
const bestPage = shell({ title: bestTitle, description: bestDescription, path: bestPath, current: "", kicker: "BEST BUILDS BY PURPOSE", h1: `PoE2 最強ビルド｜${discovery.patchVersion}の目的別おすすめ比較`, intro: "周回・ボス・防御の候補を、装備・予算・育成段階の条件と一緒に比較できます。", content: bestContent + bestEvidence, crumbs: [{ name: "ホーム", path: "/" }, { name: "目的別おすすめビルド", path: bestPath }], assetVersion: "discovery-4" });
await writeFile(resolve(root, "best-builds/index.html"), bestPage.replace("</head>", `<link rel="stylesheet" href="/assets/build-search.css"><script type="application/ld+json">${JSON.stringify(bestSchema).replaceAll("<", "\\u003c")}</script></head>`));


const one = discovery.poe2One;
const oneBeginnerIds = ["witch-minion-infernalist", "ranger-ice-shot-deadeye", "warrior-shield-wall-smith", "druid-plant-oracle"];
const oneBeginnerCards = oneBeginnerIds.map((id) => {
  const build = byId(id);
  return compactBuildCard(build, "0.5.5の育成手順を見る", discovery.buildTags?.[id] ?? []);
}).join("");
const oneContent = `<section class="content-action"><h2>結論：PoE2 1.0は2026年12月11日（PST）公開予定</h2><ul>${one.confirmed.map((item) => `<li>${esc(item)}</li>`).join("")}</ul><p>日付・無料化・Duelistは公式発表で確認済みです。1.0環境のビルド性能はまだ確定していません。</p></section><section><h2>正式リリース日はいつ？</h2><p>公式発表では、Path of Exile 2の正式版1.0は2026年12月11日（PST）に公開予定です。</p><a class="button-secondary" href="/poe2-1-0/release-date/">公開予定日を詳しく見る</a></section><section><h2>正式版は無料で遊べる？</h2><p>公式発表では、正式版1.0は基本プレイ無料のアクションRPGとして公開予定です。対応機種（PC・PS5・Xbox Series）や入手先、クロスプレイは始め方のページで確認できます。</p><div class="section-cta"><a class="button-secondary" href="/poe2-1-0/how-to-start/">無料化後の始め方を見る</a><a class="button-secondary" href="/poe2-1-0/system-requirements/">必要スペックを見る</a><a class="button-secondary" href="/poe2-1-0/japanese/">日本語対応を見る</a><a class="button-secondary" href="/poe2-1-0/microtransactions/">課金はどれを買う？</a><a class="button-secondary" href="/poe2-1-0/controller/">コントローラー対応を見る</a><a class="button-secondary" href="/poe2-1-0/pre-registration/">事前登録のやり方と報酬</a></div><p><a href="${esc(one.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(one.sourceName)}の正式版発表</a>（確認：${esc(one.checkedAt)}）</p></section><section><h2>ExileCon 2026（11月7〜8日）</h2><p>公式は、ExileCon 2026を11月7〜8日（ニュージーランド時間）にオークランドで開催し、大型発表を行うと案内しています。発表内容は公式情報で確認してから、このページと各ページに反映します。</p><p><a href="https://store.steampowered.com/news/app/2694490/view/523114848066732372" target="_blank" rel="noopener noreferrer">Steamニュース（公式）：ExileCon 2026</a>（確認：2026-09-28）</p></section><section><h2>Early Accessから何が変わる？</h2><p>現時点で公式に確認できる変更は、正式版1.0への移行、基本プレイ無料での公開、Duelistの追加です。キャンペーン、スキル数値、既存ビルドの強弱など、公式発表で確定していない内容はここでは断定しません。</p></section><section><h2>新職業Duelistの公式情報</h2><p>Duelistは正式版1.0で追加予定です。スキル・アセンダンシー・既存ビルドへの影響は、正式なパッチノートと段階別資料を確認できるまで推測で掲載しません。</p><div class="section-cta"><a class="button-secondary" href="/poe2-1-0/duelist/">Duelistの確認済み情報</a><a class="button-secondary" href="${esc(one.duelistSourceUrl)}" target="_blank" rel="noopener noreferrer">Duelistの公式発表</a></div></section><section class="content-action"><h2>初心者は何を選べばいい？</h2><p>1.0向けの最強ビルドはまだ選べません。今プレイする場合は、0.5.5で育成手順を確認済みの候補から、遠距離・召喚・耐久・操作量で選んでください。正式版公開後に再確認できたものだけ1.0対応へ切り替えます。</p><div class="section-cta"><a class="button" href="/best-builds/">0.5.5の目的別候補を見る</a><a class="button-secondary" href="/class-check/">4問で職業を絞る</a></div></section><section><h2>1.0を待たず、今から始めてもいい？</h2><p>現行0.5.5を遊びながら基本操作や育成の流れを知りたい場合は、今から始められます。ただし、現在のビルド性能や装備条件が1.0でも同じとは限りません。1.0用のビルドを決め打ちしたい場合は、正式なパッチノートと再確認済みガイドを待ってください。</p></section><section><h2>1.0までに覚えておきたいこと</h2><div class="tool-grid"><a class="tool-card" href="/beginner-guide/"><span>SKILL</span><strong>スキルと育成の基本</strong><p>ビルドを選び、現在Lvの手順へ進む流れを確認します。</p></a><a class="tool-card" href="/guides/gear-upgrade/"><span>GEAR</span><strong>装備更新</strong><p>今の困りごとから交換候補を絞ります。</p></a><a class="tool-card" href="/guides/passive-tree/"><span>PASSIVE</span><strong>パッシブ</strong><p>育成段階に合う原典の確認方法を見ます。</p></a><a class="tool-card" href="/guides/resistance/"><span>DEFENCE</span><strong>耐性</strong><p>死にやすいときの確認順を整理します。</p></a><a class="tool-card" href="/guides/mapping/"><span>ENDGAME</span><strong>Mapping・Endgame</strong><p>キャンペーン後に確認する項目へ進みます。</p></a></div></section><section><h2>現在選べる初心者向けビルド</h2><p>以下は1.0予想ではなく、現行0.5.5でLv1〜Endgameの主要情報を確認済みの候補です。</p><div class="discovery-grid">${oneBeginnerCards}</div></section><section class="content-action"><h2>1.0公開前に断定しない情報</h2><ul>${one.unconfirmed.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section><section id="one-build-impact"><h2>現在の0.5.5ビルドへの影響</h2><p>掲載中の${builds.length}ビルドは0.5.5向けです。1.0向けに再確認済みのビルドはまだありません。公式パッチノートと段階別資料を確認するまで、0.5.5の手順を1.0対応とは表示しません。</p><a class="button-secondary" href="/poe2-1-0/build-status/">ビルドごとの1.0対応状況を見る</a></section><section><h2>よくある質問</h2><details><summary>PoE2 1.0はいつ？</summary><p>2026年12月11日（PST）に公開予定です。</p></details><details><summary>正式版は無料？</summary><p>公式発表では、1.0は基本プレイ無料で公開予定です。</p></details><details><summary>0.5.5のビルドを1.0でもそのまま使える？</summary><p>まだ確認できません。正式な変更内容と段階別資料を確認してから更新します。</p></details></section><section><h2>更新履歴</h2><ul><li>2026-09-25：初心者向け判断、今から始める場合の注意、基礎ガイド、現行ビルド導線を追加</li><li>2026-09-24：検索意図を整理し、確定情報・未確定情報・FAQを分離</li><li>2026-09-23：正式版・基本プレイ無料化・Duelistの公式情報を更新</li></ul></section><section><h2>1.0公開後の更新方針</h2><p>公式パッチノート、スキル変更、アセンダンシー、段階別の書面ガイドを再確認してから、Tier・リーグスターター・各ビルドの対応版を更新します。公開前の予想を最強ランキングとして掲載しません。</p></section>`;
const oneNextActions = `<section class="content-action"><h2>1.0から始める人が今やること</h2><ol><li><b>戦い方を決める：</b>近接・遠距離・スペル・ミニオンから、続けたい操作感を選ぶ。</li><li><b>現行環境で試す：</b>0.5.5の確認済みビルドで基本操作と育成の流れを体験する。</li><li><b>基本を覚える：</b>スキル・装備・耐性・パッシブの更新順を確認する。</li><li><b>1.0公開後に選び直す：</b>正式パッチノートと再確認済みビルドが公開されてから、1.0用ビルドを決める。</li></ol><p>1.0向けの最強ビルドはまだ確定していません。現時点では0.5.5の確認済み情報だけを使います。</p><div class="section-cta"><a class="button" href="/beginner-guide/">初心者向けビルドを見る</a><a class="button-secondary" href="/best-builds/">今使えるおすすめビルドを見る</a><a class="button-secondary" href="/league-starter/">リーグスターターを見る</a></div></section>`;
const oneContentWithActions = oneContent
  .replace(/<section class="content-action"><h2>初心者は何を選べばいい？<\/h2>[\s\S]*?<\/section>(?=<section><h2>1\.0を待たず)/, oneNextActions)
  .replace("<section><h2>更新履歴</h2><ul>", "<section><h2>更新履歴</h2><ul><li>2026-09-26：1.0から始める人向けの4段階アクションと主要導線を追加</li>");
await mkdir(resolve(root, "poe2-1-0"), { recursive: true });
await writeFile(resolve(root, "poe2-1-0/index.html"), shell({ title: "PoE2 1.0はいつ？2026年12月11日（PST）正式リリース・無料化", description: "PoE2 1.0は2026年12月11日（PST）正式リリース予定。基本プレイ無料化、Duelist、現行0.5.5ビルドとの違いを公式情報だけで整理します。", path: "/poe2-1-0/", current: "", kicker: "PATH OF EXILE 2 / VERSION 1.0", h1: "PoE2 1.0はいつ？正式リリース・無料化の確定情報", intro: "2026年12月11日（PST）の正式版・基本プレイ無料化に向け、確定情報と未確定のビルド情報を分けて更新します。", content: oneContentWithActions, crumbs: [{ name: "ホーム", path: "/" }, { name: "PoE2 1.0", path: "/poe2-1-0/" }], statusLabel: "現在掲載ビルド" }));

const noteRows = [
  ["PoE2 最強・おすすめビルド", "/best-builds/", "best_builds"],
  ["PoE2 初心者向けTier", "/tier-list/", "poe2_tier"],
  ["PoE2 初心者おすすめ", "/beginner-guide/", "beginner_build"],
  ["PoE2 リーグスターター", "/league-starter/", "league_starter"],
  ["PoE2 1.0", "/poe2-1-0/", "poe2_1_0"],
  ["PoE2 0.5.5ビルド", "/guides/poe2-0-5-5-builds/", "poe2_0_5_5"],
  ["PoE2 Forbidden Rites初心者", "/guides/forbidden-rites-beginner/", "forbidden_rites_beginner"],
  ["PoE2 火力が出ない", "/guides/increase-damage/", "low_damage"],
  ["PoE2 すぐ死ぬ", "/guides/why-i-die/", "dying_too_much"],
  ["PoE2 装備更新", "/guides/gear-upgrade/", "gear_upgrade"],
  ["PoE2 マナ不足", "/guides/mana-problem/", "mana_problem"],
  ["PoE2 ボスに勝てない", "/guides/cant-beat-boss/", "cant_beat_boss"],
  ["PoE2 周回が遅い", "/guides/slow-mapping/", "slow_mapping"],
  ["PoE2 Mapping初心者", "/guides/mapping/", "mapping_beginner"],
  ["PoE2 パッシブの振り方", "/guides/passive-tree/", "passive_tree"],
  ["PoE2 耐性・すぐ死ぬ", "/guides/resistance/", "resistance"],
  ["PoE2 1.0 公開日", "/poe2-1-0/release-date/", "poe2_1_0_release"],
  ["PoE2 始め方・無料化", "/poe2-1-0/how-to-start/", "poe2_how_to_start"],
  ["PoE2 必要スペック", "/poe2-1-0/system-requirements/", "poe2_system_requirements"],
  ["PoE2 日本語対応", "/poe2-1-0/japanese/", "poe2_japanese"],
  ["PoE2 課金・スタッシュタブ", "/poe2-1-0/microtransactions/", "poe2_microtransactions"],
  ["PoE2 コントローラー", "/poe2-1-0/controller/", "poe2_controller"],
  ["PoE2 事前登録", "/poe2-1-0/pre-registration/", "poe2_pre_registration"],
  ["PoE2 1.0ビルド対応状況", "/poe2-1-0/build-status/", "poe2_1_0_build_status"],
  ["PoE2 Duelist", "/poe2-1-0/duelist/", "poe2_duelist"],
  ...builds.map((build) => [build.name, buildUrl(build), build.id])
];
const publishedNoteRows = [
  ["Spirit Walker（ハントレス）ツイスタービルド完全ガイド", "https://note.com/fresh_okapi3816/n/nbe96101eda53", "/builds/huntress/twister-spirit-walker/", "huntress_twister_spirit_walker"],
  ["グレネード・ジェムリング解説", "https://note.com/fresh_okapi3816/n/nfd9d6bfbb0d8", "/builds/mercenary/grenade-gemling/", "mercenary_grenade_gemling"],
  ["0.5.5 Tier比較", "https://note.com/fresh_okapi3816/n/n5c499efd7391", "/tier-list/", "poe2_tier_055"],
  ["1.0正式版の速報", "https://note.com/fresh_okapi3816/n/n8e50e45e6c73", "/poe2-1-0/", "poe2_1_0_news"],
  ["1.0無料化・初心者向けクラス", "https://note.com/fresh_okapi3816/n/ne5263724eb0f", "/classes/", "poe2_1_0_beginner_classes"],
  ["0.5.5レベリング効率化", "https://note.com/fresh_okapi3816/n/nf6f8c2db6ed1", "/leveling/", "leveling_055"],
  ["装備の優先順位", "https://note.com/fresh_okapi3816/n/n63f105b8740d", "/guides/gear-upgrade/", "gear_priority"],
  ["マッピング最強ビルド3選", "https://note.com/fresh_okapi3816/n/nbd2ce44d8585", "/best-builds/", "mapping_best_builds"],
  ["低予算ビルド3選", "https://note.com/fresh_okapi3816/n/n09f92db3dc1a", "/best-builds/", "budget_best_builds"],
  ["ボスで詰まった時に見直す5項目", "https://note.com/fresh_okapi3816/n/nb6f6a2709e4a", "/guides/cant-beat-boss/", "cant_beat_boss"]
];
const noteMap = `# note / X → POE2ビルドナビ 送客対応表\n\n同じ本文を転載せず、noteでは特徴・選び方を説明し、サイトではLv1からの手順と現在Lv入力を提供します。トップではなく、投稿テーマに一致するURLへ直接送ります。\n\n## 公開済みnote記事からの優先リンク\n\n| note記事 | 記事URL | 最適なリンク先 | 計測用URL |\n|---|---|---|---|\n${publishedNoteRows.map(([theme, noteUrl, path, campaign]) => `| ${theme} | ${noteUrl} | ${path} | ${absolute(path)}?utm_source=note&utm_medium=referral&utm_campaign=${campaign} |`).join("\n")}\n\n## 公開済み記事の修正候補\n\n| 記事 | 残存箇所 | 差し替え先 |\n|---|---|---|\n| [1.0無料化・初心者向けクラス](https://note.com/fresh_okapi3816/n/ne5263724eb0f) | 「Ice Shot Deadeye 完全ロードマップ」の未設定URL | ${absolute("/builds/ranger/ice-shot-deadeye/")}?utm_source=note&utm_medium=referral&utm_campaign=poe2_1_0_ice_shot |\n| 同上 | 「Spirit Walker（ハントレス）ツイスター完全ガイド」の未設定URL | ${absolute("/builds/huntress/twister-spirit-walker/")}?utm_source=note&utm_medium=referral&utm_campaign=poe2_1_0_spirit_walker |\n| 同上 | 「ミニオン系初心者ビルドの選び方」の未設定URL | ${absolute("/builds/witch/minion-infernalist/")}?utm_source=note&utm_medium=referral&utm_campaign=poe2_1_0_minion |\n\n今回の公開検索で確認できたPoE2記事には、「有料記事」と誤解させる表記は見つかりませんでした。上の未設定URLは誤解や離脱につながるため、note側で差し替えが必要です。\n\nウィッチハンター比較・ストームウィーバー比較は、単一の育成手順と一致する個別ビルドがまだないため、無関係な個別ページへは送りません。\n\n## 投稿テーマ別リンク\n\n| 投稿テーマ | リンク先 | note用UTMリンク | X用UTMリンク |\n|---|---|---|---|\n${noteRows.map(([theme, path, campaign]) => `| ${theme} | ${path} | ${absolute(path)}?utm_source=note&utm_medium=referral&utm_campaign=${campaign} | ${absolute(path)}?utm_source=x&utm_medium=social&utm_campaign=${campaign} |`).join("\n")}\n\nCTA例：\n\n- Lv1から完成までの育成手順はこちら\n- 現在Lvから次にやることを見る\n- 装備・スキル・パッシブまでまとめて確認\n`;
await writeFile(resolve(root, "NOTE_CONTENT_MAP.md"), noteMap);

console.log("Generated discovery landing pages and note mapping.");
