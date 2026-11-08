# Google Search / AI Overviews readiness — 2026-11-08

Google requires indexed, snippet-eligible pages for supporting links in AI Overviews and AI Mode. There is no special AI markup, AI text file, or guaranteed inclusion. Source: https://developers.google.com/search/docs/appearance/ai-features?hl=ja ; robots/snippet controls: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag?hl=ja .

## Findings and changes

All 144 sitemap pages already permitted Googlebot access, used self-canonicals and exposed their main content in initial HTML. No noindex, nosnippet, zero-length snippet cap or main-content data-nosnippet restriction was found. All sitemap pages are reachable from the homepage by ordinary HTML links. These checks establish site-side prerequisites, not actual Google index coverage.

The 12 verified build guides had no Article entity or visible editorial credit. Each now has a concise static definition, the existing reviewed switching recommendation and a nearby original-source link with its actual recorded review date. Existing audience/weakness/SSF caveats remain visible. The Article describes the same visible guide and cites visible sources; the shared editorial pass adds the credited operator and editorial-policy link. No new game-mechanic claims, invented rankings or publication dates were introduced. Source-review dates were retained; only the 12 changed guides receive a new content modification date and sitemap lastmod.

The Google crawl/robots permissions were already suitable and were preserved. No AI-specific files or schema were added. Article is ordinary guide metadata, not a requirement or promise of AI inclusion.

## Verification

- `npm run test:search`: all 144 routes, Googlebot rules, robots meta/snippet controls, self-canonicals, static HTML, HTML-link reachability, 98 attributed Articles and 12 build answers pass. Fixtures cover blocked routes, specific Googlebot rules and snippet exclusions.
- `node scripts/test-site.mjs`, `node scripts/test-seo.mjs`, `node scripts/test-static-content.mjs`, `node scripts/test-build-ux.cjs`, `node scripts/test-choice-clarity.cjs`, `node scripts/test-editorial-trust.mjs`, `git diff --check` pass.
- All 12 build detail pages match after the complete generator chain, including Article metadata and editorial credits.
- Browser: desktop Ice Shot guide checked; at 375/390/430 CSS px, HTML scroll width equals viewport width. Source labels are 14 px. [390 px evidence](build-answer-mobile.webp) is cropped from the browser screenshot to the real iframe plus scrollbar; no simulated phone frame. Physical iPhone/Safari not tested.
- The Pages workflow now runs the public search-eligibility check before collecting/deploying site files.

## Measurement boundary

Google index coverage, URL Inspection and actual AI Overview citations have not been claimed or verified. Use Search Console for index coverage and Web search impressions/clicks on the updated guide URLs after recrawling. Google includes AI-feature traffic in Web search reporting; ordinary referral or click totals cannot prove AI Overview placement. No unsupported submission endpoint or automated recurring task was added.
