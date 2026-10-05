# CHONK 'EM — Game Design Doc

**Version:** 0.2 (draft)
**Status:** Pre-prototype. This doc is the source of truth — argue with it in PRs, not in vibes.
**Target:** Web-first (mobile + desktop browsers from one codebase). PWA wrapper later for installable/offline.

---

## 1. High concept

A barrel-bursting feeder. A **shooter cat** perched at the top lobs **yarn balls** into a field of sealed **barrels**. Each barrel bursts open on impact, spilling its contents: tasty **snacks** (various calorie values), nasty **veggies** (negative calories), or the occasional **power-up**. The loot tumbles down into a swaying **funnel**, rides a **conveyor belt** off to the left, and drops into the **main cat's bowl**. The main cat eats everything and visibly widens from scrawny street goblin to glorious loaf.

Working title: **CHONK 'EM**. Tagline: *"No scrawny cats on my watch."*

## 2. Design pillars

1. **Bursting feels physical.** Cracking a barrel open is the whole fantasy — wood particles, loot spill, the works.
2. **Chonk is the reward.** The main cat's body is the progress bar. No abstract XP; you *see* the width.
3. **One-thumb portable.** Fully playable one-handed on a phone, equally good with a mouse. No porting, no separate builds.
4. **Aim with consequences.** Every barrel you crack is a decision — veggies exist, and the funnel doesn't catch everything.

## 3. Core loop

```
Aim → Launch yarn ball → Burst barrels → Loot spills & falls
  → Funnel catches → Conveyor ride → Bowl → Main cat eats
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
- Round wooden barrels. **One hit → burst**: wood particles, contents eject with a small random pop velocity.
- Contents are **labeled, not random**: snack barrels carry a fish icon, veggie barrels a broccoli icon, power-up barrels a star. Aiming stays a real decision. Later levels add **mystery barrels (???)** for chaos.
- Barrel types:
  - **Snack barrel** — spills a snack (see 4.3).
  - **Veggie barrel** — spills a veggie. Sometimes guards a snack barrel behind it: crack it carefully and let the veggie miss the funnel, or leave it alone.
  - **Power-up barrel** — spills a power-up (see 4.3).
  - **Armored barrel** (later levels) — takes 2 hits, usually guarding the good stuff.

### 4.3 Contents: snacks, veggies, power-ups
| Item | Calories | Behavior |
|---|---|---|
| Kibble | +1 | Standard fall |
| Salmon chunk | +3 | Light, drifts a little |
| Tuna steak | +5 | Heavy — falls fast, funnel timing matters |
| Broccoli | −2 | The betrayal |
| Celery | −1 | Minor betrayal |
| ★ Multi-yarn | power-up | Next shot fires 3 yarn balls |
| ★ Wide funnel | power-up | 2× funnel width, 15 s |
| ★ Slow-mo | power-up | 5 s slow motion for precision |
| ★ Magnet barrel | power-up | Falling contents drift toward funnel, 15 s |

### 4.4 Funnel → conveyor → bowl
- **Funnel** hangs center-field and **sways side to side** (speed/width tuned per level). Contents that land in it slide down to the conveyor. Contents that miss it are lost — sad trombone meow.
- **Conveyor belt** carries loot leftward, off the gameplay area, with a little animated belt. Pure anticipation beat — you watch your feast ride over.
- **Bowl** sits at the conveyor's end, next to the main cat. Veggie in the bowl = negative calories, disgusted cat face, combo reset.

### 4.5 Main cat
- Sits left of the playfield beside the bowl, outside the gameplay area. Eats each delivery with a nom animation.
- Body width = chonk stage (5 stages, ~1.0× → ~2.2×, springy belly jiggle on every delivery).
- Eyes track falling loot. Blinks. Judges you on veggie deliveries.

### 4.6 Combos & special moments
- Consecutive bowl deliveries with no misses build a calorie multiplier (×2, ×3…). A miss or a veggie resets it.
- **FEAST FRENZY:** fill a full chonk stage with zero misses and zero veggies → slow-mo multi-yarn barrage, main cat catches the shower.
- Callouts: "BARREL BURST!", "BANK!", "NOM!", "BROCCOLI?!"

### 4.7 Hazards (later levels)
- **Vacuum cleaner:** patrols beneath the conveyor, eats loot off the belt. Time your shots.
- **Cucumber:** if a yarn ball hits it, the funnel jumps to a new position (shooter cat got spooked).

## 5. Level structure

- Hand-authored layouts (JSON), ~15 levels for v1.
- Level definition: barrel list (type, x, y, contents), yarn ball count, chonk goal, funnel sway params, hazard set, par.
- Stars: 1 = goal met, 2 = under par yarn balls, 3 = goal + zero veggies eaten + zero missed loot.
- Difficulty levers: funnel sway speed, mystery barrels, armored barrels, vacuum timing, narrower funnel.

## 6. Controls & portability

- **One codebase, HTML5 canvas.** No engine dependency for v1 — vanilla JS + Canvas 2D keeps it hackable by any agent and runs everywhere.
- Responsive: portrait-first layout that letterboxes gracefully on desktop; scales to devicePixelRatio. Side panel (conveyor + main cat) collapses below the playfield on narrow phones.
- Input abstraction: `pointerdown/move/up` covers touch + mouse + pen in one path.
- PWA manifest + service worker (v0.3): installable, offline, home-screen icon.
- 60 fps target on mid-range phones; cap particle counts; no per-frame allocations in hot loop.

## 7. Art direction

- Cute-flat vector style, drawn in code (no asset pipeline for v1). Warm kitchen/pastel backgrounds per level.
- **Shooter cat:** aiming pose, ears perk on release, yarn ball loaded in paws.
- **Barrels:** wooden staves with icon badges (fish / broccoli / star / ???).
- **Main cat:** layered ellipses, width = f(chonk stage), tail swish, disgust face for veggies, bliss face for tuna.
- Juice: wood-chip particles on burst, squash-and-stretch on funnel catch, belt animation, tiny screen shake on armored-barrel hits.

## 8. Audio

- WebAudio, all synthesized (no audio files for v1): barrel burst (wooden knock + pop), funnel *clink*, conveyor hum, nom (filtered noise chomp), veggie disgust mewl, jingle for power-ups, sad meow for lost loot.
- Mute toggle, persisted. Respect `prefers-reduced-motion` for shake/particles.

## 9. Tech architecture (v1)

```
/index.html      — shell, canvas, PWA hooks
/css/style.css   — layout, responsive (playfield + side panel)
/js/main.js      — game loop, state machine
/js/physics.js   — gravity, circle collision, bounce, eject velocities
/js/levels.js    — level data (JSON-ish)
/js/barrels.js   — barrel rendering, burst, contents spawn
/js/funnel.js    — funnel sway + catch detection
/js/conveyor.js  — belt animation + delivery
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

- Funnel: sway on its own (timing skill) vs player-steerable (control skill)? Current verdict: sway — keeps one-thumb purity.
- Should the main cat ever *lose* chonk (diet level)? Verdict so far: absolutely not. This is a pro-chonk household.
- Level editor for players? Nice-to-have post-v1.
