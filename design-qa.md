# Passive tree QA — 2026-11-07

Source visual truth: `/workspace/scratch/bfa68d33673d/upload/IMG_7212.jpeg` and `IMG_7211.jpeg`, supplied by the user. Scope is the passive canvas and compact mobile controls, with blue reference paths and independently saved gold allocations. Ninja branding, advertisements and browser chrome are outside scope.

Implementation: `http://127.0.0.1:4173/simulator/?build=mercenary-twister-gemling`, rendered in a 390 × 844 CSS-pixel iframe. Evidence: [overview](docs/simulator/2026-11-07/overview.webp), [focused reference](docs/simulator/2026-11-07/reference.webp), [saved allocations](docs/simulator/2026-11-07/saved.webp).

Normalization: source screenshots are 706 × 1536 physical pixels; source CSS density is unknown. The tree-only source crop (706 × 724) was resized to 390 × 400. Browser evidence was captured at 1363 × 936 pixels, then cropped to the actual 390 × 844 iframe. No phone frame or synthetic device status bar was added. Comparison inputs: `/workspace/shared/poe2-passive-final-comparison.png` and `/workspace/shared/poe2-passive-focus-comparison.png`. Source and implementation were placed together in these images before review. Different acquisition colors and compact app controls are intentional.

## Comparison history

1. P1: initial reference nodes appeared without connecting lines. Cause: reference edges initialized before the current tree. Fixed initialization order and added a first-open connection assertion. Final browser observation shows 131 genuine reference edges on first open.
2. P2: overview connections were too faint and cluster rings appeared as chords. Added non-scaling strokes and 1,391 arc definitions derived from actual connected nodes in the pinned game's orbital groups. No extra graph connections or invented routes were added. Final captures show cluster curves and readable blue paths.
3. P2: initial desktop overview used the hidden-panel aspect ratio. Deferred fitting until the tree is visible and added a wide desktop aspect-ratio regression assertion.
4. P2: mobile legend was hidden and too small. Restored the blue/gold legend, increased labels and counts to 12 px, and kept all persistent controls within the 390 px canvas. Final overview shows both reference and acquired states explicitly.

## Required fidelity surfaces

- Fonts/typography: Japanese site font retained. Save controls and headings are approximately 14 px; status is secondary. Reference, search/settings and point counters remain readable without truncation. This is a consistent app UI, not a copy of Ninja's navigation font.
- Spacing/layout rhythm: edge-to-edge black canvas, compact top controls, 48 px zoom/overview/start controls, overlay settings and node detail. Controls do not change map height. Ads and browser chrome intentionally omitted. The main tree fits the screen initially; the reference button focuses the relevant main-tree region without shrinking it to fit distant ascendancy nodes.
- Colors/tokens: black background, muted colored game nodes, blue reference connections, gold acquired nodes and connections. Blue is intentionally different from the source's gold because the user requested reference-only blue. Overview glow is disabled to reduce rendering load.
- Image/asset fidelity: live SVG graph from pinned game data, not a static imitation. Orbit arcs follow existing connections. No copied logo, decorative game icons or generated bitmap is used. Geometry is scoped to compatible 0_5 trees.
- Copy/content: all 12 presets have a verified Ninja first-row reference. Eleven are actually Lv100; the companion reference is Lv99 and labeled accordingly. Completion snapshots are explicitly distinguished from unpublished acquisition order. Weapon-set-specific selections remain separate. Unsupported passive warnings use Japanese node descriptions.

## Interactions and validation

Browser checked: first mobile open, full-tree overview, reference focus, floating controls, settings, native drag (viewBox changed while map remained at x=0/y=0), bulk reference preview, explicit application, save/return and reload. Applying the Twister reference changed life 1,018 → 1,338 and DPS 0.8 → 3.8; reload retained those values. Reference-only viewing kept zero acquired nodes. No app-origin browser errors were observed; unrelated browser-extension metadata errors were excluded.

Automated: `npm run test:simulator`, `node scripts/test-site.mjs`, `git diff --check` passed. Real WASM calculations validate confirmed reference application, preview cancellation, undo including level/quest points, no stat changes from display toggles, per-weapon reference node membership, known graph connections, connected allocation/refund and saved-state restoration.

Residual test gap: no physical iPhone/Safari gesture session; pinch and page-scroll isolation are exercised by pointer/touch regression tests. References are a dated snapshot, not a live ranking feed. Jewel-specific effects and unsupported engine effects are disclosed and are not presented as reproduced Ninja character DPS.

No remaining actionable P0/P1/P2 findings within this scope.

final result: passed
