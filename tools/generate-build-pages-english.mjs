// Generates the English build guide pages (/en/builds/ and /en/builds/<class>/<slug>/)
// from data/builds.json (structure, numbers, URLs, dates) merged with the reviewed
// translations in data/builds-en.json, and writes the per-build English data files
// (data/builds-en/<class>/<slug>.json) that assets/detail-en.js fetches at runtime.
// Runs after generate-simulator-english, following the same pattern as the English
// simulator: Japanese-only enhancers have already finished, and the language-aware
// finishers (skill icons, equipment icons, site usability, sitemap, OG images) run
// after this step and treat the English pages like en/simulator.
// English pages deliberately carry no note.com referral boxes (the note articles
// are Japanese only); Japanese pages are not modified here.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const buildsJa = JSON.parse(await readFile(resolve(root, "data/builds.json"), "utf8"));
const translations = JSON.parse(await readFile(resolve(root, "data/builds-en.json"), "utf8"));
const classes = JSON.parse(await readFile(resolve(root, "data/classes.json"), "utf8"));
const site = JSON.parse(await readFile(resolve(root, "data/site.json"), "utf8"));
const publisher = "ca-pub-7738997902416481";
const baseUrl = "https://poe2-build-navi-jp.github.io";
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const esc = escapeHtml;

const CLASS_EN = { monk: "Monk", mercenary: "Mercenary", warrior: "Warrior", sorceress: "Sorceress", huntress: "Huntress", ranger: "Ranger", witch: "Witch", druid: "Druid" };
const STATUS_LABELS_EN = {
  verified: "Key information from Lv1 to Endgame verified",
  partial: "Some stages are still being checked (gaps are shown in each stage)",
  "needs-review": "Rechecking the sections changed by the current patch",
  draft: "Draft"
};
const AXES_EN = [
  { key: "beginner", field: "beginnerRating", label: "Beginner friendliness" },
  { key: "damage", field: "damageRating", label: "Damage" },
  { key: "defense", field: "defenseRating", label: "Defense" },
  { key: "mapping", field: "mappingRating", label: "Mapping" },
  { key: "boss", field: "bossRating", label: "Boss / Single target" }
];
const BEGINNER_CHECKS_EN = [
  ["earlyMainSkill", "At least one of the build's main skills is usable from Lv22 or below (early substitute skills do not count)"],
  ["moderateOperation", "The source explicitly lists ease of operation as a strength"],
  ["ssfConfirmed", "The source explicitly states the build works in SSF (no trading); \"no uniques required\" alone does not count"],
  ["noDodgeRequirement", "The source explicitly lists defense or safe positioning as a strength"]
];

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));

function mergeStage(ja, en, buildId, index) {
  if (!en) throw new Error(`builds-en: ${buildId} stage ${index} missing`);
  const core = ["label", "mainSkill", "supports", "passivePriority", "gearPriority", "replaceGear", "caution", "transitionCondition"];
  for (const key of core) if (typeof en[key] !== "string" || !en[key]) throw new Error(`builds-en: ${buildId} stage ${index} field ${key} missing`);
  if (!Array.isArray(en.nowActions) || en.nowActions.length !== 3) throw new Error(`builds-en: ${buildId} stage ${index} nowActions must have 3 items`);
  const out = { ...ja, ...pick(en, [...core, "supportSourceStage"]), nowActions: en.nowActions };
  if (ja.actionGuidance) {
    if (!en.actionGuidance?.what || !en.actionGuidance?.where) throw new Error(`builds-en: ${buildId} stage ${index} actionGuidance missing`);
    out.actionGuidance = { ...ja.actionGuidance, ...pick(en.actionGuidance, ["what", "where"]) };
  }
  return out;
}

function mergeBuild(ja) {
  const en = translations[ja.id];
  if (!en) return null;
  const b = { ...ja, ...pick(en, ["name", "seoTitle", "seoDescription", "className", "ascendancy", "mainSkill", "audience", "difficulty", "budget", "strengths", "weaknesses", "gearPriorities"]) };
  if (!b.name || !b.seoTitle || !b.seoDescription || !b.className || !b.ascendancy || !b.mainSkill || !b.audience) throw new Error(`builds-en: ${ja.id} core fields missing`);
  b.levelingStages = ja.levelingStages.map((stage, i) => mergeStage(stage, en.levelingStages?.[i], ja.id, i));
  b.sources = ja.sources.map((source, i) => ({ ...source, ...pick(en.sources?.[i], ["name", "type"]) }));
  b.changeHistory = (ja.changeHistory || []).map((record, i) => ({ ...record, ...pick(en.changeHistory?.[i], ["summary"]) }));
  const evEn = en.ratingEvidence || {};
  b.ratingEvidence = { ...ja.ratingEvidence };
  for (const axis of AXES_EN) {
    const je = ja.ratingEvidence?.[axis.key];
    const ee = evEn[axis.key];
    if (!je) continue;
    if (!ee?.note) throw new Error(`builds-en: ${ja.id} ratingEvidence.${axis.key}.note missing`);
    b.ratingEvidence[axis.key] = { ...je, note: ee.note, ...pick(ee, ["basis", "sourceName", "quote"]) };
    if (axis.key === "beginner" && je.verifiedChecks) {
      b.ratingEvidence.beginner.verifiedChecks = Object.fromEntries(Object.entries(je.verifiedChecks).map(([key, proof]) => [key, { ...proof, ...pick(ee.verifiedChecks?.[key], ["basis"]) }]));
    }
  }
  if (ja.reviewedFacts) {
    if (!en.reviewedFacts) throw new Error(`builds-en: ${ja.id} reviewedFacts missing`);
    b.reviewedFacts = { ...ja.reviewedFacts, ...pick(en.reviewedFacts, ["difficulty", "operation", "gearDependence", "ssfNote"]) };
  }
  if (ja.mainSkillTiming) {
    if (!en.mainSkillTiming) throw new Error(`builds-en: ${ja.id} mainSkillTiming missing`);
    b.mainSkillTiming = { ...ja.mainSkillTiming, ...pick(en.mainSkillTiming, ["available", "recommendedSwitch", "guide"]) };
  }
  if (ja.practicalGuide) {
    if (!en.practicalGuide?.heading || !en.practicalGuide?.scope || !Array.isArray(en.practicalGuide?.questions)) throw new Error(`builds-en: ${ja.id} practicalGuide missing`);
    b.practicalGuide = { ...ja.practicalGuide, ...pick(en.practicalGuide, ["heading", "scope"]), questions: en.practicalGuide.questions };
  }
  return b;
}

const publicJa = buildsJa.filter((build) => build.status !== "draft");
const builds = [];
for (const ja of publicJa) {
  const merged = mergeBuild(ja);
  // Every published build must have a reviewed English translation; a missing one
  // fails the build instead of silently shipping an incomplete English section.
  if (!merged) throw new Error(`builds-en: no English translation for ${ja.id}`);
  builds.push(merged);
}

const ssfLabel = (build) => build.reviewedFacts?.ssfNote || (build.ssf === true ? "Confirmed" : build.ssf === false ? "Not supported" : "Not confirmed");
const passiveSource = (build) => build.sources?.find((source) => /leveling|build|guide|Mobalytics|Maxroll/i.test(`${source.name} ${source.type}`)) || build.sources?.[0];

function evidenceLabelEn(axisKey, e) {
  if (axisKey === "beginner") {
    const count = BEGINNER_CHECKS_EN.filter(([key]) => e.checks[key] === true).length;
    return count ? `Confirmed conditions ${count}/4` : "No conditions confirmed yet";
  }
  if (!e.quote) return "Source statement under review";
  if (e.basis === "Both a strength and a weakness") return "Listed as both a strength and a weakness in the source";
  if (e.basis?.startsWith("Strength")) return "Listed as a strength in the source";
  if (e.basis?.startsWith("Weakness")) return "Listed as a weakness in the source";
  return "Source statement under review";
}

function ratingSectionHtml(build) {
  const ev = build.ratingEvidence;
  const rows = AXES_EN.map((axis) => {
    const e = ev[axis.key];
    const score = build[axis.field];
    let body;
    if (axis.key === "beginner") {
      body = `<p>${esc(e.note)}</p><ul class="rating-checks">${BEGINNER_CHECKS_EN.map(([key, label]) => `<li class="${e.checks[key] ? "ok" : "ng"}"><span aria-hidden="true">${e.checks[key] ? "✓" : "—"}</span>${esc(label)}${e.checks[key] ? `: ${esc(e.verifiedChecks[key].basis)} <a href="${esc(e.verifiedChecks[key].source)}" target="_blank" rel="noopener noreferrer">Source guide</a>` : ""}</li>`).join("")}</ul>`;
    } else if (score == null) {
      body = `<p>${esc(e.note)}</p>`;
    } else {
      body = `<p>${esc(e.note)}</p><p class="rating-quote"><span>${esc(e.basis)}</span> "${esc(e.quote)}" — <a href="${esc(e.source)}" target="_blank" rel="noopener noreferrer">${esc(e.sourceName)}</a> (Checked ${esc(e.checkedAt)})</p>`;
    }
    return `<div class="rating-row"><dt>${esc(axis.label)}</dt><dd><div class="rating-score"><strong>${esc(evidenceLabelEn(axis.key, e))}</strong></div>${body}</dd></div>`;
  }).join("");
  return `<section id="build-rating" class="rating-card" aria-labelledby="rating-title"><p class="section-kicker">SOURCE EVIDENCE</p><h2 id="rating-title">Source evidence for ${esc(build.name)} in 5 areas</h2><p>Beginner friendliness shows how many of the <a href="/rating-criteria/">four shared conditions</a> (Japanese page) were confirmed. Damage, defense, mapping and boss classify what the source guide itself listed as strengths or weaknesses. These are not performance measurements under identical conditions. Scores in the update history are records from the previous rubric.</p><dl class="rating-list">${rows}</dl><p class="disclaimer">Sources checked: ${esc(ev.checkedAt)} / Patch ${esc(build.version)}</p></section>`;
}

function roadmapHtml(build) {
  const source = passiveSource(build);
  return `<section id="roadmap" class="static-roadmap" aria-labelledby="roadmap-title"><div class="section-head"><p class="section-kicker">LEVELING ROADMAP</p><h2 id="roadmap-title">PoE2 ${esc(build.name)} leveling roadmap: Lv1 to Endgame</h2><p>Only the stage for your current level opens first. All ${build.levelingStages.length} stages are on this page, so you can also check the steps ahead. The level bands are this site's guide to progression. Do not switch on level alone — follow the source's Act, gear, gem and ascendancy conditions first.</p></div>${build.levelingStages.map((stage, index) => `<details id="roadmap-stage-${index}" data-stage-index="${index}"${index === 0 ? " open" : ""}><summary><span>${esc(stage.label)}</span><span class="current-stage-marker" hidden>You are here</span></summary><div class="roadmap-stage-body"><ol class="stage-actions">${stage.nowActions.map((action) => `<li>${esc(action)}</li>`).join("")}</ol><dl>${[["Main skill", stage.mainSkill], ["Supports", stage.supports], ["Passives", stage.passivePriority], ["Gear priorities", stage.gearPriority], ["Replacement candidates", stage.replaceGear], ["Caution", stage.caution], [index === build.levelingStages.length - 1 ? "Completion condition" : "When to move to the next stage", stage.transitionCondition]].map(([key, value]) => `<dt>${key}</dt><dd>${esc(value)}</dd>`).join("")}</dl>${source && stage.supportSourceStage ? `<div class="passive-source"><span>Source stage for supports: ${esc(stage.supportSourceStage)}</span><a class="button-secondary" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">Check this stage's supports in the source guide</a></div>` : ""}${source ? `<div class="passive-source"><span>Source stage: ${esc(stage.passivePriority)}</span><a class="button-secondary" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">View this stage's passive tree in the source</a></div>` : ""}<label class="progress-check stage-complete"><input type="checkbox">I have completed this stage</label></div></details>`).join("")}</section>`;
}

const NAV_EN = `<a href="/guides/">Guides (Japanese)</a><a href="/beginner-builds/">Starter builds (Japanese)</a><a href="/tier-list/">Beginner tier (Japanese)</a><a href="/league-starter/">League starter (Japanese)</a><a href="/builds/">Browse builds (Japanese)</a><a href="/gear-check/">Gear check (Japanese)</a><a href="/beginner-guide/">Beginner guide (Japanese)</a><a href="/leveling/">Leveling (Japanese)</a><a href="/dictionary/">Glossary (Japanese)</a><a href="/search/">Site search (Japanese)</a><a href="/en/builds/">Build guides</a><a href="/en/simulator/">Simulator</a><a href="/en/simulator/#sim-resume">Saved builds</a>`;
// Placed last in <head>: enhancers insert their blocks before site-icon, so the page's own assets must come
// before it or the block order would depend on which tool ran first (npm run test:order).
const ICON_EN = `<!-- site-icon:start --><link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="alternate" type="application/atom+xml" title="POE2 Build Navi updates (Japanese)" href="/feed.xml"><!-- site-icon:end -->`;
const FOOTER_EN = `<footer class="site-footer"><div class="footer-row"><div class="footer-brand"><span class="brand-mark" aria-hidden="true">P2</span><span>POE2<br>Build Navi</span></div><nav class="footer-links" aria-label="Site information"><a href="/about/">About (Japanese)</a><a href="/editorial-policy/">Editorial policy (Japanese)</a><a href="/privacy/">Privacy (Japanese)</a><a href="/terms/">Terms (Japanese)</a><a href="/issues/">Issues and reports (Japanese)</a><a href="/site-map/">Sitemap (Japanese)</a></nav></div><p class="fine">Path of Exile 2 is a trademark of Grinding Gear Games. This site is not affiliated with or endorsed by Grinding Gear Games.</p></footer>`;
const headerHtml = `<header class="site-header"><a class="brand" href="/" aria-label="POE2 Build Navi home"><span class="brand-mark">POE2</span><span>Build Navi</span></a><button id="menu-button" class="menu-button" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button><nav id="site-nav" class="site-nav" aria-label="Main menu">${NAV_EN}</nav></header>`;

function detailPage(build, related) {
  const jaPath = `/builds/${build.classSlug}/${build.slug}/`;
  const enPath = `/en${jaPath}`;
  const relatedStatic = related.map((item) => `<a href="/en/builds/${item.classSlug}/${item.slug}/">${esc(item.name)}</a>`).join("");
  const switchNote = build.mainSkillTiming?.recommendedSwitch || "See the stage-by-stage leveling steps below.";
  const history = (build.changeHistory || []).map((record) => `<li><time datetime="${esc(record.date)}">${esc(record.date)}</time> ${esc(record.summary)}</li>`).join("");
  const facts = build.reviewedFacts;
  const practical = build.practicalGuide ? `<section id="practical-guide" class="content-section" aria-labelledby="practical-guide-title"><p class="section-kicker">PRACTICAL GUIDE</p><h2 id="practical-guide-title">${esc(build.practicalGuide.heading)}</h2><p>${esc(build.practicalGuide.scope)}</p>${build.practicalGuide.questions.map((q) => `<h3>${esc(q.question)}</h3><p>${esc(q.answer)}</p>`).join("")}</section>` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(build.seoTitle)}</title>
<meta name="description" content="${esc(build.seoDescription)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${baseUrl}${enPath}">
<link rel="alternate" hreflang="ja" href="${baseUrl}${jaPath}">
<link rel="alternate" hreflang="en" href="${baseUrl}${enPath}">
<link rel="alternate" hreflang="x-default" href="${baseUrl}${jaPath}">
<meta property="og:type" content="article">
<meta property="og:locale" content="en_US">
<meta property="og:site_name" content="POE2 Build Navi">
<meta property="og:title" content="${esc(build.seoTitle)}">
<meta property="og:description" content="${esc(build.seoDescription)}">
<meta property="og:url" content="${baseUrl}${enPath}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(build.seoTitle)}">
<meta name="twitter:description" content="${esc(build.seoDescription)}">
<link rel="stylesheet" href="/assets/styles.css">
<link rel="stylesheet" href="/assets/level-input.css">
<link rel="stylesheet" href="/assets/build-answer.css">
<link rel="stylesheet" href="/assets/mobile.css">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}" crossorigin="anonymous"></script>
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${baseUrl}/` }, { "@type": "ListItem", position: 2, name: "Build guides", item: `${baseUrl}/en/builds/` }, { "@type": "ListItem", position: 3, name: build.className, item: `${baseUrl}/classes/${build.classSlug}/` }, { "@type": "ListItem", position: 4, name: build.name, item: `${baseUrl}${enPath}` }] })}</script>
<script type="module" src="/assets/detail-en.js"></script>${ICON_EN}</head>
<body data-page="build-detail">
<a class="skip-link" href="#main">Skip to main content</a>
${headerHtml}
<main id="main" class="detail-layout">
<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/en/builds/">Build guides</a><span aria-hidden="true">/</span><a id="breadcrumb-class" href="/classes/${build.classSlug}/">${esc(build.className)}</a><span aria-hidden="true">/</span><span id="breadcrumb-name" aria-current="page">${esc(build.name)}</span></nav>
<section class="detail-hero">
<div><p class="eyebrow">POE2 BUILD GUIDE</p><h1 id="build-name">PoE2 ${esc(build.name)} Build | ${esc(build.version)} Leveling Guide</h1><p id="build-class" class="build-class">${esc(build.className)} / ${esc(build.ascendancy)}</p><p id="build-skill" class="build-skill">Main skill: ${esc(build.mainSkill)}</p></div>
<div class="detail-status"><span class="status-badge">${esc(STATUS_LABELS_EN[build.status] || build.status)}</span><p><strong>Sources checked</strong><br>${esc(build.updatedAt)}</p><p><strong>Applicable patch</strong><br>PoE2 ${esc(build.version)}</p><p><strong>Language</strong><br><a href="${jaPath}">Japanese version</a></p></div>
</section>
<section class="level-card" aria-labelledby="level-card-title"><div><p class="section-kicker">YOUR LEVEL</p><h2 id="level-card-title">What is your current level?</h2><p>Enter your level and the matching stage, its three priority actions and a progress checklist appear automatically. If you are unsure which stage to check, the stage's label shows the level range.</p><p id="level-input-help" class="disclaimer">Enter a number from 1 to 100. You can also use the slider or the minus / plus buttons.</p></div><div class="level-controls"><button id="level-minus" type="button" aria-label="Decrease level">−</button><label>Level<input id="level-input" type="number" min="1" max="100" value="1" inputmode="numeric" aria-describedby="level-input-help"></label><button id="level-plus" type="button" aria-label="Increase level">＋</button><input id="level-range" type="range" min="1" max="100" value="1" aria-label="Level"><output id="level-output" for="level-input level-range">Lv1</output></div></section>
<section id="now" class="now-panel" aria-labelledby="now-title"><div class="now-head"><div><p class="section-kicker">WHAT TO DO NOW</p><h2 id="now-title">What to do now: <span id="now-stage">Lv1–10</span></h2><p id="now-source-label" class="disclaimer">Priority actions organized from the published sources</p></div><p id="now-next" class="next-goal">Next goal: Lv11</p></div><ol class="now-actions"><li data-now-action></li><li data-now-action></li><li data-now-action></li></ol><p id="now-action-guidance" class="now-action-guidance" hidden></p><div class="now-links"><a class="button" href="#roadmap">Open the roadmap</a><a id="now-stage-detail" class="button-secondary" href="#roadmap-stage-0">View this stage in the roadmap</a><a class="button-secondary" data-simulator-level="${esc(build.id)}" href="/en/simulator/?build=${encodeURIComponent(build.id)}&level=1&from=guide">Open this build in the simulator</a></div></section>
<section class="progress-card" aria-labelledby="progress-title"><div class="progress-head"><div><p class="section-kicker">PROGRESS CHECK</p><h2 id="progress-title">Stage progress</h2></div><strong id="progress-percent">0%</strong></div><div class="progress-track"><span id="progress-bar"></span></div><div id="progress-checks" class="progress-checks"></div><p id="progress-next" class="disclaimer"></p></section>
<section class="trouble-card" aria-labelledby="trouble-title"><p class="section-kicker">TROUBLESHOOTING</p><h2 id="trouble-title">Stuck? Start here</h2><p>Choose what is going wrong and you get a three-step plan for your current stage. The plan is built from the build data, not from a fixed price or an unverified setting.</p><div class="trouble-buttons"><button type="button" data-trouble="death" aria-pressed="false">Dying often</button><button type="button" data-trouble="damage" aria-pressed="false">Not enough damage</button><button type="button" data-trouble="mana" aria-pressed="false">Mana runs out</button><button type="button" data-trouble="boss" aria-pressed="false">Bosses take too long</button><button type="button" data-trouble="speed" aria-pressed="false">Clearing too slowly</button><button type="button" data-trouble="gear" aria-pressed="false">Do not know what gear to buy</button></div><div id="trouble-result" class="trouble-result" aria-live="polite"><p class="disclaimer">Choose a problem and a plan for your current stage appears here.</p></div></section>
${roadmapHtml(build)}
${ratingSectionHtml(build)}
${practical}
<section class="content-section" aria-labelledby="profile-title"><p class="section-kicker">BUILD PROFILE</p><h2 id="profile-title">${esc(build.name)}: strengths, weaknesses and gear priorities</h2><p>Organized from the published sources. Use it as a checklist before choosing and when replacing gear, not as a score.</p><div class="profile-grid"><div><h3>Strengths</h3><ul id="strength-list">${build.strengths.map((v) => `<li>${esc(v)}</li>`).join("")}</ul></div><div><h3>Weaknesses &amp; cautions</h3><ul id="weakness-list">${build.weaknesses.map((v) => `<li>${esc(v)}</li>`).join("")}</ul></div><div><h3>Gear priorities</h3><ol id="gear-priority-list">${build.gearPriorities.map((v) => `<li>${esc(v)}</li>`).join("")}</ol></div></div></section>
<section class="content-section" aria-labelledby="faq-title"><p class="section-kicker">FAQ</p><h2 id="faq-title">${esc(build.name)} build FAQ</h2><h3>Who is this build for?</h3><p>${esc(build.audience)}</p><h3>What weakness should I know before starting?</h3><p>${esc(build.weaknesses[0])}</p><h3>What should I do at my current level?</h3><p>Enter your current level at the top of this page and the matching stage and its three priority actions appear automatically.</p></section>
<section class="content-section" aria-labelledby="fact-title"><p class="section-kicker">FACT CHECK</p><h2 id="fact-title">Build facts checked</h2><div id="fact-grid" class="fact-grid"></div><p class="disclaimer">Best for: ${esc(build.audience)} / Operation difficulty: ${esc(build.difficulty)} / Budget: ${esc(build.budget)} / When to switch to the main skill: ${esc(switchNote)}</p></section>
<section class="content-section" aria-labelledby="guide-links-title"><p class="section-kicker">GUIDES (JAPANESE)</p><h2 id="guide-links-title">When you are unsure about passives or gear for ${esc(build.name)}</h2><div class="related-links"><a href="/guides/resistance/">Resistances (Japanese)</a><a href="/guides/passive-tree/">Passive allocation (Japanese)</a><a href="/guides/increase-damage/">Not enough damage (Japanese)</a><a href="/guides/mapping/">Starting Mapping (Japanese)</a></div><p><a id="gear-check-link" class="button" href="/gear-check/?build=${encodeURIComponent(build.id)}&level=1&concern=purchase">Open the gear check (Japanese)</a></p></section>
<section class="content-section" aria-labelledby="related-title"><p class="section-kicker">RELATED</p><h2 id="related-title">Related builds and next pages</h2><div id="related-links" class="related-links">${relatedStatic}</div><div class="related-buttons"><a class="button-secondary" href="/classes/${build.classSlug}/">${esc(build.className)} builds (Japanese)</a><a class="button-secondary" href="/en/builds/">All build guides</a><a class="button-secondary" data-unique-gear-level href="/guides/unique-gear/?build=${encodeURIComponent(build.id)}&level=1#purchase-${encodeURIComponent(build.id)}">Unique gear for this build (Japanese)</a><a class="button-secondary" href="/tier-list/">Compare by beginner tier (Japanese)</a><a class="button-secondary" href="/league-starter/">Compare league starters (Japanese)</a><a class="button-secondary" href="/beginner-guide/">Beginner guide (Japanese)</a></div></section>
<section class="content-section" aria-labelledby="sources-title"><p class="section-kicker">SOURCES</p><h2 id="sources-title">Sources checked</h2><p>The text is not copied; the published sources were checked and reorganized into beginner-friendly steps.</p><ul id="source-list" class="source-list">${build.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a><span>${esc(s.type)} · Checked ${esc(s.checkedAt)}</span></li>`).join("")}</ul></section>
<section class="content-section" aria-labelledby="history-title"><p class="section-kicker">UPDATE HISTORY</p><h2 id="history-title">Source checks and update history</h2><p>Build sources checked: ${esc(build.updatedAt)} / Patch ${esc(build.version)}.</p>${history ? `<ul class="update-history">${history}</ul>` : ""}${facts ? `<p>${esc(facts.checkedAt)}: The comparison items below were additionally checked against the source guide. This is not the date the full ${build.levelingStages.length} stages were re-verified.</p><ul><li>Operation difficulty: ${esc(facts.difficulty)}</li><li>Operation load: ${esc(facts.operation)}</li><li>Gear requirements: ${esc(facts.gearDependence)}</li><li>SSF: ${esc(facts.ssfNote)}</li></ul><p><a href="${esc(facts.source)}" target="_blank" rel="noopener noreferrer">View the source guide checked</a></p>` : ""}</section>
</main>
${FOOTER_EN}
<a class="mobile-sticky" href="#now">See what to do at your current level</a>
</body>
</html>`;
}

function listPage() {
  const sections = classes.map((klass) => {
    const classBuilds = builds.filter((build) => build.classSlug === klass.slug);
    if (!classBuilds.length) return "";
    return `<section aria-labelledby="class-${klass.slug}"><h2 id="class-${klass.slug}">${esc(CLASS_EN[klass.slug] || klass.name)}</h2><div class="catalog-list">${classBuilds.map((build) => `<article class="catalog-card"><div><p>${esc(build.className)} / ${esc(build.ascendancy)}</p><h3>${esc(build.name)}</h3><p>Main skill: ${esc(build.mainSkill)}</p></div><div class="catalog-fit"><strong>Best for: ${esc(build.audience)}</strong><p>Weakness: ${esc(build.weaknesses[0])}</p></div><dl><div><dt>Operation</dt><dd>${esc(build.difficulty)}</dd></div><div><dt>SSF</dt><dd>${esc(ssfLabel(build))}</dd></div><div><dt>Patch</dt><dd>${esc(build.version)}</dd></div></dl><a class="button" href="/en/builds/${build.classSlug}/${build.slug}/">Level from Lv1</a></article>`).join("")}</div></section>`;
  }).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PoE2 Build Guides (0.5.5) | Compare Main Skills, Operation and SSF</title>
<meta name="description" content="English PoE2 0.5.5 build guides for all 8 classes: ${builds.length} builds with a Lv1-to-Endgame leveling roadmap, source-checked strengths, weaknesses and gear priorities.">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${baseUrl}/en/builds/">
<link rel="alternate" hreflang="ja" href="${baseUrl}/builds/">
<link rel="alternate" hreflang="en" href="${baseUrl}/en/builds/">
<link rel="alternate" hreflang="x-default" href="${baseUrl}/builds/">
<meta property="og:type" content="website">
<meta property="og:locale" content="en_US">
<meta property="og:site_name" content="POE2 Build Navi">
<meta property="og:title" content="PoE2 Build Guides (0.5.5) | Compare Main Skills, Operation and SSF">
<meta property="og:description" content="English PoE2 0.5.5 build guides for all 8 classes: ${builds.length} builds with a Lv1-to-Endgame leveling roadmap, source-checked strengths, weaknesses and gear priorities.">
<meta property="og:url" content="${baseUrl}/en/builds/">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/styles.css">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}" crossorigin="anonymous"></script>
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${baseUrl}/` }, { "@type": "ListItem", position: 2, name: "Build guides", item: `${baseUrl}/en/builds/` }] })}</script>${ICON_EN}</head>
<body data-page="builds-en">
<a class="skip-link" href="#main">Skip to main content</a>
${headerHtml}
<main id="main">
<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span aria-current="page">Build guides</span></nav>
<section class="page-hero"><p class="eyebrow">BUILD GUIDES</p><h1>PoE2 0.5.5 Build Guides by Class</h1><p>All ${builds.length} guides are checked against published sources. Each page gives you a stage-by-stage roadmap from Lv1 to Endgame: enter your current level and see the three things to do now, plus source-checked strengths, weaknesses and gear priorities.</p><p><a href="/builds/">日本語版のビルド一覧はこちら</a></p></section>
${sections}
</main>
${FOOTER_EN}
</body>
</html>`;
}

let written = 0;
for (const build of builds) {
  const related = builds.filter((item) => item.id !== build.id && item.className === build.className).slice(0, 3)
    .map((item) => ({ id: item.id, name: item.name, classSlug: item.classSlug, slug: item.slug }));
  const staticRelated = [...builds.filter((item) => item.id !== build.id && item.className === build.className), ...builds.filter((item) => item.id !== build.id && item.className !== build.className)].slice(0, 3);
  const dataDir = resolve(root, "data/builds-en", build.classSlug);
  await mkdir(dataDir, { recursive: true });
  await writeFile(resolve(dataDir, `${build.slug}.json`), `${JSON.stringify({ build, related }, null, 2)}\n`);
  const pageDir = resolve(root, "en/builds", build.classSlug, build.slug);
  await mkdir(pageDir, { recursive: true });
  await writeFile(resolve(pageDir, "index.html"), detailPage(build, staticRelated));
  written += 1;
}
await mkdir(resolve(root, "en/builds"), { recursive: true });
await writeFile(resolve(root, "en/builds/index.html"), listPage());
console.log(`English build pages: ${written} detail pages + /en/builds/ list (${builds.length} builds)`);
