/* CHONK'EM smoke suite: barrel types, vacuum hazard, food physics, movers
   Loaded by tools/smoke.js — shares the harness globals (T, step, ctxStub, game, ...). */
// 13. vacuum hazard (extreme-mode)
loadLevel(0);
T('vacuum: absent on non-flagged levels', game.vacuum === null);
loadLevel(5); // Diagonal Dash — flagged
T('vacuum: spawns on flagged levels', game.vacuum !== null && game.vacuum.x >= 70 && game.vacuum.x <= 530);
const vx0 = game.vacuum.x, vd0 = game.vacuum.dir;
step(60);
T('vacuum: patrols slowly left/right', Math.abs(game.vacuum.x - vx0) > 1 && Math.abs(game.vacuum.x - vx0) < 60);
game.vacuum.x = 529; game.vacuum.dir = 1; step(60);
T('vacuum: bounces off the right wall', game.vacuum.dir === -1 && game.vacuum.x <= 530);
game.vacuum.x = 200; game.vacuum.dir = 1;
// falling loot in the suction cone: yanked in and eaten
game.items.push({ x: 200, y: 695, vx: 0, vy: 0, r: 9, state: 'fall', cal: 3, t: 0, gone: false });
const eaten0 = game.vacuum.eaten;
step(120);
T('vacuum: hoovers nearby falling loot', game.vacuum.eaten >= eaten0 + 1);
// belt loot in the cone: ripped off the belt, then eaten
// (gulp cleared so the rip→eat chain is observable in isolation)
game.vacuum.gulpT = 0; game.vacuum.eatenThisShot = 0;
const beltIt = { x: 210, y: 700, vx: 0, vy: 0, r: 9, state: 'belt', belt: 'L', cal: 5, t: 0, gone: false };
game.items.push(beltIt);
step(3);
T('vacuum: rips belt loot off the belt', beltIt.state === 'fall' && beltIt.sucked === true && !beltIt.gone);
const eaten1 = game.vacuum.eaten;
step(240);
T('vacuum: eats the ripped loot', game.vacuum.eaten >= eaten1 + 1);
const farItem = { x: 550, y: 700, vx: 0, vy: 0, r: 9, state: 'belt', belt: 'R', cal: 3, t: 0, gone: false };
game.items.push(farItem);
step(120);
T('vacuum: ignores distant loot', !farItem.gone);
T('vacuum: only 3 of 12 levels flagged', LEVELS.filter(L => L.vacuum).length === 3);
T('vacuum: tuned down (suck 55 / eat 20 / 2 per shot)', Vacuum.SUCK_R === 55 && Vacuum.EAT_R === 20 && Vacuum.MEAL === 2);
T('vacuum: two-item limit per shot', (() => {
  loadLevel(5);
  game.vacuum.x = 300; game.vacuum.eatenThisShot = 0;
  for (const dx of [-10, 0, 10]) game.items.push({ x: 300 + dx, y: 735, vx: 0, vy: 0, r: 9, state: 'fall', cal: 3, t: 0, gone: false });
  const e0 = game.vacuum.eaten;
  step(300); // 2.5s: gulp windows let loot slip past, but the per-shot cap is never exceeded
  return game.vacuum.eaten - e0 <= 2;
})());

// 13b. EMP short-circuit barrel (vacuum counterplay, 2026-10-18)
T('emp: CONTENT entry is a burst-immediate power', CONTENT.emp && CONTENT.emp.power === 'emp' && CONTENT.emp.cal === 0);
T('emp: handcrafted vacuum levels each deal one', [5, 8, 11].every(i => LEVELS[i].barrels.some(b => b.kind === 'power' && b.content === 'emp')));
T('emp: procedural vacuum levels deal one, non-vacuum levels deal none', (() => {
  const withV = genLevelSeeded(12345, 5, 200, true), noV = genLevelSeeded(12345, 5, 200, false);
  return withV.barrels.some(b => b.kind === 'power' && b.content === 'emp') &&
         !noV.barrels.some(b => b.kind === 'power' && b.content === 'emp');
})());
T('emp: bursting one zaps the vacuum for 10s (no patrol, no suction)', (() => {
  loadLevel(5);
  const v = game.vacuum;
  v.x = 200; v.dir = 1; v.gulpT = 0; v.eatenThisShot = 0;
  onBarrelBurst({ x: 300, y: 400, kind: 'power', content: 'emp', cleared: false }, null);
  if (v.zapT !== Vacuum.ZAP_SECS) return false;
  const x0 = v.x, e0 = v.eaten;
  const it = { x: 200, y: 690, vx: 0, vy: 0, r: 9, state: 'fall', cal: 3, t: 0, gone: false };
  game.items.push(it);
  step(120); // 1s: the item crosses the belt line and rides it, unsucked, uneaten
  return v.x === x0 && v.zapT > 0 && v.zapT < Vacuum.ZAP_SECS && !it.sucked && v.eaten === e0;
})());
T('emp: vacuum recovers patrol and suction after the zap expires', (() => {
  loadLevel(5);
  const v = game.vacuum;
  v.x = 200; v.dir = 1; v.zapT = 0.05; v.gulpT = 0; v.eatenThisShot = 0;
  step(120); // zap burns off (0.05s), patrol resumes
  const x0 = v.x;
  game.items.push({ x: 200, y: 695, vx: 0, vy: 0, r: 9, state: 'fall', cal: 3, t: 0, gone: false });
  const e0 = v.eaten;
  step(120);
  return v.zapT <= 0 && v.x !== x0 && v.eaten > e0;
})());
T('emp: fires cleanly with no vacuum on the level', (() => {
  loadLevel(0);
  onBarrelBurst({ x: 300, y: 400, kind: 'power', content: 'emp', cleared: false }, null);
  return game.vacuum === null && game.rings.length > 0;
})());
T('emp: never disturbs the every-level split powerup', (() => {
  const L = genLevelSeeded(999, 5, 200, true);
  return L.barrels.some(b => b.kind === 'power' && b.content === 'split');
})());

// 14. food physics: bounce, never burst
loadLevel(0);
const bb = game.barrels.find(b => !b.cleared);
game.items.push({ x: bb.x, y: bb.y - 40, vx: 0, vy: 200, r: 9, state: 'fall', cal: 3, t: 0, gone: false });
const clearedBefore = game.barrels.filter(b => b.cleared).length;
step(40);
T('food: bounces off barrels without bursting them',
  game.barrels.filter(b => b.cleared).length === clearedBefore);
loadLevel(0);
const fi = { x: 200, y: 600, vx: 0, vy: 50, r: 9, state: 'fall', cal: 3, t: 0, gone: false };
game.items.push(fi);
step(240);
T('food: belt bounce settles into belt ride', fi.bounces > 0 && (fi.state === 'belt' || fi.gone));
loadLevel(0);
game.items.push({ x: 530, y: 700, vx: 0, vy: 300, r: 9, state: 'fall', cal: 3, t: 0, gone: false }); // over the end gap
const misses0 = game.misses;
step(600);
T('food: missed food bounces on floor, then lost', game.items.length === 0 && game.misses > misses0);

// 16. split-yarn powerup
loadLevel(0);
deliver({ power: 'split' });
T('split: delivery arms the next shot', game.splitNext === true);
fireShot(300, 500);
T('split: fired ball carries the split charge', game.shots.some(b => b.splitArmed));
const armed = game.shots.find(b => b.splitArmed);
armed.x = 300; armed.y = 300; armed.vx = 0; armed.vy = 400;
const n0 = game.shots.length;
onBarrelBurst(game.barrels[0], armed);
T('split: first burst divides the ball (1→3)', game.shots.length === n0 + 2 && armed.splitDone === true);

// 17. armored barrels need 2 hits
loadLevel(0);
T('armor: level ships armored barrels', game.barrels.some(b => b.armor));
const arm = { x: 300, y: 300, r: 11, kind: 'snack', content: 'kibble', armor: true, cracked: false, cleared: false, wob: 0, wobV: 0 };
const probe = { x: 300, y: 290, vx: 0, vy: 300, r: 10, life: 0, slowT: 0, bounces: 0 };
let didCrack = false, didBurst = false;
Physics.stepBall(probe, 1/60, [arm], () => { didBurst = true; }, () => { didCrack = true; });
T('armor: first hit cracks, does not burst', didCrack && !didBurst && arm.cracked && !arm.cleared);
probe.x = 300; probe.y = 290; probe.vx = 0; probe.vy = 300;
Physics.stepBall(probe, 1/60, [arm], () => { didBurst = true; }, () => { didCrack = true; });
T('armor: second hit bursts', didBurst && arm.cleared);

// 2026-10-25: yarn-ball-vanish — a ball at rest on an unbreakable barrel
// used to micro-bounce every frame, hit bounces>14 in ~0.25 s, and vanish
// while visibly sitting on the barrel (bumpers also spammed combo/boing).
// Now it slides off tangentially with no bounce count and no special.
T('vanish: ball at rest on steel slides off, no bounce count, no cull', (() => {
  const ball = { x: 300, y: 275, vx: 0, vy: 0, r: 10, life: 0, slowT: 0, bounces: 0, gentleT: 0, stuckT: 0 };
  const steel = [{ x: 300, y: 300, r: 15, kind: 'steel', cleared: false }];
  let dead = false, steps = 0;
  for (; steps < 180 && !dead; steps++) dead = Physics.stepBall(ball, 1 / 60, steel, () => {}, () => {}, () => {});
  // rolled off the barrel; if it died, it fell out the bottom (normal shot
  // end), not by a bounce/slow cull while sitting on the barrel
  return ball.bounces === 0 && ball.x !== 300 && (!dead || ball.y > 940);
})());
T('vanish: ball at rest on bumper slides off, no combo/boing spam', (() => {
  const ball = { x: 300, y: 275, vx: 0, vy: 0, r: 10, life: 0, slowT: 0, bounces: 0, gentleT: 0, stuckT: 0 };
  const bump = [{ x: 300, y: 300, r: 15, kind: 'bumper', cleared: false }];
  let specials = 0, dead = false, steps = 0;
  for (; steps < 180 && !dead; steps++) dead = Physics.stepBall(ball, 1 / 60, bump, () => {}, () => {}, () => { specials++; });
  return specials === 0 && ball.bounces === 0 && (!dead || ball.y > 940);
})());
T('vanish: ball wedged in a steel pocket gets kicked free, not culled', (() => {
  const ball = { x: 300, y: 285, vx: 0, vy: 0, r: 10, life: 0, slowT: 0, bounces: 0, gentleT: 0, stuckT: 0 };
  const pocket = [
    { x: 280, y: 300, r: 15, kind: 'steel', cleared: false },
    { x: 320, y: 300, r: 15, kind: 'steel', cleared: false },
  ];
  let dead = false, steps = 0, freed = false;
  for (; steps < 300 && !dead; steps++) {
    dead = Physics.stepBall(ball, 1 / 60, pocket, () => {}, () => {}, () => {});
    if (Math.abs(ball.x - 300) > 40) freed = true; // kicked clear of the pocket
  }
  return freed && ball.bounces <= 14;
})());
T('vanish: fast steel hits still bounce and count (no slide regression)', (() => {
  const ball = { x: 300, y: 200, vx: 0, vy: 400, r: 10, life: 0, slowT: 0, bounces: 0, gentleT: 0, stuckT: 0 };
  const steel = [{ x: 300, y: 300, r: 15, kind: 'steel', cleared: false }];
  let specials = 0, dead = false;
  for (let i = 0; i < 60 && !dead; i++) dead = Physics.stepBall(ball, 1 / 60, steel, () => {}, () => {}, () => { specials++; });
  return ball.bounces > 0 && specials > 0; // a real hit still clangs and counts
})());

// 19. daily 2026-10-13: mystery / golden / cucumber barrels + FX bus + juice pass
T('deal: exactly 1 golden jackpot per level, content = level top snack', (() => {
  loadLevel(0);
  const g = game.barrels.filter(b => b.kind === 'golden');
  return g.length === 1 && g[0].content === topCommonFor(1);
})());
T('deal: mystery barrels dealt from empties (~6%)', (() => {
  loadLevel(0);
  const m = game.barrels.filter(b => b.kind === 'mystery');
  const empt0 = getLevel(0).barrels.filter(b => b.kind === 'empty').length;
  return m.length >= 1 && m.length <= Math.ceil(empt0 * 0.06) + 1;
})());
T('deal: no cucumber on levels 1-3 (onboarding stays clean)', (() => {
  loadLevel(0); const a = game.barrels.some(b => b.kind === 'cuke');
  loadLevel(1); const b = game.barrels.some(b => b.kind === 'cuke');
  loadLevel(2); const c = game.barrels.some(b => b.kind === 'cuke');
  return !a && !b && !c;
})());
T('deal: deterministic — same level, same specials, every load', (() => {
  loadLevel(9);
  const k1 = game.barrels.map(b => b.kind + ':' + b.content).join('|');
  loadLevel(9);
  const k2 = game.barrels.map(b => b.kind + ':' + b.content).join('|');
  return k1 === k2;
})());
T('deal: barrel count and food counts unchanged by dealing', (() => {
  loadLevel(0);
  const L = getLevel(0);
  const nFood = game.barrels.filter(b => b.kind === 'snack' && (CONTENT[b.content] || { cal: 0 }).cal > 0).length;
  const LFood = L.barrels.filter(b => b.kind === 'snack' && (CONTENT[b.content] || { cal: 0 }).cal > 0).length;
  return game.barrels.length === L.barrels.length && nFood === LFood;
})());
T('mystery: burst resolves to a valid snack or power-up and spawns loot', (() => {
  loadLevel(0);
  const mb = game.barrels.find(b => b.kind === 'mystery');
  if (!mb) return false;
  const items0 = game.items.length;
  onBarrelBurst(mb, null);
  const it = game.items[game.items.length - 1];
  const ok = game.items.length === items0 + 1 && CONTENT[it.content] &&
    (mb.kind === 'snack' || mb.kind === 'power');
  return ok;
})());
T('golden: burst pays 2x the barrel snack, with jackpot juice', (() => {
  loadLevel(0);
  const g = game.barrels.find(b => b.kind === 'golden');
  if (!g) return false;
  const base = (CONTENT[g.content] || { cal: 0 }).cal;
  const items0 = game.items.length;
  onBarrelBurst(g, null);
  const it = game.items[game.items.length - 1];
  return game.items.length === items0 + 1 && it.cal === base * 2 && it.golden === true &&
    game.shakeT > 0 && game.hitstopT > 0;
})());
T('cuke: burst spills a spook item (no calories)', (() => {
  loadLevel(0);
  const cb = game.barrels[10]; cb.kind = 'cuke'; cb.content = 'cucumber'; // deterministic placement for the test
  const items0 = game.items.length;
  onBarrelBurst(cb, null);
  const it = game.items[game.items.length - 1];
  return game.items.length === items0 + 1 && it.spook === true && it.cal === 0 && it.icon === '🥒' &&
    typeof AudioSys.startle === 'function';
})());
T('cuke: delivery spooks the cat — hop, wobble, aim wobble, no calories', (() => {
  loadLevel(0);
  const cal0 = game.calories, combo0 = game.combo;
  game.weightLb = 20;
  deliver({ spook: true, cal: 0, x: 300, y: 600 });
  const okSync = game.cukeT === 4 && game.scareJump === 110 && game.face === 'shocked' &&
    game.calories === cal0 && game.combo === combo0 &&
    game.popups.some(p => p.text === 'SPOOKED! aim wobbles!');
  step(2); // phys mirror refreshes on tick()
  const ok = okSync && game.wob.belly.v > 0;
  game.cukeT = 0; game.scareJump = 0;
  return ok;
})());
T('cuke: aim angle wobbles while spooked, steady when calm', (() => {
  loadLevel(0);
  game.cukeT = 4;
  game.time = 0; const a1 = aimAngleFor(300, 500);
  game.time = 0.2; const a2 = aimAngleFor(300, 500);
  game.cukeT = 0;
  game.time = 0; const a3 = aimAngleFor(300, 500);
  game.time = 0.2; const a4 = aimAngleFor(300, 500);
  return a1 !== a2 && a3 === a4;
})());
T('exhaustion: unresolved mystery barrels count as food left', (() => {
  loadLevel(0);
  game.barrels.forEach(b => { if (b.kind === 'snack') b.cleared = true; });
  game.balls = 5; game.shots = []; game.items = [];
  step(100);
  const hasMystery = game.barrels.some(b => b.kind === 'mystery' && !b.cleared);
  return hasMystery ? game.over === null : true;
})());
T('fx: hit-stop freezes the world', (() => {
  loadLevel(0);
  const ball = { x: 300, y: 300, vx: 100, vy: 100, r: 10, life: 0, slowT: 0, bounces: 0 };
  game.shots.push(ball);
  FX.hitstop(0.2);
  const x0 = ball.x;
  step(12); // 0.1s < 0.2s
  const frozen = ball.x === x0;
  step(24); // hit-stop consumed, world resumes
  return frozen && ball.x !== x0;
})());
T('fx: slowmo dips timeScale under frenzy/slow-mo', (() => {
  loadLevel(0);
  FX.slowmo(0.4, 1.0);
  tick(1 / 120);
  const dipped = game.timeScale === 0.4;
  for (let i = 0; i < 130; i++) tick(1 / 120); // 1.08s > 1.0s
  return dipped && game.timeScale === 1;
})());
T('fx: final-ball win triggers the dramatic slow-mo beat', (() => {
  loadLevel(0);
  game.balls = 1; game.goalMet = true;
  fireShot(300, 500);
  const ok = game.balls === 0 && game.fxSlowT > 0;
  game.fxSlowT = 0;
  return ok;
})());
T('fx: burst juice scales with calories (hit-stop on 10+ cal, shake on 25+)', (() => {
  loadLevel(0);
  const mk = cal => ({ x: 300, y: 300, r: 10, kind: 'snack', content: 'tuna', cleared: false });
  const b1 = mk(); game.hitstopT = 0; game.shakeT = 0;
  // 5-cal snack: no juice
  const saveCal = CONTENT.tuna.cal; CONTENT.tuna.cal = 5;
  onBarrelBurst(b1, null);
  const none = game.hitstopT === 0 && game.shakeT === 0;
  // 30-cal: shake + hit-stop
  CONTENT.tuna.cal = 30;
  onBarrelBurst(mk(), null);
  const big = game.hitstopT > 0 && game.shakeT > 0;
  CONTENT.tuna.cal = saveCal;
  return none && big;
})());
T('fx: exotic delivery rains confetti', (() => {
  loadLevel(0);
  const p0 = game.particles.length;
  deliver({ cal: 15, x: 100, y: 700 });
  const p1 = game.particles.length;
  deliver({ cal: 3, x: 100, y: 700 });
  return p1 > p0;
})());

T('keg chain never bursts bumpers (no CONTENT[null] crash)', (() => {
  loadLevel(0);
  // plant a keg right next to a bumper and detonate it
  const bumper = game.barrels.find(b => b.kind === 'bumper') || (() => {
    const b = { x: 300, y: 400, r: 16, kind: 'bumper', content: null, cleared: false };
    game.barrels.push(b); return b;
  })();
  game.barrels.push({ x: bumper.x + 40, y: bumper.y, r: 14, kind: 'keg', content: null, cleared: false });
  try { explode(bumper.x + 40, bumper.y); } catch (e) { return false; }
  return bumper.cleared === false; // bumpers are blast-proof
})());
T('burst with unknown content never throws', (() => {
  loadLevel(0);
  const b = { x: 300, y: 300, r: 14, kind: 'snack', content: 'nope-not-real', cleared: false };
  try { onBarrelBurst(b, null); } catch (e) { return false; }
  return game.items.length >= 0;
})());
T('combo multiplier: +0.1x per food delivered, caps at 3x', (() => {
  loadLevel(0);
  game.combo = 0; game.mult = 1;
  const vals = [];
  for (let n = 0; n < 25; n++) { deliver({ cal: 3, x: 100, y: 700 }); vals.push(game.mult); }
  // mult is computed from the pre-delivery combo: 1st delivery 1.0x, 2nd 1.1x...
  return vals[0] === 1 && vals[1] === 1.1 && vals[9] === 1.9 &&
    vals[19] === 2.9 && vals[20] === 3 && vals[24] === 3;
})());
T('combo multiplier: miss and veggie reset it to 1x', (() => {
  loadLevel(0);
  game.combo = 5; game.mult = 1.5;
  loseItem({ x: 100, y: 700 });
  const afterMiss = game.mult;
  game.combo = 5; game.mult = 1.5;
  deliver({ cal: -2, x: 100, y: 700 });
  return afterMiss === 1 && game.mult === 1 && game.combo === 0;
})());
T('cal-cut: no single food delivery reaches 100 cal at max mult', (() => {
  const top = Math.max(...Object.values(CONTENT).filter(c => c.cal > 0).map(c => c.cal));
  return top * 3 < 100; // imperial 32 x 3 = 96 — the old 100-cal single shots are gone
})());
T('cal-cut: exotic ladder is 15..32 in +1 steps (18 exotics)', (() => {
  const ex = EXOTICS.map(e => (CONTENT[e[0]] || {}).cal);
  return ex.length === 18 && ex.every((c, i) => c === 15 + i);
})());


// 2026-10-14: moving barrels (world 4+, level 31+)
T('movers: none before world 4', (() => {
  loadLevel(29); // level 30
  return game.barrels.every(b => !b.mv);
})());
T('movers: level 31 deals 2-6 moving snack barrels', (() => {
  loadLevel(30);
  const mv = game.barrels.filter(b => b.mv);
  return mv.length >= 2 && mv.length <= 6 &&
    mv.every(b => b.kind === 'snack' && ((CONTENT[b.content] || {}).cal || 0) > 0 &&
      (b.mv.axis === 'x' || b.mv.axis === 'y') && b.mv.amp > 0 && b.mv.period > 0 &&
      b.hx === b.x && b.hy === b.y);
})());
T('movers: oscillate within amplitude around the base track', (() => {
  loadLevel(30);
  const mv = game.barrels.filter(b => b.mv);
  let ok = mv.length > 0, moved = false;
  for (let i = 0; i < 1200; i++) {
    tick(1 / 120);
    for (const b of mv) {
      const o = b.mv.axis === 'x' ? b.x - b.hx : b.y - b.hy;
      if (Math.abs(o) > b.mv.amp + 0.001) ok = false;
      if (Math.abs(o) > b.mv.amp * 0.5) moved = true;
    }
  }
  return ok && moved;
})());
T('movers: burst spawns loot at the live position', (() => {
  loadLevel(30);
  const mv = game.barrels.find(b => b.mv && !b.cleared);
  const n0 = game.items.length;
  onBarrelBurst(mv, null);
  const it = game.items[game.items.length - 1];
  return game.items.length === n0 + 1 && it.cal > 0 &&
    Math.hypot(it.x - mv.x, it.y - mv.y) < 1;
})());
T('movers: vertical tracks never clip the belt', (() => {
  for (const n of [30, 45, 70, 99]) {
    loadLevel(n);
    for (const b of game.barrels.filter(b => b.mv && b.mv.axis === 'y'))
      if (b.hy + b.mv.amp + b.r > 684 + 0.001) return false;
  }
  return true;
})());
T('worlds: worldForLevel maps 1->0, 31->3, 100->9',
  worldForLevel(1) === 0 && worldForLevel(31) === 3 && worldForLevel(100) === 9);

// 2026-10-14: vacuum v2 — gulp pauses, world-scaled speed
T('vacuum-v2: gulp pause after eating blocks suction', (() => {
  for (let i = 0; i < 12; i++) {
    loadLevel(i);
    if (game.vacuum) {
      const v = game.vacuum;
      if (v.gulpT !== 0) return false;
      v.x = 200; // keep clear of the center-bowl chute protection zone
      let eaten = 0;
      game.items = [{ x: v.x, y: 740, vx: 0, vy: 0, r: 9, state: 'fall', cal: 3, t: 0, gone: false }];
      Vacuum.tick(v, 1 / 60, game.items, () => { eaten++; });
      if (eaten !== 1 || !(v.gulpT > 0)) return false;
      game.items = [{ x: v.x, y: 740, vx: 0, vy: 0, r: 9, state: 'fall', cal: 3, t: 0, gone: false }];
      Vacuum.tick(v, 1 / 60, game.items, () => { eaten++; });
      return eaten === 1 && !game.items[0].gone && v.gulpT > 0;
    }
  }
  return false;
})());
T('vacuum-v2: suction resumes after the gulp, per-shot cap intact', (() => {
  for (let i = 0; i < 12; i++) {
    loadLevel(i);
    if (game.vacuum) {
      const v = game.vacuum;
      v.x = 200; v.eatenThisShot = 0; // keep clear of the center-bowl chute protection zone
      const drop = () => game.items.push({ x: 200, y: 735, vx: 0, vy: 0, r: 9, state: 'fall', cal: 3, t: 0, gone: false });
      drop(); step(30); // first item eaten, gulp starts
      if (v.gulpT <= 0) return false;
      step(60); // gulp expires
      drop(); step(60); // second item after the gulp: eaten (meal = 2)
      const e1 = v.eaten;
      drop(); step(60); // third item: blocked by the per-shot cap
      return e1 > 0 && v.eaten - e1 === 0;
    }
  }
  return false;
})());
T('vacuum-v2: speed scales with world', (() => {
  for (let i = 0; i < 12; i++) {
    loadLevel(i);
    if (game.vacuum) {
      const exp = 1.0 * (1 + 0.05 * worldForLevel(i + 1)); // normal difficulty
      return Math.abs(game.vacuum.speedMul - exp) < 1e-9;
    }
  }
  return false;
})());


// 2026-10-16: per-exotic signature effects
T('exotic-fx: every exotic (15+ cal) has a signature entry', (() => {
  const exotics = Object.keys(CONTENT).filter(k => CONTENT[k].cal >= 15);
  return exotics.length === 18 &&
    exotics.every(k => EXOTIC_FX[k] && EXOTIC_FX[k].text && EXOTIC_FX[k].colors.length >= 3);
})());
T('exotic-fx: burst pops the named popup + signature particles (no slow-mo below 30 cal)', (() => {
  loadLevel(12); // L13: exotics legal
  const p0 = game.particles.length;
  FX.exoticFx(300, 400, 'lobster');
  const popped = game.popups.some(p => p.text === EXOTIC_FX.lobster.text);
  const sigCols = game.particles.slice(p0).every(p => EXOTIC_FX.lobster.colors.includes(p.color));
  return popped && game.particles.length > p0 && sigCols && game.fxSlowT === 0;
})());
T('exotic-fx: imperial-tier feast (30+ cal) steals a slow-mo beat', (() => {
  loadLevel(12);
  FX.exoticFx(300, 400, 'imperial');
  return game.fxSlowT > 0;
})());
T('exotic-fx: bursting an exotic barrel routes through the signature + still drops loot', (() => {
  loadLevel(0);
  const b = { x: 300, y: 400, r: 15, kind: 'snack', content: 'caviar', cleared: false };
  const p0 = game.particles.length;
  onBarrelBurst(b, null);
  return game.particles.length > p0 &&
    game.popups.some(p => p.text === EXOTIC_FX.caviar.text) &&
    game.items.some(it => it.content === 'caviar');
})());


// 14b. rotation pass (2026-10-20 tumble, 2026-10-25 belt freeze): falling loot
// tumbles, belt loot rides frozen at its landing angle (no snap to flat).
loadLevel(0);
// clear lane left of the barrel field (level 1 barrels span x 165-435): vx=60 -> 5.4 rad/s
const ti = { x: 100, y: 300, vx: 60, vy: 0, r: 9, state: 'fall', cal: 3, t: 0, gone: false, rot: 0 };
game.items.push(ti);
step(60); // 0.5s of fall
T('rotation: falling food tumbles with vx', ti.rot > 2.5 && ti.rot < 2.9);
T('rotation: food tumble direction matches vx sign', ti.rot > 0);
loadLevel(0);
const si = { x: 200, y: 600, vx: 60, vy: 50, r: 9, state: 'fall', cal: 3, t: 0, gone: false, rot: 0 };
game.items.push(si);
let belted = false;
for (let i = 0; i < 240; i++) { tick(1 / 120); if (si.state === 'belt') { belted = true; break; } }
const landingRot = si.rot;
step(120); // ride the belt: the landing angle must survive unchanged
T('rotation: belt loot rides frozen at its landing angle', belted && landingRot !== 0 && si.rot === landingRot);
T('rotation: burst-spawned loot starts with rot 0', (() => {
  loadLevel(0);
  const sb = game.barrels.find(b => !b.cleared && b.kind === 'snack' && CONTENT[b.content]);
  const n0 = game.items.length;
  onBarrelBurst(sb, null);
  const spawned = game.items.slice(n0);
  return spawned.length === 1 && spawned[0].rot === 0;
})());
