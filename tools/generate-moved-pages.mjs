// Writes a small "moved" page at each old URL listed in data/moved.json. GitHub Pages has no
// server-side redirects, so each page points to its new URL with rel=canonical, meta refresh and
// location.replace (which keeps ?utm_... query strings from note links), plus a visible link.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const site = JSON.parse(await readFile(resolve(root, "data/site.json"), "utf8"));
const { pages } = JSON.parse(await readFile(resolve(root, "data/moved.json"), "utf8"));
const esc = (v) => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

for (const [from, to] of Object.entries(pages)) {
  const target = `${site.baseUrl}${to}`;
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>移動しました｜POE2ビルドナビ</title><link rel="canonical" href="${esc(target)}"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0; url=${esc(to)}"><script>location.replace(${JSON.stringify(to)}+location.search+location.hash);</script><link rel="stylesheet" href="/assets/styles.css"></head><body><main class="page-main"><article class="article-page"><h1>このページは移動しました</h1><p>内容は<a href="${esc(to)}">${esc(target)}</a>へまとめました。自動で移動しない場合はリンクを開いてください。</p></article></main></body></html>`;
  await mkdir(resolve(root, from.slice(1)), { recursive: true });
  await writeFile(resolve(root, from.slice(1), "index.html"), html);
}
console.log(`Moved pages: ${Object.keys(pages).length}`);
