/* CHONK'EM smoke suite: combo/frenzy/jiggle systems, win path, weight + wobble
   Loaded by tools/smoke.js — shares the harness globals (T, step, ctxStub, game, ...). */
// 8. stunkus systems: combo multiplier, frenzy, jiggle, eased body, shotsFired, mute
loadLevel(0);
deliver({ cal: 1 }); deliver({ cal: 1 }); deliver({ cal: 1 }); deliver({ cal: 1 });
T('combos: after 3 clean deliveries, 4th+ earns ×2 calories', game.combo === 4 && game.mult === 2);
step(2); // phys mirror refreshes on tick()
T('jiggle: delivery kicks the belly spring', game.jiggleV > 0);
game.calories = 24; game.stageMisses = 0; game.stageVeggies = 0;
const ballsBefore = game.balls;
deliver({ cal: 1 }); // clean stage-up → FEAST FRENZY
T('frenzy: clean stage-up triggers FEAST FRENZY (+2 yarn, 0.35× time)',
  game.frenzy === 6 && game.balls === ballsBefore + 2 && game.timeScale === 0.35);
// chonk easing: bulk past 10 lb (0.3 lb/cal needs real food), then watch it ease
loadLevel(0);
deliver({ cal: 5 }); deliver({ cal: 5 }); deliver({ cal: 5 }); deliver({ cal: 5 });
step(60);
T('chonk-stages: body width eases toward weight-based target (not instant)',
  game.weightLb > 10 && game.displayRx > catRx(0) && game.displayRx < catRx(chonkT(game.weightLb)));
loadLevel(0);
fireShot(150, 400);
T('stars/par: shotsFired counts balls launched', game.shotsFired === 1);
game.multiShots = 1; game.shots = [];
fireShot(150, 400);
T('stars/par: multi-shot counts all 3 balls', game.shotsFired === 4);
AudioSys.toggle();
T('audio: mute toggle flips state', AudioSys.muted === true);
AudioSys.toggle();

// 10. win path: goal no longer ends the level instantly
loadLevel(0);
game.calories = game.level.goal - 1;
deliver({ cal: 1 });
T('v0.5: reaching goal does NOT end level mid-play', game.over === null && game.goalMet === true);
// exhaustion: balls gone -> scores win when goal met
loadLevel(0);
game.calories = game.goalNow;
game.balls = 0; game.shots = []; game.items = [];
step(100);
T('v0.5: balls exhausted scores a WIN when goal met', game.over === 'win');
// exhaustion: balls gone, goal missed -> lose
loadLevel(0);
game.calories = 0;
game.balls = 0; game.shots = []; game.items = [];
step(100);
T('v0.5: balls exhausted with goal missed scores a LOSS', game.over === 'lose');
// exhaustion: no food barrels left but balls remain -> level still ends
loadLevel(0);
game.calories = game.goalNow;
game.barrels.forEach(b => { if (['snack', 'mystery', 'golden'].includes(b.kind)) b.cleared = true; }); // all edible kinds
game.shots = []; game.items = [];
step(100);
T('v0.5: no food barrels left ends level even with balls remaining', game.over === 'win');
// mid-level: food remains, balls remain -> keeps playing
loadLevel(0);
game.calories = game.goalNow;
game.shots = []; game.items = [];
step(100);
T('v0.5: level continues while food and balls remain', game.over === null);
T('saves: best stars persisted to localStorage (profile v2)', (() => {
  const p = JSON.parse(lsStore.get('chonk-em:profile-v2') || 'null');
  return !!p && p.version === 2 && p.best && p.best[0] && p.best[0].stars >= 1;
})());

// 11. weight system + wobble v2 (stunkus full-chonk pass)
loadLevel(0);
const w0 = game.weightLb;
deliver({ cal: 5 });
T('weight: snack deliveries add pounds from RAW cal (per-level growth)', game.weightLb === w0 + 5 * game.lbPerCal);
T('weight: flat 0.3 lb/cal, 150lb absolute cap, no per-level caps', MAX_LB === 150 && LB_PER_CAL === 0.3 && typeof LEVEL_MAX_LB === 'undefined');
T('weight: 100 raw cal gains exactly 30 lb', (() => {
  loadLevel(11); game.weightLb = 5;
  deliver({ cal: 100 });
  return Math.abs(game.weightLb - 35) < 1e-9;
})());
T('weight: weight persists to localStorage (profile v2)', (() => {
  const p = JSON.parse(lsStore.get('chonk-em:profile-v2') || 'null');
  return !!p && Math.abs(p.weight - game.weightLb) < 1e-9;
})());
const w1 = game.weightLb;
deliver({ cal: -2 });
T('weight: veggies never slim the cat', game.weightLb === w1);
// the 100-cal delivery above triggered frenzy slow-mo (0.35x): substeps land sporadically,
// so tick until the mirror catches the motion (cap 60 ticks)
let kickedCT = false;
for (let i = 0; i < 60 && !kickedCT; i++) { tick(1 / 120); kickedCT = game.wob.cheek.v > 0 && game.wob.tail.v > 0; }
T('wobble: delivery kicks cheek and tail springs too', kickedCT);
loadLevel(0);
wobbleImpulse('belly', 4);
step(1);
const kicked = Math.abs(game.wob.belly.x) > 0;
step(600);
T('wobble: belly spring oscillates then settles near rest',
  kicked && Math.abs(game.wob.belly.x) < 0.05 && Math.abs(game.wob.belly.v) < 0.05);

