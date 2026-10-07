# CHONK 'EM — Game Design Doc

**Version:** 0.2 (draft)
**Status:** Pre-prototype. This doc is the source of truth — argue with it in PRs, not in vibes.
**Target:** Web-first (mobile + desktop browsers from one codebase). PWA wrapper later for installable/offline.

---

## 1. High concept

A barrel-bursting feeder. A **shooter cat** perched at the top lobs **yarn balls** into a field of sealed **barrels**. Each barrel bursts open on impact, spilling its contents: tasty **snacks** (various calorie values), nasty **veggies** (negative calories), or the occasional **power-up**. The loot tumbles onto a conveyor belt spanning the playfield bottom, rides off to the left, and drops into the **main cat's bowl**. The main cat eats everything and visibly widens from scrawny street goblin to glorious loaf.

Working title: **CHONK 'EM**. Tagline: *"No scrawny cats on my watch."*

## 2. Design pillars

1. **Bursting feels physical.** Cracking a barrel open is the whole fantasy — wood particles, loot spill, the works.
2. **Chonk is the reward.** The main cat's body is the progress bar. No abstract XP; you *see* the width.
3. **One-thumb portable.** Fully playable one-handed on a phone, equally good with a mouse. No porting, no separate builds.
4. **Aim with consequences.** Every barrel you crack is a decision — veggies exist, and the belt gap doesn't catch everything.

## 3. Core loop

```
Aim → Launch yarn ball → Burst barrels → Loot spills & falls
  → Belt catch (gap = miss) → Conveyor ride → Bowl → Main cat eats
  → Chonk Meter fills → Level goal check → Next level
```

**Session arc:** 2–4 minute levels. **Meta arc:** level select map, stars per level, total "Chonk Score."

## 4. Moment-to-moment mechanics

### 4.1 Shooter cat & yarn balls
- Shooter cat sits top-center, rotates within a ~120° arc, determined little face.
- **Touch:** drag anywhere to aim (slingshot-style), release to fire. **Mouse:** move to aim, click to fire. **Keyboard:** arrows nudge, space fires.
- Limited yarn balls per level (e.g., 10). Running out = retry.
- Trajectory preview: short dotted arc (first ~0.5s of flight), not full-path.
- A yarn ball **survives bursting barrels**, losing ~25% speed per burst — chaining 2–4 barrels in one shot is the skill ceiling. It dies when slow or after N bounces.

### 4.2 Barrels (the pegs)
- Round wooden barrels, **small** (r=15, desktop-first sizing). **One hit → burst**: wood particles, contents eject with a small random pop velocity.
- **Armored barrels** (steel band, ~15% of snacks): need **2 hits** — first hit cracks them (tink + crack lines), second bursts.
- Contents are **labeled, not random**: snack barrels carry a fish icon, veggie barrels a broccoli icon, power-up barrels a star. Aiming stays a real decision. Later levels add **mystery barrels (???)** for chaos.
- Barrel types:
  - **Snack barrel** — spills a snack (see 4.3).
  - **Veggie barrel** — spills a veggie. Sometimes guards a snack barrel behind it: crack it carefully and let the veggie fall into the belt gap, or leave it alone.
  - **Power-up barrel** — spills a power-up (see 4.3).
  - **Armored barrel** (later levels) — takes 2 hits, usually guarding the good stuff.

### 4.3 Contents: snacks, veggies, power-ups
| Item | Calories | Behavior |
| Split Yarn | ★ power-up | Next yarn ball divides into 3 on its first burst |
|---|---|---|
| Kibble | +1 | Standard fall |
| Salmon chunk | +3 | Light, drifts a little |
| Tuna steak | +5 | Heavy — falls fast, lands where you aim |
| Broccoli | −2 | The betrayal |
| Celery | −1 | Minor betrayal |
| ★ Multi-yarn | power-up | Next shot fires 3 yarn balls |
| ★ Bridge! | power-up | Belt gap bridged, 15 s |
| ★ Slow-mo | power-up | 5 s slow motion for precision |
| ★ Magnet barrel | power-up | Falling contents drift toward the bowl, 15 s |

### 4.4 Conveyor → bowl *(v0.2 revision — funnel cut, owner directive 2026-10-05)*
- **Why the funnel got cut:** its sway made every catch a timing coin-flip — random chance, not strategy. Playtest verdict: too hard, not enough decision.
- **Conveyor belt** spans the bottom of the playfield. Loot that lands on the belt rides left to the bowl. Where loot lands is determined by which barrel you burst and eject velocity — readable, learnable geometry.
- **Static gap** on the right side of the belt: loot falling through it is lost — sad trombone meow. The gap is fixed per level: aim-with-consequences is preserved as *positioning* strategy, not sway timing.
- **Bowl** sits at the conveyor's left end, next to the main cat. Veggie in the bowl = negative calories, disgusted cat face, combo reset.

### 4.5 Main cat
- Sits beside the bowl. Eats each delivery with a nom animation.
- **Lifetime weight in pounds**, starting at 5.0 lb, +0.4 lb per calorie, persistent across levels (localStorage). Veggies never slim the cat. Milestone popups at 10/15/20/25/30 lb.
- **Procedural multi-part body** — not one scaling oval. Each part grows at its own rate with weight: belly apron sags and spreads, jowls bloom beside the muzzle, haunches emerge, paws chunk up and splay (pink toe beans past ~30% chonk), tail thickens, the neck vanishes into the loaf. The head barely grows, like a real cat; the ears stay fixed and look adorably small.
- **Three-spring wobble:** belly (slow, heavy), cheeks (quick), tail (sway) — impulses on every delivery, nom, frenzy, and weight milestone, plus idle breathing.

### 4.6 Combos & special moments
- Consecutive bowl deliveries with no misses build a calorie multiplier (×2, ×3…). A miss or a veggie resets it.
- **FEAST FRENZY:** fill a full chonk stage with zero misses and zero veggies → slow-mo multi-yarn barrage, main cat catches the shower.
- Callouts: "BARREL BURST!", "BANK!", "NOM!", "BROCCOLI?!"

### 4.7 Hazards (later levels)
- **Vacuum cleaner (shipped, extreme-mode):** a Roomba-style unit patrols slowly (42 px/s) beneath the conveyor on levels 6, 9 and 12 only — rare by design. Suction radius 95 px yanks falling and belt-riding loot (food AND power-ups) into its mouth; anything within 30 px is eaten. Loot already in the bowl's drop chute is safe. Yanked loot that escapes the suction cone can re-land on the belt. Warning popup on level start. Time your shots.
- **Cucumber:** if a yarn ball hits it, the shooter cat gets spooked and loot scatters extra hard (spec TBD — `hazards`).

### 4.8 Cat jiggle physics
- Three springs (belly/cheek/tail) tuned slow and lazy (belly ~0.8 Hz) with a lagging sub-belly spring for the secondary fat-wobble. Impulses scale with chonk — fatter cat, bigger jiggle. Sprite squash-and-stretch amplified accordingly.
- **No crossfade between sizes** — hard stage cuts with a 0.28 s squash-pop on size-up (crossfade looked ghostly). Sprite stages trigger at **exponential weight thresholds** (~1.35x lb per stage); per-level stage names also exponential (~2.3x cal per stage).

### 4.9 Food physics
- Loot is a real physical object: gravity per item, bounce off uncleared barrels (restitution 0.5 — food NEVER bursts barrels, burst is yarn-only), side-wall bounces, belt bounces (settles and rides after 2–3 hops), tile-floor bounces for missed food (3 bounces, then lost). Suction-yanked loot can't re-land until it escapes the vacuum's cone.

## 5. Level structure

- Hand-authored layouts (JSON), ~15 levels for v1.
- Level definition: barrel list (type, x, y, contents), yarn ball count, chonk goal, belt gap position, hazard set, par.
- Stars: 1 = goal met, 2 = under par yarn balls, 3 = goal + zero veggies eaten + zero missed loot.
- Difficulty levers: gap width/position, mystery barrels, armored barrels, vacuum timing, loot eject spread.

## 6. Controls & portability

- **One codebase, HTML5 canvas.** No engine dependency for v1 — vanilla JS + Canvas 2D keeps it hackable by any agent and runs everywhere.
- Responsive: portrait-first layout that letterboxes gracefully on desktop; scales to devicePixelRatio. Side panel (conveyor + main cat) collapses below the playfield on narrow phones.
- Input abstraction: `pointerdown/move/up` covers touch + mouse + pen in one path.
- PWA manifest + service worker (v0.3): installable, offline, home-screen icon.
- 60 fps target on mid-range phones; cap particle counts; no per-frame allocations in hot loop.

## 7. Art direction

- Cute-flat vector style. v1 was drawn in code; **v0.3+ adds generated sprite assets** (ComfyUI Qwen Image 2.1 pipeline, `tools/gen_sprites.py` + `tools/sprite_prep.py`, magenta-chroma → alpha PNGs in `assets/`) rendered with vector fallback when an asset 404s. Sprites must match the cute-flat look: clean outlines, soft gradients, solid magenta background at generation time. Warm kitchen/pastel backgrounds per level.
- **Shooter cat:** aiming pose, ears perk on release, yarn ball loaded in paws.
- **Barrels:** wooden staves with icon badges (fish / broccoli / star / ???).
- **Main cat:** layered ellipses, width = f(chonk stage), tail swish, disgust face for veggies, bliss face for tuna.
- Juice: wood-chip particles on burst, squash-and-stretch on belt landing, belly jiggle spring, belt animation, tiny screen shake on armored-barrel hits.

## 8. Audio

- WebAudio, all synthesized (no audio files for v1): barrel burst (wooden knock + pop), belt clatter, conveyor hum, nom (filtered noise chomp), veggie disgust mewl, jingle for power-ups, sad meow for lost loot.
- Mute toggle, persisted. Respect `prefers-reduced-motion` for shake/particles.

## 9. Tech architecture (v1)

```
/index.html      — shell, canvas, PWA hooks
/css/style.css   — layout, responsive (playfield + side panel)
/js/main.js      — game loop, state machine
/js/physics.js   — gravity, circle collision, bounce, eject velocities
/js/levels.js    — level data (JSON-ish)
/js/barrels.js   — barrel rendering, burst, contents spawn
/js/conveyor.js  — belt animation + catch + delivery
/js/cats.js      — shooter cat + main cat rendering, chonk stages
/js/audio.js     — WebAudio synth
/js/input.js     — unified pointer input
```

- Fixed-timestep physics (120 Hz) decoupled from render. Seeded RNG per level so layouts play fair.
- Save: `localStorage` (stars, settings, chonk records). No backend for v1.

## 10. Milestones

- **v0.1 — Prototype:** shooter cat + yarn physics + bursting barrels + falling loot + funnel catch + conveyor + bowl + widening cat. One level. Prove the fun.
- **v0.2 — Game:** all barrel/content types, armored + mystery barrels, hazards, 5 chonk stages, combos, 8–15 levels, stars, audio.
- **v0.3 — Portable:** PWA packaging, mobile polish (touch tuning, safe areas), desktop niceties.
- **v1.0 — Ship:** balance pass, juice pass, itch.io / GitHub Pages release.

## 11. Non-goals (for now)

No multiplayer, no accounts, no IAP, no backend leaderboards, no 3D, no framework (revisit if codebase outgrows vanilla).

## 12. Open questions

- Funnel: sway on its own (timing skill) vs player-steerable (control skill)? Verdict 2026-10-05: **neither — cut it.** Belt gap geometry replaces it.
- Should the main cat ever *lose* chonk (diet level)? Verdict so far: absolutely not. This is a pro-chonk household.
- Level editor for players? Nice-to-have post-v1.

## Mega levels (PR #4, 2026-10-05)
Owner asked for longer, harder, reliably-winnable levels plus a menu:
- Tight symmetric hex layouts: L1-5 get 45-49 barrels (r=11), L6+ get 67-79 (r=10),
  shapes per level (block/diamond/rows/columns/ring/twin/cross), mirrored about x=300.
- Quotas = 60% of raw snack calories: clearable with ZERO combo (combo is pure bonus).
- Balls scale with barrels (~70% of count); par ~75% of balls.
- Cat size resets every level; per-level lbPerCal = 75/goal so growth spans the quota.
- Aim arc widened 25°/155° -> 10°/170°.
- Level-select menu (boot + HUD ☰ button + Esc), best-stars per level, reset-everything button.
- BG asset name fixed: code asked for 'bg', file is kitchen_bg.png.

## v0.4 polish pass (PR #5, 2026-10-06)
Owner's post-PR4 list, built on top of qwen's sprite/ghost-food work (main @ 938fb47):
- Conveyor slats ran opposite the food (visual only) — slats now run left with the food.
- Canvas text contrast: HUD + popups get dark outlines, readable over the kitchen bg.
- Weight retune: 100 lb cap; gain from RAW calories (no combo inflation, no 20-lb spikes);
  per-level caps [50..100] reserve 80+ lb for the late game; growth arc spans the quota.
- Settings: difficulty (Easy/Normal/Hard) in the level menu — scales balls, goals, vacuum speed.
- Levels 61-120 barrels, Peggle-style iconic patterns (star, heart, smiley, invader) +
  shapes (block/diamond/ring/twin/cross/columns); 50% of barrels are hollow (no loot flood).
- Vacuum actually visible now: was drawn BEFORE the main cat and hidden behind the chonk;
  now drawn after. Bowl-chute protection implemented (was comment-only).
- Polish: favicon, v0.4 title, level intro splash cards.

## v0.4 follow-up tweaks (PR #5, 2026-10-06)
- Weight: flat 0.3 lb/cal (100 cal = 30 lb). Per-level caps removed — food in the
  barrels is the only limit (100 lb absolute cap stays).
- Menu button moved top-right (was covering the HUD stats).
- Conveyor: symmetric 60px end gaps on both sides (was: single 100px gap right).
  Bridge power-up now extends the belt over both end gaps.
- Vacuum tuned down: suck 95→55, eat 30→20, 2 items per shot then it's full
  (resets every shot, "VACUUM FULL" popup). Proper vacuum asset still wanted later.

## Food tiers & the 100-level chonk curve (PR #5, 2026-10-06)
Owner's long-term replay design: per-level reset STAYS, but food is the progression.
- New exotic food every 5 levels, +5 cal: L1 max 5 (tuna), L5 max 10 (steak),
  L10 caviar 15, L15 lobster 20 … L100 Imperial Feast 100. Past exotics stay on the menu.
- Each level's TOTAL raw cal follows 55 + 4*(n-1): L1 55 (21.5 lb max), L10 91
  (32 lb — 80 impossible), L50 251 (80 lb with near-perfect play — rare),
  L100 451 (140 lb). Cap raised to 150 for the even-bigger chonk.
- Levels 1-12 handcrafted and retuned to the curve; 13-100 generated deterministically
  (seeded, symmetric archetypes: full/diamond/ring/columns/checker/twin/wave).
- Splash + menu flag newly unlocked exotics (🆕).
- Asset debt: 18 exotic food sprites + cat stages 90-150 (Qwen).

## Weigh-in results ceremony (PR #5, 2026-10-07)
Owner's idea: after a win, the cat steps onto a scale. Analog dial (0-150 lb),
needle eases up over ~2.6s with rising tick sounds; the cat emoji on the platform
grows and squashes as the needle climbs. Stars are WEIGHT stars now:
1 = goal met, 2 = 75% of the level's food delivered, 3 = 90%.
Stars pop in as the needle crosses each threshold. Finale: 1 star = sad trombone
(synth), 2 stars = jingle, 3 stars = fanfare + canvas confetti.
Stats line (cal, best combo) + Retry/Menu/Next buttons appear after the needle lands.

## New barrel types (PR #5, 2026-10-07)
Owner asked for unbreakable steel + two of Stunkus's choosing:
- **Steel** — unbreakable obstacle. Ball bounces off dead (CLANG!), never bursts,
  immune to explosions. Brushed-steel vector art with rivets.
- **Powder keg** — bursts into a chain explosion: clears every barrel within 80px
  (except steel), their loot spawns normally, kegs chain-recurse. Screen shake +
  BOOM. The jackpot play.
- **Bumper** — chrome dome, never breaks: kicks the ball away at 1.25x (capped),
  +1 combo, BOING! Rewards skillful bank shots.
Procedural levels (13+) deal ~6% steel / ~4% keg / ~4% bumper from the empty share;
handcrafted 6/9/12 got a sprinkle so they show up early.
