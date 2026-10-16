## 2026-10-16 — qwen: owner playtest round 2 (sharpness, feel, text bugs, yarn)
- **N64 fuzz FIXED**: `fitCanvas` backed the canvas with a fixed 600x900*dpr while CSS stretched it to ~940px wide. Now backing store = displayed CSS size x dpr (transform scales W/H to match) — sharp at any window size.
- **Text behind barrels**: `\U0001F9E8`-style escapes are NOT valid JS (backslash-U doesn't exist) — keg label and all 4 CAT_UNLOCKS icons rendered as literal "U0001F431" etc. Fixed to `\u{...}` form. Grep for `'\\U000` is now clean.
- **Hint text**: "drag or tap to aim" was drawn mid-board on EVERY level forever; now levels 1-2 only, before the first shot.
- **Cat physics feel** (owner: rear too active, floaty/wavy, belly should lead): tail shear 0.22→0.10, tailCouple 2.5→1.5, idle swish 1.0→0.55, tail tau 1.0→0.45; belly strip gain 0.065→0.095; ring times cut ~45% (0.70/2.2/0.14 → 0.38/1.2/0.08), body settle 0.7→0.45x, popZeta 0.40→0.55. Measured: belly 1.13 vs rear 1px on eats; 1-2s window <0.2 (was floaty).
- **Yarn -20%**: DIFFS balls 1.3/1.0/0.8 → 1.05/0.8/0.64 (L1 normal: 8→6 balls).
- Smoke 155/155 (5 tests updated to new intent + 1 new "damped not floaty" test; wobble test now samples a window — single-sample hit zero crossings).

## 2026-10-15 — qwen: strip renderer hotfix (owner: cat "doubled, distorted, nasty seams")
Blamed and fixed on `stunkus/daily-polish` (deploy branch — this was live). Root cause: `drawSpriteStrips` padded EVERY strip by the WORST shear gap of the whole body (up to 13px on a 9.4px strip = 3.7x-wide overlapping stretched copies = doubled/smeared cat), plus per-strip bilinear resample fuzz on flat AoT linework (seams). Fix, keeping strips (owner directive: no fallback to whole-image bounce):
- `cats.js drawSpriteStrips`: per-side pad — a strip only stretches across a boundary whose shear actually opens, by exactly that gap, clamped to 1.5x strip width. Source rect bleeds ~1 destination px so overlaps paint real pixels, not resampled edge fuzz.
- `catphysics.js`: `W_TAIL` ramp widened 0.80-0.93 → 0.60-0.95 so the tail shear spreads over ~8 columns (per-column shear step 11px → 3-4px; no more staircase silhouette). Sprite shear path only — vector adapter untouched.
- `main.js fitCanvas`: `imageSmoothingQuality='high'` (per-strip downscales were using the 'low' filter).
Verified: 600-frame worst case never gaps; max stretch 1.64x at the one active boundary (was 3.7x everywhere). Firefox headless before/after harness: old = doubled stripes, new = crisp. Smoke 154/154. Review notes on the rest of the branch coming separately (campaign balls/par rebalance is intentional per owner directives; 4 generated levels shift layout as a side effect of the MAX_EXOTICS cap changing RNG draws — flag for owner).

## 2026-10-15 — stunkus: weigh-in module extraction + smoke suite split (Blarmo's call)
Two refactors, both local on `stunkus/daily-polish`.
- **weigh-in module**: the results ceremony (`endGame`, `showResults`/`hideResults`, `updateWeigh`, `drawScale`, `starsFor`/`rawCal`) moved out of main.js into `js/weighin.js` (191 lines). main.js drops 1255 → 1068 lines. No behavior change; callers (tick, buttons) hit the same globals. Also fixes a real find from the aliveness review: the sprite renderer ignores `face` (`void face`), so all expression work — old and new — only ever ran in the vector fallback. **Blarmo's directive: no more development time on the vector fallback renderer** (quality will never match sprites; it stays as-is, nothing new goes there).
- **smoke split**: `tools/smoke.js` was a 1016-line monolith. Now it's a thin runner (`node tools/smoke.js [--only=core,save,...]`) over `tools/smoke/harness.js` + 7 domain suites: core (17), systems (20), levels (33), barrels (46), catphysics (15), save (5), ui (18). Same 154 tests, same globals, byte-identical coverage verified. `--only=` gives targeted runs; unknown names error out.
Smoke 154/154, tap-fuzz clean on 8 levels.

## 2026-10-15 — stunkus: save-v2 + daily challenge + cat aliveness (daily polish)
Three chunks, all local on `stunkus/daily-polish`.
- **save-v2** (roadmap P0, finally done): one versioned profile blob `chonk-em:profile-v2` — lifetime stats (total cal fed, best chonk, levels cleared, shots fired, max combo), per-level bests, settings (difficulty/mute/cat/howSeen/world-open), saved weight, daily bests + streaks. First load migrates every flat key (`best/difficulty/cat/howSeen/mute/weight/worldopen:*`) and deletes them. New `js/save.js`; menu shows a lifetime-stats line; mute toggle + weight save + full reset all go through `Profile`.
- **daily-challenge** (roadmap P2): one fresh date-seeded level per calendar day — `genLevel` refactored into a shared `genLevelSeeded(seed, tier, target, vacuum)` core so campaign and daily build through the same code path (campaign behavior byte-identical). Daily tier rotates 5–15 with the day of year; movers always dealt, golden/mystery/cuke eligible. Menu card shows today's best stars + streak; wins record per date without touching the campaign board; retry/next buttons are daily-aware; weigh-in title shows the date.
- **cat-aliveness** (roadmap P1): proper blink cycle (both eyes together, ~3.7 s, suppressed for shocked/determined), alternating ear twitch every ~4.3 s, three new faces — smug (6+ combo smirk), shocked (cucumber spook, replaced the old sad face), determined (FEAST FRENZY, replaced bliss). Weigh-in ceremony now opens with a weight-pitched `AudioSys.meow`. Size-scaling logic untouched.
Smoke 154/154 (+13 new tests; 7 legacy tests updated to the Profile API). Tap-fuzz clean on 8 levels incl. the daily. Cat physics (Sleve's v2) untouched.

## 2026-10-14 — stunkus: movers + vacuum v2 + music loader + world-map menu (daily polish)
Four chunks, all local on `stunkus/daily-polish`. Hands off cats.js / catphysics.js (Sleve's v2 untouched).
- **mover-barrels** (world 4+, level 31+): the Peggle staple. `dealMovers()` in levels.js converts a deterministic slice of leftover empty slots into snack barrels on slow sinusoidal tracks (x/y axis, 22–36 px, 3.2–5.6 s period, slow-mo aware, vertical tracks clamped above the belt). Dashed track-line telegraphs under both render paths; collision/burst/keg-chains all read the live position. Level-31 splash announces them.
- **vacuum-v2**: 0.4 s gulp pause after every eaten item (amber eye, drooping nozzle, contented bubbles, no suction — real counterplay windows; the 2-per-shot meal cap survives), and speed now scales with world (`×(1 + 0.05·world)`, multiplicative with difficulty).
- **music-loader**: `AudioSys.music` wires `assets/music/` playback — menu/gameplay/frenzy/weighin tracks auto-switch with game state (frenzy → frenzy → gameplay on expiry, weigh-in ceremony → weighin), 1.5 s crossfade, 0.32 level under SFX, mute toggle respected. Fully silent until Qwenny's files land; every call is a safe no-op headless.
- **menu-worlds**: level select is now a world map — 10 collapsible world sections (★ totals per world), per-level best-cal readout, current level highlighted; plus a first-run 3-step "How to play" panel (dismiss persists).
Smoke 142/142 (+12 new tests; two old vacuum tests re-timed for the gulp). Tap-fuzz clean on 7 levels (incl. level 41 movers, level 6 vacuum). Cat physics untouched.

## 2026-10-13 — stunkus: branch discipline switch (Blarmo's call)
One-task-one-branch is retired. Two branches only from here: `main` and
`stunkus/daily-polish` — no per-task branches. Claim tasks in TASKS.md before
coding, commit onto `stunkus/daily-polish`. COLLAB.md updated to match (rules,
merging, push-approval sections). Pages test link deploys from
`stunkus/daily-polish`, tracking main via merge (never rebase).

## 2026-10-13 — stunkus: mystery + golden + cucumber barrels, FX bus + juice pass (daily polish)
Three new barrel kinds, dealt deterministically from empty slots at load time
(LEVELS untouched): **mystery** (purple ?, orbiting sparkles; burst reveals a tier
snack 65% / power-up 20% / veggie dud 15%), **golden** (one per level, radiant gold,
pays 3x the level's top snack + fanfare + shake/hit-stop/confetti), **cucumber**
(rare, levels 4+: spills a cucumber — the cat gets SPOOKED: comedic hop, full-body
wobble, aim wobbles 4s, no calories, no combo change; `AudioSys.startle()`).
New **FX bus** (`js/fx.js`): `FX.popup/shake/hitstop/slowmo/confetti/burstJuice`,
one-liner juice anywhere, REDUCED-safe. Juice pass: hit-stop on 10+ cal bursts,
cal-scaled shake (25+/50+ cal), confetti on 15+ cal exotic deliveries, slow-mo beat
on final-ball wins; keg shake now routes through FX. Hands off cats.js entirely
(sonnet-5.5's cat-physics-v2 still pending). Smoke 112/112 (+16 new tests).

## 2026-10-07 — stunkus: steel + keg + bumper barrels (same branch)
Blarmo asked for unbreakable steel obstacles + two of my picks: **powder keg**
(chain explosion, 80px, steel immune, screen shake) and **bumper** (chrome dome,
1.25x power bounce capped, +1 combo, never breaks). Vector art for all three,
clang/boing/boom synths (+SFX spec rows for Blarmo's gen work), procedural 13+
deals them from the empty share, L6/9/12 sprinkled. Smoke 88/88.

## 2026-10-07 — stunkus: WORK ORDER for qwen — 10 world backgrounds
Blarmo approved 10 world backgrounds (10 worlds × 10 levels). Spec:
- 600×900 PNG, same warm cartoon style/perspective as `kitchen_bg`.
- Keep the bottom-center band (conveyor y≈700, bowl x≈100) relatively calm —
  gameplay happens there; detail lives in the top 2/3.
- Worlds: 1 Kitchen (exists), 2 Pantry, 3 Garden, 4 Fish Market, 5 Bakery,
  6 Diner, 7 Farm, 8 Park Picnic, 9 Candy Shop, 10 Banquet Hall.
- Name them `assets/bg_world1.png` … `bg_world10.png`; Stunkus wires
  `worldForLevel(n) = floor((n-1)/10)` into drawBackground (kitchen_bg stays as
  world 1 until the new fleet lands).

## 2026-10-07 — stunkus: species unlocks built + SFX spec for Blarmo
- Species unlocks live on this branch: total stars gate the roster (never spent) —
  Tabby 0★, Orange 8★, Tuxedo 25★, Calico 60★. Menu cat picker, unlock fanfare +
  notice in the weigh-in results. Smoke 84/84.
- `AUDIO_SPEC.md` written for Blarmo's audio-gen experiments: 24 SFX, art direction,
  `assets/sfx/<name>.mp3`. `AudioSys` now has a buffer-first loader (`loadSfx`,
  `play`, `sfx`) — generated files play automatically, synth fallback until they land.

## 2026-10-07 — stunkus: weigh-in results ceremony built (same branch)
Blarmo's pitch, built: post-win weigh-in — analog scale dial, needle climbs ~2.6s
with rising ticks, cat squashes on the platform, stars pop as the needle crosses
thresholds. Stars are weight-based now (1 = win, 2 = 75% of level food, 3 = 90% —
replaces the old par/clean criteria). Sad trombone for 1 star, jingle for 2,
fanfare + confetti for 3. Stats + Retry/Menu/Next. Smoke 82/82.

## 2026-10-07 — stunkus: depth maps SCRAPPED + v0.4 roadmap started
Blarmo killed the procedural depth maps ("not great") — `tools/depth_refs/` deleted.
The underlying need (readable chonk ramp) stands; approach TBD. Separately, started
brainstorming the massive v0.4: see V04_ROADMAP.md (architecture, game design, polish
pillars + proposed cut). Awaiting Blarmo's reaction before speccing.

## 2026-10-06 — stunkus: WORK ORDER for qwen — silhouette-locked chonk ramp (ControlNet depth)
Blarmo's diagnosis: the 30-lb sprite reads as 50-lb, and stages 50-80 are near-identical
with slight variance — the size ramp doesn't read. Fix: build ONE ControlNet depth-map
reference PER SIZE STAGE (12+ stages covering the 10-150 lb ramp), all sharing one
canonical pose/camera. Depth locks the silhouette per stage; species becomes a pure
prompt swap (tabby / orange / tuxedo / calico / future species = same 12 depth maps,
different prompt). Requirements:
- Monotonic silhouette growth, verified TWO ways:
  1. Objective: silhouette pixel area (non-transparent pixel count) must increase
     at every stage — no exceptions, script-checkable.
  2. Subjective: the squint test — every stage must read distinctly bigger than
     the last at thumbnail size (Blarmo grades).
- Keep the existing asset naming + per-asset vector fallback contract in js/cats.js
  (check the STAGES table for expected keys); Stunkus rewires thresholds once the
  new fleet lands.
- Reuse the AoT bold-linework style prompt from the current fleet.
This supersedes the "stages 90-150" patch job — do the full re-ramp, not an extension.
STATUS 2026-10-06 (stunkus): the 10 depth references are DONE — `tools/depth_refs/depth_stage01..10.png`
(512×512 grayscale, brighter = closer) + `make_depth.py` (the generator, numpy/PIL).
Front-facing sitting cat, bottom-anchored (paws on the same ground line every stage),
uniform 1.10× linear growth per step (NOT logarithmic): stage 10 is 2.36× stage 1,
pixel area strictly increasing every step (+21% per step, +456% total — script-verified,
zero clipping). Qwen: feed each as ControlNet-depth reference, prompt-swap the species.
If you want a different pose, tweak PARTS in make_depth.py and re-run.

## 2026-10-06 — stunkus: PR #5 food tiers + 100-level curve (same branch)
Blarmo's long-term replay design, built on `stunkus/v04-polish`: per-level reset stays,
food becomes the progression — new exotic every 5 levels (+5 cal: L1 tuna/5 … L5 steak/10,
L10 caviar/15 … L100 Imperial Feast/100), level raw-cal follows 55+4*(n-1) so 80 lb is
impossible on L10, rare on L50 (needs near-perfect play), 140+ on L100; cap 150.
Levels 1-12 retuned to the curve, 13-100 generated deterministically in JS
(seedable, symmetric, 60-115 barrels). Splash/menu flag new exotic unlocks.
QWEN: 18 exotic food sprites + cat stages 90-150 needed (emoji/w80 fallbacks live).
Smoke 79/79.

## 2026-10-06 — stunkus: PR #5 follow-up tweaks (same branch)
Blarmo's tuning round, folded into `stunkus/v04-polish`: flat 0.3 lb/cal with per-level
caps removed (barrel food is the only limit now), menu button moved top-right off the
HUD stats, conveyor rebuilt with symmetric 60px end gaps (bridge extends over both),
vacuum tuned way down (suck 55 / eat 20 / 2 items per shot, FULL popup). Smoke 74/74.

## 2026-10-06 — stunkus: PR #5 v0.4 polish ready (on top of main @ 938fb47)
Branch `stunkus/v04-polish` answers Blarmo's post-PR4 list: conveyor slats now run left
with the food (was: visual ran right), HUD/popup text gets dark outlines for bg contrast,
weight retuned (100 lb cap, RAW-cal gain, per-level caps 50→100 reserving 80+ for late
game), difficulty setting (Easy/Normal/Hard scales balls/goals/vacuum), 61-120 barrel
Peggle-style patterns (star/heart/smiley/invader + shapes) with 50% hollow barrels,
vacuum now drawn AFTER the main cat (it was hidden behind the chonk — that's why nobody
saw it) plus real bowl-chute protection, favicon + v0.4 title + level splash cards.
Smoke 71/71.

## Handoff — chonk ramp recalibration + PR4 merge — qwen, 2026-10-06
Owner flagged the ladder: huge 10→20 jump, plateau 30–70, tabby 70→80 shrank. Cause: hyperbolic "twice as obese" chain prompts fire the fat-cat prior immediately, then saturate. Fix: **calibrated intensity ramp** — per-stage body-language (20 chubby-walks-normally → 30 belly-past-knees → 40 sagging-two-rolls → 50 pooling-several-rolls → 60 body-wider → 70 wider-than-tall → 80 mountain-of-blubber), chained from the good 10 lb bases. All 4 varieties re-chained 20–80; ramp is now monotonic. Merged PR4 (mega-levels) with the sprite regen — smoke 62/62. Your kitchen_bg key fix + per-level weight reset kept as-is.
Files: assets/{cat,orange,tuxedo,calico}_w20..80.png
**Prompt lesson for future chains:** absolute hyperbole saturates chains; per-stage relative body-language ("belly hanging low past the knees", "body wider than tall") gives monotonic progression.
Review (stunkus): —

---

## 2026-10-05 22:45 CDT — stunkus: PR #4 mega-levels ready for review
Branch `stunkus/mega-levels` (PR #4) answers Blarmo's post-merge list: tight symmetric
hex layouts (45-49 barrels L1-5 at r=11, 67-79 L6+ at r=10), quotas set to 60% of raw
snack calories so every level is winnable with zero combo, balls scaled to barrel count,
cat size resets each level with growth spanning the quota, aim arc widened to 10°/170°,
level-select menu + reset-everything, and the kitchen_bg asset-name fix (code asked for
'bg', file is kitchen_bg.png). Smoke 62/62. Vacuum confirmed live on 6/9/12 — if it's
not visible, hard-refresh; the bg 404 was real and is fixed.

# HANDOFFS — newest on top

## Handoff — PR #3 follow-up: cat physics, no-ghost sizes, small barrels, split, armor — stunkus, 2026-10-05
Done (all on `stunkus/extreme-mode`, folded into PR #3 per owner): (1) **Cat jiggle v2** — springs retuned slow/lazy (belly ~0.8 Hz), lagging sub-belly spring for the secondary fat-wobble, impulses scale with chonk, sprite squash amplified. (2) **No more crossfade** — hard stage cuts with a 0.28 s squash-pop (owner: crossfade ghosted); sprite stages now trigger at **exponential weight thresholds** (~1.35x lb/stage: 10→80); STAGES flavor table exponential too (~2.3x). (3) **Barrels smaller + spread**: r 22→15, 78 px hex-grid spacing, field widened to y 150–660, 32 barrels/level, desktop-first sizing (owner: fine if small on mobile). (4) **Split-yarn powerup**: next ball divides into 3 on its first burst (≥1 barrel/level). (5) **Armored barrels**: steel band, 2 hits (crack + tink, then burst), ~15% of snacks.
Files: js/cats.js, js/main.js, js/levels.js, js/barrels.js, js/physics.js, js/audio.js, tools/smoke.js, TASKS.md, DESIGN.md
How to verify: `node tools/smoke.js` → 57/57.

## Handoff — extreme-mode: vacuum hazard + XL levels + food physics (PR #3) — stunkus, 2026-10-05
Done: (1) **Vacuum hazard** (`js/vacuum.js`, claimed from `hazards`): Roomba-style patroller under the belt, 42 px/s, suction 95 px / capture 30 px, eats falling + belt loot (food and power-ups), can't steal from the drop chute, escaped loot can re-land. Spawns on levels 6/9/12 only (3/12 — rare per owner). Vector-drawn, warning popup on entry. (2) **XL levels** (`levels-xl`): every level ~2.6x barrels (33–43, was 13–22), goals ~3x (94–217, was 8–52), balls +80% (18–40); layouts expanded from the originals preserving kind/content mix, bounds + 56 px spacing + calorie budget (eff/goal ≈ 2.2) validated. (3) **Food physics**: loot bounces off barrels (never bursts them — burst is yarn-only), belt bounce settles into the ride, floor bounce for misses, wall bounces; suction-yanked loot can't re-land mid-cone.
Files: js/vacuum.js (new), js/main.js, js/levels.js, js/physics.js, index.html, tools/smoke.js, TASKS.md, DESIGN.md
How to verify: `node tools/smoke.js` → 45/45. Play level 6: vacuum patrols under the belt and steals your snacks — time your shots.
Next: `barrel-types` (armored + mystery) still unclaimed; cucumber spook still open under `hazards`.

The shared bulletin board. Append your block, push, and the other agent appends a Review/Response
to the same entry. Format is in COLLAB.md. If it's not in this file (or in git history), it didn't happen.

---

## Handoff — AoT asset overhaul — qwen, 2026-10-06
Done: full sprite overhaul in Attack on Titan bold-linework style using the owner's fast turbo recipe (8 steps, CFG 1.6, euler_ancestral+beta, viggle-turbo LoRA — ~30s/gen). Fleet: **4 cat varieties (tabby, orange, tuxedo, calico) × 8 chonk stages (10→80 lb)** = 32 sprites + 9 barrel skins + bowl + yarn + shooter cat + kitchen bg. Weight system now runs to 80 lb (milestones 10..80, 9-stage STAGES table); cat variety rolls random per level. All draw sites keep vector fallbacks. Assets quantized to 128 colors (2.2MB shipped, raw gitignored). Smoke 35/35.
Files: assets/*.png, js/cats.js, js/barrels.js, js/conveyor.js, js/main.js, tools/gen_sprites.py, tools/smoke.js
How to verify: play live — cat varieties rotate per level, chonk ladder morphs 10→80 lb, barrels show contents, AoT kitchen bg.
**Prompt lessons learned (important for future art):** (1) mild edit prompts ("one step fatter") barely change the model — use hyperbolic reinforcement like the owner's examples ("twice as obese, massive corpulent belly dominates the composition, head and legs even smaller"); (2) edit chains drift toward the fat-cat prior (orange tabby) — lock colors explicitly in the prompt ("this cat is a BLACK AND WHITE TUXEDO and must stay one, NOT orange") and add drift words to the negative prompt; (3) magenta chroma bg + sprite_prep still the cleanest keying path.
Review (stunkus): Approved — the 4×8 variety ladder is a huge upgrade and the AoT linework reads great at sprite scale. Verified the conventions doc; per-asset vector fallbacks intact. Two nits for later, non-blocking: (1) variety rolls random per level, so the 'same cat gets fatter' fantasy breaks across levels — consider locking variety per save; (2) 2.2 MB of PNGs will want lazy-loading before mobile matters.

---

## Handoff — sprite pipeline + cat-chonk stages — qwen, 2026-10-06
Done: ComfyUI MCP installed (`pi mcp add comfy-mcp`, 41 tools, spawns in new pi sessions). Workflows in `tools/comfy/`. `tools/gen_sprites.py` (t2i base + chained image-edit for style consistency) + `tools/sprite_prep.py` (magenta chroma → true alpha, despill, trim). Five cat-chonk stages generated on the 3090 → `assets/cat_stage0..4.png` (RGBA, ~420px, 4.5MB). cats.js renders sprites: crossfade by chonkT, jiggle squash, nom bob; Stunkus's vector cat remains the fallback (404-safe; Node has no Image → smoke stays vector).
Files: assets/cat_stage*.png, tools/gen_sprites.py, tools/sprite_prep.py, tools/comfy/*, js/cats.js, TASKS.md
How to verify: `node tools/smoke.js` → 35/35. Play: cat is the generated white chonk, morphing through 5 stages as weight climbs, belly squash on delivery.
**Sprite conventions for future art** (barrels, bowl, shooter cat, kitchen): 1024×1024, solid magenta #FF00FF bg, no scenery/shadow on bg, limb-count constraints IN the prompt — image-edit chains add legs (stage 1 shipped with six; fixed with "EXACTLY four limbs" + negative prompt). Prep via sprite_prep into `assets/<part>_<variant>.png`, keep vector fallbacks.
Review (stunkus): —

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
