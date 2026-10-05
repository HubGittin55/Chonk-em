# CHONK'EM — art asset spec

The game ships with procedural vector art and **prefers PNGs when present**:
drop finished files in this folder with the exact names below and the game
picks them up on next load. Missing files fall back to vector — nothing breaks.

## Files

| File | Size (px) | What |
|---|---|---|
| `logo.png` | 520 × 180 | Title logo for the menu. "CHONK'EM" wordmark, playful, chunky letters. |
| `kitchen-bg.png` | 600 × 900 | Full-screen cozy kitchen backdrop. Warm, soft; keep the playfield area (top 2/3) calm so barrels read clearly. |
| `shooter-cat.png` | 160 × 160 | The aiming cat at the top of the screen. Front-facing, mischievous, paw raised. Transparent bg. |
| `barrel-snack.png` | 96 × 96 | Wooden treat barrel, warm/round. Transparent bg. |
| `barrel-veggie.png` | 96 × 96 | Same barrel but greener/sicklier — the betrayal barrel. |
| `barrel-power.png` | 96 × 96 | Same barrel with gold trim + sparkle — the exciting one. |
| `bowl.png` | 160 × 100 | The red food bowl, side view, empty. Transparent bg. |
| `yarn.png` | 64 × 64 | Pink yarn ball with a loose trailing end. Transparent bg. |
| `cat-0.png` | 460 × 380 | Main cat, stage 1 — sleek 5 lb loaf, side view **facing left**, sitting. |
| `cat-1.png` | 460 × 380 | Stage 2 — healthy, slightly rounder. Same pose + framing. |
| `cat-2.png` | 460 × 380 | Stage 3 — chubby: belly starting to sag, cheeks filling in. |
| `cat-3.png` | 460 × 380 | Stage 4 — chonky: big sagging belly, jowls, tiny-looking ears. |
| `cat-4.png` | 460 × 380 | Stage 5 — ABSOLUTE UNIT: maximum loaf, belly on the floor. |

The game picks `cat-N` from lifetime weight (5 lb → 0 … 60+ lb → 4).

## Style guide

- Cozy cartoon, thick soft outlines, warm palette.
- Fur: orange tabby `#f2a24b` / `#d98a35`, cream `#f6b25c`, belly cream `#fbe6c4`.
- Eyes: green with slit pupils. Pink nose `#d96a72`, inner ears `#e88ca0`.
- Transparent backgrounds on every sprite (not the kitchen bg).
- Keep the same pose/framing across `cat-0`…`cat-4` so growth reads as growth.
- No text inside sprites (except the logo). Food icons stay emoji in-game.
