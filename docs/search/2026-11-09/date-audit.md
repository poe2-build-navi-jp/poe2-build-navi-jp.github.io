# Page modification date audit — 2026-11-09 (JST)

Production audited at commit 86fb2c203baad8a6b43060e3aecb715bbfdd0be6. Scope: 144 indexable sitemap URLs and all 98 Article entities. All recorded content fingerprints matched their HTML. No future sitemap dates or missing Article dateModified fields were found. However, 76 of 98 Article dateModified values were older than the sitemap/content-ledger dates. A prominent, distinctly labelled page-update date was also missing.

## Confirmed production examples

Fresh no-cache HTTP GETs matched the repository source, including the sitemap and three sample pages:

| URL path | Sitemap lastmod / recorded content date | Previous Article dateModified |
|---|---|---|
| /skills/ice-shot/ | 2026-11-04 | 2026-10-16 |
| /guides/poe2-0-5-5-builds/ | 2026-11-05 | 2026-09-13 |
| /builds/ranger/ice-shot-deadeye/ | 2026-11-08 | 2026-11-08 (already consistent) |

All sampled HTTP Last-Modified values were Sun, 08 Nov 2026 13:33:40 GMT: GitHub Pages' deployment/file signal, not a page-specific editorial review date. No unsupported custom HTTP-header fix was attempted.

## Cause and correction

Several generators derived Article dateModified from source-check dates or old manually maintained fields; the sitemap independently used data/page-dates.json. A final shared metadata pass now emits the recorded content date into page-level Article/WebPage/CollectionPage/FAQPage metadata and a visible `ページ更新` time near the heading/editor. Missing page entities receive an ordinary WebPage entity. Publication and source-review dates are preserved and are not presented as new verification dates.

The sitemap now uses only each page's recorded content date, avoiding a site-wide patch date forcing unrelated page dates forward. The content fingerprint also tracks linked URLs, image URLs/alt text, title, description and canonical, fixing the reproduced URL-only edit blind spot. Fingerprint migration preserves the old date when the original content fingerprint still matches. Date labels, source-credit decoration, shared notices and asset-version-only changes do not advance the content date.

All 144 existing content dates were retained: none was reset to the audit date. The corrected Article dates now agree with the existing historical content dates, rather than manufacturing freshness.

## Validation

`npm run test:search` includes the new `test:dates` check and runs before Pages deployment. Tests cover all 144 visible dates and page schemas, 98 Articles, lastmod agreement, future/invalid dates, publication preservation, URL/image/description edits, migration without date inflation, idempotent date passes and unchanged regeneration. Existing site, SEO, editorial-trust, guide-search-intent, unique-gear and mobile-summary checks pass. Browser verification at 390 CSS px shows page update 2026-11-04 clearly separated from source review 2026-10-16 with no horizontal overflow. [Mobile evidence](page-date-mobile.webp). Physical iPhone/Safari not tested.

Google still chooses whether and which date to show. This audit does not establish Google's last crawl time, index coverage or a causal ranking/AI Overview effect.

Official guidance:
- https://developers.google.com/search/docs/appearance/publication-dates
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping
