# Build selection UX

Run `node tools/enhance-build-ux.mjs` after the existing page/image generators.
This idempotent generator consumes `data/builds.json` and `data/discovery.json`.
It does not change build ratings, verification dates, patch values or URLs.

Validation:

```
node tools/enhance-build-ux.mjs
node scripts/test-site.mjs
node scripts/test-seo.mjs
node scripts/test-static-content.mjs
NODE_PATH=/path/to/test-only/node_modules node scripts/test-build-ux.cjs
```

`test-build-ux.cjs` uses jsdom only in the test environment; no browser dependency is shipped.

For future verified content changes, optionally append `changeHistory` entries
with `date` and `summary` to the relevant existing build record. Update `version`,
`updatedAt`, `status`, and the actual stages only after checking source material.
Keep global patch-note checks separate from build-specific verification dates.
Do not manufacture past history. The baseline explicitly says old reasons are unrecorded.
A 1.0 release uses these same build URLs and fields, without copied SEO pages.

Equipment dependence remains unrated until supported. Unlock filtering only uses
an explicit main-skill transition level or explicit Lv1 continuation in the source.
Mixed/unknown operation ratings remain unclassified instead of inferred.
