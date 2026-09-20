import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const site = JSON.parse(await readFile(resolve(root, "data/site.json"), "utf8"));
const measurementId = site.googleAnalyticsMeasurementId;

if (!/^G-[A-Z0-9]+$/.test(measurementId)) {
  throw new Error("Invalid Google Analytics measurement ID");
}

const tag = `<!-- Google tag (gtag.js) --><script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${measurementId}');</script><!-- /Google tag -->`;
const marker = /<!-- Google tag \(gtag\.js\) -->[\s\S]*?<!-- \/Google tag -->/;
const ignoredDirectories = new Set([".git", "_next", "company", "node_modules", "scripts", "tests", "tools"]);
let pageCount = 0;

async function inject(directory = "") {
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    if (entry.name.startsWith(".") || ignoredDirectories.has(entry.name)) continue;
    const path = directory ? `${directory}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await inject(path);
      continue;
    }
    if (!entry.name.endsWith(".html") || entry.name.startsWith("google")) continue;
    const file = resolve(root, path);
    const original = await readFile(file, "utf8");
    if (!original.includes("</head>")) continue;
    const html = marker.test(original)
      ? original.replace(marker, tag)
      : original.replace(/<head([^>]*)>/, `<head$1>${tag}`);
    await writeFile(file, html);
    pageCount += 1;
  }
}

await inject();
console.log(`Injected Google Analytics into ${pageCount} HTML pages.`);
