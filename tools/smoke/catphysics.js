/* CHONK'EM smoke suite: cat stages, CatPhysics integration, face/aliveness draw
   Loaded by tools/smoke.js — shares the harness globals (T, step, ctxStub, game, ...). */
// 15. cat physics: exponential stages, hard cuts, slow wobble
T('cat: stageIdxForLb spans 0..7 across 10..80 lb',
  stageIdxForLb(10) === 0 && stageIdxForLb(80) === 7 && stageIdxForLb(12.9) === 0 && stageIdxForLb(13) === 1);
T('cat: stage thresholds are exponential (~1.35x)',
  (() => { const d = []; for (let i = 1; i < STAGE_AT_LB.length; i++) d.push(STAGE_AT_LB[i] - STAGE_AT_LB[i-1]);
    return d.every((v, i) => i === 0 || v > d[i-1]); })());
T('cat: STAGES flavor thresholds are exponential',
  STAGES.every((st, i) => i < 2 || st.at > STAGES[i-1].at * 2));
loadLevel(0);
wobbleImpulse('belly', 4);
step(36); // 0.3s
let wobMax = 0;                 // max over the 0.3-0.7s window: a single sample can land on a zero crossing
for (let i = 0; i < 48; i++) { step(1); wobMax = Math.max(wobMax, Math.abs(game.wob.belly.x)); }
T('cat: slow wobble still oscillating at 0.5s (damped but alive)', wobMax > 0.05);
T('cat: sub-belly lags the main spring', Math.abs(game.wob.sub.x) > 0.001);
step(36); // to ~1.0s
let lateMax = 0;                // owner 2026-10-16: was "very floaty" — ring times cut ~45%
for (let i = 0; i < 120; i++) { step(1); lateMax = Math.max(lateMax, Math.abs(game.wob.belly.x)); }
T('cat: jiggle is damped, not floaty (1-2s window under 0.2)', lateMax < 0.2);
step(1200);
T('cat: wobble settles eventually', Math.abs(game.wob.belly.x) < 0.05 && Math.abs(game.wob.belly.v) < 0.05);

// 17. CatPhysics integration (Sleve's module, wired 2026-10-14)
T('catphysics: sim created on loadLevel with full API', (() => {
  loadLevel(0);
  return !!game.phys && ['eat', 'impulse', 'milestone', 'update', 'pose', 'setWeight', 'setReduced']
    .every(m => typeof game.phys[m] === 'function') && game.wob === game.phys.wob;
})());
T('catphysics: wobbleImpulse routes into the sim', (() => {
  loadLevel(0);
  const e0 = game.phys.energy();
  wobbleImpulse('belly', 4);
  return game.phys.energy() > e0;
})());
T('catphysics: eat() then tick moves the belly mirror', (() => {
  loadLevel(0);
  game.phys.eat(30, 1, 0.3);
  step(4);
  return Math.abs(game.wob.belly.x) > 0.001;
})());
T('catphysics: milestone holds the old sprite through the crouch', (() => {
  loadLevel(0);
  game.weightLb = 40; game.phys.setWeight(40); step(2);
  game.weightLb = 57; game.phys.milestone(40, 57); // deliver() updates weightLb before milestone()
  const held = game.phys.shownLb === 40;
  step(60); // 0.5s: crouch (0.15s+ at 40lb) released, new stage live, pop settling
  return held && game.phys.shownLb === 57 && game.phys.phase === 0;
})());
T('catphysics: drawMain with phys renders without throwing', (() => {
  loadLevel(0);
  game.phys.eat(20, 1, 0.4); step(4);
  try {
    Cats.drawMain(ctxStub, 252, 806, { t: 0.5, lb: game.phys.shownLb, phys: game.phys, wob: game.wob, var: 1, nomT: 0, face: 'normal', time: 1 });
    return true;
  } catch (e) { return false; }
})());
T('catphysics: REDUCED flag reaches the sim', (() => {
  const p = CatPhysics.create({ reduced: true });
  return p.gain === 0.35;
})());

// 2026-10-15: cat aliveness — new faces + blink/ear-twitch draw without throwing
T('aliveness: smug/shocked/determined faces draw without throwing', (() => {
  try {
    loadLevel(0); step(10);
    for (const f of ['smug', 'shocked', 'determined']) {
      game.face = f; game.faceT = 2; game.time += 0.05; tick(1 / 60); render();
    }
    return true;
  } catch (e) { console.log('    ' + e.message); return false; }
})());
T('aliveness: spook sets shocked face; frenzy sets determined face', (() => {
  loadLevel(0);
  spookCat({ x: 300, y: 400 });
  const shocked = game.face === 'shocked' && game.faceT > 0;
  triggerFrenzy();
  const determined = game.face === 'determined';
  game.frenzy = 0; game.timeScale = 1;
  return shocked && determined;
})());
T('aliveness: 6+ combo sets the smug face', (() => {
  loadLevel(0);
  game.face = 'normal'; game.faceT = 0; game.combo = 5; game.maxCombo = 0;
  deliver({ cal: 5, content: 'kibble', t: 0, x: 100, y: 700 });
  return game.face === 'smug' && game.combo === 6;
})());
