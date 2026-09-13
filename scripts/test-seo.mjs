import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const base = "https://poe2-build-navi-jp.github.io";
const failures = [];
const sitemap = await readFile(resolve(root, "sitemap.xml"), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

for (const url of urls) {
  const pathname = new URL(url).pathname;
  const file = pathname === "/" ? "index.html" : `${pathname.slice(1)}index.html`;
  let html;
  try {
    html = await readFile(resolve(root, file), "utf8");
  } catch {
    failures.push(`${pathname}: HTML file missing`);
    continue;
  }

  const title = html.match(/<title>([^<]+)<\/title>/)?.[1]?.trim();
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1]?.trim();
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  const h1s = [...html.matchAll(/<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/g)];
  const bodyText = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] || "")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[^;]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const internalLinks = [...html.matchAll(/<a\s[^>]*href="(\/[^"]*)"/g)].map((match) => match[1]);

  if (!title) failures.push(`${pathname}: title missing`);
  if (!description) failures.push(`${pathname}: description missing`);
  if (canonical !== `${base}${pathname}`) failures.push(`${pathname}: canonical mismatch (${canonical || "missing"})`);
  if (h1s.length !== 1 || !h1s[0][1].replace(/<[^>]+>/g, "").trim()) failures.push(`${pathname}: exactly one non-empty H1 required`);
  if (/name="robots" content="[^"]*noindex/i.test(html)) failures.push(`${pathname}: noindex page must not be in sitemap`);
  if (bodyText.length < 180) failures.push(`${pathname}: initial HTML body is too thin (${bodyText.length})`);
  if (pathname !== "/" && internalLinks.length === 0) failures.push(`${pathname}: internal link missing`);
  if (/読込中|PHASE\s*\d/i.test(bodyText)) failures.push(`${pathname}: development wording exposed`);
}

const builds = JSON.parse(await readFile(resolve(root, "data/builds.json"), "utf8")).filter((build) => build.status !== "draft");
const buildList = await readFile(resolve(root, "builds/index.html"), "utf8");
for (const build of builds) {
  const path = `/builds/${build.classSlug}/${build.slug}/`;
  if (!buildList.includes(build.name) || !buildList.includes(path)) failures.push(`/builds/: missing initial HTML link for ${build.name}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`PASS: ${urls.length} indexable URLs have title, description, one H1, self-canonical, initial HTML and internal links.`);
