# TASKS.md — CHONK 'EM task board

## Daily polish 2026-10-22 (stunkus, branch `stunkus/daily-polish`)

- [x] `trophy-progress` — DONE (stunkus, 2026-10-22). Locked trophies in the 🏆 panel show a derived progress hint ("3/10 three-star levels", "42/50 lb best chonk") from existing profile state. No new persisted fields; one-shot event trophies show no hint. Smoke 246/246 (+4).

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
- [x] species unlocks via total stars (stunkus, 2026-10-07 — Tabby 0 / Orange 8 / Tuxedo 25 / Calico 60)
- [ ] 10 world backgrounds (qwen — spec in HANDOFFS 2026-10-07)
- [ ] SFX generation, 24 clips (Blarmo — spec in AUDIO_SPEC.md; loader ready, synth fallback live)
- [ ] proper vacuum asset (unclaimed — current vector Roomba is placeholder)
- [ ] 18 exotic food sprites: caviar, lobster, wagyu, btruffle, saffron, bluefin, foiegras, goldkib, kingcrab, uni, kobe, matsutake, beluga, iberico, amberjack, wtruffle, saffris, imperial (unclaimed — emoji fallback live)
- [ ] READABLE CHONK RAMP (approach TBD — procedural depth maps scrapped 2026-10-07; w80 sprite stretches past 80 for now)

## PR #5 — v0.4 polish (stunkus, 2026-10-06, on top of main @ 938fb47)
- [x] conveyor slat direction fix
- [x] text contrast (HUD/popups outlined)
- [x] weight retune: 100lb cap, raw-cal gain, per-level reserve tiers
- [x] settings menu + difficulty
- [x] 61-120 barrel iconic patterns, 50% hollow barrels
- [x] vacuum visible (draw order) + chute protection
- [x] favicon, v0.4 title, level splash
- [ ] mystery barrels (unclaimed)
- [ ] cucumber (unclaimed)
- [ ] proper vacuum asset (unclaimed — current vector Roomba is placeholder)
- [ ] 18 exotic food sprites: caviar, lobster, wagyu, btruffle, saffron, bluefin, foiegras, goldkib, kingcrab, uni, kobe, matsutake, beluga, iberico, amberjack, wtruffle, saffris, imperial (unclaimed — emoji fallback live)
- [ ] cat chonk stages 90-150 lb (unclaimed — w80 sprite stretches past 80 for now)

## Daily polish 2026-10-13 (stunkus, branch `stunkus/daily-polish`)

- [x] `mystery-barrels` — DONE (stunkus). Purple ? barrels, sparkle hint; burst reveals tier snack / power-up / rare veggie dud. Dealt ~6% from empties. Smoke 112/112.
- [x] `cucumber` — DONE (stunkus). Rare green barrel (L4+, ~40% of levels); burst spills a cucumber, cat gets SPOOKED: comedic hop + wobble + 4s aim wobble, no calories. `AudioSys.startle()` synth.
- [x] `golden-barrel` — DONE (stunkus). One per level: radiant gold jackpot paying 3x the level's top snack, with fanfare + shake/hit-stop/confetti.
- [x] `fx-bus` — DONE (stunkus). `js/fx.js`: FX.popup/shake/hitstop/slowmo/confetti/burstJuice one-liner API, REDUCED-safe.
- [x] `juice-pass` — DONE (stunkus). Hit-stop on 10+ cal bursts, cal-scaled shake, confetti on 15+ cal exotic deliveries, slow-mo beat on final-ball wins. Hands off cats.js (cat-physics-v2 pending).

## Cat physics overhaul (assigned: sonnet-5.5 via Blarmo, 2026-10-12)
- [ ] `cat-physics-v2` — novel unified cat physics replacing the 4-spring wobble: brief in ~/workspace/goals/chonk-em-development/files/cat-physics-overhaul-brief.md (attach js/cats.js alongside). In progress — sonnet-5.5. Stunkus: hands off until it lands.

## Daily polish 2026-10-15 (stunkus, branch `stunkus/daily-polish`)

- [x] `save-v2` — DONE (stunkus). Versioned player profile (`chonk-em:profile-v2`): lifetime stats (total cal fed, best chonk, levels cleared, shots fired, max combo), per-level bests, settings (difficulty, mute, cat, howSeen, world-open, saved weight), daily bests + streaks. Migrates all flat keys on first load and deletes them; mute toggle + weight persistence + reset all go through Profile. Smoke 154/154.
- [x] `daily-challenge` — DONE (stunkus). Date-seeded daily level (deterministic for the day, fresh layout every calendar day; genLevel refactored to a shared seed+tier core). Menu card shows today's best stars + play streak; wins record per-date (never touch the campaign board); losing/retrying the daily stays in daily mode; weigh-in title shows the date. Tap-fuzz clean on the daily path.
- [x] `cat-aliveness` — DONE (stunkus). Proper blink cycle (both eyes, ~3.7 s period, skipped for shocked/determined), occasional alternating ear twitch, three new reaction faces: smug (6+ combo), shocked (cucumber spook — replaced the sad face), determined (FEAST FRENZY — replaced bliss). Weigh-in ceremony opens with a weight-pitched meow. Size-scaling untouched.

## Daily polish 2026-10-14 (stunkus, branch `stunkus/daily-polish`)

- [x] `mover-barrels` — DONE (stunkus). Peggle-staple moving barrels from world 4 (level 31+) on: deterministic deal from empty slots, slow sinusoidal oscillation on x/y axis, slow-mo aware, telegraphed with dashed track lines.
- [x] `vacuum-v2` — DONE (stunkus). Vacuum gets smarter: gulp pause after each eaten item (no suction while digesting, telegraphed nozzle droop), speed scales with world.
- [x] `music-loader` — DONE (stunkus). Wire assets/music/ playback: menu/gameplay/frenzy/weighin tracks auto-switch with game state, graceful silence until Qwenny's files land, mute toggle respected.
- [x] `menu-worlds` — DONE (stunkus). World-grouped level select (10 worlds x 10 levels, star totals per world, collapsible) + first-run "How to play" 3-step panel.

## Daily polish 2026-10-18 (stunkus, branch `stunkus/daily-polish`)

- [x] `emp-barrel` — DONE (stunkus). Vacuum counterplay power-up (answers roadmap open Q3): Short-Circuit ⚡ barrel dealt on vacuum levels (3 handcrafted + procedural/endless); burst fires an EMP shockwave ring that shorts the vacuum for 10s (no patrol, no suction, dead eye + sparks + reboot ring). Burst-immediate, not on delivery. Mystery can resolve to emp; `AudioSys.zap()` synth; `FX.empBlast` + generic ring system. Smoke 191/191 (+7).
- [x] `aim-preview-multi` — DONE (stunkus). Multi-yarn preview draws all three ghost trajectories (outer two dimmer) — fixes the known "preview shows center ball only" quirk.
- [x] `lastball-tension` — DONE (stunkus). Pulsing LAST BALL HUD readout + one-shot 'LAST BALL…' popup + tick when the final yarn is chambered.
- [x] `combo-meter` — DONE (stunkus). Persistent 🔥 COMBO ×N (with multiplier) chip in the power HUD while combo ≥ 2.
- [x] `asset-manifest` — DONE (stunkus). Declared sprite manifest in js/assets.js (roadmap P0): props/barrel_/food_/species×stage keys, single Assets loader with null-safe helpers (null = vector fallback), Sprites consolidated (no double fetch), all call sites switched. `tools/check-assets.js` gap report: 48 missing of 102 declared (tier/exotic/cuke/split/emp skins still emoji fallback), 1 stray (cat_w5.png). Smoke 197/197 (+6 manifest tests); fuzz-taps clean; tuning-curve holds.

## Daily polish 2026-10-17 (stunkus, branch `stunkus/daily-polish`)

- [x] `tuning-deep-dive` — Blarmo's directive (2026-10-16): deep dive on calorie, food, and difficulty tuning. The high end is too busy, too many calories, too easy — the opposite of what you want. Starting spec: -10% food barrels at level 20, scaling linearly to -50% food barrels by level 100. Validate with headless playtests across the curve; keep star thresholds, Endless Climb, and daily challenge sane. → **DONE (stunkus, 2026-10-17)**: `foodFactor(n)` in levels.js — 1 below L20, 0.90 @L20 → 0.50 @L100 (linear), floored 0.30 past L140. Applied to food-barrel deal AND raw-cal target in `genLevelSeeded(..., foodMul)`; downgrade loop can shed spare exotics (tier signature keeps ≥1) so raw converges. Endless rides the extended curve (100+depth); daily (tiers 5-15) untouched. Validated: `tools/tuning-curve.js` (new) — raw tracks scaled target, goal=60% raw, balls=35% food, star reachability, food floor ≥8, all hold L13–L120 + endless depths + 7 dailies. L100: 51→26 food barrels, raw 451→228. Note: generated layouts shift slightly (RNG draw order changed in the tuning loop) — same as the 2026-10-15 MAX_EXOTICS flag.
- [x] `lost-food-pop-bug` — Blarmo's report (2026-10-16): food that falls down the side and should be lost sometimes pops back onto the conveyor. Repro, root-cause, fix; add a regression test. → **DONE (stunkus, 2026-10-17)**: hypothesis confirmed — the y-only catch re-caught below-belt drifters. Fixed by folding into the dual-belt redesign: `Conveyor.crossesBelt(prevY, y, vy)` requires a plane crossing. Regression test in tools/smoke/core.js (below-belt drifter never re-caught, ends lost).
  - Root-cause hypothesis (2026-10-16, unverified — confirm with headless repro first): the belt-catch at main.js:622 (`it.y >= Conveyor.BELT_Y && it.vy > 0 && !it.sucked && Conveyor.onBelt(...)`) has no prevY plane-crossing check. Gap-fallers (32px gaps at x 40..72 / 528..560 per conveyor.js:11) drop below the belt line toward the tile floor, but magnet pull toward BOWL_X (main.js:613), per-item drift (main.js:612), and residual vx surviving tile bounces (vx *= 0.6 while re-lofting, main.js:633-634) can carry x back into [72,528] while y >= 700 and vy > 0 — the catch then snaps it to y=700: the pop. Fix sketch: capture prevY before integration and require `prevY < Conveyor.BELT_Y && it.y >= Conveyor.BELT_Y`. NOTE: the dual-belt redesign below rewrites this logic — apply the minimal fix OR fold it into the redesign, not both. → **folded into the redesign as suggested; hypothesis was correct**
- [x] `center-bowl-duel-belts` — Blarmo's directive (2026-10-16): redesign food delivery — bowl goes in the middle, two separate belts on each side both running inward toward a center gap between them; food drops through the gap into the bowl. Replaces the current single-belt + static-gap layout. Watch interactions: vacuum patrol path, magnet→bowl pull, wide→bridge, movers near the gap, Endless Climb. → **DONE (stunkus, 2026-10-17)**: bowl at x=300; left belt 72–268 runs right, right belt 332–528 runs left, 64px center gap chutes food straight to the bowl (new `drop` path for gap-crossers). Far-end 32px gaps still lose food; Bridge spans both outer gaps; slats run inward per belt. Interactions: vacuum chute protection follows the bowl (gap approach is protected, belts still threatened); magnet pulls to center; movers clamp above the belt as before; main cat moved to x=452 (right of the bowl, same +152 offset as the old layout). Vacuum escape tosses released loot back over the belt line so it can re-land.

## Daily polish 2026-10-16 (stunkus, branch `stunkus/daily-polish`)

- [ ] `endless-mode` — DONE (stunkus). Endless Climb: post-campaign procedural climb with rising vacuum speed, depth records in save-v2, menu card.
- [ ] `exotic-fx` — DONE (stunkus). Per-exotic signature burst effects (roadmap P2): table-driven particles/popup per exotic, dramatic beat on the biggest feasts.
- [ ] `world-tints` — DONE (stunkus). Per-world background tint wash (cheap procedural take on roadmap P3 backgrounds).
- [ ] `menu-title-anim` — DONE (stunkus). Animated menu title (P3 menu overhaul flavor).
- [ ] `pwa` — DONE (stunkus). Web app manifest + service worker + icons (roadmap v0.3).

## Daily polish 2026-10-19 (stunkus, branch `stunkus/daily-polish`)

- [x] `trophies` — DONE (stunkus). Achievements system: ~20 trophies across campaign/endless/daily play (star counts, combos, cucumber spooks, EMP shorts, golden jackpots, keg demolitions, imperial feasts, streaks, level counts, weight milestones), unlock toasts in-game, 🏆 Trophies panel in the menu, persisted in save-v2.
- [x] `pause-menu` — DONE (stunkus). Real in-game pause: P key + ⏸ HUD button, dim overlay with Resume / Restart / Quit to menu / mute toggle; tick frozen, render continues.
- [x] `ball-trails` — DONE (stunkus). Yarn ball motion trails (fading yarn-fuzz circles behind flying balls), desktop-first juice, REDUCED-safe.
- [x] `weighin-stats` — DONE (stunkus). Richer weigh-in results line: shots fired + barrels popped alongside cal/max combo/weight.

## Daily polish 2026-10-21 (stunkus, branch `stunkus/daily-polish`)

- [x] `menu-mascot` — DONE (stunkus, 2026-10-21). Roadmap P0 menu-overhaul leftover: CSS-drawn mascot cat in the level-select header; pupils track the pointer, blinks on the ~3.7s in-game cadence, click = squish + weight-pitched meow. Fur tint follows the selected species. REDUCED-safe, desktop-first. New js/mascot.js; hooks in showMenu/hideMenu/frame. Smoke 242/242 (+9).

## Daily polish 2026-10-20 (stunkus, branch `stunkus/daily-polish`)

- [x] `ball-food-rotation` — Blarmo's directive (2026-10-19): ball and food rotation system on top of the current physics. The yarn ball looks wrong translating with no spin — give it realistic rotation as it moves, and make the hanging yarn thread rotate with the ball instead of staying frozen. Same treatment for falling food items where it reads well. → **DONE (stunkus, 2026-10-20)**: yarn balls spin with flight velocity (vx/r, clamped ±30 rad/s so it doesn't strobe), split-yarn children inherit parent spin, and the loose thread end anchors at the rim in ball-local coords so it rotates with the ball (sprite + vector paths). Falling food/veggies/power-ups tumble with vx (capped ±12 rad/s); spin damps to 0 on the belt so loot sits flat while riding in. Smoke 233/233 (+10 new). Fuzz-taps clean: 8 levels, 0 stuck, 0 exceptions. Tuning curve invariants hold.
