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
const eventTag = '<script defer src="/assets/analytics-events.js?v=20260923-1"></script>';
const eventMarker = /<script defer src="\/assets\/analytics-events\.js[^\"]*"><\/script>/g;
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
    let html = marker.test(original)
      ? original.replace(marker, tag)
      : original.replace(/<head([^>]*)>/, `<head$1>${tag}`);
    const tracksEvents = path === "index.html"
      || /^(best-builds|tier-list|league-starter|leveling|poe2-1-0)\/index\.html$/.test(path)
      || /^builds\/[^/]+\/[^/]+\/index\.html$/.test(path);
    if (tracksEvents && !html.includes("/assets/analytics-events.js")) {
      html = html.replace("</head>", `${eventTag}</head>`);
    } else if (!tracksEvents) {
      html = html.replace(eventMarker, "");
    }
    const usesUpdatedLayout = path === "index.html" || /^builds\/[^/]+\/[^/]+\/index\.html$/.test(path);
    if (usesUpdatedLayout) {
      html = html.replace(
        /\/assets\/(styles\.css|mobile\.css|detail\.js)(\?[^"']*)?/g,
        "/assets/$1?v=20260922-1"
      );
    }
    if (path === "privacy/index.html" && !html.includes("<h2>Google Analytics</h2>")) {
      html = html
        .replace("<h2>広告配信</h2>", '<h2>Google Analytics</h2><p>本サイトは利用状況を把握し改善するため、Google Analyticsを使用します。Google AnalyticsはCookie等を利用し、閲覧ページや利用環境などの情報を収集する場合があります。収集情報の取り扱いは、Googleの<a href="https://policies.google.com/technologies/partner-sites?hl=ja" target="_blank" rel="noopener noreferrer">サービス利用サイトから収集した情報の使用について</a>をご確認ください。</p><h2>広告配信</h2>')
        .replace("最終更新：2026年9月8日。", "最終更新：2026年9月20日。");
    }
    await writeFile(file, html);
    pageCount += 1;
  }
}

await inject();
console.log(`Injected Google Analytics into ${pageCount} HTML pages.`);
