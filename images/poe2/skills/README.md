These are original Path of Exile 2 skill and support icons, identified through the English and Japanese PoE2DB catalogs on 2026-11-13. Game artwork belongs to Grinding Gear Games.

Each SVG sheet embeds the original WebP bytes and exposes one named view per image. `data/skill-icons.json` records every skill name, source URL, reference page, SHA-256 and corresponding sheet fragment. No AI-generated icons or shared placeholder icons are substituted for a skill.

Refresh with `python tools/vendor-skill-icons.py`, then run `node tools/enhance-skill-icons.mjs` and the normal site finishing steps. The import cache is excluded from Git; normal builds use the checked-in sheets and name catalog without external requests. Two Varashta command skills use the icons of their identically named granting ascendancy nodes; their provenance is recorded in `data/skill-icon-overrides.json`.
