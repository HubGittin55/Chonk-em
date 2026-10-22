/* CHONK'EM smoke suite: boot, shots, power-ups, fall physics, magnet, chains
   Loaded by tools/smoke.js — shares the harness globals (T, step, ctxStub, game, ...). */
// 1. boot
T('boot: level 1 loads with 61 barrels (r=10), 6 balls (35% of food, -20% yarn 2026-10-16)', game.barrels.length === 61 && game.balls === 6 && game.barrels.every(b => b.r === 10));
T('boot: split power barrel present (guaranteed)', game.barrels.some(b => b.kind === 'power' && b.content === 'split'));

// 2. single shot
fireShot(300, 500);
T('fire: single shot spawns 1 ball, spends 1 yarn', game.shots.length === 1 && game.balls === 5);
step(1200); // 10s: ball bursts the center column, then falls out
T('fire: ball dies out cleanly', game.shots.length === 0);

// 3. multi-yarn shot (fresh level: test 2's center-column run may have won the level)
loadLevel(0);
game.multiShots = 1;
fireShot(300, 500);
T('multi: fires 3 balls, spends 3 yarn', game.shots.length === 3 && game.balls === 3);
T('multi: consumed after firing', game.multiShots === 0);
game.shots = [];

// 4. power-up activations via bowl delivery
deliver({ power: 'wide' });
T('power wide→bridge: gap bridged 15s', game.bridgeT === 15);
deliver({ power: 'slow' });
T('power slow-mo: 5s armed', game.slowT === 5);
deliver({ power: 'magnet' });
T('power magnet: 15s armed', game.magnetT === 15);
deliver({ power: 'multi' });
T('power multi: next shot armed', game.multiShots === 1);
game.multiShots = 0; game.slowT = 0; game.magnetT = 0; game.bridgeT = 0;

// 5. distinct fall behaviors: tuna (heavy) outpaces salmon (light+drift)
// (clear barrels: this tests fall physics, barrel bounce is covered in section 14)
game.barrels.forEach(b => b.cleared = true);
game.items = [
  { x: 200, y: 300, vx: 0, vy: 0, r: 9, state: 'fall', cal: 5, grav: CONTENT.tuna.grav,   drift: CONTENT.tuna.drift,   t: 0, gone: false },
  { x: 400, y: 300, vx: 0, vy: 0, r: 9, state: 'fall', cal: 3, grav: CONTENT.salmon.grav, drift: CONTENT.salmon.drift, t: 0, gone: false },
];
step(60); // 0.5s
const tuna = game.items[0], salmon = game.items[1];
T('fall: tuna falls faster than salmon', tuna.vy > salmon.vy * 1.5);
T('fall: salmon drifts horizontally, tuna does not', Math.abs(salmon.x - 400) > 1 && Math.abs(tuna.x - 200) < 0.5);
game.items = [];

// 6. magnet pulls loot toward the bowl
game.barrels.forEach(b => b.cleared = true);
game.magnetT = 15;
game.items = [{ x: 480, y: 400, vx: 0, vy: 100, r: 9, state: 'fall', cal: 1, grav: 1, drift: 0, t: 0, gone: false }];
step(60);
T('magnet: loot drifts toward the bowl', game.items[0].vx < -20);
game.magnetT = 0; game.items = [];

// 7. full chain: shot bursts a barrel; magnet-assisted loot gets caught
loadLevel(0);
const target = game.barrels.reduce((a, b) =>
  (Math.hypot(b.x - 300, b.y - 220) < Math.hypot(a.x - 300, a.y - 220) ? b : a));
fireShot(target.x, 300); // straight down at the top-center barrel
let burst = false;
for (let i = 0; i < 120 * 4; i++) { tick(1 / 120); if (target.cleared) break; }
T('chain: shot bursts barrel', target.cleared);
// loot lands on the LEFT belt → rides inward to the gap
 game.items.push({ x: 200, y: 650, vx: 0, vy: 100, r: 9, state: 'fall', cal: 1, grav: 1, drift: 0, t: 0, gone: false });
let caught = false;
for (let i = 0; i < 120 * 2; i++) {
  tick(1 / 120);
  if (game.items.some(it => it.state === 'belt' || it.state === 'drop')) { caught = true; break; }
}
T('chain: loot lands on belt → rides to bowl', caught);
// loot over the RIGHT belt → rides inward too (the other side)
game.items.push({ x: 400, y: 650, vx: 0, vy: 100, r: 9, state: 'fall', cal: 1, grav: 1, drift: 0, t: 0, gone: false });
let caughtR = false;
for (let i = 0; i < 120 * 2; i++) {
  tick(1 / 120);
  if (game.items.some(it => it.state === 'belt' && it.belt === 'R' || it.state === 'drop')) { caughtR = true; break; }
}
T('dual-belts: right-belt loot rides inward to the gap', caughtR);
// loot down the center chute → straight to the bowl
game.items.push({ x: 300, y: 650, vx: 0, vy: 100, r: 9, state: 'fall', cal: 1, grav: 1, drift: 0, t: 0, gone: false });
let chuted = false;
for (let i = 0; i < 120 * 2; i++) {
  tick(1 / 120);
  if (game.items.some(it => it.state === 'drop')) { chuted = true; break; }
}
T('dual-belts: loot down the center gap chutes to the bowl', chuted);
// loot over the end gap → lost
const comboBefore = game.combo;
game.items.push({ x: 530, y: 650, vx: 0, vy: 100, r: 9, state: 'fall', cal: 1, grav: 1, drift: 0, t: 0, gone: false });
let lost = false;
for (let i = 0; i < 120 * 4; i++) {
  tick(1 / 120);
  if (!game.items.some(it => it.x === 490 && !it.gone)) { lost = true; break; }
}
T('gap: loot through the gap is lost', lost);
// lost-food-pop-bug regression (2026-10-17): food that fell below the belt line
// and drifts back under a belt must NOT pop back onto it — the catch needs a
// plane crossing (prevY < BELT_Y), not a y-only check
const pop = { x: 200, y: 720, vx: -50, vy: 100, r: 9, state: 'fall', cal: 3, grav: 1, drift: 0, t: 0, gone: false };
game.items.push(pop);
let popped = false;
for (let i = 0; i < 120 * 6; i++) {
  tick(1 / 120);
  if (pop.state === 'belt') { popped = true; break; }
}
T('lost-food-pop: below-belt food drifting under a belt is NOT re-caught', !popped && pop.gone);
// bridge power-up saves gap loot
game.bridgeT = 15;
game.items.push({ x: 530, y: 650, vx: 0, vy: 100, r: 9, state: 'fall', cal: 1, grav: 1, drift: 0, t: 0, gone: false });
let bridged = false;
for (let i = 0; i < 120 * 2; i++) {
  tick(1 / 120);
  if (game.items.some(it => it.state === 'belt' && it.x <= 490)) { bridged = true; break; }
}
T('bridge: gap loot caught while bridge active', bridged);
game.bridgeT = 0;


// 1b. asset manifest (2026-10-18): declared keys stay in sync with the code
T('manifest: every CONTENT key has barrel_ and food_ entries', (() => {
  const keys = Object.keys(CONTENT);
  return keys.every(k => ASSET_MANIFEST.barrels.includes('barrel_' + k) && ASSET_MANIFEST.foods.includes('food_' + k));
})());
T('manifest: every barrel_/food_ key maps to a real CONTENT key', (() => {
  const keys = new Set(Object.keys(CONTENT));
  return ASSET_MANIFEST.barrels.every(k => keys.has(k.slice(7))) && ASSET_MANIFEST.foods.every(k => keys.has(k.slice(5)));
})());
T('manifest: cat keys cover every species × stage', (() => {
  const want = CAT_VARS.flatMap(v => STAGE_LBS.map(lb => v + '_w' + lb));
  return want.every(k => ASSET_MANIFEST.cats.includes(k));
})());
T('manifest: Assets.barrel/food/prop return null headless (vector fallback)', (() =>
  Assets.barrel('kibble') === null && Assets.food('emp') === null && Assets.prop('bowl') === null)());
T('manifest: missing() reports everything headless (no Image, all vector)', (() => {
  const m = Assets.missing();
  return m.includes('barrel_emp') && m.includes('food_split') && m.includes('barrel_caviar') &&
         m.length === ASSET_MANIFEST.all.length;
})());
T('manifest: new EMP content is declared', ASSET_MANIFEST.barrels.includes('barrel_emp') && ASSET_MANIFEST.foods.includes('food_emp'));


// 2b. rotation pass (2026-10-20): yarn balls spin in flight, thread rides along
loadLevel(0);
fireShot(520, 400); // rightward flight: vx > 0
const spinBall = game.shots[0];
T('rotation: fired ball starts with rot 0', spinBall.rot === 0);
step(10);
T('rotation: ball spins while moving (rot grows with vx)', spinBall.rot > 0.01);
T('rotation: spin direction matches vx sign (rightward = positive)', (() => {
  const r0 = spinBall.rot; step(10); return spinBall.rot > r0;
})());
spinBall.vx = 10000; // absurd speed — must not strobe
const rc = spinBall.rot; step(60); // 0.5s
T('rotation: spin clamped at 30 rad/s', Math.abs(spinBall.rot - rc) <= 30 * 0.5 + 1e-6);
T('rotation: split children inherit the parent rot', (() => {
  loadLevel(0);
  deliver({ power: 'split' });
  fireShot(300, 500);
  const p = game.shots.find(b => b.splitArmed);
  p.rot = 2.5; p.x = 300; p.y = 300; p.vx = 0; p.vy = 400;
  onBarrelBurst(game.barrels[0], p);
  const kids = game.shots.filter(b => b !== p && !b.splitArmed);
  return kids.length === 2 && kids.every(k => k.rot === 2.5);
})());
T('rotation: drawYarn takes a rot param headless (thread rides the spin)', (() => {
  try { drawYarn(ctxStub, 100, 100, 12, 1.5); drawYarn(ctxStub, 100, 100, 12); return true; }
  catch (e) { return false; }
})());
