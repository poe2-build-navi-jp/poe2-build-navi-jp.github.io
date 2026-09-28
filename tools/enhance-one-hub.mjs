// Idempotent. (1) Adds a short "PoE2 1.0" box linking to the /poe2-1-0/ pages on every
// sitemap page except the home page, the 1.0 pages themselves and site/legal pages.
// (2) Adds FAQPage structured data to /poe2-1-0/ pages, built from the visible
// "よくある質問" <details> so the markup can never drift from what readers see.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (p) => readFile(resolve(root, p), "utf8");
const site = JSON.parse(await read("data/site.json"));
const sitemap = await read("sitemap.xml");
const paths = [...sitemap.matchAll(/<loc>https:\/\/poe2-build-navi-jp\.github\.io\/([^<]*)<\/loc>/g)].map((m) => m[1]);

const released = site.gameVersion === site.nextGameVersion;
const [y, m, d] = site.nextGameVersionReleaseDate.split("-").map(Number);
const heading = released ? "PoE2 正式版1.0の情報" : `PoE2 1.0は${y}年${m}月${d}日公開予定`;
const lead = released ? "正式版は基本プレイ無料です。" : "正式版から基本プレイ無料になります。";
export const ONE_LINK_MARKER = "<!-- one-link:start -->";
const box = `${ONE_LINK_MARKER}<aside class="next-box one-link" aria-label="PoE2 1.0の情報"><b>${heading}</b><p>${lead}<a href="/poe2-1-0/">1.0の確定情報</a>・<a href="/poe2-1-0/how-to-start/">始め方</a>・<a href="/poe2-1-0/system-requirements/">必要スペック</a></p></aside><!-- one-link:end -->`;

const skip = (path) => path === "" || path.startsWith("poe2-1-0/") || /^(about|privacy|terms|editorial-policy|rating-criteria)\//.test(path);
const unescape = (v) => v.replace(/<[^>]+>/g, "").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&").trim();

let linked = 0;
let faqPages = 0;
for (const path of paths) {
  const file = `${path}index.html`;
  let html = await read(file);
  html = html.replace(/<!-- one-link:start -->[\s\S]*?<!-- one-link:end -->/g, "");
  html = html.replace(/<!-- one-faq:start -->[\s\S]*?<!-- one-faq:end -->/g, "");
  if (!skip(path)) {
    const at = html.lastIndexOf("</main>");
    if (at === -1) throw new Error(`${file}: </main> not found`);
    html = `${html.slice(0, at)}${box}${html.slice(at)}`;
    linked++;
  }
  if (path.startsWith("poe2-1-0/")) {
    const section = html.match(/<h2>よくある質問<\/h2>([\s\S]*?)<\/section>/)?.[1] ?? "";
    const items = [...section.matchAll(/<details><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map(([, q, a]) => ({ q: unescape(q), a: unescape(a) }));
    if (items.length) {
      const schema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } }))
      }).replaceAll("<", "\\u003c");
      html = html.replace("</head>", `<!-- one-faq:start --><script type="application/ld+json">${schema}</script><!-- one-faq:end --></head>`);
      faqPages++;
    }
  }
  await writeFile(resolve(root, file), html);
}
console.log(`1.0 hub: link box on ${linked} pages, FAQPage on ${faqPages} pages.`);
