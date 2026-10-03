import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const guides = JSON.parse(await readFile(resolve(root, "data/guides.json"), "utf8"));
const terms = JSON.parse(await readFile(resolve(root, "data/dictionary.json"), "utf8"));
const site = JSON.parse(await readFile(resolve(root, "data/site.json"), "utf8"));
const builds = JSON.parse(await readFile(resolve(root, "data/builds.json"), "utf8"));
const base = "https://poe2-build-navi-jp.github.io";
const publisher = "ca-pub-7738997902416481";
const esc = (v) => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const head = (title, description, url) => `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow"><meta name="google-adsense-account" content="${publisher}"><link rel="canonical" href="${url}"><meta property="og:type" content="article"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="POE2ビルドナビ"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary"><link rel="stylesheet" href="/assets/styles.css?v=discovery-2"><link rel="stylesheet" href="/assets/mobile.css?v=discovery-2"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}" crossorigin="anonymous"></script>`;
const header = `<header class="site-header"><a class="brand" href="/"><span class="brand-mark">P2</span><span>POE2<br>ビルドナビ</span></a><nav class="site-nav page-nav" aria-label="メインメニュー"><a href="/builds/">ビルド</a><a href="/class-check/">職業診断</a><a href="/beginner-guide/">初心者ガイド</a><a href="/dictionary/">用語辞典</a></nav></header>`;

// Optional rich fields on a term or guide: sections [{heading, paragraphs, bullets}], buildExamples
// [{id, text}] (linked to the build page), sources [{name, url, checkedAt}], version.
const termSections = (term) => (term.sections || []).map((s) => `<h2>${esc(s.heading)}</h2>${(s.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join("")}${s.bullets?.length ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}`).join("");
const termExamples = (term) => term.buildExamples?.length ? `<h2>このサイトのビルドでの例</h2><ul>${term.buildExamples.map((ex) => {
  const build = builds.find((item) => item.id === ex.id);
  if (!build) throw new Error(`${term.slug}: unknown build ${ex.id}`);
  return `<li><a href="/builds/${build.classSlug}/${build.slug}/">${esc(build.name)}</a>：${esc(ex.text)}</li>`;
}).join("")}</ul>` : "";
const termSources = (term) => term.sources?.length ? `<section class="sources"><h2>確認した情報源</h2><p>数値や仕様はPath of Exile 2 ${esc(term.version || site.gameVersion)}時点のものです。正式版1.0で変わる可能性があります。</p><ul class="source-list">${term.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a><span>確認日 ${esc(s.checkedAt)}</span></li>`).join("")}</ul></section>` : "";

for (const guide of guides) {
  const dir = resolve(root, "guides", guide.slug);
  const url = `${base}/guides/${guide.slug}/`;
  const actions = guide.actions.map((x, i) => `<li><b>${["最優先", "次", "その次"][i]}</b><span>${esc(x)}</span></li>`).join("");
  const details = guide.details.map((x) => `<p>${esc(x)}</p>`).join("");
  const html = `<!doctype html><html lang="ja"><head>${head(`POE2 ${guide.title}｜初心者ガイド`, guide.metaDescription || guide.summary, url)}</head><body>${header}<main class="page-main"><nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li><a href="/beginner-guide/">初心者ガイド</a></li><li>${esc(guide.title)}</li></ol></nav><article class="article-page"><p class="section-kicker">BEGINNER GUIDE</p><h1>${esc(guide.title)}</h1><p class="lead">${esc(guide.summary)}</p><section class="content-action"><h2>今日確認すること</h2><ol>${actions}</ol></section><section><h2>初心者向け説明</h2>${details}</section>${termSections(guide)}${termExamples(guide)}${termSources(guide)}<aside class="next-box"><b>次の行動</b><p>${esc(guide.nextText || "関連する画面を開いて、今の自分に必要な項目を確認してください。")}</p><a class="button" href="${guide.related}">${esc(guide.relatedLabel || "関連ページへ")}</a>${(guide.links || []).map((l) => `<a class="button button-ghost" href="${esc(l.href)}">${esc(l.label)}</a>`).join("")}</aside><p><a href="/beginner-guide/">${guides.length}章の一覧へ戻る</a></p></article></main></body></html>`;
  await mkdir(dir, { recursive: true }); await writeFile(resolve(dir, "index.html"), html);
}

for (const term of terms) {
  const dir = resolve(root, "dictionary", term.slug);
  const url = `${base}/dictionary/${term.slug}/`;
  const html = `<!doctype html><html lang="ja"><head>${head(`POE2 ${term.term}とは｜初心者用語辞典`, term.metaDescription || `${term.term}をPOE2初心者向けに説明。${term.oneLine}`, url)}</head><body>${header}<main class="page-main"><nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li><a href="/dictionary/">用語辞典</a></li><li>${esc(term.term)}</li></ol></nav><article class="article-page"><p class="section-kicker">DICTIONARY</p><h1>${esc(term.term)}</h1><section class="term-lead"><h2>一言でいうと</h2><p>${esc(term.oneLine)}</p></section><h2>初心者向け説明</h2><p>${esc(term.description)}</p>${termSections(term)}<h2>なぜ重要？</h2><p>${esc(term.importance)}</p>${termExamples(term)}<h2>次にすること</h2><p>${esc(term.action)}</p>${termSources(term)}<div class="section-cta"><a class="button" href="${term.guide}">関連ガイド</a><a class="button button-ghost" href="/dictionary/">用語一覧</a></div></article></main></body></html>`;
  await mkdir(dir, { recursive: true }); await writeFile(resolve(dir, "index.html"), html);
}

const guideCards = guides.map((g, i) => `<a class="content-card" href="/guides/${g.slug}/"><small>第${i + 1}章</small><strong>${esc(g.title)}</strong><span>${esc(g.summary)}</span></a>`).join("");
const problemCards = [
  ["耐性が分からない", "/guides/resistance/", "装備交換前後の耐性を確認します。"],
  ["火力が出ない", "/guides/increase-damage/", "武器・スキル・サポートを順に確認します。"],
  ["すぐ死ぬ", "/guides/why-i-die/", "耐性・回復・装備・立ち回りを切り分けます。"],
  ["パッシブで迷う", "/guides/passive-tree/", "現在Lvに合う取得方針を確認します。"],
  ["装備を更新したい", "/guides/gear-upgrade/", "交換する部位を1つに絞ります。"],
  ["Mappingを始めたい", "/guides/mapping/", "開始前の確認項目を順に進めます。"]
].map(([title, url, summary]) => `<a class="content-card" href="${url}"><strong>${title}</strong><span>${summary}</span></a>`).join("");
// Merged from the former /guides/beginner-build/ page (data/moved.json): who each pick suits and its main caution.
const discovery = JSON.parse(await readFile(resolve(root, "data/discovery.json"), "utf8"));
const beginnerPicks = discovery.beginnerPurposes.map(({ label, buildId }) => {
  const build = builds.find((item) => item.id === buildId);
  if (!build) throw new Error(`Unknown beginner build: ${buildId}`);
  return `<article class="purpose-card"><p class="section-kicker">${esc(label)}</p><h3>${esc(build.name)}</h3><p>${esc(build.audience)}</p><p><b>注意：</b>${esc(build.weaknesses[0])}</p><a class="button" href="/builds/${build.classSlug}/${build.slug}/?level=1#now">このビルドで始める</a></article>`;
}).join("");
await writeFile(resolve(root, "beginner-guide/index.html"), `<!doctype html><html lang="ja"><head>${head("PoE2初心者向けおすすめビルド・育成ガイド", "PoE2初心者向けのおすすめビルドと序盤の育成ガイド。クラスとビルドを選び、現在Lvから今やること3つを確認できます。", `${base}/beginner-guide/`)}</head><body>${header}<main class="page-main"><nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li>初心者ガイド</li></ol></nav><article class="article-page wide-article"><p class="section-kicker">BEGINNER GUIDE / ${guides.length} CHAPTERS</p><h1>PoE2初心者向けおすすめビルド・育成ガイド</h1><p>初めてなら、遊びたい戦い方から候補を1つ選び、ビルド詳細へ現在Lvを入力してください。</p><div class="update-strip"><span>対応環境：${esc(site.siteVersion)}</span><span><a href="${esc(site.latestPatchSource)}" target="_blank" rel="noopener noreferrer">最新確認：${esc(site.latestPatch)}</a></span><span>最終確認：${esc(site.latestPatchCheckedAt)}</span></div><section class="content-action choice-summary" aria-labelledby="beginner-next-title"><h2 id="beginner-next-title">初心者はまずここから</h2><ol><li>近接・遠距離・召喚など、続けやすい戦い方を選ぶ</li><li>途中で主力スキルが変わる時期を確認する</li><li>ビルド詳細で現在Lvを入力し、今やること3つを見る</li></ol><p>完成形を最初から再現する必要はありません。迷ったら複数のビルドを同時に進めず、選んだ1つのロードマップへ戻ってください。「最強」という言葉だけで選ばず、操作しやすさと育成途中の切替時期で比べます。</p><div class="purpose-grid">${beginnerPicks}</div><div class="section-cta"><a class="button" href="/classes/">おすすめクラスを選ぶ</a><a class="button-secondary" href="/class-check/">4問で自分に合う職業を見る</a><a class="button-secondary" href="/leveling/">現在Lvから育成を見る</a><a class="button-secondary" href="/best-builds/">目的別おすすめを見る</a><a class="button-secondary" href="/builds/">全ビルドを見る</a></div></section><section aria-labelledby="problem-guides-title"><h2 id="problem-guides-title">困りごとから探す</h2><p>検索した悩みに直接答えるページから、関連ビルドと現在Lvナビへ進めます。</p><div class="content-grid">${problemCards}</div></section><section aria-labelledby="chapters-title"><h2 id="chapters-title">基礎から学ぶ${guides.length}章</h2><div class="content-grid">${guideCards}</div></section></article></main></body></html>`);

const termCards = terms.map((t) => `<a class="content-card" href="/dictionary/${t.slug}/"><strong>${esc(t.term)}</strong><span>${esc(t.oneLine)}</span></a>`).join("");
await writeFile(resolve(root, "dictionary/index.html"), `<!doctype html><html lang="ja"><head>${head("POE2初心者用語辞典｜独立解説ページ", "POE2初心者が別サイトへ戻らず理解できる、DPS、スキル、耐性、Mappingなどの用語辞典。", `${base}/dictionary/`)}</head><body>${header}<main class="page-main"><nav class="breadcrumbs" aria-label="パンくず"><ol><li><a href="/">ホーム</a></li><li>用語辞典</li></ol></nav><article class="article-page wide-article"><p class="section-kicker">DICTIONARY</p><h1>分からない言葉を、その場で確認</h1><p>各用語は独立URLで詳しく説明し、次に読むガイドへつなげています。</p><div class="content-grid dictionary-cards">${termCards}</div></article></main></body></html>`);

console.log(`Generated ${guides.length} guide pages and ${terms.length} dictionary pages.`);
await import('./generate-discovery-pages.mjs');
await import('./generate-seo-pages.mjs');
