# Bing verification and explicit IndexNow notifications

The homepage retains Bing's `msvalidate.01` ownership tag. The homepage generator reads and preserves its existing head; the generation regressions and IndexNow test protect the tag.

The root text file named by `KEY_FILE` in `scripts/indexnow-content.mjs` is this site's public IndexNow host-verification key. It is deliberately published and is not an account credential, API token, OAuth grant, or payment secret. Do not reuse another site's key.

## Current selection

`docs/indexnow/2026-10-13-changes.json` contains exactly 16 canonical HTML pages changed from `0fc117efc3b214ba5a15cca190dd184e0a3def3e` to `7fd942c80bcbbe29565cf9a88467e56de549ce82`. It includes the homepage, purpose comparison, gear diagnosis, unique-gear guide, and 12 build details. The other 89 sitemap URLs were not selected. The hashes cover meaningful rendered content, title, description and links; verification-only tags do not create content updates.

`docs/indexnow/2026-10-16-changes.json` is the newest plan: the homepage (new build list), `/best-builds/` and `/what-is-poe2/` (titles and descriptions). `npm run test:indexnow` checks the current pages against the newest plan, so a later content change to one of its pages needs a new plan.

## Review and send

Requires Node 22+ and repository dev dependencies. No scheduled workflow or automatic submission is installed.

1. After future substantive edits, make a newline-separated, explicit list of affected canonical production URLs. Only this site's HTTPS paths without query strings/fragments are accepted.
2. Create a plan from Git commits, then review its diff and URL list:

   `node scripts/indexnow-plan.mjs BASE_COMMIT CONTENT_COMMIT urls.txt changes.json`

3. Dry-run makes no network request:

   `npm run indexnow -- --urls changes.json --dry-run`

4. Wait for the exact production commit to finish the standard GitHub Pages deployment, then perform read-only checks:

   `npm run indexnow -- --urls changes.json --commit DEPLOYED_COMMIT --verify`

5. Only when submission is authorized, send with the same persistent receipt directory every time:

   `npm run indexnow -- --urls changes.json --commit DEPLOYED_COMMIT --send --state-dir /persistent/path/poe2-indexnow`

Verification fails closed unless the main branch equals the chosen commit, the latest standard Pages deployment for that commit succeeded, the public key matches, robots.txt allows crawlers, each URL is in the live sitemap, and each URL is a direct HTTP 200 HTML response with a self-canonical, no noindex directive, and reviewed content hash. The entire production check repeats immediately before each attempt, including after a 429. The source content commit can differ from the deployment commit when the latter only adds submission tooling or verification tags.

## Receipts and retries

Keep `receipts.json` outside the published site, on persistent storage, and back it up with the reviewed plan and submission output. Reuse it across future invocations and executors; a new empty directory loses duplicate protection. `.indexnow/` is ignored if it is used locally. A lock prevents concurrent senders.

The script writes and fsyncs an `in_flight` record, then syncs its directory, before its batch POST to `https://api.indexnow.org/indexnow`. It records HTTP 200 as `accepted` and 202 as `key_validation_pending`; neither proves indexing or ranking. Both block automatic resubmission of the same content. Participating engines share IndexNow submissions, so do not also submit the batch separately to Bing.

Only an explicit HTTP 429 can retry automatically, respecting Retry-After, with at most three attempts. Long waits require a later invocation with the same receipts. Lost responses and server errors are `uncertain` and are never automatically resent. Preserve `in_flight` or `uncertain` records and investigate before any manual resubmission; do not delete them to make the script run. Other rejection responses also stop automatic submission.

Tests: `npm run test:indexnow` and `npm test`.

Protocol reference: https://www.indexnow.org/documentation
