// Title handling after a major release (e.g. 1.0) for pages still verified only for an older version.
// A title that says only the old version looks stale in search results, and claiming the new version
// would be false, so the old version is dropped and an explicit "checking" suffix is added.
// The original title is kept in a head comment so the change can be undone or reapplied (idempotent).
const ORIGINAL = /<!-- version-title:original (.*?) -->/;
const escRe = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function releaseTitle(title, oldVersion, game) {
  const v = escRe(oldVersion);
  const stripped = title
    // A bracketed version such as （0.5.5） would otherwise leave empty brackets behind.
    .replace(new RegExp(`[（(【\\[]\\s*${v}\\s*[）)】\\]]`), "")
    .replace(new RegExp(`｜${v}$`), "")
    .replace(new RegExp(` ?${v} ?`), " ")
    .replace(/ ｜/g, "｜").replace(/｜ /g, "｜").replace(/ {2,}/g, " ").trim();
  return `${stripped}【${game}対応確認中】`;
}

const OG = /<meta property="og:title" content="([^"]*)">/;
const schemaName = (title) => `"name":${JSON.stringify(title.replaceAll("&amp;", "&"))}`;
const escAttr = (v) => v.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

// Restores the original title and og:title, then (when oldVersion is given and the title contains it)
// applies releaseTitle to both.
export function applyVersionTitle(html, oldVersion, game) {
  const saved = html.match(ORIGINAL);
  if (saved) {
    const { title, og } = JSON.parse(decodeURIComponent(saved[1]));
    const shown = html.match(/<title>([^<]*)<\/title>/)?.[1];
    if (shown && shown !== title) html = html.replaceAll(schemaName(shown), schemaName(title));
    html = html.replace(ORIGINAL, "").replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
    if (og !== undefined) html = html.replace(OG, `<meta property="og:title" content="${og}">`);
  }
  if (!oldVersion) return html;
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  if (!title || !title.includes(oldVersion)) return html;
  const og = html.match(OG)?.[1];
  const next = releaseTitle(title, oldVersion, game);
  const marker = `<!-- version-title:original ${encodeURIComponent(JSON.stringify({ title, og }))} -->`;
  html = html.replace(/<title>[^<]*<\/title>/, `${marker}<title>${next}</title>`);
  // Structured data that repeats the page title (e.g. CollectionPage.name) follows it.
  html = html.replaceAll(schemaName(title), schemaName(next));
  if (og !== undefined) html = html.replace(OG, `<meta property="og:title" content="${escAttr(og.includes(oldVersion) ? releaseTitle(og, oldVersion, game) : next)}">`);
  return html;
}
