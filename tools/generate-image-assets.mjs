import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "images/poe2");
const [builds, classes, discovery] = await Promise.all([
  readFile(resolve(root, "data/builds.json"), "utf8").then(JSON.parse),
  readFile(resolve(root, "data/classes.json"), "utf8").then(JSON.parse),
  readFile(resolve(root, "data/discovery.json"), "utf8").then(JSON.parse)
]);

const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const short = (value, max = 26) => {
  const clean = String(value ?? "").replace(/（[^）]*）/g, "").replace(/\([^)]*\)/g, "").replace(/。.*$/, "").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};
const svg = (body, label, height = 630) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc" viewBox="0 0 1200 ${height}" width="1200" height="${height}">
  <title id="title">${esc(label)}</title><desc id="desc">POE2ビルドナビが既存の確認済みデータから作成した独自図解です。</desc>
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#101827"/><stop offset="1" stop-color="#242037"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-opacity=".24"/></filter></defs>
  <rect width="1200" height="${height}" rx="34" fill="url(#bg)"/><circle cx="1090" cy="105" r="210" fill="#cc9b4b" opacity=".09"/><circle cx="90" cy="${height - 30}" r="180" fill="#6e8fa8" opacity=".11"/>
  ${body}
  <text x="64" y="${height - 34}" fill="#9fb0c3" font-family="sans-serif" font-size="20">POE2ビルドナビ独自図解 ・ Patch ${esc(discovery.patchVersion)}</text>
</svg>`;

function renderOg(filename, title, subtitle) {
  const target = resolve(out, "og", filename);
  const result = spawnSync("convert", [
    "-size","1200x630","xc:#101827",
    "-fill","#2b2033","-draw","circle 1110,30 790,350",
    "-fill","none","-stroke","#d4a95d","-strokewidth","12","-draw","path 'M 760,455 C 850,310 970,310 1090,455 M 820,495 C 890,395 975,395 1040,495'",
    "-font","DejaVu-Sans-Bold","-fill","#d4a95d","-stroke","none","-pointsize","28","-annotate","+70+92","POE2 BUILD NAVI",
    "-fill","#ffffff","-pointsize","52","-annotate","+70+270",title,
    "-font","DejaVu-Sans","-fill","#cbd5e1","-pointsize","30","-annotate","+70+342",subtitle,
    "-fill","#d4a95d","-draw","roundrectangle 70,430 425,502 36,36",
    "-font","DejaVu-Sans-Bold","-fill","#101827","-pointsize","24","-annotate","+122+476",`PATCH ${discovery.patchVersion}`,
    "-strip","-quality","82",target
  ], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Failed to render ${filename}: ${result.stderr}`);
}

const header = (kicker, title, subtitle, height = 630) => `<text x="64" y="74" fill="#d4a95d" font-family="sans-serif" font-size="22" font-weight="700" letter-spacing="3">${esc(kicker)}</text><text x="64" y="132" fill="#f8fafc" font-family="sans-serif" font-size="43" font-weight="800">${esc(title)}</text><text x="64" y="174" fill="#c9d4df" font-family="sans-serif" font-size="24">${esc(subtitle)}</text>`;
const card = (x, y, w, h, eyebrow, title, detail, accent = "#d4a95d") => `<g filter="url(#shadow)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="#182436" stroke="#31455d"/><rect x="${x}" y="${y}" width="8" height="${h}" rx="4" fill="${accent}"/><text x="${x + 28}" y="${y + 37}" fill="${accent}" font-family="sans-serif" font-size="18" font-weight="700">${esc(eyebrow)}</text><text x="${x + 28}" y="${y + 78}" fill="#fff" font-family="sans-serif" font-size="27" font-weight="700">${esc(short(title, 22))}</text><text x="${x + 28}" y="${y + 112}" fill="#b9c7d6" font-family="sans-serif" font-size="19">${esc(short(detail, 32))}</text></g>`;

function guideVisual(title, subtitle, picks, filename) {
  const positions = [[64,220],[624,220],[64,385],[624,385]];
  const body = header("QUICK GUIDE", title, subtitle) + picks.slice(0, 4).map((pick, index) => card(...positions[index], 512, 130, pick.label, pick.title, pick.detail, pick.color)).join("");
  return writeFile(resolve(out, "guides", filename), svg(body, title));
}

const byId = (id) => builds.find((build) => build.id === id);
await mkdir(resolve(out, "guides"), { recursive: true });
await mkdir(resolve(out, "classes"), { recursive: true });
await mkdir(resolve(out, "builds"), { recursive: true });
await mkdir(resolve(out, "og"), { recursive: true });

await guideVisual("PoE2 初心者おすすめビルド", "遊び方から最初の1体を選ぶ早見図", [
  {label:"遠距離",title:byId("ranger-ice-shot-deadeye").name,detail:"Lv31で主力へ切替",color:"#79b7dd"},
  {label:"耐久",title:byId("warrior-shield-wall-smith").name,detail:"盾を軸に育成",color:"#9fb6c8"},
  {label:"ミニオン",title:byId("witch-minion-infernalist").name,detail:"位置取りへ集中",color:"#b28adb"},
  {label:"継続ダメージ",title:byId("witch-ed-contagion-lich").name,detail:"序盤から段階別に育成",color:"#85c7a3"}
], "poe2-beginner-recommended-builds.svg");

await guideVisual("PoE2 初心者向けビルドTier", "強さだけでなく育てやすさと操作条件で比較", discovery.tiers.S.map(({id}, index) => ({label:`S TIER ${index + 1}`,title:byId(id).name,detail:byId(id).audience,color:"#d4a95d"})), "poe2-beginner-build-tier.svg");
await guideVisual("PoE2 リーグスターター", "序盤の育てやすさから候補を比較", [
  {label:"弓",title:byId("ranger-ice-shot-deadeye").name,detail:"序盤手順を確認済み",color:"#79b7dd"},
  {label:"盾・耐久",title:byId("warrior-shield-wall-smith").name,detail:"Lv22で主力へ",color:"#9fb6c8"},
  {label:"召喚",title:byId("witch-minion-infernalist").name,detail:"攻撃を仲間に任せる",color:"#b28adb"},
  {label:"近接",title:byId("monk-whirling-assault").name,detail:"Lv41で主力へ",color:"#d88f70"}
], "poe2-league-starter-builds.svg");

const levelBody = header("LEVELING", "PoE2 レベリングガイド", "職業 → ビルド → 現在Lv → 今やること3つ") + ["職業を選ぶ","ビルドを選ぶ","現在Lvを入力","今やること3つ"].map((label,index) => {
  const x = 64 + index * 278;
  return `<g><circle cx="${x + 105}" cy="340" r="86" fill="#182436" stroke="${index === 3 ? "#d4a95d" : "#44617c"}" stroke-width="4"/><text x="${x + 105}" y="328" text-anchor="middle" fill="#d4a95d" font-family="sans-serif" font-size="28" font-weight="800">${index + 1}</text><text x="${x + 105}" y="372" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="21" font-weight="700">${label}</text>${index < 3 ? `<path d="M${x + 200} 340h55" stroke="#6f8398" stroke-width="4"/><path d="m${x + 250} 328 14 12-14 12" fill="none" stroke="#6f8398" stroke-width="4"/>` : ""}</g>`;
}).join("");
await writeFile(resolve(out, "guides/poe2-leveling-guide.svg"), svg(levelBody, "PoE2 レベリングガイド"));

const classPicks = [{label:"遠距離",slug:"ranger"},{label:"召喚",slug:"witch"},{label:"近接",slug:"monk"},{label:"耐久",slug:"warrior"}].map(({label,slug}) => { const c=classes.find((item)=>item.slug===slug); return {label,title:c.name,detail:c.tagline,color:"#d4a95d"}; });
await guideVisual("PoE2 おすすめクラス・職業", "強さ順位ではなく続けたい戦い方から選ぶ", classPicks, "poe2-recommended-classes.svg");
renderOg("poe2-recommended-builds-og.webp", "RECOMMENDED BUILDS", "Beginner picks and leveling");
renderOg("poe2-build-tier-og.webp", "BEGINNER BUILD TIER", "Leveling clarity and controls");
renderOg("poe2-league-starter-og.webp", "LEAGUE STARTERS", "Early-game build comparison");
renderOg("poe2-leveling-og.webp", "LEVELING GUIDE", "Your level. Your next 3 actions.");
renderOg("poe2-classes-og.webp", "CHOOSE YOUR CLASS", "Find a class by playstyle");

const classMarks = {
  ranger:'<path d="M470 355q120-145 245 0M500 390q105-115 185 0M735 248 540 470M690 250l48-5-5 48" fill="none" stroke="#d4a95d" stroke-width="18" stroke-linecap="round"/>',
  witch:'<circle cx="600" cy="340" r="112" fill="none" stroke="#b28adb" stroke-width="16"/><path d="M600 190v300M450 340h300M500 240l200 200M700 240 500 440" stroke="#b28adb" stroke-width="10" opacity=".7"/>',
  monk:'<path d="M450 405 735 245M485 450 770 290M455 415l-45 70M765 280l45-70" fill="none" stroke="#d88f70" stroke-width="20" stroke-linecap="round"/>',
  warrior:'<path d="M510 220h180v155q0 110-90 155-90-45-90-155z" fill="none" stroke="#9fb6c8" stroke-width="18"/><path d="M600 230v275M520 330h160" stroke="#9fb6c8" stroke-width="12"/>',
  sorceress:'<path d="M600 190c25 60-60 85-20 140 20 28 52 13 62-13 33 64 2 145-71 158-92 16-151-84-95-155 8 78 53 72 62 31 11-49-24-74 62-161z" fill="none" stroke="#e18b73" stroke-width="16"/>',
  huntress:'<path d="M440 455 745 220M500 245l235 205M470 430l-40 50M720 245l42-50" fill="none" stroke="#85c7a3" stroke-width="17" stroke-linecap="round"/>',
  mercenary:'<path d="M430 300h295l55 45-55 45H430zM520 390v80M650 390v80" fill="none" stroke="#79b7dd" stroke-width="17" stroke-linejoin="round"/><circle cx="705" cy="345" r="24" fill="none" stroke="#79b7dd" stroke-width="12"/>',
  druid:'<path d="M600 470c-100-25-145-142-78-220 31 62 92 50 115-20 76 75 55 206-37 240zM600 462c5-94 38-143 95-190M600 462c-14-75-54-115-115-140" fill="none" stroke="#85c7a3" stroke-width="17" stroke-linecap="round"/>'
};
for (const item of classes) {
  const body = header("CLASS GUIDE", `PoE2 ${item.name}`, item.tagline) + classMarks[item.slug] + `<g><rect x="64" y="492" width="1072" height="72" rx="18" fill="#182436"/><text x="600" y="538" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="24">${esc(item.combatStyle.join(" ・ "))}</text></g>`;
  await writeFile(resolve(out, "classes", `poe2-${item.slug}.svg`), svg(body, `Path of Exile 2 ${item.name}`));
  renderOg(`poe2-${item.slug}-og.webp`, `POE2 ${item.slug.toUpperCase()}`, "Builds and leveling guide");
}

const priorityBuildIds = ["ranger-ice-shot-deadeye","witch-minion-infernalist","warrior-shield-wall-smith","monk-whirling-assault","witch-ed-contagion-lich"];
for (const id of priorityBuildIds) {
  const build = byId(id);
  const rows = build.levelingStages.map((stage,index) => {
    const col = index % 2, row = Math.floor(index / 2), x = 64 + col * 556, y = 202 + row * 142;
    return card(x,y,512,116,stage.label,short(stage.mainSkill,24),short(stage.nowActions[0],31),index < 4 ? "#79b7dd" : "#d4a95d");
  }).join("");
  const body = header("BUILD ROADMAP", `PoE2 ${build.name}`, "Lv1 → Campaign → Mapping → Endgame", 840) + rows;
  await writeFile(resolve(out, "builds", `poe2-${build.slug}-leveling-roadmap.svg`), svg(body, `PoE2 ${build.name}の育成ロードマップ`, 840));
  renderOg(`poe2-${build.slug}-og.webp`, build.slug.replaceAll("-", " ").toUpperCase(), "Level 1 to Endgame roadmap");
}

console.log("Generated 18 original SVG image assets from verified site data.");

// Replace practical diagrams with readable desktop/mobile compositions.
await import("./improve-practical-images.mjs");
