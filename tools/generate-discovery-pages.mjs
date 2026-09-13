import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const [builds, discovery] = await Promise.all([
  readJson("data/builds.json"),
  readJson("data/discovery.json")
]);
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

function shell({ title, description, path, current, kicker, h1, intro, content, crumbs }) {
  return `<!doctype html><html lang="ja"><head>${head({ title, description, path, crumbs })}</head><body><a class="skip-link" href="#main">本文へ移動</a>${header(current)}<main id="main" class="page-main"><nav class="breadcrumbs" aria-label="パンくず"><ol>${crumbs.map((item, index) => `<li>${index === crumbs.length - 1 ? esc(item.name) : `<a href="${item.path}">${esc(item.name)}</a>`}</li>`).join("")}</ol></nav><section class="page-hero discovery-hero"><p class="section-kicker">${esc(kicker)}</p><h1>${esc(h1)}</h1><p>${esc(intro)}</p><div class="update-strip"><span>対応：${esc(discovery.patchVersion)}</span><span>最終確認：${esc(discovery.updatedAt)}</span></div></section><article class="article-page discovery-page">${content}</article></main></body></html>`;
}

function compactBuildCard(build, label = "Lv1から育てる") {
  return `<article class="discovery-card"><p class="build-meta">${esc(build.className)} / ${esc(build.ascendancy)}</p><h3>${esc(build.name)}</h3><p><b>主力：</b>${esc(build.mainSkill)}</p><p>${esc(build.audience)}</p><dl><div><dt>操作</dt><dd>${esc(build.difficulty)}</dd></div><div><dt>予算</dt><dd>${esc(build.budget)}</dd></div><div><dt>対応</dt><dd>${esc(build.version)}・${esc(build.updatedAt)}</dd></div></dl><a class="button" href="${buildUrl(build)}">${esc(label)}</a></article>`;
}

const featured = discovery.featuredBuildIds.map(byId);
const featuredHtml = `<section id="featured-builds" class="section featured-builds" aria-labelledby="featured-title"><div class="section-head"><p class="section-kicker">BEGINNER PICKS</p><h2 id="featured-title">初心者におすすめのビルド</h2><p>強さの順位ではなく、0.5.5の段階別資料と初心者向けの育成導線を確認できる候補です。</p></div><div class="discovery-grid">${featured.map((build) => compactBuildCard(build)).join("")}</div><div class="section-cta"><a class="button" href="/builds/">全10ビルドを見る</a><a class="button-secondary" href="/tier-list/">目的別Tierを見る</a><a class="button-secondary" href="/league-starter/">リーグスターターを見る</a></div></section>`;

let home = await readFile(resolve(root, "index.html"), "utf8");
home = home
  .replace(/<title>.*?<\/title>/, "<title>PoE2 最新ビルドサイト｜初心者向け日本語育成ナビ</title>")
  .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="PoE2 0.5.5対応の日本語ビルドサイト。10ビルドから選び、現在Lvを入力すると、Lv1からEndgameまで次にやること3つが分かります。">')
  .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="PoE2 最新ビルドサイト｜初心者向け日本語育成ナビ">')
  .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="海外の強ビルドを日本語でLv1から確認。現在Lvから次にやることを3つに絞ります。">')
  .replace(/<section class="hero"[\s\S]*?<\/section>\s*<section id="choose-class"/, `<section class="hero" aria-labelledby="hero-title"><div><p class="eyebrow">PATH OF EXILE 2 / JAPANESE BUILD GUIDE</p><h1 id="hero-title">PoE2ビルドナビ</h1><p class="lead">初心者でもLv1からそのまま真似できる日本語ビルドガイド。現在のレベルを入力すると、次にやることが分かります。</p><div class="journey-steps" aria-label="使い方"><span><b>1</b>ビルドを選ぶ</span><span><b>2</b>現在Lvを入力</span><span><b>3</b>今やることを見る</span></div><div class="hero-actions"><a class="button" href="#featured-builds">おすすめビルドを見る</a><a class="button-secondary" href="/guides/beginner-build/">初めてのビルド選び</a></div><div class="status-note">対応パッチ <span id="site-version">${esc(discovery.patchVersion)}</span>・最終更新 <span id="last-updated">${esc(discovery.updatedAt)}</span></div></div><aside class="hero-guide"><strong>検索目的から選ぶ</strong><ul><li><a href="/guides/poe2-0-5-5-builds/">0.5.5対応ビルド</a></li><li><a href="/guides/forbidden-rites-beginner/">Forbidden Rites初心者</a></li><li><a href="/tier-list/">初心者向けTier</a></li><li><a href="/league-starter/">リーグスターター</a></li><li><a href="/poe2-1-0/">PoE2 1.0情報</a></li></ul></aside></section>${featuredHtml}<section id="choose-class"`)
  .replace(/<section id="featured-builds"[\s\S]*?<\/section>\s*<section id="choose-class"/, `${featuredHtml}<section id="choose-class"`)
  .replace("<h2 id=\"classes-title\">まず職業を選んでください</h2>", "<h2 id=\"classes-title\">職業から探す</h2>")
  .replace("<p>ビルド名が分からなくても大丈夫です。好きな戦い方から職業を選べます。</p>", "<p>おすすめを見ても決められない場合は、好きな戦い方から職業を選べます。</p>")
  .replace(/<section class="section section-soft" aria-labelledby="quality-title">[\s\S]*?<\/section>/, `<section class="section section-soft" aria-labelledby="quality-title"><div class="section-head"><p class="section-kicker">SEARCH GUIDES</p><h2 id="quality-title">目的から探す</h2><p>検索した悩みから、ビルド詳細のLv入力まで迷わず進めます。</p></div><div class="tool-grid"><a class="tool-card" href="/guides/poe2-0-5-5-builds/"><span>PATCH 0.5.5</span><strong>対応ビルドを選ぶ</strong><p>10ビルドを同じ基準で確認します。</p></a><a class="tool-card" href="/guides/forbidden-rites-beginner/"><span>FORBIDDEN RITES</span><strong>イベントを始める</strong><p>初心者が最初にする3つを確認します。</p></a><a class="tool-card" href="/guides/increase-damage/"><span>DAMAGE</span><strong>火力が出ない</strong><p>武器・スキル・パッシブを順番に確認します。</p></a><a class="tool-card" href="/guides/why-i-die/"><span>DEFENCE</span><strong>すぐ死ぬ</strong><p>耐性・回復・装備を切り分けます。</p></a><a class="tool-card" href="/guides/gear-upgrade/"><span>GEAR</span><strong>装備更新を決める</strong><p>ビルドと現在Lvから交換候補を絞ります。</p></a><a class="tool-card" href="/poe2-1-0/"><span>POE2 1.0</span><strong>正式版情報</strong><p>確定情報と未発表情報を分けて掲載します。</p></a></div></section>`);
await writeFile(resolve(root, "index.html"), home);

const tierSections = ["S", "A", "B", "C"].map((tier) => {
  const entries = discovery.tiers[tier];
  const cards = entries.length ? entries.map(({ id, reason }) => {
    const build = byId(id);
    return `<article class="tier-card"><div class="tier-badge tier-${tier.toLowerCase()}">${tier}</div><div><p class="build-meta">${esc(build.className)} / ${esc(build.ascendancy)}</p><h3>${esc(build.name)}</h3><p class="tier-reason">${esc(reason)}</p><div class="tier-columns"><div><b>強み</b><p>${esc(build.strengths[0])}</p></div><div><b>弱み</b><p>${esc(build.weaknesses[0])}</p></div></div><ul class="tier-facts"><li>初心者適性：${esc(build.audience)}</li><li>周回・ボス・防御：同条件の数値比較は未採点</li><li>予算：${esc(build.budget)}</li><li>操作：${esc(build.difficulty)}</li></ul><a class="button" href="${buildUrl(build)}">現在Lvから進める</a></div></article>`;
  }).join("") : '<p class="empty-tier">現在、この基準でCに分類したビルドはありません。</p>';
  return `<section class="tier-section" aria-labelledby="tier-${tier.toLowerCase()}"><h2 id="tier-${tier.toLowerCase()}">${tier} Tier</h2>${cards}</section>`;
}).join("");

const tierContent = `<section class="content-action"><h2>このTierの見方</h2><p><b>強さの断定順位ではありません。</b>現在掲載している0.5.5のビルドを、初心者がLv1から育成を始めやすいか、操作や途中切替が分かりやすいか、確認資料が揃っているかで暫定分類しています。火力・周回・ボス・防御の数値比較は、同条件の検証がないため採点していません。</p></section>${tierSections}<section><h2>評価基準</h2><ul><li>同じパッチ0.5.5の資料であること</li><li>8段階の育成手順を確認できること</li><li>初心者が注意すべき操作・切替・弱点が明記されていること</li><li>資料が不足する候補は上位へ断定しないこと</li></ul><p><a href="/editorial-policy/">編集方針と情報確認方法を見る</a></p></section>`;
await mkdir(resolve(root, "tier-list"), { recursive: true });
await writeFile(resolve(root, "tier-list/index.html"), shell({ title: "PoE2 0.5.5初心者向けビルドTier｜育てやすさ比較", description: "PoE2 0.5.5の初心者向けビルドを、育成の始めやすさ・操作・構成切替・資料確認状況で暫定比較。各ビルドは現在Lvから育成できます。", path: "/tier-list/", current: "tier", kicker: "TIER LIST / PATCH 0.5.5", h1: "PoE2 0.5.5初心者向けビルドTier", intro: "初心者が最初の1体を選ぶための暫定Tierです。強さだけの順位ではなく、Lv1から迷わず進められるかを重視します。", content: tierContent, crumbs: [{ name: "ホーム", path: "/" }, { name: "Tierリスト", path: "/tier-list/" }] }));

const starterCards = builds.filter((build) => build.leagueStarter).map((build) => `<article class="starter-card"><div><p class="build-meta">${esc(build.className)} / ${esc(build.ascendancy)}</p><h2>${esc(build.name)}</h2><p>${esc(build.audience)}</p><ul><li>主力：${esc(build.mainSkill)}</li><li>操作：${esc(build.difficulty)}</li><li>${build.ssf === true ? "SSF対応の根拠を確認済み" : "SSF適性は確認中"}</li><li>価格：固定相場を断定しません</li></ul><p><b>先に知る弱点：</b>${esc(build.weaknesses[0])}</p></div><a class="button" href="${buildUrl(build)}">Lv1から育てる</a></article>`).join("");
const starterContent = `<section class="content-action"><h2>選定条件</h2><p>掲載資料でリーグ開始から育成できることを確認できる候補です。高額ユニークへの依存やSSF適性が確認できない場合は、そのまま明記しています。</p></section><div class="starter-list">${starterCards}</div><aside class="next-box"><b>決められない場合</b><p>遠距離・近接・操作・重視項目から4問で候補を絞れます。</p><a class="button" href="/class-check/">4問診断を始める</a></aside>`;
await mkdir(resolve(root, "league-starter"), { recursive: true });
await writeFile(resolve(root, "league-starter/index.html"), shell({ title: "PoE2 リーグスターターおすすめ｜初心者・低予算ビルド", description: "PoE2初心者向けリーグスターターを比較。装備依存・操作難易度・育成切替を確認し、Lv1からEndgameまでの手順へ進めます。", path: "/league-starter/", current: "starter", kicker: "LEAGUE STARTER", h1: "PoE2 リーグスターターおすすめビルド", intro: "最初のキャラクターで育成を始められる、0.5.5対応の候補を比較します。固定価格や未確認の強さは断定しません。", content: starterContent, crumbs: [{ name: "ホーム", path: "/" }, { name: "リーグスターター", path: "/league-starter/" }] }));

const purposeCards = discovery.beginnerPurposes.map(({ label, buildId }) => {
  const build = byId(buildId);
  return `<article class="purpose-card"><p class="section-kicker">${esc(label)}</p><h2>${esc(build.name)}</h2><p>${esc(build.audience)}</p><p><b>注意：</b>${esc(build.weaknesses[0])}</p><a class="button" href="${buildUrl(build)}">このビルドをLv1から見る</a></article>`;
}).join("");
const beginnerContent = `<section class="content-action"><h2>初めてなら、この順で選ぶ</h2><ol><li>近接・遠距離・召喚など、続けやすい戦い方を選ぶ</li><li>途中で主力スキルが変わる時期を確認する</li><li>ビルド詳細で現在Lvを入力し、今やること3つを見る</li></ol></section><div class="purpose-grid">${purposeCards}</div><aside class="next-box"><b>まだ決められない場合</b><p>4問の軽量診断は既存ビルドデータだけで候補を絞ります。</p><a class="button" href="/class-check/">4問診断を始める</a></aside>`;
await mkdir(resolve(root, "guides/beginner-build"), { recursive: true });
await writeFile(resolve(root, "guides/beginner-build/index.html"), shell({ title: "PoE2初心者おすすめビルド｜最初に選ぶならどれ？", description: "PoE2初心者が最初に選ぶビルドを、戦い方・操作・育成切替から比較。選んだ後は現在Lvを入力して次の行動を確認できます。", path: "/guides/beginner-build/", current: "", kicker: "BEGINNER BUILD", h1: "PoE2初心者おすすめビルド", intro: "最強という言葉だけで選ばず、操作しやすさと育成途中の切替から自分に合う候補を選びます。", content: beginnerContent, crumbs: [{ name: "ホーム", path: "/" }, { name: "初心者ガイド", path: "/beginner-guide/" }, { name: "初心者おすすめビルド", path: "/guides/beginner-build/" }] }));

const one = discovery.poe2One;
const oneContent = `<section><h2>PoE2 1.0とは</h2><p>早期アクセスから正式版へ移行する大型更新です。公式サイトで公開された情報を確認し、確定事項と未確定事項を分けて掲載します。</p></section><section><h2>確認できた正式版情報</h2><ul>${one.confirmed.map((item) => `<li>${esc(item)}</li>`).join("")}</ul><p><a href="${esc(one.sourceUrl)}">${esc(one.sourceName)}</a>（確認：${esc(one.checkedAt)}）</p><div class="section-cta"><a class="button" href="/poe2-1-0/release-date/">公開予定日を詳しく見る</a><a class="button-secondary" href="/poe2-1-0/duelist/">Duelistの確認済み情報</a></div></section><section class="content-action"><h2>まだ断定しない情報</h2><ul>${one.unconfirmed.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section><section><h2>正式版前にできること</h2><div class="tool-grid"><a class="tool-card" href="/guides/beginner-build/"><span>初心者向け</span><strong>ビルドの選び方</strong><p>操作と育成切替で選びます。</p></a><a class="tool-card" href="/league-starter/"><span>STARTER</span><strong>リーグ開始候補</strong><p>現在の0.5.5候補を確認します。</p></a><a class="tool-card" href="/guides/poe2-0-5-5-builds/"><span>BUILDS</span><strong>現在の10ビルド</strong><p>Lv1からの育成手順へ進みます。</p></a></div></section><section><h2>1.0公開後の更新方針</h2><p>公式パッチノート、スキル変更、アセンダンシー、段階別の書面ガイドを再確認してから、Tier・リーグスターター・各ビルドの対応版を更新します。公開前の予想を最強ランキングとして掲載しません。</p></section>`;
await mkdir(resolve(root, "poe2-1-0"), { recursive: true });
await writeFile(resolve(root, "poe2-1-0/index.html"), shell({ title: "PoE2 1.0 最新情報｜正式版・初心者おすすめビルド", description: "Path of Exile 2正式版1.0の確認済み情報と、初心者向けビルド・リーグスターターへの入口。未確定情報は断定しません。", path: "/poe2-1-0/", current: "", kicker: "PATH OF EXILE 2 / VERSION 1.0", h1: "PoE2 1.0 最新情報", intro: "2026年12月11日の正式版公開に向け、確定情報とビルド再確認状況を更新します。", content: oneContent, crumbs: [{ name: "ホーム", path: "/" }, { name: "PoE2 1.0", path: "/poe2-1-0/" }] }));

const noteRows = [
  ["PoE2 最強ビルド・Tier", "/tier-list/", "poe2_tier"],
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
  ["PoE2 1.0 公開日", "/poe2-1-0/release-date/", "poe2_1_0_release"],
  ["PoE2 Duelist", "/poe2-1-0/duelist/", "poe2_duelist"],
  ...builds.map((build) => [build.name, buildUrl(build), build.id])
];
const noteMap = `# note / X → POE2ビルドナビ 送客対応表\n\n同じ本文を転載せず、noteでは特徴・選び方を説明し、サイトではLv1からの手順と現在Lv入力を提供します。トップではなく、投稿テーマに一致するURLへ直接送ります。\n\n| 投稿テーマ | リンク先 | note用UTMリンク | X用UTMリンク |\n|---|---|---|---|\n${noteRows.map(([theme, path, campaign]) => `| ${theme} | ${path} | ${absolute(path)}?utm_source=note&utm_medium=referral&utm_campaign=${campaign} | ${absolute(path)}?utm_source=x&utm_medium=social&utm_campaign=${campaign} |`).join("\n")}\n\nCTA例：\n\n- Lv1から完成までの育成手順はこちら\n- 現在Lvから次にやることを見る\n- 装備・スキル・パッシブまでまとめて確認\n`;
await writeFile(resolve(root, "NOTE_CONTENT_MAP.md"), noteMap);

console.log("Generated discovery landing pages and note mapping.");
