# Build selection UX

Run `node tools/enhance-build-ux.mjs` after the existing page/image generators.
This idempotent generator consumes `data/builds.json` and `data/discovery.json`.
It does not change build ratings, verification dates, patch values or URLs.

Validation:

```
node tools/enhance-build-ux.mjs
node tools/sync-asset-versions.mjs
npm install   # once; installs the test-only jsdom dependency
npm test
```

`test-build-ux.cjs` uses jsdom only in the test environment; no browser dependency is shipped.

Always run `node tools/sync-asset-versions.mjs` last after any generator or any edit under
`assets/`. It rewrites every `/assets/*.css|js` reference to `?v=<content hash>`, so the
hard-coded `?v=` values inside individual generators do not matter. `npm test` fails if a
page carries a stale version.

For future verified content changes, optionally append `changeHistory` entries
with `date` and `summary` to the relevant existing build record. Update `version`,
`updatedAt`, `status`, and the actual stages only after checking source material.
Keep global patch-note checks separate from build-specific verification dates.
Do not manufacture past history. The baseline explicitly says old reasons are unrecorded.
A 1.0 release uses these same build URLs and fields, without copied SEO pages.

Equipment dependence remains unrated until supported. Unlock filtering only uses
an explicit main-skill transition level or explicit Lv1 continuation in the source.
Mixed/unknown operation ratings remain unclassified instead of inferred.

When a guide explicitly supports a comparison fact, add `reviewedFacts` to its
existing build record with the precise claim, `source` URL and `checkedAt` date.
The card links to that guide. A partial SSF guide is described by its covered
stage rather than marking the full Endgame build SSF verified. Gem levels are
not treated as character unlock levels. The original `updatedAt` remains the
date of the full build-data review.

## Build ratings

`beginnerRating` / `damageRating` / `defenseRating` / `mappingRating` / `bossRating`
follow the rubric in `tools/build-ratings.mjs` and are published at `/rating-criteria/`.
Each build carries `ratingEvidence` (checkedAt, per-axis note, and for non-beginner
axes the quoted source statement, URL and date). `beginnerRating` is always
1 + the number of passed `checks`. Axes without a pros/cons statement stay `null`
(未評価), never guessed. After editing ratings run:

```
node tools/enhance-ratings.mjs
node tools/enhance-build-ux.mjs
node tools/generate-sitemap.mjs
node tools/inject-analytics.mjs
node tools/sync-asset-versions.mjs
npm test
```
