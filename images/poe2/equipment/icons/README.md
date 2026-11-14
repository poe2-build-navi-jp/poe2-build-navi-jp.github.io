Equipment inventory art identified through PoE2DB. Game artwork © Grinding Gear Games.

The SVG sheets embed small transparent WebP thumbnails with one named view per item. Inventory art is fitted to 96 pixels without changing its aspect ratio. `data/equipment-icons.json` records exact English/Japanese names, engine/base IDs, original image URLs, reference pages, source SHA-256 hashes and thumbnail hashes. Shared artwork is deduplicated without merging item identities. Unidentified records remain explicitly listed; another item's artwork is never substituted.

Refresh with `python tools/vendor-equipment-icons.py`, then run `node tools/enhance-equipment-icons.mjs` and the normal finishing steps. The import cache is ignored by Git; remove it before refreshing upstream data. Ordinary builds use local checked-in files and make no external image requests.

Inline icons are decorative companions to readable equipment names. The simulator also identifies the selected unique, rare base and equipped item from its header. Inputs, option values, calculation requests and save formats remain independent of artwork.
