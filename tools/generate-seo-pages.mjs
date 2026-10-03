import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const [pages, builds, site, classes, terms] = await Promise.all([
  readJson("data/seo-pages.json"),
  readJson("data/builds.json"),
  readJson("data/site.json"),
  readJson("data/classes.json"),
  readJson("data/dictionary.json")
]);
const base = site.baseUrl;
const publisher = "ca-pub-7738997902416481";
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const absolute = (path) => `${base}${path}`;
const buildUrl = (build) => `/builds/${build.classSlug}/${build.slug}/`;

const header = `<header class="site-header"><a class="brand" href="/" aria-label="POE2ビルドナビ ホーム"><span class="brand-mark" aria-hidden="true">P2</span><span>POE2<br>ビルドナビ</span></a><nav class="site-nav page-nav" aria-label="メインメニュー"><a href="/tier-list/">Tier</a><a href="/league-starter/">スターター</a><a href="/builds/">ビルド</a><a href="/beginner-guide/">初心者ガイド</a></nav></header>`;

function crumbsFor(page) {
  if (page.topLevel) return [{ name: "ホーム", path: "/" }, { name: page.crumb ?? page.h1, path: page.path }];
  if (page.path.startsWith("/dictionary/")) return [{ name: "ホーム", path: "/" }, { name: "用語辞典", path: "/dictionary/" }, { name: page.crumb ?? page.h1, path: page.path }];
  if (page.path.startsWith("/poe2-1-0/")) return [{ name: "ホーム", path: "/" }, { name: "PoE2 1.0", path: "/poe2-1-0/" }, { name: page.h1, path: page.path }];
  return [{ name: "ホーム", path: "/" }, { name: "初心者ガイド", path: "/beginner-guide/" }, { name: page.h1, path: page.path }];
}

// Newest source check date for the page; the site-wide date can be older than a page's own sources.
const checkedDate = (page) => [site.lastUpdated, ...(page.sources ?? []).map((source) => source.checkedAt)].filter(Boolean).sort().at(-1);

function structuredData(page, crumbs) {
  return JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: page.h1,
      description: page.description,
      inLanguage: "ja",
      ...(page.publishedAt ? { datePublished: page.publishedAt } : {}),
      // Never before the publish date (the visible "最終確認" stays the source check date).
      dateModified: [checkedDate(page), page.publishedAt].filter(Boolean).sort().at(-1),
      mainEntityOfPage: absolute(page.path),
      // Same file generate-og-images writes for this path.
      image: absolute(`/images/poe2/og/poe2-${page.path.replace(/^\/|\/$/g, "").replaceAll("/", "-")}-og.webp`),
      author: { "@type": "Organization", name: site.operatorName ?? site.siteName, url: absolute("/about/") },
      publisher: { "@type": "Organization", name: site.siteName, url: `${base}/` },
      ...(page.about ? { about: page.about } : {})
    },
    ...(page.term ? [{
      "@context": "https://schema.org",
      "@type": "DefinedTerm",
      name: page.term.name,
      ...(page.term.alternateName ? { alternateName: page.term.alternateName } : {}),
      description: page.answer,
      url: absolute(page.path),
      inDefinedTermSet: { "@type": "DefinedTermSet", name: `${site.siteName} PoE2用語辞典`, url: absolute("/dictionary/") }
    }] : []),
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

// 1.0 status of every listed build, derived from builds.json so it never goes stale.
function buildStatus() {
  const next = site.nextGameVersion;
  const released = site.gameVersion === next;
  const listed = builds.filter((build) => build.status === "verified");
  const done = listed.filter((build) => build.version === next);
  const waiting = listed.filter((build) => build.version !== next);
  const card = (build) => {
    const state = build.version === next ? `${next}で確認済み（${build.updatedAt}）` : released ? `${next}では確認中` : `${next}公開後に確認`;
    return `<article><p>${esc(build.className)} / ${esc(build.ascendancy)}</p><h3>${esc(build.name)}</h3><span>作成時の版：${esc(build.version)}／${esc(state)}</span><a href="${buildUrl(build)}">ビルドを見る</a></article>`;
  };
  const summary = `<p class="build-status-summary"><b>${next}で確認済み：${done.length} / ${listed.length}ビルド</b>${!released && !done.length ? `（${next}は未公開のため、確認済みのビルドはまだありません）` : ""}</p>`;
  const doneHtml = done.length ? `<h3>${next}で確認済み</h3><div class="seo-build-list">${done.map(card).join("")}</div>` : "";
  const waitingHtml = waiting.length ? `<h3>確認待ち</h3><div class="seo-build-list">${waiting.map(card).join("")}</div>` : "";
  return `${summary}${doneHtml}${waitingHtml}`;
}

// Builds whose data matches a section's buildMatch: {"field":"ssf","equals":true} or {"text":"regex"}.
function matchBuilds(match) {
  const listed = builds.filter((build) => build.status === "verified");
  if (match.field) return listed.filter((build) => build[match.field] === match.equals);
  const pattern = new RegExp(match.text, "i");
  return listed.filter((build) => pattern.test(JSON.stringify([build.mainSkill, build.strengths, build.weaknesses, build.gearPriorities, build.levelingStages])));
}

function factTable(rows) {
  return `<div class="comparison-scroll"><table class="comparison-table facts-table"><tbody>${rows.map(([label, value]) => `<tr><th scope="row">${esc(label)}</th><td data-label="${esc(label)}">${esc(value)}</td></tr>`).join("")}</tbody></table></div>`;
}

// Table of listed builds with chosen columns, e.g. [{"label":"主力スキル","field":"mainSkill"}].
function buildTable(columns) {
  const listed = builds.filter((build) => build.status === "verified");
  return `<div class="comparison-scroll"><table class="comparison-table facts-table"><thead><tr><th scope="col">ビルド</th>${columns.map((column) => `<th scope="col">${esc(column.label)}</th>`).join("")}</tr></thead><tbody>${listed.map((build) => `<tr><th scope="row"><a href="${buildUrl(build)}">${esc(build.name)}</a></th>${columns.map((column) => `<td data-label="${esc(column.label)}">${esc(build[column.field])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

// Per build, the strengths/weaknesses sentences matching a regex (buildNotes) or the first
// n gear priorities (buildGear), each linked to the build page.
function buildNoteList(items) {
  return `<ul class="build-notes">${items.map(([build, lines]) => `<li><a href="${buildUrl(build)}">${esc(build.name)}</a><ul>${lines.map((line) => `<li>${esc(line)}</li>`).join("")}</ul></li>`).join("")}</ul>`;
}
function buildNotes(regex) {
  const pattern = new RegExp(regex);
  return buildNoteList(builds.filter((build) => build.status === "verified").map((build) => [build, [...build.strengths, ...build.weaknesses].filter((line) => pattern.test(line))]).filter(([, lines]) => lines.length));
}
function buildGear(count) {
  return buildNoteList(builds.filter((build) => build.status === "verified").map((build) => [build, build.gearPriorities.slice(0, count)]));
}

function classCards() {
  return `<div class="seo-build-list">${classes.map((item) => `<article><p>${esc([].concat(item.combatStyle ?? []).join("・"))}</p><h3>${esc(item.name)}</h3><span>${esc(item.tagline)}</span><a href="/classes/${item.slug}/">${esc(item.name)}のビルドを見る</a></article>`).join("")}</div>`;
}

function termLinks(slugs) {
  const items = slugs.map((slug) => terms.find((term) => term.slug === slug)).filter(Boolean);
  return `<ul class="term-links">${items.map((term) => `<li><a href="/dictionary/${term.slug}/">${esc(term.term)}</a>：${esc(term.oneLine)}</li>`).join("")}</ul>`;
}

function renderSection(section) {
  const paragraphs = (section.paragraphs ?? []).map((paragraph) => `<p>${esc(paragraph)}</p>`).join("");
  const bullets = section.bullets?.length ? `<ul>${section.bullets.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : "";
  const selectedBuilds = (section.buildIds ?? []).map((id) => builds.find((build) => build.id === id)).filter((build) => build?.status === "verified");
  const matched = section.buildMatch ? matchBuilds(section.buildMatch) : [];
  const buildsHtml = section.buildStatus ? buildStatus() : section.buildList === "all" ? buildList() : selectedBuilds.length ? buildCards(selectedBuilds) : matched.length ? buildCards(matched) : "";
  const matchedNote = section.buildMatch && section.matchedNote ? `<p>${esc(section.matchedNote.replace("{count}", matched.length).replace("{total}", builds.filter((build) => build.status === "verified").length))}</p>` : "";
  const table = section.table ? factTable(section.table) : "";
  const classHtml = section.classList ? classCards() : "";
  const notesHtml = section.buildNotes ? buildNotes(section.buildNotes) : section.buildGear ? buildGear(section.buildGear) : "";
  const buildTableHtml = section.buildTable ? buildTable(section.buildTable) : "";
  const termHtml = section.termLinks ? `${section.termIntro ? `<p>${esc(section.termIntro)}</p>` : ""}${termLinks(section.termLinks)}` : "";
  const links = section.links?.length ? `<div class="related-links">${section.links.map((item) => `<a href="${item.url}">${esc(item.label)}</a>`).join("")}</div>` : "";
  return `<section${section.id ? ` id="${esc(section.id)}"` : ""}><h2>${esc(section.heading)}</h2>${paragraphs}${table}${bullets}${matchedNote}${buildsHtml}${buildTableHtml}${notesHtml}${classHtml}${termHtml}${links}</section>`;
}

for (const page of pages) {
  const crumbs = crumbsFor(page);
  const url = absolute(page.path);
  const breadcrumbs = crumbs.map((item, index) => `<li>${index === crumbs.length - 1 ? esc(item.name) : `<a href="${item.path}">${esc(item.name)}</a>`}</li>`).join("");
  const actions = page.quickActions.map((action, index) => `<li><b>${["最優先", "次", "その次"][index]}</b><span>${esc(action)}</span></li>`).join("");
  const related = page.related.map((item) => `<a href="${item.url}">${esc(item.label)}</a>`).join("");
  const faq = page.faq?.length ? `<section class="seo-faq"><h2>よくある質問</h2>${page.faq.map((item) => `<details><summary>${esc(item.q)}</summary><p>${esc(item.a)}</p></details>`).join("")}</section>` : "";
  const sources = page.sources.length ? `<section class="seo-sources"><h2>確認した情報源</h2><ul>${page.sources.map((source) => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a><span>確認：${esc(source.checkedAt)}</span></li>`).join("")}</ul></section>` : "";
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)}</title><meta name="description" content="${esc(page.description)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="google-adsense-account" content="${publisher}"><link rel="canonical" href="${url}"><meta property="og:type" content="article"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="${esc(site.siteName)}"><meta property="og:title" content="${esc(page.title)}"><meta property="og:description" content="${esc(page.description)}"><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary"><link rel="stylesheet" href="/assets/styles.css?v=seo-1"><link rel="stylesheet" href="/assets/mobile.css?v=seo-1"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}" crossorigin="anonymous"></script><script type="application/ld+json">${structuredData(page, crumbs)}</script></head><body><a class="skip-link" href="#main">本文へ移動</a>${header}<main id="main" class="page-main"><nav class="breadcrumbs" aria-label="パンくず"><ol>${breadcrumbs}</ol></nav><article class="article-page seo-landing"><p class="section-kicker">${esc(page.kicker)}</p><h1>${esc(page.h1)}</h1><p class="seo-answer">${esc(page.answer)}</p><div class="update-strip"><span>対応：${esc(site.siteVersion)}</span><span>最終確認：${esc(checkedDate(page))}</span></div><section class="content-action"><h2>${esc(page.actionsHeading ?? "まずやること3つ")}</h2><ol>${actions}</ol></section>${page.sections.map(renderSection).join("")}${faq}${sources}<section class="related seo-related"><h2>次に見るページ</h2><div class="related-links">${related}</div></section></article></main></body></html>`;
  const dir = resolve(root, page.path.slice(1));
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, "index.html"), html);
}

console.log(`Generated ${pages.length} search landing pages.`);
