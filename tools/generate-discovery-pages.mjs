import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const [allBuilds, classes, discovery] = await Promise.all([
  readJson("data/builds.json"),
  readJson("data/classes.json"),
  readJson("data/discovery.json")
]);
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

function head({ title, description, path, type = "article", crumbs }) {
  const url = absolute(path);
  return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="google-adsense-account" content="${publisher}"><link rel="canonical" href="${url}"><meta property="og:type" content="${type}"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="POE2ビルドナビ"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary"><link rel="stylesheet" href="/assets/styles.css?v=discovery-2"><link rel="stylesheet" href="/assets/mobile.css?v=discovery-2"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}" crossorigin="anonymous"></script><script type="application/ld+json">${breadcrumb(crumbs)}</script>`;
}

function shell({ title, description, path, current, kicker, h1, intro, content, crumbs, statusLabel = "対応環境" }) {
  return `<!doctype html><html lang="ja"><head>${head({ title, description, path, crumbs })}</head><body><a class="skip-link" href="#main">本文へ移動</a>${header(current)}<main id="main" class="page-main"><nav class="breadcrumbs" aria-label="パンくず"><ol>${crumbs.map((item, index) => `<li>${index === crumbs.length - 1 ? esc(item.name) : `<a href="${item.path}">${esc(item.name)}</a>`}</li>`).join("")}</ol></nav><section class="page-hero discovery-hero"><p class="section-kicker">${esc(kicker)}</p><h1>${esc(h1)}</h1><p>${esc(intro)}</p><div class="update-strip"><span>${esc(statusLabel)}：${esc(discovery.patchVersion)}</span><span><a href="${esc(discovery.latestPatchSource)}" target="_blank" rel="noopener noreferrer">最新確認：${esc(discovery.latestPatch)}</a></span><span>最終確認：${esc(discovery.latestPatchCheckedAt)}</span></div></section><article class="article-page discovery-page">${content}</article></main></body></html>`;
}

function compactBuildCard(build, label = "ビルド詳細を見る", tags = []) {
  const ssf = build.ssf === true ? "確認済み" : build.ssf === false ? "非対応" : "未確認";
  const tagsHtml = tags.length ? `<div class="build-tags" aria-label="用途">${tags.map((tag) => `<span>${esc(tag)}</span>`).join("")}</div>` : "";
  return `<article class="discovery-card"><p class="build-meta">${esc(build.className)} / ${esc(build.ascendancy)}</p><h3>${esc(build.name)}</h3>${tagsHtml}<p><b>おすすめ：</b>${esc(build.audience)}</p><p><b>弱点：</b>${esc(build.weaknesses?.[0])}</p><dl><div><dt>主力</dt><dd>${esc(build.mainSkill)}</dd></div><div><dt>操作</dt><dd>${esc(build.difficulty)}</dd></div><div><dt>SSF</dt><dd>${ssf}</dd></div><div><dt>対応</dt><dd>${esc(build.version)}・${esc(build.updatedAt)}</dd></div></dl><a class="button" href="${buildUrl(build)}">${esc(label)}</a></article>`;
}

function choiceCard(label, buildId, reason, cta = "このビルドを確認する") {
  const build = byId(buildId);
  return `<article class="purpose-card"><p class="section-kicker">${esc(label)}</p><h3>${esc(build.name)}</h3><p>${esc(reason)}</p><a class="button" href="${buildUrl(build)}">${esc(cta)}</a></article>`;
}

const featured = discovery.featuredBuildIds.map(byId);
const featuredHtml = `<section id="featured-builds" class="section featured-builds" aria-labelledby="featured-title"><div class="section-head"><p class="section-kicker">BEGINNER PICKS / 詳細比較</p><h2 id="featured-title">初心者におすすめのビルド</h2><p><b>詳細比較用：</b>おすすめ理由・弱点・操作・SSFを見比べてから選べます。</p></div><div class="discovery-grid">${featured.map((build) => compactBuildCard(build, undefined, discovery.featuredBuildTags?.[build.id] ?? [])).join("")}</div><div class="section-cta"><a class="button" href="/builds/">全10ビルドを見る</a><a class="button-secondary" href="/tier-list/">目的別Tierを見る</a><a class="button-secondary" href="/league-starter/">リーグスターターを見る</a></div></section>`;
const topChoices = `<section id="purpose-picks" class="section section-soft" aria-labelledby="purpose-picks-title"><div class="section-head"><p class="section-kicker">QUICK ANSWER / 即決</p><h2 id="purpose-picks-title">迷ったらこの4つ</h2><p><b>即決用：</b>最強1位ではなく、遊び方と育成条件から候補をすぐ選べます。</p></div><div class="purpose-grid">${[
  choiceCard("初心者・安全重視", "witch-minion-infernalist", "ミニオンに攻撃を任せやすく、自分は回避と位置取りへ集中できます。"),
  choiceCard("弓で遊びたい", "ranger-ice-shot-deadeye", "Lv31からアイスショットへ切り替える時期と、序盤の育成手順が明確です。"),
  choiceCard("近接で遊びたい", "monk-whirling-assault", "移動しながら攻撃でき、Lv41の主力切替まで段階別に確認できます。"),
  choiceCard("SSF・必須ユニークなし", "witch-ed-contagion-lich", "SSFで成立し、必須ユニークを必要としないことを確認済みです。")
].join("")}</div><div class="section-cta"><a class="button-secondary" href="/best-builds/">目的別おすすめを見る</a><a class="button-secondary" href="/tier-list/">初心者Tierで比較する</a><a class="button-secondary" href="/league-starter/">リーグスターターを見る</a></div></section>`;

let home = await readFile(resolve(root, "index.html"), "utf8");
home = home.replace(/<section id="featured-builds"[\s\S]*?<\/section>/g, "");
home = home
  .replace(/<title>.*?<\/title>/, "<title>PoE2 ビルド｜0.5.5おすすめ・初心者向け日本語育成ナビ</title>")
  .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="PoE2 0.5.5対応の日本語ビルドサイト。初心者向けおすすめビルドを比較し、現在Lvからスキル・装備・パッシブの「今やること」を3つ確認できます。">')
  .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="PoE2 ビルド｜0.5.5おすすめ・初心者向け日本語育成ナビ">')
  .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="PoE2 0.5.5対応の日本語ビルドサイト。初心者向けビルドを目的別に比較し、現在Lvから今やること3つを確認できます。">')
  .replace(/<section class="hero(?: hero-focused)?"[\s\S]*?<\/section>\s*(?:<section id="purpose-picks"[\s\S]*?<\/section>\s*)?(?:<section id="featured-builds"[\s\S]*?<\/section>\s*)?<section id="choose-class"/, `<section class="hero hero-focused" aria-labelledby="hero-title"><div><p class="eyebrow">PATH OF EXILE 2 / JAPANESE BUILD GUIDE</p><h1 id="hero-title">PoE2 0.5.5 初心者向けおすすめビルド</h1><p class="lead">目的別にビルドを選び、現在Lvを入力すると、スキル・装備・パッシブの「今やること」を3つ表示します。</p><div class="journey-steps" aria-label="使い方"><span><b>1</b>おすすめを選ぶ</span><span><b>2</b>ビルドを開く</span><span><b>3</b>現在Lvを入力</span><span><b>4</b>今やること3つ</span></div><div class="hero-actions"><a class="button" href="#purpose-picks">迷ったらこの4つ</a><a class="button-secondary" href="#choose-class">職業から選ぶ</a></div><div class="status-note">対応環境 <span id="site-version">${esc(discovery.patchVersion)}</span>・<a href="${esc(discovery.latestPatchSource)}" target="_blank" rel="noopener noreferrer">最新確認 ${esc(discovery.latestPatch)}</a>・最終確認 <span id="last-updated">${esc(discovery.latestPatchCheckedAt)}</span></div></div></section>${topChoices}<section id="choose-class"`)
  .replace("<h2 id=\"classes-title\">まず職業を選んでください</h2>", "<h2 id=\"classes-title\">職業から探す</h2>")
  .replace(/<p>おすすめを見ても決められない場合は、好きな戦い方から職業を選べます。<\/p>|<p>ビルド名が分からなくても大丈夫です。好きな戦い方から職業を選べます。<\/p>/, "<p>好きな戦い方から職業を選び、掲載ビルドへ進めます。</p>")
  .replace(/(<section id="quick-start"[\s\S]*?<\/section>)/, `$1${featuredHtml}`)
  .replace(/(<a id="quick-link"[^>]*>)[^<]*(<\/a>)/, "$1現在Lvから今やることを見る$2")
  .replace(/<section class="section section-soft" aria-labelledby="quality-title">[\s\S]*?<\/section>/, `<section class="section section-soft" aria-labelledby="quality-title"><div class="section-head"><p class="section-kicker">SEARCH GUIDES</p><h2 id="quality-title">目的から探す</h2><p>検索した目的から、ビルド詳細のLv入力まで迷わず進めます。</p></div><div class="tool-grid"><a class="tool-card" href="/beginner-guide/"><span>BEGINNER</span><strong>初心者向けビルド</strong><p>戦い方別の候補から最初の1体を選びます。</p></a><a class="tool-card" href="/classes/"><span>CLASS</span><strong>おすすめクラスを選ぶ</strong><p>遠距離・召喚・近接・耐久から職業を選びます。</p></a><a class="tool-card" href="/leveling/"><span>LEVELING</span><strong>現在Lvから育成を見る</strong><p>職業とビルドを選び、今やること3つへ進みます。</p></a><a class="tool-card" href="/league-starter/"><span>EARLY GAME</span><strong>序盤おすすめビルド</strong><p>序盤の育てやすさからスターターを比較します。</p></a><a class="tool-card" href="/tier-list/"><span>TIER</span><strong>初心者Tierで比較</strong><p>育てやすさと操作条件で候補を絞ります。</p></a><a class="tool-card" href="/best-builds/"><span>BEST BY PURPOSE</span><strong>目的別おすすめビルド</strong><p>周回・ボス・防御・操作から候補を選びます。</p></a><a class="tool-card" href="/poe2-1-0/"><span>VERSION 1.0</span><strong>正式版・無料化情報</strong><p>確定情報と未確定情報を分けて確認します。</p></a><a class="tool-card" href="/builds/"><span>ALL BUILDS</span><strong>掲載ビルド一覧</strong><p>確認済みの10ビルドを職業と名前で探します。</p></a></div></section>`);
await writeFile(resolve(root, "index.html"), home);

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

const starterCards = builds.filter((build) => build.leagueStarter).map((build) => `<article class="starter-card"><div><p class="build-meta">${esc(build.className)} / ${esc(build.ascendancy)}</p><h2>${esc(build.name)}</h2><p>${esc(build.audience)}</p><ul><li>主力：${esc(build.mainSkill)}</li><li>操作：${esc(build.difficulty)}</li><li>${build.ssf === true ? "SSF対応の根拠を確認済み" : "SSF適性は確認中"}</li><li>価格：固定相場を断定しません</li></ul><p><b>序盤の使いやすさ：</b>Lv1〜10は${esc(build.levelingStages[0].mainSkill)}で進めます。</p><p><b>先に知る弱点：</b>${esc(build.weaknesses[0])}</p></div><a class="button" href="${buildUrl(build)}?level=1#roadmap">Lv1〜10の育成を見る</a></article>`).join("");
const starterChoices = `<section class="content-action choice-summary"><h2>迷ったらこの候補</h2><div class="purpose-grid">${[
  choiceCard("初心者", "witch-minion-infernalist", "ミニオンへ攻撃を任せやすく、回避へ集中できます。"),
  choiceCard("弓", "ranger-ice-shot-deadeye", "序盤構成とLv31の主力切替が明確です。"),
  choiceCard("近接・耐久", "warrior-shield-wall-smith", "盾を使い、耐久を意識して進めたい人向けです。"),
  choiceCard("SSF", "witch-ed-contagion-lich", "SSF成立と必須ユニークなしを確認済みです。")
].join("")}</div></section>`;
const starterContent = `${starterChoices}<section class="content-action"><h2>選定条件</h2><p>掲載資料でリーグ開始から育成できることを確認できる候補です。高額ユニークへの依存やSSF適性が確認できない場合は、そのまま明記しています。</p></section><div class="starter-list">${starterCards}</div><aside class="next-box"><b>決められない場合</b><p>遠距離・近接・操作・重視項目から4問で候補を絞れます。</p><a class="button" href="/class-check/">4問診断を始める</a></aside><section class="related"><h2>別の基準で選ぶ</h2><div class="related-links"><a href="/best-builds/">目的別おすすめを見る</a><a href="/tier-list/">初心者向けTierを見る</a><a href="/leveling/">現在Lvから育成を見る</a></div></section>`;
await mkdir(resolve(root, "league-starter"), { recursive: true });
await writeFile(resolve(root, "league-starter/index.html"), shell({ title: "PoE2リーグスターター・序盤おすすめビルド", description: "PoE2初心者向けスタータービルドを比較。序盤の使いやすさ、装備依存、SSF、育成切替を確認し、Lv1〜10の手順へ直接進めます。", path: "/league-starter/", current: "starter", kicker: "LEAGUE STARTER", h1: "PoE2リーグスターター・序盤おすすめビルド", intro: "最初のキャラクターで序盤から育成できる、0.5.5対応の候補を比較します。固定価格や未確認の強さは断定しません。", content: starterContent, crumbs: [{ name: "ホーム", path: "/" }, { name: "リーグスターター", path: "/league-starter/" }] }));

const levelingClassOptions = classes.filter((classData) => builds.some((build) => build.classSlug === classData.slug)).map((classData) => `<option value="${esc(classData.slug)}">${esc(classData.name)}</option>`).join("");
const levelingBuildOptions = builds.map((build) => `<option value="${esc(buildUrl(build))}" data-class="${esc(build.classSlug)}">${esc(build.name)}</option>`).join("");
const levelingStages = [["Lv1〜10",1],["Lv11〜20",11],["Lv21〜30",21],["Lv31〜40",31],["Campaign後",61],["Mapping",71],["Endgame",81]].map(([label, level]) => `<button type="button" data-level="${level}">${label}</button>`).join("");
const levelingBuildCards = builds.map((build) => `<article><p>${esc(build.className)} / ${esc(build.ascendancy)}</p><h3>${esc(build.name)}</h3><span>Lv1〜Endgameの8段階から、現在Lvの手順を表示します。</span><a href="${buildUrl(build)}?level=1#now">このビルドでレベリング</a></article>`).join("");
const levelingContent = `<section class="content-action"><h2>現在Lvから探す</h2><p>職業と使っているビルド、現在Lvを選ぶと、既存の育成ページでスキル・装備・パッシブの「今やること」を3つに絞って表示します。</p><form id="leveling-form" class="leveling-form"><label>職業<select id="leveling-class">${levelingClassOptions}</select></label><label>ビルド<select id="leveling-build">${levelingBuildOptions}</select></label><label>現在Lv<input id="leveling-level" type="number" min="1" max="100" value="1" inputmode="numeric"></label><a id="leveling-cta" class="button" href="/builds/monk/whirling-assault/?level=1#now">現在Lvから今やることを見る</a></form><div class="leveling-stages" aria-label="レベル帯から選ぶ">${levelingStages}</div></section><section><h2>使っているビルドから選ぶ</h2><p>共通説明を重複させず、各ビルドにあるLv別の確認済み育成手順へ直接案内します。</p><div class="seo-build-list">${levelingBuildCards}</div></section><section class="related"><h2>まだビルドが決まっていない場合</h2><div class="related-links"><a href="/classes/">おすすめクラスから選ぶ</a><a href="/beginner-guide/">初心者向けビルドから選ぶ</a><a href="/best-builds/">目的別おすすめから選ぶ</a><a href="/league-starter/">序盤スターターから選ぶ</a></div></section><script type="module" src="/assets/leveling.js?v=20260919-1"></script>`;
await mkdir(resolve(root, "leveling"), { recursive: true });
await writeFile(resolve(root, "leveling/index.html"), shell({ title: "PoE2レベリング・育成ガイド｜現在Lvから次にやること", description: "PoE2のレベリング・レベル上げを、職業・ビルド・現在Lvから確認。スキル・装備・パッシブの今やること3つへ直接進めます。", path: "/leveling/", current: "", kicker: "LEVELING GUIDE", h1: "PoE2レベリングガイド｜現在Lvから次にやること", intro: "長い共通攻略ではなく、使っているビルドと現在Lvに合う既存の育成手順へ案内します。", content: levelingContent, crumbs: [{ name: "ホーム", path: "/" }, { name: "レベリング・育成", path: "/leveling/" }] }));

const bestBuilds = [
  { label: "周回", id: "ranger-ice-shot-deadeye", reason: "遠距離から攻撃し、周回用アイスショットと単体用スナイプを使い分けます。" },
  { label: "ボス", id: "monk-whirling-assault", reason: "移動攻撃に加え、単体戦で使うFalling Thunderの手順を段階別に確認できます。" },
  { label: "初心者", id: "witch-minion-infernalist", reason: "攻撃をミニオンへ任せやすく、自分は敵の動きと回避へ集中しやすい構成です。" },
  { label: "低装備依存・SSF", id: "witch-ed-contagion-lich", reason: "SSF成立と、必須ユニークを必要としないことを掲載資料で確認済みです。" },
  { label: "防御重視", id: "warrior-shield-wall-smith", reason: "盾を軸に進め、耐久を優先するスターター候補として掲載しています。" },
  { label: "操作少なめ", id: "druid-plant-oracle", reason: "Lv1から主力を継続しやすく、基本操作を増やしすぎずに育成できます。" }
];
const bestBuildCards = bestBuilds.map(({ label, id, reason }) => {
  const build = byId(id);
  const tags = discovery.buildTags?.[id] ?? [];
  return `<article class="purpose-card"><p class="section-kicker">${esc(label)}</p><h3>${esc(build.name)}</h3><div class="build-tags" aria-label="特徴">${tags.map((tag) => `<span>${esc(tag)}</span>`).join("")}</div><p><b>選定理由：</b>${esc(reason)}</p><p><b>注意：</b>${esc(build.weaknesses[0])}</p><a class="button" href="${buildUrl(build)}?level=1#now">現在Lvから今やることを見る</a></article>`;
}).join("");
const bestContent = `<section class="content-action"><h2>結論：目的別のおすすめ候補</h2><p>「最強」は周回・ボス・防御・装備条件で変わります。掲載10ビルドの確認済みデータから、目的ごとに1本ずつ候補を選びました。</p></section><div class="purpose-grid">${bestBuildCards}</div><section><h2>Tier・リーグスターターとの違い</h2><div class="pros-cons"><section class="info-card"><h3>初心者向けTier</h3><p>Lv1からの育てやすさ、操作、構成切替、資料確認状況を重視します。</p><a href="/tier-list/">初心者向けTierを見る</a></section><section class="info-card"><h3>リーグスターター</h3><p>資産が少ない序盤から育成できるか、装備依存やSSF情報を重視します。</p><a href="/league-starter/">リーグスターターを見る</a></section></div></section><section><h2>選定と更新の方針</h2><ul><li>掲載中かつLv1〜Endgameの主要情報を確認できたビルドだけを対象にします。</li><li>同条件の実測DPS順位は作らず、既存資料で確認できる用途・操作・装備条件を使います。</li><li>パッチ変更時は公式ノートと各ビルドの段階別資料を再確認します。</li></ul><p><a href="/editorial-policy/">編集方針と情報確認方法を見る</a></p></section><section class="related"><h2>ビルドを決めた後</h2><div class="related-links"><a href="/leveling/">別のビルド・現在Lvから探す</a><a href="/classes/">職業から選び直す</a><a href="/builds/">確認済み10ビルドを見る</a></div></section>`;
await mkdir(resolve(root, "best-builds"), { recursive: true });
await writeFile(resolve(root, "best-builds/index.html"), shell({ title: "PoE2 0.5.5おすすめ・最強ビルド｜目的別に比較", description: "PoE2 0.5.5のおすすめビルドを、周回・ボス・初心者・低装備依存・防御・操作量で比較。選んだ後は現在Lvから今やること3つを確認できます。", path: "/best-builds/", current: "", kicker: "BEST BUILDS BY PURPOSE", h1: "PoE2 0.5.5おすすめ・最強ビルド｜目的別比較", intro: "絶対的な1位ではなく、遊びたい目的と育成条件に合う候補を選ぶページです。", content: bestContent, crumbs: [{ name: "ホーム", path: "/" }, { name: "目的別おすすめビルド", path: "/best-builds/" }] }));

const purposeCards = discovery.beginnerPurposes.map(({ label, buildId }) => {
  const build = byId(buildId);
  return `<article class="purpose-card"><p class="section-kicker">${esc(label)}</p><h2>${esc(build.name)}</h2><p>${esc(build.audience)}</p><p><b>注意：</b>${esc(build.weaknesses[0])}</p><a class="button" href="${buildUrl(build)}">このビルドをLv1から見る</a></article>`;
}).join("");
const beginnerContent = `<section class="content-action"><h2>初めてなら、この順で選ぶ</h2><ol><li>近接・遠距離・召喚など、続けやすい戦い方を選ぶ</li><li>途中で主力スキルが変わる時期を確認する</li><li>ビルド詳細で現在Lvを入力し、今やること3つを見る</li></ol></section><div class="purpose-grid">${purposeCards}</div><aside class="next-box"><b>まだ決められない場合</b><p>4問の軽量診断は既存ビルドデータだけで候補を絞ります。</p><a class="button" href="/class-check/">4問診断を始める</a></aside>`;
await mkdir(resolve(root, "guides/beginner-build"), { recursive: true });
await writeFile(resolve(root, "guides/beginner-build/index.html"), shell({ title: "PoE2初心者おすすめビルド｜最初に選ぶならどれ？", description: "PoE2初心者が最初に選ぶビルドを、戦い方・操作・育成切替から比較。選んだ後は現在Lvを入力して次の行動を確認できます。", path: "/guides/beginner-build/", current: "", kicker: "BEGINNER BUILD", h1: "PoE2初心者おすすめビルド", intro: "最強という言葉だけで選ばず、操作しやすさと育成途中の切替から自分に合う候補を選びます。", content: beginnerContent, crumbs: [{ name: "ホーム", path: "/" }, { name: "初心者ガイド", path: "/beginner-guide/" }, { name: "初心者おすすめビルド", path: "/guides/beginner-build/" }] }));

const one = discovery.poe2One;
const oneContent = `<section><h2>PoE2 1.0とは</h2><p>早期アクセスから正式版へ移行する大型更新です。このページでは公式発表で確認できた内容と、まだ断定できないビルド情報を分けます。</p></section><section><h2>正式リリース日は2026年12月11日</h2><p>公式発表では、Path of Exile 2の正式版1.0は2026年12月11日に公開予定です。</p><a class="button-secondary" href="/poe2-1-0/release-date/">公開予定日を詳しく見る</a></section><section><h2>基本プレイ無料化について</h2><p>正式版1.0の公開時に基本プレイ無料へ移行予定であることが公式発表されています。価格・対応機種など、このサイトのビルド選択と直接関係しない未確認情報は扱いません。</p><p><a href="${esc(one.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(one.sourceName)}の正式版発表</a>（確認：${esc(one.checkedAt)}）</p></section><section><h2>新職業・新要素</h2><p>Duelistは正式版1.0で追加予定です。スキル・アセンダンシー・既存ビルドへの影響は、正式なパッチノートと段階別資料を確認できるまで推測で掲載しません。</p><div class="section-cta"><a class="button-secondary" href="/poe2-1-0/duelist/">Duelistの確認済み情報</a><a class="button-secondary" href="${esc(one.duelistSourceUrl)}" target="_blank" rel="noopener noreferrer">Duelistの公式発表</a></div></section><section class="content-action"><h2>まだ断定しない情報</h2><ul>${one.unconfirmed.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section><section><h2>初心者におすすめの職業</h2><p>1.0公開前のため、1.0環境の最強職業は断定しません。現在の0.5.5で確認済みの8職業から、遠距離・召喚・近接・耐久などの戦い方で選べます。</p><div class="section-cta"><a class="button" href="/classes/">おすすめクラス・職業を選ぶ</a><a class="button-secondary" href="/class-check/">4問で職業を絞る</a></div></section><section><h2>初心者におすすめのビルド</h2><p>現在掲載中の10ビルドは0.5.5向けです。正式版公開後は、公式変更と各ビルドの育成資料を再確認してから1.0対応表示へ切り替えます。</p><div class="tool-grid"><a class="tool-card" href="/best-builds/"><span>目的別</span><strong>おすすめビルド</strong><p>周回・ボス・防御・操作から選びます。</p></a><a class="tool-card" href="/tier-list/"><span>BEGINNER TIER</span><strong>初心者向けTier</strong><p>育てやすさと構成切替で比較します。</p></a><a class="tool-card" href="/league-starter/"><span>STARTER</span><strong>リーグ開始候補</strong><p>低資産・序盤条件から選びます。</p></a></div></section><section id="one-build-impact"><h2>現在の0.5.5ビルドへの影響</h2><p>掲載中の10ビルドは0.5.5向けです。1.0向けに再確認済みのビルドはまだありません。0.5.5c公式パッチノートには、掲載10ビルドのスキル・パッシブ構成を直接変更する記載は確認されませんでした。</p></section><section><h2>更新履歴</h2><ul><li>2026-09-23：正式版・基本プレイ無料化・Duelistの公式情報と0.5.5c影響確認を更新</li><li>2026-09-13：0.5.5ビルドとの区別と再確認状況を追記</li><li>2026-09-12：公開予定日とDuelistの公式確認ページを追加</li></ul></section><section><h2>1.0公開後の更新方針</h2><p>公式パッチノート、スキル変更、アセンダンシー、段階別の書面ガイドを再確認してから、Tier・リーグスターター・各ビルドの対応版を更新します。公開前の予想を最強ランキングとして掲載しません。</p></section>`;
await mkdir(resolve(root, "poe2-1-0"), { recursive: true });
await writeFile(resolve(root, "poe2-1-0/index.html"), shell({ title: "PoE2 1.0 最新情報｜正式版・無料化・初心者おすすめビルド", description: "Path of Exile 2正式版1.0のリリース日、基本プレイ無料化、Duelistの公式情報と、初心者向けクラス・ビルドの選び方を確認できます。", path: "/poe2-1-0/", current: "", kicker: "PATH OF EXILE 2 / VERSION 1.0", h1: "PoE2 1.0 正式版｜初心者向け最新情報", intro: "2026年12月11日の正式版・基本プレイ無料化に向け、確定情報とビルド再確認状況を更新します。", content: oneContent, crumbs: [{ name: "ホーム", path: "/" }, { name: "PoE2 1.0", path: "/poe2-1-0/" }], statusLabel: "現在掲載ビルド" }));

const noteRows = [
  ["PoE2 最強・おすすめビルド", "/best-builds/", "best_builds"],
  ["PoE2 初心者向けTier", "/tier-list/", "poe2_tier"],
  ["PoE2 初心者おすすめ", "/guides/beginner-build/", "beginner_build"],
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
  ["PoE2 Duelist", "/poe2-1-0/duelist/", "poe2_duelist"],
  ...builds.map((build) => [build.name, buildUrl(build), build.id])
];
const noteMap = `# note / X → POE2ビルドナビ 送客対応表\n\n同じ本文を転載せず、noteでは特徴・選び方を説明し、サイトではLv1からの手順と現在Lv入力を提供します。トップではなく、投稿テーマに一致するURLへ直接送ります。\n\n| 投稿テーマ | リンク先 | note用UTMリンク | X用UTMリンク |\n|---|---|---|---|\n${noteRows.map(([theme, path, campaign]) => `| ${theme} | ${path} | ${absolute(path)}?utm_source=note&utm_medium=referral&utm_campaign=${campaign} | ${absolute(path)}?utm_source=x&utm_medium=social&utm_campaign=${campaign} |`).join("\n")}\n\nCTA例：\n\n- Lv1から完成までの育成手順はこちら\n- 現在Lvから次にやることを見る\n- 装備・スキル・パッシブまでまとめて確認\n`;
await writeFile(resolve(root, "NOTE_CONTENT_MAP.md"), noteMap);

console.log("Generated discovery landing pages and note mapping.");
