// Idempotent. Pages listed in data/noindex.json get robots "noindex,follow" (the sitemap
// also skips them in generate-sitemap.mjs). Every other page keeps its own robots value.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const { paths } = JSON.parse(await readFile(resolve(root, "data/noindex.json"), "utf8"));

for (const path of paths) {
  const file = resolve(root, path.slice(1), "index.html");
  const html = await readFile(file, "utf8");
  if (!/<meta name="robots" content="[^"]*">/.test(html)) throw new Error(`${path}: robots meta missing`);
  await writeFile(file, html.replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex,follow">'));
}
console.log(`Noindex: ${paths.length} pages kept out of search until rewritten.`);
