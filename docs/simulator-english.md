# English simulator

The public English entry is `/en/simulator/`. The Japanese entry remains `/simulator/`.

Both versions use the same calculation engine and same save format/storage keys. User notes and build names must not be translated or overwritten. English pages use original English game names from the engine catalog instead of translating Japanese names back to guessed English.

## Build and QA

Run the English generator through `npm run build`; do not edit generated English output as the only source. Run `node scripts/test-simulator-english.mjs`, `npm run test:simulator`, and `npm run test:search`. The English page is regenerated after Japanese-only enhancement passes. Page dates and asset hashes are finalized afterward.

## Search eligibility

- Separate crawlable English URL and self canonical.
- Reciprocal `hreflang="ja"` / `hreflang="en"` on both simulator pages.
- English headings, description and useful visible instructions available without JavaScript.
- Links from the Japanese simulator; both XML and text sitemaps include the English URL.
- Indexable robots metadata; JavaScript and game data remain crawlable.

These are eligibility and discovery improvements, not a guarantee of indexing, rankings or rich results. Google decides whether and when to index. Search Console submission should only be reported as performed after its result is verified. No Search Console submission is implied by generating a sitemap.

English-specific checks: `npm run test:simulator:en`. Translation generation fails on unknown Japanese source strings, rather than silently serving untranslated labels. The English runtime is generated from the Japanese implementation; it is not independently edited. Existing Japanese user notes and item names inside imported calculation payloads remain user data and are deliberately not rewritten.

English guide data includes one explicitly qualified name: the source's ケラリの残虐 is described as Kelari's second command with the official English name unverified; do not invent a canonical game name. Linked full guide articles remain Japanese and are labelled accordingly.

The English social image is original SVG artwork (`images/poe2/og/poe2-en-simulator-og.svg`), exported to WebP. Existing site OG images can be retained with `OG_METADATA_ONLY=1 npm run build` when the browser-based image renderer is unavailable; this still executes the full site/data/metadata generation chain. Shared build query/hash data is excluded from the analytics page location in both locales.
