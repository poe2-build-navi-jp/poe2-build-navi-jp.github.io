# Glossary provenance and final coverage

## Review base and publication hold

This is a separate follow-up to PR #48, based on `content/remaining-guide-evidence` at `1377ba2f7243244842830ca10dd39ca94011ee2d`. PR #48 in turn depends on PR #47. Neither preceding branch is modified. No merge or deployment is requested. After earlier PRs merge, retarget this PR and recheck the remaining diff and tests.

## Thirteen glossary pages

The dictionary keeps its definition-first format. The next action now follows the short definition, followed by a term-specific explanation of the sources, reference period and unknowns. It does not pretend to be a gameplay test report. The old blanket “all values are current at 0.5.5” source sentence is removed. Historical source dates are retained; a source check is not a gameplay-test date.

| Term | Individual evidence boundary |
| --- | --- |
| build | Site selection criteria and linked build examples; no full-build testing or optimal-build claim |
| dps | Authors' evaluations and estimates, not comparable measured DPS |
| skill-gem | Existing gem/quality/requirement reference records, with present-item checks and exceptions left open |
| support-gem | Existing count/attribute/Lineage explanations; official 0.4.0 compatibility display change does not validate every combination |
| passive-tree | Historical baseline point counts, with extra points separate; current routes and costs not tested |
| resistance | Dated cap/reward examples; exact progression-penalty table replaced with current character-display checking |
| mapping | Official identification change; unsupported universal revival-count and failure-penalty rules removed |
| endgame | Fixed-location party-sharing and core-specific fortress completion changes corrected against official notes |
| league-starter | Event dates and migration plans explicitly attributed to the recorded announcement, not asserted as current availability |
| ssf | Mode rules and authors' evidence separated; no whole-route SSF proof or fixed count of confirmed builds in metadata |
| ascendancy | Point/selection reference records and authors' recommended levels, not universal required levels |
| spirit | Dated reward examples and current reservation/weapon-set checks; not proof of every exception |
| energy-shield | Dated baseline recharge numbers and damage behavior, with special effects and actual build requirements untested |

New checks on 2026-10-25 are narrowly scoped to these official notes:
- https://www.pathofexile.com/forum/view-thread/3932540 — identified Waystones and shared completion of fixed Atlas locations (0.5.0).
- https://www.pathofexile.com/forum/view-thread/4000864 — non-quest versus quest Origin Core fortress completion (0.5.5).
- https://www.pathofexile.com/forum/view-thread/3883495/filter-account-type/staff — equipped-skill compatibility display when hovering supports (0.4.0).

Other references retain their prior dates and are explicitly presented as existing source records; this work did not refetch every external build guide or certify every intervening patch.

## Separate build/entity inspection

All 12 build-detail pages were checked for individual rating evidence, recorded build version, dated source/history information, the distinction from same-condition performance measurement, and specific unconfirmed/reverification limits. Those elements are already rendered; no duplicate glossary block is added. The recorded build version is not a fresh certification that all eight stages still work. Inherited claims whose original sources could not be reacquired remain historical/qualified evidence, not new proof.

All 24 entity pages (12 skills, 12 equipment) have per-source `supports` and `checkedAt`, source-linked effect/requirement/acquisition statements, and individual cautions. Skill stage usage links back to the build's source/version; equipment entries explain adoption conditions and tradeoffs. The existing source section limits descriptions to the sources' checked scope and prioritizes actual gem/item values. No missing structural field requiring a duplicate block was identified. All roll variants, skill interactions and drops have not been experimentally verified.

## Coverage of this structural task

| Family | Count | Result |
| --- | ---: | --- |
| First-batch guides | 5 | PR #47: scoped evidence and crawler policy |
| Remaining guides | 16 | PR #48: individual scope, reference versions and bounded corrections |
| Already structured guides | 14 | Existing action/source/caveat structure retained without duplicate blocks |
| General glossary | 13 | This PR: individual provenance and reference-time boundaries |
| Build details | 12 | Existing individual evidence/version/unknown structures inspected and retained |
| Skill/equipment details | 24 | Existing individual source support/cautions inspected and retained |
| Total detailed pages inventoried | 84 | Structural coverage; not 84 gameplay validations |

The 14 retained guides are act-1-walkthrough, act-2-walkthrough, act-3-walkthrough, act-4-walkthrough, interlude-walkthrough, endgame-contents, endgame-items, atlas-passive-trees, ascendancy-trials, permanent-rewards, budget-gear-crafting, pinnacle-bosses, arbiter-of-ash-clear-record and unique-gear.

Within this inventory, no further missing provenance-format work is identified. Navigation, search, event/version landing pages, tools and legal pages are outside the forced guide format. This does not assert that every gameplay fact on every site page is current. No new game-client tests, full-build runs, timing measurements, loot experiments or price checks were performed. Existing operator-provided screenshots and clear records are preserved unchanged.

## Validation

Full build and full repository tests; dictionary tests cover all 13 definitions/actions/evidence/source ordering, individual fields, source dates and removal of the blanket version claim. Additional structural assertions cover the existing 12 builds and 24 entities. All 13 glossary pages checked in Chromium at 390px and 1440px for overflow, source-anchor behavior and axe WCAG 2 A/AA violations; representative screenshots inspected. Public deployment is not performed. Automated accessibility checks do not replace a complete manual audit.
