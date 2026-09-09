import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const baseUrl = "https://poe2-build-navi-jp.github.io";
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const read = (path) => readFile(resolve(root, path), "utf8");

const required = ["index.html", "404.html", "robots.txt", "sitemap.xml", "ads.txt", "googlebaa56ffa7c50bcfb.html", "data/classes.json", "data/builds.json", "data/guides.json", "data/dictionary.json", "assets/app.js", "assets/detail.js", "assets/class-check.js", "class-check/index.html"];
for (const path of required) {
  try { await access(resolve(root, path)); } catch { failures.push(`missing: ${path}`); }
}

const [index, buildList, gearCheck, robots, sitemap, ads, verification, buildsText] = await Promise.all([
  read("index.html"), read("builds/index.html"), read("gear-check/index.html"), read("robots.txt"), read("sitemap.xml"), read("ads.txt"), read("googlebaa56ffa7c50bcfb.html"), read("data/builds.json")
]);
const builds = JSON.parse(buildsText);
const classes = JSON.parse(await read("data/classes.json"));
const guides = JSON.parse(await read("data/guides.json"));
const terms = JSON.parse(await read("data/dictionary.json"));
const stageLabels = ["Lv1〜10", "Lv11〜20", "Lv21〜30", "Lv31〜40", "Lv41〜キャンペーン終了", "Mapping開始", "Early Endgame", "Endgame完成"];
const stageFields = ["mainSkill", "supports", "passivePriority", "gearPriority", "replaceGear", "caution", "transitionCondition"];
assert(builds.length === 10, "build count must be 10");
assert(new Set(builds.map((build) => build.className)).size === 8, "each playable class must have a build");
assert(classes.length === 8, "class count must be 8");
assert(new Set(classes.map((item) => item.slug)).size === 8, "class slugs must be unique");
assert(index.includes('id="class-grid"'), "homepage class cards container missing");
assert(index.indexOf('id="choose-class"') < index.indexOf('id="quick-start"'), "homepage must show class selection before resume controls");
assert(index.includes("今日やることが、<em>3つに絞れる。"), "homepage action-first message missing");
assert(index.indexOf('id="quick-class"') < index.indexOf('id="quick-build"') && index.indexOf('id="quick-build"') < index.indexOf('id="quick-level"'), "homepage flow must be class -> build -> level");
assert(buildList.includes('id="class-choices"'), "build catalog class-first choices missing");
assert(gearCheck.indexOf('id="gear-class"') < gearCheck.indexOf('id="gear-build"') && gearCheck.indexOf('id="gear-build"') < gearCheck.indexOf('id="gear-level"'), "gear flow must be class -> build -> level");
assert(!index.includes("読込中") && !index.includes("PHASE"), "development wording must not appear on homepage");
assert(new Set(builds.map((build) => build.id)).size === builds.length, "build ids must be unique");
assert(new Set(builds.map((build) => `${build.classSlug}/${build.slug}`)).size === builds.length, "build URLs must be unique");
for (const build of builds) {
  for (const field of ["id", "slug", "classSlug", "name", "className", "ascendancy", "version", "updatedAt", "mainSkill", "levelingStages", "gearPriorities", "sources"]) {
    assert(Object.hasOwn(build, field), `${build.id}: missing ${field}`);
  }
  assert(build.dataStatus === "reviewed", `${build.id}: roadmap must be reviewed`);
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
    const expectedRobots = ["reviewed", "source-checked"].includes(build.dataStatus) ? 'content="index,follow"' : 'content="noindex,follow"';
    assert(page.includes(expectedRobots), `${pagePath}: robots status mismatch`);
    assert(page.includes('id="trouble-buttons"'), `${pagePath}: trouble diagnosis missing`);
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
  } catch { failures.push(`missing: ${pagePath}`); }
}

assert(index.includes('ca-pub-7738997902416481'), "AdSense publisher id missing from index");
assert(index.includes('<link rel="canonical" href="https://poe2-build-navi-jp.github.io/">'), "root canonical missing");
assert(robots.includes("Allow: /"), "robots must allow crawling");
assert(robots.includes("https://poe2-build-navi-jp.github.io/sitemap.xml"), "robots sitemap missing");
assert(sitemap.includes("https://poe2-build-navi-jp.github.io/"), "sitemap root missing");
assert(sitemap.includes("https://poe2-build-navi-jp.github.io/builds/monk/whirling-assault/"), "reviewed build missing from sitemap");
for (const page of ["builds/", "gear-check/", "class-check/", "tier-list/", "beginner-guide/", "dictionary/"]) {
  assert(sitemap.includes(`https://poe2-build-navi-jp.github.io/${page}`), `${page} missing from sitemap`);
  try { await access(resolve(root, page, "index.html")); } catch { failures.push(`missing: ${page}index.html`); }
}
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

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}
console.log(`PASS: ${builds.length} build pages, SEO files, AdSense and Search Console verification.`);
