# CHONK 'EM v0.4 — "MASSIVE" update roadmap

Brainstorm 2026-10-07. Absorbs the `stunkus/v04-polish` branch (PR #5: 100 levels,
food tiers, difficulty, vacuum placeholder, 150-lb cap). Three pillars: architecture,
game design, polish. Starred (★) items are Stunkus's proposed P0 cut.

## Pillar 1 — Architecture

- ★ **Save schema v2.** Versioned player profile: lifetime stats (total cal fed,
  best chonk, levels cleared), stars[100], unlocked species, settings. Namespaced
  keys + migration from the current flat keys so nobody's progress wipes.
- ★ **FX bus.** One API — `FX.popup / shake / slowmo / jingle / confetti / hitstop` —
  that all game feel flows through. New juice becomes a one-liner anywhere.
- ★ **Asset manifest + fallback chain.** Declared sprite list with
  species → generic → vector fallback, so a missing PNG never breaks rendering and
  Qwen can see at a glance exactly which assets are still needed.
- **LevelManager.** Owns handcrafted 1–12 + procedural 13–100 + daily-seed + endless;
  menu, splash, and win-path all read from it instead of raw `LEVELS`.

## Pillar 2 — Game design (new systems)

- ★ **Species unlocks.** Tabby → orange (first 30-lb cat) → tuxedo (50 lb) →
  calico (100 lb). Pick your cat in the menu. Turns Blarmo's species-swap idea into
  the long-term progression hook.
- ★ **Worlds.** 10 worlds × 10 levels (Kitchen, Pantry, Garden, Fish Market, Bakery…).
  Palette + background + music swap per world. Cheap to build (tints + a few
  backgrounds), massive perceived variety across 100 levels.
- ★ **Mystery barrels.** Random content, sparkle hint so they read as special.
  (Already in TASKS, unclaimed.)
- ★ **Cucumber.** Rare barrel; scares the cat — comedic jump, brief aim wobble.
  (Already in TASKS, unclaimed.)
- **Moving barrels.** Slowly oscillating barrels from world 4 on. The Peggle staple
  we're missing.
- **Golden barrel.** One per level, 3× cal jackpot. Gives every level a mini-objective.
- ★ **Proper vacuum.** Real asset (placeholder Roomba retires) + smarter behavior:
  telegraphed lunges, pauses after eating, world-scaled speed.
- **Endless mode.** Post-100 procedural climb with rising vacuum speed. For the sickos.
- **Daily challenge.** Date-seeded level, local best tracking.

## Pillar 3 — Polish (the "next level" feel)

- ★ **Menu overhaul.** Animated title, mascot cat that tracks the cursor, world-map
  level select instead of a 100-button grid.
- ★ **Results cards.** Per-level stats on win: cal delivered, max combo, stars earned.
- ★ **Juice pass.** Hit-stop on barrel burst, cal-scaled screen shake, confetti on
  exotic delivery, slow-mo on final-ball wins. (Needs the FX bus first.)
- **Audio pass.** Per-world music, meow pitch scales with chonk, richer burst/delivery
  SFX set.
- **Cat aliveness.** Blinking, ear twitches, idle breathing, expanded reaction faces
  (bliss/happy exist — add smug, shocked, determined).
- **Backgrounds.** 4–5 themes rotating per world group (current single kitchen is
  carrying too much).
- **Onboarding.** 3-step first-play overlay: aim → shoot → feed.

## Proposed cut

- **P0 (v0.4 ships with this):** species unlocks, worlds, save v2, FX bus + juice pass,
  menu overhaul, results cards, mystery + cucumber barrels, proper vacuum.
- **P1:** moving barrels, golden barrel, audio pass, onboarding, cat aliveness.
- **P2:** endless mode, daily challenge, per-exotic special effects.

## Open questions for Blarmo

1. Worlds: 10×10, or fewer worlds with more levels each?
2. Species unlocks tied to lifetime chonk — right trigger, or level-based instead?
3. Vacuum: keep as pure hazard, or give the player counterplay (e.g., a barrel that
   shorts it out for 10s)?
4. Anything in P0 you'd cut, or P1/P2 you'd promote?
