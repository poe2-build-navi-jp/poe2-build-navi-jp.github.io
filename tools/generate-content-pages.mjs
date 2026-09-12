import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const guides = JSON.parse(await readFile(resolve(root, "data/guides.json"), "utf8"));
const terms = JSON.parse(await readFile(resolve(root, "data/dictionary.json"), "utf8"));
const base = "https://poe2-build-navi-jp.github.io";
const publisher = "ca-pub-7738997902416481";
const esc = (v) => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const head = (title, description, url) => `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow"><meta name="google-adsense-account" content="${publisher}"><link rel="canonical" href="${url}"><meta property="og:type" content="article"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="POE2ビルドナビ"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary"><link rel="stylesheet" href="/assets/styles.css?v=discovery-2"><link rel="stylesheet" href="/assets/mobile.css?v=discovery-2"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}" crossorigin="anonymous"></script>`;
const header = `<header class="site-header"><a class="brand" href="/"><span class="brand-mark">P2</span><span>POE2<br>ビルドナビ</span></a><nav class="site-nav page-nav"><a href="/builds/">ビルド</a><a href="/class-check/">職業診断</a><a href="/beginner-guide/">初心者ガイド</a><a href="/dictionary/">用語辞典</a></nav></header>`;

for (const guide of guides) {
  const dir = resolve(root, "guides", guide.slug);
  const url = `${base}/guides/${guide.slug}/`;
  const actions = guide.actions.map((x, i) => `<li><b>${["最優先", "次", "その次"][i]}</b><span>${esc(x)}</span></li>`).join("");
  const details = guide.details.map((x) => `<p>${esc(x)}</p>`).join("");
  const html = `<!doctype html><html lang="ja"><head>${head(`POE2 ${guide.title}｜初心者ガイド`, guide.summary, url)}</head><body>${header}<main class="page-main"><nav class="breadcrumbs"><ol><li><a href="/">ホーム</a></li><li><a href="/beginner-guide/">初心者ガイド</a></li><li>${esc(guide.title)}</li></ol></nav><article class="article-page"><p class="section-kicker">BEGINNER GUIDE</p><h1>${esc(guide.title)}</h1><p class="lead">${esc(guide.summary)}</p><section class="content-action"><h2>今日確認すること</h2><ol>${actions}</ol></section><section><h2>初心者向け説明</h2>${details}</section><aside class="next-box"><b>次の行動</b><p>関連する画面を開いて、今の自分に必要な項目を確認してください。</p><a class="button" href="${guide.related}">関連ページへ</a></aside><p><a href="/beginner-guide/">13章の一覧へ戻る</a></p></article></main></body></html>`;
  await mkdir(dir, { recursive: true }); await writeFile(resolve(dir, "index.html"), html);
}

for (const term of terms) {
  const dir = resolve(root, "dictionary", term.slug);
  const url = `${base}/dictionary/${term.slug}/`;
  const html = `<!doctype html><html lang="ja"><head>${head(`POE2 ${term.term}とは｜初心者用語辞典`, `${term.term}をPOE2初心者向けに説明。${term.oneLine}`, url)}</head><body>${header}<main class="page-main"><nav class="breadcrumbs"><ol><li><a href="/">ホーム</a></li><li><a href="/dictionary/">用語辞典</a></li><li>${esc(term.term)}</li></ol></nav><article class="article-page"><p class="section-kicker">DICTIONARY</p><h1>${esc(term.term)}</h1><section class="term-lead"><h2>一言でいうと</h2><p>${esc(term.oneLine)}</p></section><h2>初心者向け説明</h2><p>${esc(term.description)}</p><h2>なぜ重要？</h2><p>${esc(term.importance)}</p><h2>次にすること</h2><p>${esc(term.action)}</p><div class="section-cta"><a class="button" href="${term.guide}">関連ガイド</a><a class="button button-ghost" href="/dictionary/">用語一覧</a></div></article></main></body></html>`;
  await mkdir(dir, { recursive: true }); await writeFile(resolve(dir, "index.html"), html);
}

const guideCards = guides.map((g, i) => `<a class="content-card" href="/guides/${g.slug}/"><small>第${i + 1}章</small><strong>${esc(g.title)}</strong><span>${esc(g.summary)}</span></a>`).join("");
await writeFile(resolve(root, "beginner-guide/index.html"), `<!doctype html><html lang="ja"><head>${head("POE2初心者ガイド全13章｜始め方からEndgameまで", "POE2を始めてから職業、ビルド、スキル、装備、Mapping、Endgameまで順番に学べる初心者ガイド全13章。", `${base}/beginner-guide/`)}</head><body>${header}<main class="page-main"><nav class="breadcrumbs"><ol><li><a href="/">ホーム</a></li><li>初心者ガイド</li></ol></nav><article class="article-page wide-article"><p class="section-kicker">BEGINNER GUIDE / 13 CHAPTERS</p><h1>初めてからEndgameまで、順番に理解する</h1><p>一度に全部読む必要はありません。今困っている章から開き、最後にビルド詳細の「今日やること」へ戻ってください。</p><div class="content-grid">${guideCards}</div></article></main></body></html>`);

const termCards = terms.map((t) => `<a class="content-card" href="/dictionary/${t.slug}/"><strong>${esc(t.term)}</strong><span>${esc(t.oneLine)}</span></a>`).join("");
await writeFile(resolve(root, "dictionary/index.html"), `<!doctype html><html lang="ja"><head>${head("POE2初心者用語辞典｜独立解説ページ", "POE2初心者が別サイトへ戻らず理解できる、DPS、スキル、耐性、Mappingなどの用語辞典。", `${base}/dictionary/`)}</head><body>${header}<main class="page-main"><nav class="breadcrumbs"><ol><li><a href="/">ホーム</a></li><li>用語辞典</li></ol></nav><article class="article-page wide-article"><p class="section-kicker">DICTIONARY</p><h1>分からない言葉を、その場で確認</h1><p>各用語は独立URLで詳しく説明し、次に読むガイドへつなげています。</p><div class="content-grid dictionary-cards">${termCards}</div></article></main></body></html>`);

console.log(`Generated ${guides.length} guide pages and ${terms.length} dictionary pages.`);
await import('./generate-discovery-pages.mjs');
await import('./generate-seo-pages.mjs');
