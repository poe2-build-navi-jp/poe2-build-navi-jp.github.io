import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const read = (path) => readFile(resolve(root, path), "utf8");

const required = ["index.html", "404.html", "robots.txt", "sitemap.xml", "ads.txt", "googlebaa56ffa7c50bcfb.html", "data/builds.json", "assets/app.js", "assets/detail.js"];
for (const path of required) {
  try { await access(resolve(root, path)); } catch { failures.push(`missing: ${path}`); }
}

const [index, robots, sitemap, ads, verification, buildsText] = await Promise.all([
  read("index.html"), read("robots.txt"), read("sitemap.xml"), read("ads.txt"), read("googlebaa56ffa7c50bcfb.html"), read("data/builds.json")
]);
const builds = JSON.parse(buildsText);
assert(builds.length === 5, "build count must be 5");
assert(index.includes("今日やることが、<em>3つに絞れる。"), "homepage action-first message missing");
assert(!index.includes("読込中") && !index.includes("PHASE"), "development wording must not appear on homepage");
assert(new Set(builds.map((build) => build.id)).size === builds.length, "build ids must be unique");
assert(new Set(builds.map((build) => `${build.classSlug}/${build.slug}`)).size === builds.length, "build URLs must be unique");
for (const build of builds) {
  for (const field of ["id", "slug", "classSlug", "name", "className", "ascendancy", "version", "updatedAt", "mainSkill", "levelingStages", "gearPriorities", "sources"]) {
    assert(Object.hasOwn(build, field), `${build.id}: missing ${field}`);
  }
  const pagePath = `builds/${build.classSlug}/${build.slug}/index.html`;
  try {
    const page = await read(pagePath);
    assert(page.includes(`<link rel="canonical" href="https://poe2-build-navi-jp.github.io/builds/${build.classSlug}/${build.slug}/">`), `${pagePath}: canonical mismatch`);
    const expectedRobots = ["reviewed", "source-checked"].includes(build.dataStatus) ? 'content="index,follow"' : 'content="noindex,follow"';
    assert(page.includes(expectedRobots), `${pagePath}: robots status mismatch`);
  } catch { failures.push(`missing: ${pagePath}`); }
}

assert(index.includes('ca-pub-7738997902416481'), "AdSense publisher id missing from index");
assert(index.includes('<link rel="canonical" href="https://poe2-build-navi-jp.github.io/">'), "root canonical missing");
assert(robots.includes("Allow: /"), "robots must allow crawling");
assert(robots.includes("https://poe2-build-navi-jp.github.io/sitemap.xml"), "robots sitemap missing");
assert(sitemap.includes("https://poe2-build-navi-jp.github.io/"), "sitemap root missing");
assert(sitemap.includes("https://poe2-build-navi-jp.github.io/builds/monk/whirling-assault/"), "reviewed build missing from sitemap");
for (const page of ["builds/", "gear-check/", "tier-list/", "beginner-guide/", "dictionary/"]) {
  assert(sitemap.includes(`https://poe2-build-navi-jp.github.io/${page}`), `${page} missing from sitemap`);
  try { await access(resolve(root, page, "index.html")); } catch { failures.push(`missing: ${page}index.html`); }
}
for (const removed of ["builds/ranger/ice-shot-deadeye/index.html", "builds/druid/wolf/index.html", "builds/witch/spark-comet-infernalist/index.html"]) {
  try { await access(resolve(root, removed)); failures.push(`retired build still exists: ${removed}`); } catch {}
}
assert(ads.includes("pub-7738997902416481"), "ads.txt publisher missing");
assert(verification.trim() === "google-site-verification: googlebaa56ffa7c50bcfb.html", "Search Console verification file changed");

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}
console.log(`PASS: ${builds.length} build pages, SEO files, AdSense and Search Console verification.`);
