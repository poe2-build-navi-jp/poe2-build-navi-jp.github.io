// note.com article header image (1280x670 PNG). Original text/shape design only: no official PoE2 artwork.
// The image is for the note article; do not add it to the site.
// Usage: CHROMIUM_PATH=/opt/pw-browsers/chromium node tools/note-header.mjs "<title>" "<subtitle>" <out.png> [kicker]
import { chromium } from "playwright-core";

const [title, subtitle = "", out, kicker = "PATH OF EXILE 2"] = process.argv.slice(2);
if (!title || !out) {
  console.error('Usage: node tools/note-header.mjs "<title>" "<subtitle>" <out.png> [kicker]');
  process.exit(1);
}
const esc = (v) => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}
body{width:1280px;height:670px;overflow:hidden;background:#132530;color:#fff;font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;position:relative}
.frame{position:absolute;inset:36px;border:2px solid #d8ad52;padding:64px 72px;display:flex;flex-direction:column;justify-content:center}
.frame::after{content:"";position:absolute;right:-2px;bottom:-2px;width:260px;height:260px;background:linear-gradient(135deg,transparent 50%,#d8613033 50%)}
.kicker{color:#d8ad52;font-size:30px;font-weight:800;letter-spacing:.14em}
h1{font-size:76px;line-height:1.25;font-weight:900;margin:22px 0 26px}
p{font-size:34px;line-height:1.5;color:#e8e2d6}
.brand{position:absolute;left:72px;bottom:28px;font-size:24px;font-weight:800;color:#d8ad52}
</style></head><body><div class="frame"><div class="kicker">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p><div class="brand">POE2ビルドナビ</div></div></body></html>`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 670 } });
await page.setContent(html);
await page.screenshot({ path: out });
await browser.close();
console.log(`note header: ${out}`);
