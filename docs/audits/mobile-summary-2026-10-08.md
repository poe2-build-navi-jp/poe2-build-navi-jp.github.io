# Mobile entry-page summary — 2026-10-08

## Scope

Home and `/beginner-builds/` only; baseline main `a04a1fe9e8a185adc53f264c3cdbd5d137ed529c`.

- Home keeps the three primary routes, guide hub and current-level controls available immediately. Eight secondary content blocks use labeled native disclosures: usage/patch details, class chooser, changes, extended routes, example, and three FAQ answers.
- Beginner page keeps all five quick choices, audience, weakness, switch timing and direct build links visible. The six longer comparison cards open together. Source details remain available. The mobile header is a labeled menu disclosure.
- No build facts or existing guide text are removed. The change adds no persistence, network requests or analytics events. All original content and links remain in generated HTML.
- CSS spacing/type refinements are scoped to these pages and the mobile breakpoint. Disclosures remain usable on desktop and with JavaScript disabled. Hash navigation reveals relevant collapsed content, including repeated same-hash clicks and restored pages.
- Both discovery regeneration and site-chrome/build-UX enhancement use the shared reversible helper; generated output is checked for drift.

## Verified

`npm test` passes, including all existing site, SEO, static content, build UX, Lv37 guidance, factual corrections, beginner navigation, and new mobile-summary tests. Two complete generation passes are byte-identical to the checked-in entry pages. `node --check` and `git diff --check` pass.

DOM tests verify retained content/links/metadata, unique IDs, native open/close behavior without the enhancement script, primary controls outside closed disclosures, 5 visible quick cards plus 6 retained comparison cards, incoming/repeated/restored deep links, and unchanged build-click analytics. The responsive harness includes the beginner page.

## Verification limits

No rendered mobile page-height or scroll-reduction measurement is claimed. Local Chromium launch was blocked by sandbox socket permissions; the cloud browser recovered but could not connect to the unpublished local preview (connection refused). Therefore mobile screenshots, 320/375/390/430px overflow/touch-target measurements, rendered contrast and the Chromium-dependent enhancer-order suite are not verified. Before release, use an accessible preview or post-deploy browser to inspect both pages and disclosure/level flows at those widths.
