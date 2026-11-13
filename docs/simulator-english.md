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

Linked full guide articles remain Japanese and are labelled accordingly.

## Kelari command-skill name verification (2026-11-13)

The guide's ケラリの残虐 is **Kelari's Brutality**, not equipment or the Brutality support gem. It is Kelari's knife-volley command skill. The earlier qualified placeholder has been replaced in all four English leveling-guide strings.

Evidence:
- [PoE2DB Japanese game-data record](https://poe2db.tw/jp/Kelari%2C_the_Tainted_Sands) pairs ケラリの残虐 with skill ID `KnifeThrowSandDjinn`; its English skill-data export labels the same ID `Kelari's Brutality`.
- [PoE2DB English game-data record](https://poe2db.tw/us/Kelari%2C_the_Tainted_Sands) uses the same ID and name.
- [Original PhazePlays campaign guide](https://mobalytics.gg/poe-2/profile/phazeplays/builds/0-4-phazeplays-sandscorcher-campaign-guide) explicitly describes Kelari's Brutality and the knife command, independently matching the guide's intended use.

These are a third-party game-data mirror and the build author's guide, not a direct inspection of the user's game client or an official GGG announcement. Only guide display strings changed; calculation IDs, requests, saves, and equipment are unchanged.

The English social image is original SVG artwork (`images/poe2/og/poe2-en-simulator-og.svg`), exported to WebP. Existing site OG images can be retained with `OG_METADATA_ONLY=1 npm run build` when the browser-based image renderer is unavailable; this still executes the full site/data/metadata generation chain. Shared build query/hash data is excluded from the analytics page location in both locales.

## English copy review (2026-11-13)

Reviewed static text/attributes, runtime concatenation, save/compare/share dialogs, errors, calculation labels, passive controls, all 12 build guides and example descriptions. Corrected 3 static sentences, 44 guide/example translations, and 68 whole-template rules (67 new, one revised), including remove-group controls, number/label spacing and clearer error instructions. Prose follows the game's British English spelling where appropriate; game names and calculation data are unchanged. This review is not a claim that every possible input/error combination was manually exercised.

JSON dependencies now receive content fingerprints (the matcher tests `.json` before `.js`), so corrected display data is refreshed after deployment. Regression checks cover fingerprinted catalogs, visible remove-group text and its accessible label, plus locale-aware navigation. Search Console request status must be recorded from its actual result, separately from publication.
