import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const [pages, builds, site] = await Promise.all([
  readJson("data/seo-pages.json"),
  readJson("data/builds.json"),
  readJson("data/site.json")
]);
const base = site.baseUrl;
const publisher = "ca-pub-7738997902416481";
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const absolute = (path) => `${base}${path}`;
const buildUrl = (build) => `/builds/${build.classSlug}/${build.slug}/`;

const header = `<header class="site-header"><a class="brand" href="/" aria-label="POE2ビルドナビ ホーム"><span class="brand-mark" aria-hidden="true">P2</span><span>POE2<br>ビルドナビ</span></a><nav class="site-nav page-nav" aria-label="メインメニュー"><a href="/tier-list/">Tier</a><a href="/league-starter/">スターター</a><a href="/builds/">ビルド</a><a href="/beginner-guide/">初心者ガイド</a></nav></header>`;

function crumbsFor(page) {
  if (page.path.startsWith("/poe2-1-0/")) return [{ name: "ホーム", path: "/" }, { name: "PoE2 1.0", path: "/poe2-1-0/" }, { name: page.h1, path: page.path }];
  return [{ name: "ホーム", path: "/" }, { name: "初心者ガイド", path: "/beginner-guide/" }, { name: page.h1, path: page.path }];
}

function structuredData(page, crumbs) {
  return JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: page.h1,
      description: page.description,
      inLanguage: "ja",
      dateModified: site.lastUpdated,
      mainEntityOfPage: absolute(page.path),
      publisher: { "@type": "Organization", name: site.siteName }
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: absolute(item.path)
      }))
    }
  ]).replaceAll("<", "\\u003c");
}

function buildList() {
  return buildCards(builds.filter((build) => build.status === "verified"));
}

function buildCards(items) {
  return `<div class="seo-build-list">${items.map((build) => `<article><p>${esc(build.className)} / ${esc(build.ascendancy)}</p><h3>${esc(build.name)}</h3><span>主力：${esc(build.mainSkill)}</span><a href="${buildUrl(build)}">現在Lvから育てる</a></article>`).join("")}</div>`;
}

function renderSection(section) {
  const paragraphs = (section.paragraphs ?? []).map((paragraph) => `<p>${esc(paragraph)}</p>`).join("");
  const bullets = section.bullets?.length ? `<ul>${section.bullets.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : "";
  const selectedBuilds = (section.buildIds ?? []).map((id) => builds.find((build) => build.id === id)).filter((build) => build?.status === "verified");
  const buildsHtml = section.buildList === "all" ? buildList() : selectedBuilds.length ? buildCards(selectedBuilds) : "";
  return `<section><h2>${esc(section.heading)}</h2>${paragraphs}${bullets}${buildsHtml}</section>`;
}

for (const page of pages) {
  const crumbs = crumbsFor(page);
  const url = absolute(page.path);
  const breadcrumbs = crumbs.map((item, index) => `<li>${index === crumbs.length - 1 ? esc(item.name) : `<a href="${item.path}">${esc(item.name)}</a>`}</li>`).join("");
  const actions = page.quickActions.map((action, index) => `<li><b>${["最優先", "次", "その次"][index]}</b><span>${esc(action)}</span></li>`).join("");
  const related = page.related.map((item) => `<a href="${item.url}">${esc(item.label)}</a>`).join("");
  const sources = page.sources.length ? `<section class="seo-sources"><h2>確認した情報源</h2><ul>${page.sources.map((source) => `<li><a href="${esc(source.url)}">${esc(source.name)}</a><span>確認：${esc(source.checkedAt)}</span></li>`).join("")}</ul></section>` : "";
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)}</title><meta name="description" content="${esc(page.description)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="google-adsense-account" content="${publisher}"><link rel="canonical" href="${url}"><meta property="og:type" content="article"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="${esc(site.siteName)}"><meta property="og:title" content="${esc(page.title)}"><meta property="og:description" content="${esc(page.description)}"><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary"><link rel="stylesheet" href="/assets/styles.css?v=seo-1"><link rel="stylesheet" href="/assets/mobile.css?v=seo-1"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}" crossorigin="anonymous"></script><script type="application/ld+json">${structuredData(page, crumbs)}</script></head><body><a class="skip-link" href="#main">本文へ移動</a>${header}<main id="main" class="page-main"><nav class="breadcrumbs" aria-label="パンくず"><ol>${breadcrumbs}</ol></nav><article class="article-page seo-landing"><p class="section-kicker">${esc(page.kicker)}</p><h1>${esc(page.h1)}</h1><p class="seo-answer">${esc(page.answer)}</p><div class="update-strip"><span>対応：${esc(site.siteVersion)}</span><span>最終確認：${esc(site.lastUpdated)}</span></div><section class="content-action"><h2>まずやること3つ</h2><ol>${actions}</ol></section>${page.sections.map(renderSection).join("")}${sources}<section class="related seo-related"><h2>次に見るページ</h2><div class="related-links">${related}</div></section></article></main></body></html>`;
  const dir = resolve(root, page.path.slice(1));
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, "index.html"), html);
}

console.log(`Generated ${pages.length} search landing pages.`);
