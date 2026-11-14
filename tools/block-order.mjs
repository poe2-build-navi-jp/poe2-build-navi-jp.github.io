// Canonical order of the blocks that enhancers append just before </head> and </main>.
// Every enhancer inserts its block through insertBlock(), which places it before the first
// later-ordered block already in the page (or before the closing tag), so the final HTML is
// the same whichever order the tools run in. Add new appended blocks to these lists.
const marker = (name) => (html) => html.indexOf(`<!-- ${name}:start -->`);
export const HEAD_BLOCKS = [
  ["skill-icons", marker("skill-icons")],
  ["equipment-icons", marker("equipment-icons")],
  ["image-seo", marker("image-seo")],
  ["image-schema", marker("image-schema")],
  // inject-analytics adds this script without a marker.
  ["analytics-events", (html) => html.search(/<script defer src="\/assets\/analytics-events\.js/)],
  ["practical-assets", marker("practical-assets")],
  ["build-ux", marker("build-ux")],
  ["one-faq", marker("one-faq")],
  ["page-schema", marker("page-schema")],
  ["page-date-schema", marker("page-date-schema")],
  ["og-image", marker("og-image")],
  ["site-icon", marker("site-icon")],
  // enhance-editorial-trust: shared Organization/WebSite identity on the home and about pages.
  ["identity-schema", marker("identity-schema")]
];
export const MAIN_END_BLOCKS = [
  ["build-feedback", marker("build-feedback")],
  ["term-links", marker("term-links")],
  ["build-history", marker("build-history")],
  ["one-link", marker("one-link")]
];

export function insertBlock(html, closing, name, block) {
  const order = closing === "</head>" ? HEAD_BLOCKS : closing === "</main>" ? MAIN_END_BLOCKS : null;
  if (!order) throw new Error(`insertBlock: unsupported closing tag ${closing}`);
  const index = order.findIndex(([item]) => item === name);
  if (index === -1) throw new Error(`insertBlock: ${name} is not listed for ${closing}`);
  const end = closing === "</main>" ? html.lastIndexOf(closing) : html.indexOf(closing);
  if (end === -1) throw new Error(`insertBlock: ${closing} not found for ${name}`);
  let at = end;
  for (const [, find] of order.slice(index + 1)) {
    const found = find(html);
    if (found !== -1 && found < at) at = found;
  }
  return `${html.slice(0, at)}${block}${html.slice(at)}`;
}

// Some steps add a page stylesheet just before </head> without a block marker. Once blocks are
// re-inserted around it, its position would depend on the order the tools ran in. The page's own
// stylesheets (the run of <link rel="stylesheet"> right after styles.css, and mobile.css) stay where they are;
// every other unmarked page stylesheet moves to just before </head>, keeping their relative
// order, so the cascade does not change. Run once at the end (sync-asset-versions).
export function normalizeHeadStylesheets(html) {
  const end = html.indexOf("</head>");
  if (end === -1) return html;
  const head = html.slice(0, end);
  const spans = [...head.matchAll(/<!-- ([a-z-]+):start -->[\s\S]*?<!-- \1:end -->/g)].map((m) => [m.index, m.index + m[0].length]);
  const inBlock = (i) => spans.some(([a, b]) => a <= i && i < b);
  const links = [...head.matchAll(/<link rel="stylesheet" href="\/assets\/[^"]+">/g)].filter((m) => !inBlock(m.index));
  const baseStart = links.findIndex((m) => m[0].includes('href="/assets/styles.css'));
  if (baseStart === -1) return html;
  let k = baseStart + 1;
  while (k < links.length && /^\s*$/.test(head.slice(links[k - 1].index + links[k - 1][0].length, links[k].index))) k++;
  // mobile.css is part of every page's own head, even when it is not right after styles.css.
  const moved = links.slice(k).filter((m) => !m[0].includes('href="/assets/mobile.css'));
  if (!moved.length) return html;
  let rest = head;
  for (const m of [...moved].reverse()) rest = rest.slice(0, m.index) + rest.slice(m.index + m[0].length);
  return rest + moved.map((m) => m[0]).join("") + html.slice(end);
}
