import { access, readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { validateRatings } from "../tools/build-ratings.mjs";

const root = resolve(import.meta.dirname, "..");
const baseUrl = "https://poe2-build-navi-jp.github.io";
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const read = (path) => readFile(resolve(root, path), "utf8");

const required = ["index.html", "404.html", "robots.txt", "sitemap.xml", "ads.txt", "googlebaa56ffa7c50bcfb.html", "data/classes.json", "data/builds.json", "data/guides.json", "data/dictionary.json", "data/discovery.json", "data/seo-pages.json", "assets/app.js", "assets/detail.js", "assets/class-check.js", "assets/leveling.js", "assets/analytics-events.js", "class-check/index.html", "leveling/index.html", "best-builds/index.html", "NOTE_CONTENT_MAP.md"];
for (const path of required) {
  try { await access(resolve(root, path)); } catch { failures.push(`missing: ${path}`); }
}

const [index, buildList, gearCheck, robots, sitemap, ads, verification, buildsText, detailJs, styles] = await Promise.all([
  read("index.html"), read("builds/index.html"), read("gear-check/index.html"), read("robots.txt"), read("sitemap.xml"), read("ads.txt"), read("googlebaa56ffa7c50bcfb.html"), read("data/builds.json"), read("assets/detail.js"), read("assets/styles.css")
]);
const builds = JSON.parse(buildsText);
const classes = JSON.parse(await read("data/classes.json"));
const guides = JSON.parse(await read("data/guides.json"));
const terms = JSON.parse(await read("data/dictionary.json"));
const seoPages = JSON.parse(await read("data/seo-pages.json"));
const site = JSON.parse(await read("data/site.json"));
const stageLabels = ["Lv1〜10", "Lv11〜20", "Lv21〜30", "Lv31〜40", "Lv41〜キャンペーン終了", "Mapping開始", "Early Endgame", "Endgame完成"];
const stageFields = ["mainSkill", "supports", "passivePriority", "gearPriority", "replaceGear", "caution", "transitionCondition"];
assert(builds.length === 11, "build count must be 11");
assert(new Set(builds.map((build) => build.className)).size === 8, "each playable class must have a build");
assert(classes.length === 8, "class count must be 8");
assert(new Set(classes.map((item) => item.slug)).size === 8, "class slugs must be unique");
assert(index.includes('id="class-grid"'), "homepage class cards container missing");
assert(index.indexOf('id="purpose-picks"') < index.indexOf('id="choose-class"'), "homepage must show purpose picks before class selection");
assert(index.indexOf('id="purpose-picks"') < index.indexOf('id="quick-start"'), "homepage must show quick picks before resume controls");
assert(index.indexOf('id="quick-start"') < index.indexOf('id="featured-builds"'), "homepage must show recommended builds after class/build/level flow");
assert(index.includes("PoE2 0.5.5 初心者向けおすすめビルド") && index.includes("現在Lvを入力すると"), "homepage search intent/action message missing");
assert(index.includes("<title>PoE2 ビルド｜0.5.5おすすめ・初心者向け日本語育成ナビ</title>"), "homepage CTR-focused title missing");
assert(index.includes("PoE2 0.5.5対応の日本語ビルドサイト"), "homepage Japanese build-site description missing");
assert(index.includes('class="hero hero-focused"') && !index.includes('class="hero-guide"'), "homepage hero choices must be focused without duplicated guide links");
assert((index.match(/class="build-tags"/g) || []).length === 5, "homepage featured build purpose tags missing");
assert((index.match(/現在Lvから今やることを見る/g) || []).length <= 2, "homepage primary CTA must not be repeated excessively");
assert(index.indexOf('id="quick-class"') < index.indexOf('id="quick-build"') && index.indexOf('id="quick-build"') < index.indexOf('id="quick-level"'), "homepage flow must be class -> build -> level");
assert(buildList.includes('id="class-choices"'), "build catalog class-first choices missing");
assert(buildList.includes("<h1>PoE2 0.5.5 職業別ビルド一覧</h1>"), "build catalog search-focused H1 missing");
assert(buildList.includes("<title>PoE2 0.5.5 職業別おすすめビルド一覧｜初心者向け育成ナビ</title>"), "build catalog count-free title missing");
assert(!/ビルド\d+(?:選|本)/.test(buildList), "build catalog must not hardcode build count in SEO copy");
assert(detailJs.includes('byId("gear-check-link")') && detailJs.includes("history.replaceState"), "level changes must update the gear-check link and shareable URL");
assert(styles.includes("align-items:start") && styles.includes(".level-card{align-self:start"), "build hero must not stretch the level card");
assert(gearCheck.indexOf('id="gear-class"') < gearCheck.indexOf('id="gear-build"') && gearCheck.indexOf('id="gear-build"') < gearCheck.indexOf('id="gear-level"'), "gear flow must be class -> build -> level");
assert(!index.includes("読込中") && !index.includes("PHASE"), "development wording must not appear on homepage");
assert(new Set(builds.map((build) => build.id)).size === builds.length, "build ids must be unique");
assert(new Set(builds.map((build) => `${build.classSlug}/${build.slug}`)).size === builds.length, "build URLs must be unique");
for (const build of builds) {
  for (const field of ["id", "slug", "classSlug", "name", "seoTitle", "seoDescription", "className", "ascendancy", "version", "updatedAt", "mainSkill", "levelingStages", "gearPriorities", "sources"]) {
    assert(Object.hasOwn(build, field), `${build.id}: missing ${field}`);
  }
  assert(["verified", "partial", "needs-review", "draft"].includes(build.status), `${build.id}: invalid status`);
  assert(build.status === "verified", `${build.id}: public roadmap must be verified`);
  assert(build.levelingStages.length === 8, `${build.id}: roadmap must have 8 stages`);
  assert(build.levelingStages.every((stage, index) => stage.label === stageLabels[index]), `${build.id}: stage labels/order mismatch`);
  for (const stage of build.levelingStages) {
    for (const field of stageFields) assert(typeof stage[field] === "string" && stage[field].trim(), `${build.id}/${stage.label}: missing ${field}`);
    assert(Array.isArray(stage.nowActions) && stage.nowActions.length === 3 && stage.nowActions.every(Boolean), `${build.id}/${stage.label}: nowActions must contain 3 actions`);
  }
  assert(build.sources.every((source) => !/(youtube\.com|youtu\.be)/i.test(source.url || "") && !/youtube/i.test(source.name || "")), `${build.id}: YouTube source must be removed`);
  const pagePath = `builds/${build.classSlug}/${build.slug}/index.html`;
  assert(sitemap.includes(`https://poe2-build-navi-jp.github.io/builds/${build.classSlug}/${build.slug}/`), `${build.id}: missing from sitemap`);
  try {
    const page = await read(pagePath);
    assert(page.includes(`<link rel="canonical" href="https://poe2-build-navi-jp.github.io/builds/${build.classSlug}/${build.slug}/">`), `${pagePath}: canonical mismatch`);
    const expectedRobots = ["verified", "partial"].includes(build.status) ? 'content="index,follow' : 'content="noindex,follow"';
    assert(page.includes(expectedRobots), `${pagePath}: robots status mismatch`);
    assert(page.includes('id="trouble-buttons"'), `${pagePath}: trouble diagnosis missing`);
    assert(page.includes('id="faq-title"'), `${pagePath}: FAQ missing`);
    assert(page.includes('id="related-links"') && page.includes('/tier-list/'), `${pagePath}: static internal links missing`);
    assert(page.includes('data-build-status="verified"'), `${pagePath}: verified status missing`);
    assert(!page.includes('<p id="stage-status" class="pending">ビルド固有データ確認中</p>'), `${pagePath}: verified/confirming contradiction`);
    assert((page.match(/id="roadmap"/g) || []).length === 1, `${pagePath}: roadmap must appear once`);
    assert((page.match(/data-stage-index=/g) || []).length === 8, `${pagePath}: all 8 roadmap stages must be present in HTML`);
    assert(page.includes("この段階のパッシブツリーを見る"), `${pagePath}: stage passive source CTA missing`);
    assert(page.includes(`<title>${build.seoTitle}</title>`), `${pagePath}: search-focused title missing`);
    assert(page.includes(`<meta name="description" content="${build.seoDescription}">`), `${pagePath}: build-specific description missing`);
    assert(page.includes(`<h1 id="build-name">PoE2 ${build.name} ビルド｜${build.version}育成</h1>`), `${pagePath}: search-focused H1 missing`);
    assert(page.includes(`${build.name}ビルドのよくある質問`), `${pagePath}: build-specific FAQ H2 missing`);
    assert(page.includes('id="gear-check-link"'), `${pagePath}: level-aware gear check link missing`);
    assert(page.includes(`PoE2 ${build.name}のLv1〜Endgame育成手順`), `${pagePath}: build-specific roadmap heading missing`);
    assert(page.includes(`/classes/${build.classSlug}/`), `${pagePath}: class hub link missing`);
    assert(page.includes("現在Lvを入力すると、次に確認するスキル・装備・パッシブを3つに絞ります。"), `${pagePath}: level-value summary missing`);
    assert(page.includes('id="note-referral-guide"') && page.includes('href="#level-card"'), `${pagePath}: note referral handoff missing`);
    assert(page.includes("最新確認 0.5.5c") && page.includes("最終確認 2026-09-23"), `${pagePath}: latest patch review missing`);
    assert(page.includes('/best-builds/'), `${pagePath}: purpose comparison link missing`);
  } catch { failures.push(`missing: ${pagePath}`); }
}

for (const classData of classes) {
  assert(builds.some((build) => build.classSlug === classData.slug), `${classData.slug}: class has no build`);
  const pagePath = `classes/${classData.slug}/index.html`;
  assert(sitemap.includes(`https://poe2-build-navi-jp.github.io/classes/${classData.slug}/`), `${classData.slug}: class missing from sitemap`);
  try {
    const page = await read(pagePath);
    assert(page.includes(`<link rel="canonical" href="https://poe2-build-navi-jp.github.io/classes/${classData.slug}/">`), `${pagePath}: canonical mismatch`);
    assert(page.includes("このビルドで育てる"), `${pagePath}: build CTA missing`);
    assert(page.includes(`<h1>PoE2 ${classData.name}おすすめビルド・育成｜0.5.5</h1>`), `${pagePath}: search-focused class H1 missing`);
    assert(page.includes(`${classData.name}の序盤Lv1〜30の育て方`), `${pagePath}: early leveling guide missing`);
    assert(page.includes("/leveling/"), `${pagePath}: leveling hub link missing`);
    assert(page.includes("最終確認"), `${pagePath}: update status missing`);
    assert(page.includes("最新確認 0.5.5c"), `${pagePath}: latest patch status missing`);
    assert(page.includes('class="build-tags"'), `${pagePath}: purpose tags missing`);
  } catch { failures.push(`missing: ${pagePath}`); }
}

assert(index.includes('ca-pub-7738997902416481'), "AdSense publisher id missing from index");
assert(index.includes('<link rel="canonical" href="https://poe2-build-navi-jp.github.io/">'), "root canonical missing");
assert(robots.includes("Allow: /"), "robots must allow crawling");
assert(!/Disallow:\s*\/images/i.test(robots), "robots must not block image assets");
assert(robots.includes("https://poe2-build-navi-jp.github.io/sitemap.xml"), "robots sitemap missing");
assert(sitemap.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'), "image sitemap namespace missing");
assert((sitemap.match(/<image:image>/g) || []).length === 18, "image sitemap must contain 18 priority images");
assert(sitemap.includes("https://poe2-build-navi-jp.github.io/"), "sitemap root missing");
assert(sitemap.includes("https://poe2-build-navi-jp.github.io/builds/monk/whirling-assault/"), "reviewed build missing from sitemap");
assert(/^G-[A-Z0-9]+$/.test(site.googleAnalyticsMeasurementId), "Google Analytics measurement ID is invalid");
for (const [, pageUrl] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const pathname = new URL(pageUrl).pathname;
  const pagePath = pathname === "/" ? "index.html" : `${pathname.slice(1)}index.html`;
  const page = await read(pagePath);
  const loader = `https://www.googletagmanager.com/gtag/js?id=${site.googleAnalyticsMeasurementId}`;
  assert((page.match(new RegExp(loader.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length === 1, `${pagePath}: Google Analytics loader must appear once`);
  assert((page.match(new RegExp(`gtag\\('config','${site.googleAnalyticsMeasurementId}'\\)`, "g")) || []).length === 1, `${pagePath}: Google Analytics config must appear once`);
  const tracksEvents = pagePath === "index.html"
    || /^(best-builds|tier-list|league-starter|leveling|poe2-1-0)\/index\.html$/.test(pagePath)
    || /^builds\/[^/]+\/[^/]+\/index\.html$/.test(pagePath);
  assert((page.match(/\/assets\/analytics-events\.js/g) || []).length === (tracksEvents ? 1 : 0), `${pagePath}: analytics event script scope mismatch`);
}
for (const page of ["builds/", "classes/", "leveling/", "gear-check/", "class-check/", "tier-list/", "league-starter/", "best-builds/", "guides/beginner-build/", "poe2-1-0/", "beginner-guide/", "dictionary/"]) {
  assert(sitemap.includes(`https://poe2-build-navi-jp.github.io/${page}`), `${page} missing from sitemap`);
  try { await access(resolve(root, page, "index.html")); } catch { failures.push(`missing: ${page}index.html`); }
}
for (const page of [
  ["tier-list/", "PoE2 0.5.5初心者向けビルドTier"],
  ["league-starter/", "PoE2リーグスターター・序盤おすすめビルド"],
  ["leveling/", "PoE2レベリングガイド｜現在Lvから次にやること"],
  ["guides/beginner-build/", "PoE2初心者おすすめビルド"],
  ["best-builds/", "PoE2 0.5.5おすすめ・最強ビルド｜目的別比較"],
  ["poe2-1-0/", "PoE2 1.0はいつ？正式リリース・無料化の確定情報"]
]) {
  const html = await read(`${page[0]}index.html`);
  assert(html.includes(`<h1>${page[1]}</h1>`), `${page[0]} initial H1 missing`);
  assert(html.includes(`<link rel="canonical" href="${baseUrl}/${page[0]}">`), `${page[0]} self canonical missing`);
  assert(html.includes('application/ld+json') && html.includes('BreadcrumbList'), `${page[0]} breadcrumb data missing`);
}
const beginnerGuide = await read("beginner-guide/index.html");
assert(beginnerGuide.includes("<h1>PoE2初心者向けおすすめビルド・育成ガイド</h1>"), "beginner guide search-focused H1 missing");
assert(beginnerGuide.includes('初心者はまずここから') && beginnerGuide.includes('/classes/') && beginnerGuide.includes('/class-check/') && beginnerGuide.includes('/leveling/'), "beginner guide core navigation missing");
const classHub = await read("classes/index.html");
assert(classHub.includes("<h1>PoE2おすすめクラス・職業｜初心者向け選び方</h1>"), "class hub search-focused H1 missing");
assert(classHub.includes("4問で自分に合う職業を見る"), "class diagnosis CTA missing");
const classCheck = await read("class-check/index.html");
assert(classCheck.includes("<h1>PoE2初心者向け職業・クラス診断｜4問でおすすめを絞る</h1>"), "class check search-focused H1 missing");
const privacyPage = await read("privacy/index.html");
assert(privacyPage.includes("<h2>Google Analytics</h2>") && privacyPage.includes("policies.google.com/technologies/partner-sites?hl=ja"), "privacy policy must disclose Google Analytics");
const levelingPage = await read("leveling/index.html");
assert(levelingPage.includes('id="leveling-class"') && levelingPage.includes('id="leveling-build"') && levelingPage.includes('id="leveling-level"'), "leveling selection flow missing");
assert(levelingPage.includes("現在Lvから今やることを見る"), "leveling CTA missing");
const tierPage = await read("tier-list/index.html");
const starterPage = await read("league-starter/index.html");
const bestPage = await read("best-builds/index.html");
assert(tierPage.includes("結論だけ知りたい人向け"), "tier purpose conclusion missing");
assert(starterPage.includes("迷ったらこの候補"), "league starter purpose conclusion missing");
assert(bestPage.includes("結論：目的別のおすすめ候補") && bestPage.includes("Tier・リーグスターターとの違い"), "best builds purpose comparison missing");
assert((bestPage.match(/現在Lvから今やることを見る/g) || []).length === 6, "best builds must link six purpose candidates to level navigation");
assert(bestPage.includes('class="comparison-table"') && bestPage.includes("掲載ビルドの確認済み特徴を比較") && bestPage.includes("高投資時の伸び代"), "best builds evidence-based comparison missing");
assert((bestPage.match(/<td data-label=/g) || []).length === builds.length * 8, "best builds comparison cells need mobile labels");
assert((bestPage.match(/class="comparison-cta"/g) || []).length === builds.length, "best builds comparison rows need level CTAs");
assert(styles.includes(".comparison-table td::before{content:attr(data-label)") && styles.includes(".comparison-table tr{display:block"), "best builds comparison mobile card layout missing");
assert(seoPages.length === 13, "targeted SEO page count must be 13");
for (const page of seoPages) {
  const localPath = `${page.path.slice(1)}index.html`;
  assert(sitemap.includes(`${baseUrl}${page.path}`), `${page.path}: SEO page missing from sitemap`);
  const html = await read(localPath);
  assert(html.includes(`<h1>${page.h1}</h1>`), `${page.path}: initial H1 missing`);
  assert(html.includes(`<link rel="canonical" href="${baseUrl}${page.path}">`), `${page.path}: self canonical missing`);
  assert(html.includes("まずやること3つ"), `${page.path}: immediate actions missing`);
  assert(html.includes("BreadcrumbList"), `${page.path}: breadcrumb data missing`);
}
for (const path of ["/guides/why-i-die/", "/guides/increase-damage/", "/guides/mana-problem/", "/guides/cant-beat-boss/", "/guides/slow-mapping/", "/guides/gear-upgrade/"]) {
  assert(seoPages.some((page) => page.path === path), `${path}: trouble SEO page missing`);
}
for (const path of ["/guides/passive-tree/", "/guides/resistance/"]) {
  assert(seoPages.some((page) => page.path === path), `${path}: core beginner SEO page missing`);
}
assert(gearCheck.includes('id="gear-example-title"'), "gear check verified static example missing");
assert(gearCheck.includes("build=ranger-ice-shot-deadeye&amp;level=37&amp;concern=damage"), "gear check sample context link missing");
const oneHub = await read("poe2-1-0/index.html");
assert(oneHub.includes('id="one-build-impact"') && oneHub.includes("更新履歴"), "1.0 build impact/update history missing");
assert(oneHub.includes("正式版は無料で遊べる？") && oneHub.includes("新職業Duelist") && oneHub.includes("1.0公開前に断定しない情報"), "1.0 search-intent sections missing");
assert(oneHub.includes("Early Accessから何が変わる？") && oneHub.includes("1.0を待たず、今から始めてもいい？") && oneHub.includes("1.0までに覚えておきたいこと") && oneHub.includes("現在選べる初心者向けビルド"), "1.0 beginner hub sections missing");
assert(oneHub.includes("1.0から始める人が今やること") && oneHub.includes("初心者向けビルドを見る") && oneHub.includes("今使えるおすすめビルドを見る") && oneHub.includes("リーグスターターを見る"), "1.0 next-action section missing");
const noteMap = await read("NOTE_CONTENT_MAP.md");
assert(noteMap.includes("/best-builds/") && noteMap.includes("utm_source=note") && noteMap.includes("/builds/huntress/twister-spirit-walker/"), "note purpose mapping missing");
assert(noteMap.includes("nbd2ce44d8585") && noteMap.includes("n09f92db3dc1a") && noteMap.includes("nb6f6a2709e4a"), "recent note direct-link mapping missing");
assert(noteMap.includes("公開済み記事の修正候補") && noteMap.includes("未設定URL") && noteMap.includes("/builds/ranger/ice-shot-deadeye/"), "note placeholder link audit missing");
const analyticsEvents = await read("assets/analytics-events.js");
for (const eventName of ["best_build_click", "tier_build_click", "league_build_click", "poe2_1_0_build_click", "level_input", "note_referral"]) {
  assert(analyticsEvents.includes(eventName), `analytics event missing: ${eventName}`);
}
assert(!sitemap.match(/<loc>[^<]+<\/loc>/g).some((url, index, all) => all.indexOf(url) !== index), "sitemap URLs must be unique");
assert(guides.length === 13, "beginner guide must have 13 chapters");
for (const guide of guides) {
  assert(sitemap.includes(`${baseUrl}/guides/${guide.slug}/`), `${guide.slug}: guide missing from sitemap`);
  try { const page=await read(`guides/${guide.slug}/index.html`); assert(page.includes(`<link rel="canonical" href="${baseUrl}/guides/${guide.slug}/">`), `${guide.slug}: guide canonical mismatch`); } catch { failures.push(`missing guide: ${guide.slug}`); }
}
for (const term of terms) {
  assert(sitemap.includes(`${baseUrl}/dictionary/${term.slug}/`), `${term.slug}: term missing from sitemap`);
  try { await access(resolve(root, "dictionary", term.slug, "index.html")); } catch { failures.push(`missing term: ${term.slug}`); }
}
const allText = [index, buildsText, JSON.stringify(guides), JSON.stringify(terms)].join("\n");
assert(!/(youtube\.com|youtu\.be)/i.test(allText), "YouTube references must not appear");
for (const removed of ["builds/druid/wolf/index.html", "builds/witch/spark-comet-infernalist/index.html"]) {
  try { await access(resolve(root, removed)); failures.push(`retired build still exists: ${removed}`); } catch {}
}
assert(ads.includes("pub-7738997902416481"), "ads.txt publisher missing");
assert(verification.trim() === "google-site-verification: googlebaa56ffa7c50bcfb.html", "Search Console verification file changed");

const ratingCriteria = await read("rating-criteria/index.html").catch(() => "");
assert(ratingCriteria.includes("<h1>PoE2ビルドの評価基準と採点方法</h1>"), "rating criteria page missing");
assert(sitemap.includes(`${baseUrl}/rating-criteria/`), "rating criteria page missing from sitemap");
for (const build of builds) {
  for (const error of validateRatings(build)) failures.push(`${build.id}: rating ${error}`);
  assert(ratingCriteria.includes(`href="/builds/${build.classSlug}/${build.slug}/#build-rating"`), `${build.id}: missing from rating criteria table`);
  const page = await read(`builds/${build.classSlug}/${build.slug}/index.html`);
  assert((page.match(/id="build-rating"/g) || []).length === 1 && page.includes('href="/rating-criteria/"'), `${build.id}: rating section missing`);
}
const assetHashes = new Map();
const staleAssets = new Map();
for (const name of await readdir(resolve(root, "assets"))) {
  if (/\.(css|js)$/.test(name)) assetHashes.set(name, createHash("sha256").update(await readFile(resolve(root, "assets", name))).digest("hex").slice(0, 10));
}
for (const path of [...new Set([...sitemap.matchAll(/<loc>https:\/\/poe2-build-navi-jp\.github\.io\/([^<]*)<\/loc>/g)].map((m) => `${m[1]}index.html`)), "404.html"]) {
  const html = await read(path);
  for (const [, name, version] of html.matchAll(/\/assets\/([A-Za-z0-9_-]+\.(?:css|js))(?:\?v=([^"'\s)>]*))?/g)) {
    if (version !== assetHashes.get(name)) staleAssets.set(name, [...(staleAssets.get(name) || []), path]);
  }
}
for (const [name, paths] of staleAssets) failures.push(`/assets/${name}: stale ?v= on ${paths.length} page(s), e.g. ${paths[0]} (run node tools/sync-asset-versions.mjs)`);
for (const path of [...sitemap.matchAll(/<loc>https:\/\/poe2-build-navi-jp\.github\.io\/([^<]*)<\/loc>/g)].map((m) => `${m[1]}index.html`)) {
  const html = await read(path);
  const image = html.match(/<meta property="og:image" content="https:\/\/poe2-build-navi-jp\.github\.io\/([^"]+)">/)?.[1];
  assert(image, `${path}: og:image missing (run node tools/generate-og-images.mjs)`);
  if (image) await access(resolve(root, image)).catch(() => failures.push(`${path}: og:image file missing: ${image}`));
  assert(html.includes('<meta name="twitter:card" content="summary_large_image">') && (html.match(/name="twitter:card"/g) || []).length === 1, `${path}: needs exactly one summary_large_image twitter:card`);
}
if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}
console.log(`PASS: ${builds.length} build pages, SEO files, AdSense and Search Console verification.`);
