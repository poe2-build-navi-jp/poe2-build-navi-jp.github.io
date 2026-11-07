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

## Follow-up: mobile point-budget editing

The full-screen layout hid the quest-point input outside settings and provided no accessible level input. Both inputs now live inside the search/settings overlay, with 16 px numeric inputs and 44 px minimum height. The level stays synchronized with the main result panel. The settings show remaining points and highlight an exceeded limit without deleting selected nodes.

Changing level or campaign points invalidates both completed allocation previews and in-flight Ninja import previews. Campaign-point changes also refresh the result diagnostics. Input errors appear inside the full-screen tree and can be dismissed, instead of being hidden behind the full-screen overlay.

Browser follow-up: checked 375, 390 and 430 CSS px widths; Lv80 + 24 rewards = 103 points, Lv100 + 24 rewards = 123 points. Invalid Lv101 restores the previous value and displays the error inside the tree. Saved and reloaded Lv100 + 24 points. The settings panel did not overflow horizontally at either narrow or wide mobile width. Numeric columns align at the bottom when the campaign label wraps.

Regression coverage uses the real WASM engine: level/stat changes, budget synchronization, invalid input, completed preview invalidation, delayed in-flight Ninja preview invalidation, over-budget warnings and recovery, and preservation of selected nodes when lowering the limit. `npm run test:simulator`, `node scripts/test-site.mjs` and `git diff --check` passed. A physical iPhone/Safari session remains untested.

Follow-up evidence: [settings](docs/simulator/2026-11-07/budget-settings.webp), [in-tree error](docs/simulator/2026-11-07/budget-error.webp).

## Follow-up: multiple passive selection

Unallocated map nodes now toggle an independent pending selection. The white dashed outline and “選択中…（未反映）” toolbar distinguish pending targets from blue Ninja references and gold acquired nodes. In the mobile full-screen editor, tapping nodes keeps the map available; “能力を見る” opens the detail panel when needed. Search results also support selecting additional targets. Tapping again, removing a selection chip or using the clear button removes pending targets without changing saved allocations.

“まとめて確認” plans the requested acquisitions sequentially against a cloned request using the real graph editor. It deduplicates shared path nodes, calculates the complete combined stat result, and offers a single final apply action. A failed or cancelled batch returns no partial request. Changing the selection or budget invalidates pending calculations. Confirmed allocations clear the pending selection and are saved through the existing calculation/save pipeline. Already acquired nodes retain the existing single-node refund flow. Pending selections are not represented as saved acquired nodes.

Browser follow-up at 390 × 844 CSS px: native consecutive taps on 59779 and 11311 retained two selected targets while acquired count remained zero. Combined preview showed 2 points, Armour 0 → 20 and Evasion 7 → 23. One confirmation acquired both; save/return and reload retained both nodes and the resulting stats. No app-origin console errors were observed. Regression tests cover toggling and clearing, deduplicated shared routes, all-or-nothing budget failure, cancellation during an edit, combined real WASM effects and saved-state validation. Existing touch/pinch and budget tests still pass. Physical iPhone/Safari testing remains outside this verification.

Evidence: [two pending targets](docs/simulator/2026-11-07/multi-selected.webp), [combined preview](docs/simulator/2026-11-07/multi-preview.webp).

final result: passed
