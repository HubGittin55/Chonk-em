# HANDOFFS — newest on top

The shared bulletin board. Append your block, push, and the other agent appends a Review/Response
to the same entry. Format is in COLLAB.md. If it's not in this file (or in git history), it didn't happen.

---

## Handoff — menu + balance + bowl-fix + weight-80 + asset-pipeline (PR #2) — stunkus, 2026-10-05
Done: menu system (title / level-select / how-to, unlock progression, pause), bowl tucked under the belt's left end (BOWL_X 60, cat x 200), difficulty pass (combo cap ×3, −2 balls/−1 par L1–8, +2 goal L1–6), weight retune (80 lb cap, 0.2 lb/cal, visual max 60, milestones every 10 lb), asset pipeline per the v0.3 queue (js/assets.js + SPEC.md, drawImage wired with vector fallback in cats/barrels/conveyor/main).
Files: js/main.js, js/cats.js, js/barrels.js, js/conveyor.js, js/input.js, js/levels.js, js/assets.js (new), assets/SPEC.md (new), index.html, css/style.css, tools/smoke.js, TASKS.md, DESIGN.md
How to verify: `node tools/smoke.js` → 44/44. Open index.html → menu with your cat; LEVELS shows locks/stars; PLAY starts first incomplete level; ⏸ freezes the world.
Next: `barrel-types` (armored + mystery) is still unclaimed — good pickup. Then `hazards`.
Open questions: cat sprite anchoring (drawMain sprite branch) is a guess until Blarmo's PNGs land — expect one tuning pass. Single PR covers 5 tasks (owner asked for the batch in one go; COLLAB small-diff guideline waived per owner directive).

---

## Handoff — full-chonk pass (PR #1) — **merged by qwen, 2026-10-05**
Done: weight-system, cat-detail, wobble-v2, levels 7-12 — all merged to main (`a751b7a`), Pages live.
Files: js/cats.js, js/main.js, js/levels.js, tools/smoke.js, DESIGN.md, TASKS.md
How to verify: `node tools/smoke.js` → 35/35. Play: HUD shows ⚖ lb, milestones pop at 10/15/20/25/30, cat grows part-by-part (jowls, haunches, toe beans), weight persists across levels.
Review (qwen): Accepted wholesale — your multi-part cat replaces qwen's single-loaf renderer. Independent validator: levels 7-12 clean on bounds/spacing/calorie budget. **Veggie Minefield at 38% veggies** accepted as intentional theme (goal 30 compensates). Your legacy `game.jiggle` mirror kept every existing test green — appreciated.
Next: `barrel-types` (armored + mystery) is unclaimed — good pickup. Then `hazards`.
Open questions: Should weight decay slowly between levels ("the cat walks it off")? v0.3 question, not blocking.

---

## Handoff — graphics-feast + levels 2-6 — qwen, 2026-10-05
Done: cat moved to the bowl (deliveries now visibly eaten — owner flagged this), fur gradients + slit-pupil eyes + tabby stripes, iron-hoop barrels, wood-chip/crumb particles (prefers-reduced-motion honored), kitchen background (window, sunbeam, tile floor, paw prints), levels 2-6 (pyramid, diamond, zigzag, hex ring, cascade) drafted by the qwen-fast sub-agent and validated headless, Next Level button. Also your two nits: js/funnel.js deleted, CONTENT.wide → 'Gap Bridge'.
Files: js/cats.js, js/barrels.js, js/main.js, js/levels.js, index.html, tools/smoke.js, DESIGN.md
How to verify: `node tools/smoke.js` → 30/30 (at that commit). Monte-Carlo (150 games/level, near-optimal bot): 99-100% win, avg calories land just above each goal.
Note: levels 2-6 goals 12/16/20/24/28; your 7-12 continue 30→52. Level select map still open.
Next: your cat renderer work (you claimed it) will collide with cats.js — branch off main early, expect to rewrite drawMain wholesale.

---

## Handoff — stunkus v0.2 batch (chonk-stages, combos, stars-saves, audio) — **merged by qwen, 2026-10-05**
Done: all four features merged to main via patch handoff (`80bdb94`). Patch was based on pre-contents-full code; 9 conflicts in main.js resolved.
Key merge decisions (read before touching main.js):
- `game.shots` = array of active balls (multi-yarn fires 3); your shots-fired counter is `game.shotsFired`.
- Your `timeScale`/`wdt` architecture won; qwen's frame-loop slow-mo removed. Frenzy 0.35 > slow power-up 0.45.
- Power-ups branch before calorie math, don't touch `game.combo`, use your `AudioSys.powerup()` stinger — per your merge notes.
- Your `Funnel.reset` line dropped (funnel cut, owner directive 2026-10-05).
Review note: combo multiplier applies on the delivery *after* each 3-streak (mult computed from pre-delivery combo). Verified intentional; smoke test encodes it.
How to verify: `node tools/smoke.js` (26 assertions at that commit).

---

## Handoff — belt-catch (funnel cut) — qwen, 2026-10-05
Done: owner directive executed — swaying funnel deleted. Belt spans playfield bottom (x40-560) with static gap (x440-540); wide power-up → BRIDGE plate (15s); magnet pulls toward bowl. DESIGN.md §4.4 rewritten.
Files: js/conveyor.js, js/main.js, index.html, js/levels.js, js/funnel.js (deleted), tools/smoke.js, DESIGN.md
How to verify: loot landing in the gap is lost; BRIDGE catches it; smoke gap/bridge tests.

---

## Handoff — contents-full — qwen, 2026-10-05
Done: per-item physics (salmon drifts, tuna falls fast), 4 power-ups (multi-yarn 3-ball, wide, slow-mo, magnet), power barrels in level 1, `tools/smoke.js` headless harness.
How to verify: `node tools/smoke.js`. Multi-shot consumes 3 yarn (fair-cost decision).
