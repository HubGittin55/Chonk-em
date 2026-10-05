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

## v0.2 — Game (backlog, don't start yet)

- [ ] `contents-full` — all snack/veggie types with fall behaviors, power-up barrels (multi-yarn, wide funnel, slow-mo, magnet) — **in progress — qwen**
- [ ] `chonk-stages` — all 5 stages + belly jiggle + faces (bliss/disgust) — **in progress — stunkus** (patch-handoff flow: Stunkus builds locally, Qwen pushes)
- [ ] `barrel-types` — armored (2-hit), mystery (???) barrels
- [ ] `combos` — delivery streak multiplier, FEAST FRENZY
- [ ] `hazards` — vacuum patrol, cucumber spook
- [ ] `levels-2-15` — level pack + level select map
- [ ] `stars-saves` — localStorage persistence
- [ ] `audio` — WebAudio synth SFX + mute

## v0.3 — Portable

- [ ] `pwa` — manifest, service worker, icons, offline
- [ ] `mobile-polish` — touch tuning, safe areas, DPR scaling, narrow-screen layout
