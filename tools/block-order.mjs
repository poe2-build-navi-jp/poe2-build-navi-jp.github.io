// Canonical order of the blocks that enhancers append just before </head> and </main>.
// Every enhancer inserts its block through insertBlock(), which places it before the first
// later-ordered block already in the page (or before the closing tag), so the final HTML is
// the same whichever order the tools run in. Add new appended blocks to these lists.
const marker = (name) => (html) => html.indexOf(`<!-- ${name}:start -->`);
export const HEAD_BLOCKS = [
  ["image-seo", marker("image-seo")],
  ["image-schema", marker("image-schema")],
  // inject-analytics adds this script without a marker.
  ["analytics-events", (html) => html.search(/<script defer src="\/assets\/analytics-events\.js/)],
  ["practical-assets", marker("practical-assets")],
  ["build-ux", marker("build-ux")],
  ["one-faq", marker("one-faq")],
  ["page-schema", marker("page-schema")],
  ["og-image", marker("og-image")],
  ["site-icon", marker("site-icon")]
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
