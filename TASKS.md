# TASKS.md — CHONK 'EM task board

Claim a task by marking it `in progress — <agent>` and committing the marker. See COLLAB.md.

## v0.1 — Prototype (prove the fun) — DONE (stunkus, 2026-10-05)

- [x] `scaffold` — index.html + css + js skeleton (playfield + side panel), canvas boots, 60fps empty loop
- [x] `physics` — gravity, circle-vs-circle collision, bounce with restitution, fixed timestep, eject velocities
- [x] `shooter` — shooter cat, aim (pointer), trajectory preview dots, fire on release, yarn ball inventory
- [x] `barrels` — barrel rendering + icons, 1-hit burst, contents spawn (snack/veggie), wood particles
- [x] `funnel` — sway motion, catch detection, miss = lost loot
- [x] `conveyor-bowl` — belt animation, delivery to bowl, calorie counting
- [x] `main-cat` — cat drawn in canvas, widens with calories (5 stages), nom animation, idle, mood faces
- [x] `level-1` — first hand-authored layout ("First Breakfast"), yarn loadout, win/lose + retry

Smoke-tested headless: chaining (3 barrels/shot), funnel→belt→bowl delivery, veggie penalty + disgust face, win/lose paths all pass.

## v0.2 — Game

- [x] `belt-catch` — funnel cut per owner directive; belt spans playfield + static gap; wide→bridge, magnet→bowl pull — **DONE (qwen, 2026-10-05)**. Smoke: `node tools/smoke.js` 18/18.

- [x] `contents-full` — all snack/veggie types with fall behaviors, power-up barrels (multi-yarn, wide funnel, slow-mo, magnet) — **DONE (qwen, 2026-10-05)**. Smoke: `node tools/smoke.js` 16/16. Known quirks: wide/magnet timers run in game time (stretch during slow-mo); multi-shot preview shows center ball only.
- [x] `chonk-stages` — eased body growth (displayRx), belly jiggle spring, mood faces — done (stunkus, 2026-10-05)
- [x] `combos` — streak calorie multiplier (×2–×4), FEAST FRENZY (6s slow-mo +2 yarn) on clean stage-up — done (stunkus, 2026-10-05)
- [x] `stars-saves` — 1–3 stars per level (goal/par/flawless), best saved to localStorage — done (stunkus, 2026-10-05)
- [x] `audio` — mute toggle (persisted), powerup/frenzy/win/lose stingers — done (stunkus, 2026-10-05)
- [x] `graphics` — high-detail cat/barrel/yarn rendering, wood-chip + crumb particles, kitchen background, cat moved to bowl — **DONE (qwen, 2026-10-05)**: fur gradients + tabby stripes + slit-pupil eyes, iron-hoop barrels, sunbeam kitchen, burst/crumb particles (prefers-reduced-motion respected), main cat now sits at the bowl and visibly eats
- [x] `levels-2-15` (part 1) — levels 2–6 shipped: pyramid, diamond lattice, zigzag columns, hex ring, diagonal cascade — layouts drafted by **qwen-fast** sub-agent, validated headless (bounds/spacing/calorie budget) + Monte-Carlo playtested (win rates 99–100% for near-optimal bot, calories land just above goal). Level select map still open.
- [x] `barrel-types` — armored (2-hit) **DONE (stunkus, PR #3)** — steel-band visuals, crack on first hit, bursts on second; split-yarn powerup (next ball divides into 3 on first burst, ≥1 per level); mystery (???) stays unclaimed
- [x] `hazards` — vacuum patrol **DONE (stunkus, PR #3)** — Roomba-style patroller under the belt, hoovers fall+belt loot; cucumber spook stays unclaimed
- [x] `levels-xl` — **DONE (stunkus, PR #3)** — owner: amp it to the extreme. Barrels small (r=15) on a 78 px hex grid, 32/level, goals 72–166, balls 18–40, vacuum on 6/9/12; desktop-first sizing
- [ ] `levels-2-15` — level pack + level select map

## v0.2+ — Full-chonk pass (stunkus, 2026-10-05) — merged via PR #1, reviewed by qwen

- [x] `weight-system` — lifetime weight in pounds (starts 5.0 lb, +0.4 lb/cal, persistent in localStorage), HUD readout, milestone popups, win overlay shows new weight — **DONE (stunkus)**
- [x] `cat-detail` — procedural multi-part cat: belly apron sag, jowls, haunches, chest ruff, chunky paws with toe beans, thickening tail, vanishing neck — each part grows at its own rate with weight, not one scaling oval — **DONE (stunkus)**
- [x] `wobble-v2` — three-spring wobble (belly/cheek/tail, distinct frequencies), impulses on delivery/nom/frenzy/milestones, breathing idle — **DONE (stunkus)**
- [x] `levels-7-12` (part 2) — Twin Peaks, The Gauntlet, Honeycomb, Veggie Minefield, Power Tower, The Grand Feast; 16–22 barrels each, validated headless — **DONE (stunkus)**. Review note: Veggie Minefield runs 38% veggies (above the 30% guideline) — accepted as intentional theme, goal lowered to 30 to compensate.

## v0.3 — Portable & Assets

- [x] `asset-pipeline` — ComfyUI MCP + Qwen Image 2.1 turbo recipe (8 steps + viggle LoRA). **DONE (qwen, 2026-10-06)**: AoT-style fleet shipped — 4 cat varieties × 8 chonk stages (10–80 lb), 9 barrel skins, bowl, yarn, shooter cat, kitchen bg. Sprite renderers in cats/barrels/conveyor/main with vector fallback. Weight system extended to 80 lb.
- [ ] `pwa` — manifest, service worker, icons, offline
- [ ] `mobile-polish` — touch tuning, safe areas, DPR scaling, narrow-screen layout

## PR #4 — mega levels (stunkus, 2026-10-05)
- [x] tight hex layouts 45-79 barrels, r=10/11
- [x] goals = 60% raw (winnable, verified)
- [x] cat resets per level, growth spans quota
- [x] level select menu + reset button
- [x] aim arc 10°/170°
- [x] kitchen_bg asset name fix
- [ ] mystery barrels (unclaimed)
- [ ] cucumber (unclaimed)
