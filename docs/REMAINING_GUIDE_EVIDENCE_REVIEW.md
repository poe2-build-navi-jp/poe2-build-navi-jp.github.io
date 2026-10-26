# Remaining guide evidence review

## Dependency and publication hold

This follow-up is based on PR #47 (`content/search-access-evidence`, `8c50f84dcbcb6eafcf594cf99b5abee336a9701b`). Its review base is that branch, not main. PR #47 remains unchanged. Neither PR is authorized for merging by this work. After #47 merges, retarget and check the follow-up diff before publication.

## Scope: 16 existing guides

No new guides, URLs, images, game experiments or settings. The existing short answers and practical actions remain first. Evidence follows the actions and links to individually scoped sources.

| Template | Existing guides | Evidence scope |
| --- | --- | --- |
| Strategy (3) | campaign-progression, trial-of-chaos, expedition | Published official progression, trial and Expedition changes; no claim of testing every route, reward or build |
| Beginner (4) | skill-gems, support-gems, equipment-basics, after-campaign | Existing official/Wiki/DB references; distinguish historical changes from current complete specification |
| Diagnostic (9) | passive-tree, resistance, increase-damage, why-i-die, mapping, mana-problem, cant-beat-boss, gear-upgrade, slow-mapping | Editorial checking order; source coverage separated from unmeasured performance, prices and individual diagnoses |

The other 14 already structured intent guides receive no duplicate block. Together with the 5-guide first batch this covers the 35 intent-guide structure inventory; it is not a complete current-mechanics audit of the whole site. Event/version landing pages and navigation/legal/tools use different purposes and are not forced into this format.

## Sources and corrections

New source checks are dated 2026-10-25 only for resources actually read. Existing source dates remain unchanged. Historical patches are identified as references, not a certification against every later patch. Official sources are preferred; PoE2DB is identified as nonofficial.

- Official 0.5.0: https://www.pathofexile.com/forum/view-thread/3932540 — Waystone identification/modifier changes and passive changes; not proof of optimal routes or reward rates.
- Official 0.4.0: https://www.pathofexile.com/forum/view-thread/3883495/filter-account-type/staff — support compatibility display; not measured DPS.
- Official 0.3.0: https://www.pathofexile.com/forum/view-thread/3826682/filter-account-type/staff — campaign/interlude changes.
- Official 0.5.5/0.5.5b: https://www.pathofexile.com/forum/view-thread/4000864 and https://www.pathofexile.com/forum/view-thread/4004106 — existing strategy references for trial/Expedition changes.
- https://poe2db.tw/us/Resistances — general resistance role; no minimum build target or verification of every progression penalty.
- https://poe2db.tw/us/Mana — individual continual-consumption example; not every build's resource formula.

Removed unsupported fixed progression-penalty advice from gear-upgrade and the old universal modifier-count/revival rule from slow-mapping. Readers are directed to actual current character/item displays. No new hands-on, author, review or performance claims.

## Separate template inventory

| Page family | Count | Structural finding | Remaining work |
| --- | ---: | --- | --- |
| Build details | 12 | Stage actions, source verification, dated sources and update history already present | No duplicate guide block needed; all builds/stages have not been newly playtested or revalidated against every current patch |
| General glossary | 13 | Definitions, actions and sources exist, but shared source copy uses a blanket version and lacks term-specific confirmation limits | 13 need term-specific version/provenance review in a separate scope |
| Skill/equipment entities | 24 | Individual source support, dates, requirements and caveats already present | No mandatory guide-block gap identified; this inventory does not certify all current values |

Thus 49 build/dictionary pages were inventoried separately, with 13 glossary pages still needing provenance/version work. No glossary, entity or build page is changed in this PR.

## Validation

- Full build and repository test suite passed.
- Structural tests cover the 8 opted-in strategy pages and 13 legacy-template pages, answer/action/evidence/source order, source anchors, unique headings, robot access and retained published screenshots.
- Chromium checks all 16 changed guides at 390px and 1440px: no horizontal overflow, evidence row counts and source anchor navigation checked; axe WCAG 2 A/AA scan has no violations.
- Screenshots reviewed for the three rendering templates. Automated accessibility checks are not a full manual accessibility audit.
- Public deployment and game-client testing are not performed. Publication remains pending separate review.
