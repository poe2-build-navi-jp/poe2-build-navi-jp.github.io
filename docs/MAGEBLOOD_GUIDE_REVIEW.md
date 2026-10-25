# Mageblood Legacy guide review

Draft only. This article needs fresh public-publication approval; authorization for PR #42 does not apply.

## Scope and originality

Requested reference: https://monmon-games.com/poe2-mageblood/ . The reference was inaccessible, and the research worker reported a robots restriction. Its full text was not read; no alternative retrieval was attempted. The article uses an original purpose-based grouping and explanation, with independently verified official and database sources. It does not copy the reference's wording, table, or creative arrangement.

Current main at start: `faf43c4` (includes PR #43). Existing `/guides/unique-gear/` lists Mageblood as a conditional gear option but has no full Legacy list or duplicate explanation. This guide owns that missing scope; the existing gear recommendation links to it. No changes to builds, existing item evaluations, publication workflows, or settings are intended.

## Sources checked 2026-10-25

- Official 0.5.0 notes: https://www.pathofexile.com/forum/view-thread/3932540 — introduction of Mageblood only.
- https://poe2db.tw/us/Mageblood — current base item, four Legacy slots, 14 base effects, 25–50% increased effect per duplicate.
- https://poe2db.tw/jp/Mageblood — Japanese item/Legacy names. Its ambiguous single-type sentence is checked against English.
- https://poe2db.tw/us/Mages_Legacy — one instance of each type applies its bonus.

PoE2DB is explicitly identified as a nonofficial game database. The article does not claim all numbers were officially documented or unchanged since introduction.

## Calculation and boundaries

The explanatory formula is inferred from item text: duplicate count = 4 − distinct type count; multiplier = 1 + duplicates × roll / 100. Each distinct Legacy receives the multiplier once. AABB and AAAB have identical numeric strength for the same two types and roll.

The worked example uses a 40% roll with Quicksilver ×2, Silver and Granite: 42% increased movement speed, 42% increased skill speed, +2800 armour. These are modifier values, not guaranteed final-character multipliers. It uses integer outputs to avoid unverified rounding. The article does not multiply the presence/radius of Consecrated Ground as a verified mechanic.

No invented hands-on experience, prices, drop rates, equal-probability assumptions, reroll guarantees, or mandatory purchases. Conditional selection advice distinguishes flat versus increased defences, increased critical chance versus percentage points, maximum resistance versus filling resistance, and rarity versus guaranteed income.

## Validation

Completed: full site build (final pass with `CHROMIUM_PATH=/usr/bin/chromium OG_METADATA_ONLY=1 npm run build`), full `npm test`, 14 distinct Legacy entries, all five duplicate patterns at 25% and 50%, and integer worked examples. Chromium checks at 390px and 1440px found one H1, the correct canonical, no page overflow, usable horizontal table scrolling, and zero axe WCAG A/AA violations. Mobile screenshots and the 1200×630 OG artwork were visually inspected. `git diff --check` passed. Unrelated regenerated OG files were restored; only the new guide OG is included.
