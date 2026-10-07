'use strict';
/* CHONK'EM headless smoke test — run: node tools/smoke.js
   Stubs the browser, boots the game, drives tick() manually, asserts v0.2 content behaviors. */

const fs = require('fs'), vm = require('vm'), path = require('path');

// ---------- browser stubs ----------
const ctxStub = new Proxy({ canvas: {} }, {
  get(t, k) { if (k in t) return t[k]; return (...a) => ctxStub; },
  set(t, k, v) { t[k] = v; return true; },
});
const elStub = () => ({
  addEventListener: () => {}, classList: { add: () => {}, remove: () => {} },
  textContent: '', innerHTML: '', style: {}, width: 0, height: 0,
  getContext: () => ctxStub,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 900 }),
  setPointerCapture: () => {}, appendChild: () => {}, click: () => {},
});
global.document = { getElementById: () => elStub(), createElement: () => elStub() };
global.window = { addEventListener: () => {}, devicePixelRatio: 1 };
global.requestAnimationFrame = () => {};
global.CanvasRenderingContext2D = function () {};
const lsStore = new Map();
global.localStorage = {
  getItem: (k) => (lsStore.has(k) ? lsStore.get(k) : null),
  setItem: (k, v) => lsStore.set(k, String(v)),
  removeItem: (k) => lsStore.delete(k),
};

// ---------- boot the game ----------
const root = path.join(__dirname, '..');
const files = ['audio', 'physics', 'levels', 'barrels', 'conveyor', 'vacuum', 'cats', 'input', 'main'];
const src = files.map(f => fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8')).join('\n');
vm.runInThisContext(src, { filename: 'chonk.bundle.js' });

// ---------- test kit ----------
let pass = 0, fail = 0;
function T(name, cond) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}
const step = (n) => { for (let i = 0; i < n; i++) tick(1 / 120); };

console.log('CHONK-EM smoke test (v0.2 contents-full)');

// 1. boot
T('boot: level 1 loads with 61 barrels (r=10)', game.barrels.length === 61 && game.balls === 37 && game.barrels.every(b => b.r === 10));
T('boot: split power barrel present (guaranteed)', game.barrels.some(b => b.kind === 'power' && b.content === 'split'));

// 2. single shot
fireShot(300, 500);
T('fire: single shot spawns 1 ball, spends 1 yarn', game.shots.length === 1 && game.balls === 36);
step(1200); // 10s: ball bursts the center column, then falls out
T('fire: ball dies out cleanly', game.shots.length === 0);

// 3. multi-yarn shot (fresh level: test 2's center-column run may have won the level)
loadLevel(0);
game.multiShots = 1;
fireShot(300, 500);
T('multi: fires 3 balls, spends 3 yarn', game.shots.length === 3 && game.balls === 34);
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
// loot lands on belt left of the gap → rides
 game.items.push({ x: 300, y: 650, vx: 0, vy: 100, r: 9, state: 'fall', cal: 1, grav: 1, drift: 0, t: 0, gone: false });
let caught = false;
for (let i = 0; i < 120 * 2; i++) {
  tick(1 / 120);
  if (game.items.some(it => it.state === 'belt' || it.state === 'drop')) { caught = true; break; }
}
T('chain: loot lands on belt → rides to bowl', caught);
// loot over the end gap → lost
const comboBefore = game.combo;
game.items.push({ x: 530, y: 650, vx: 0, vy: 100, r: 9, state: 'fall', cal: 1, grav: 1, drift: 0, t: 0, gone: false });
let lost = false;
for (let i = 0; i < 120 * 4; i++) {
  tick(1 / 120);
  if (!game.items.some(it => it.x === 490 && !it.gone)) { lost = true; break; }
}
T('gap: loot through the gap is lost', lost);
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

// 8. stunkus systems: combo multiplier, frenzy, jiggle, eased body, shotsFired, mute
loadLevel(0);
deliver({ cal: 1 }); deliver({ cal: 1 }); deliver({ cal: 1 }); deliver({ cal: 1 });
T('combos: after 3 clean deliveries, 4th+ earns ×2 calories', game.combo === 4 && game.mult === 2);
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

// 9. level pack (levels 2-12; 2-6 drafted by qwen-fast, 7-12 by stunkus, validated here)
T('levels: 12 levels ship', LEVELS.length === 12);
T('v0.4 levels: 60-125 barrels, growing by tier', LEVELS.every((L, i) =>
  L.barrels.length >= 60 && L.barrels.length <= 125 &&
  (i < 4 ? L.barrels.length <= 84 : L.barrels.length >= 84)));
T('v0.4 levels: tight hex spacing respected (min dist >= 25px, in bounds)', LEVELS.every(L => {
  for (let a = 0; a < L.barrels.length; a++) {
    const ba = L.barrels[a];
    if (ba.x < 40 || ba.x > 560 || ba.y < 130 || ba.y > 680) return false;
    for (let b = a + 1; b < L.barrels.length; b++) {
      if (Math.hypot(ba.x - L.barrels[b].x, ba.y - L.barrels[b].y) < 25) return false;
    }
  }
  return true;
}));
T('v0.4 levels: barrels are r=10', LEVELS.every(L => L.r === 10));
T('v0.4 levels: layout symmetric about x=300', LEVELS.every(L =>
  L.barrels.every(ba => L.barrels.some(bb => Math.abs(bb.x - (600 - ba.x)) < 2 && Math.abs(bb.y - ba.y) < 2))));
T('v0.4 levels: goal <= 65% of RAW snack calories (winnable with zero combo)', LEVELS.every(L => {
  const raw = L.barrels.reduce((t, b) => t + (b.kind === 'snack' ? CONTENT[b.content].cal : 0), 0);
  return L.goal <= raw * 0.65;
}));
T('v0.4 levels: balls = 60% of barrel count', LEVELS.every(L => L.balls === Math.round(L.barrels.length * 0.6)));
T('levels: calorie budget winnable (combo-aware effective cal >= 1.5x goal)', LEVELS.every(L => {
  // model real play: clean deliveries ramp the combo multiplier 1,1,1,2,2,2,3,3,3,4...
  const cals = L.barrels.filter(b => b.kind === 'snack').map(b => CONTENT[b.content].cal).sort((a, b) => a - b);
  let eff = 0;
  cals.forEach((c, i) => { eff += c * Math.min(4, 1 + Math.floor(i / 3)); });
  return eff >= L.goal * 1.5;
}));
T('v0.4 levels: goals are the 60%-of-raw set', LEVELS.map(L => L.goal).join() === '35,37,39,42,44,47,49,51,54,56,59,61');

// 10. win path
game.calories = game.level.goal; // ensure threshold
game.over = null;
deliver({ cal: 1 });
T('win: reaching goal ends level with win', game.over === 'win');
T('saves: best stars persisted to localStorage', lsStore.has('chonk-em:best'));

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
T('weight: weight persists to localStorage', lsStore.get('chonk-em:weight') === String(game.weightLb));
const w1 = game.weightLb;
deliver({ cal: -2 });
T('weight: veggies never slim the cat', game.weightLb === w1);
T('wobble: delivery kicks cheek and tail springs too', game.wob.cheek.v > 0 && game.wob.tail.v > 0);
loadLevel(0);
wobbleImpulse('belly', 4);
step(1);
const kicked = Math.abs(game.wob.belly.x) > 0;
step(600);
T('wobble: belly spring oscillates then settles near rest',
  kicked && Math.abs(game.wob.belly.x) < 0.05 && Math.abs(game.wob.belly.v) < 0.05);

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
game.vacuum.x = 300; game.vacuum.dir = 1;
game.items.push({ x: 300, y: 700, vx: 0, vy: 0, r: 9, state: 'fall', cal: 3, t: 0, gone: false });
game.items.push({ x: 320, y: 700, vx: 0, vy: 0, r: 9, state: 'belt', cal: 5, t: 0, gone: false });
const farItem = { x: 550, y: 700, vx: 0, vy: 0, r: 9, state: 'belt', cal: 3, t: 0, gone: false };
game.items.push(farItem);
const eaten0 = game.vacuum.eaten;
step(60);
T('vacuum: hoovers nearby fall + belt loot', game.vacuum.eaten >= eaten0 + 2);
T('vacuum: ignores distant loot', !farItem.gone);
T('vacuum: only 3 of 12 levels flagged', LEVELS.filter(L => L.vacuum).length === 3);
T('vacuum: tuned down (suck 55 / eat 20 / 2 per shot)', Vacuum.SUCK_R === 55 && Vacuum.EAT_R === 20 && Vacuum.MEAL === 2);
T('vacuum: two-item limit per shot', (() => {
  loadLevel(5);
  game.vacuum.x = 300; game.vacuum.eatenThisShot = 0;
  for (const dx of [-10, 0, 10]) game.items.push({ x: 300 + dx, y: 735, vx: 0, vy: 0, r: 9, state: 'fall', cal: 3, t: 0, gone: false });
  const e0 = game.vacuum.eaten;
  step(90);
  const eatenNow = game.vacuum.eaten - e0;
  const leftover = game.items.filter(i => !i.gone).length;
  return eatenNow === 2 && leftover === 1;
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
step(60); // 0.5s — slow springs should still be wobbling hard
T('cat: slow wobble still oscillating at 0.5s (lazy jiggle)', Math.abs(game.wob.belly.x) > 0.05);
T('cat: sub-belly lags the main spring', Math.abs(game.wob.sub.x) > 0.001);
step(1200);
T('cat: wobble settles eventually', Math.abs(game.wob.belly.x) < 0.05 && Math.abs(game.wob.belly.v) < 0.05);

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

// 18. v0.4 features
T('v0.4: menu API exists and boots open', typeof showMenu === 'function' && typeof hideMenu === 'function' && game.menuOpen === true);
T('v0.4: ~50% of barrels are dry (empty/steel/keg/bumper, no loot flood)', LEVELS.every(L => {
  const e = L.barrels.filter(b => ['empty', 'steel', 'keg', 'bumper'].includes(b.kind)).length;
  return Math.abs(e - L.barrels.length / 2) <= 4;
}));
T('v0.4: empty barrel burst spawns no item', (() => {
  loadLevel(0);
  const before = game.items.length;
  const eb = game.barrels.find(b => b.kind === 'empty');
  onBarrelBurst(eb, null);
  return game.items.length === before;
})());
T('v0.4: difficulty setting scales balls and goal', (() => {
  store.set('difficulty', 'hard'); loadLevel(0);
  const ok = game.goalNow === Math.round(LEVELS[0].goal * 1.2) && game.balls === Math.round(LEVELS[0].balls * 0.8);
  store.set('difficulty', 'normal'); loadLevel(0);
  return ok;
})());
T('v0.4: vacuum drawn after the main cat (never hidden)', (() => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'main.js'), 'utf8');
  return src.indexOf('Vacuum.draw(ctx, game.vacuum); // after the cat') > src.indexOf('Cats.drawMain(ctx, 252, 806');
})());
T('v0.4: vacuum cannot steal from the bowl chute', (() => {
  const v = Vacuum.create(1);
  const it = { x: 100, y: 720, vx: 0, vy: 0, r: 9, state: 'belt', cal: 3, gone: false };
  v.x = 100;
  Vacuum.tick(v, 1 / 60, [it], () => {});
  return !it.gone && !it.sucked;
})());
T('tiers: 100 levels, exotic every 5 (L1:5cal … L100:100cal)',
  NUM_LEVELS === 100 && tierMaxCal(1) === 5 && tierMaxCal(5) === 10 && tierMaxCal(10) === 15 && tierMaxCal(100) === 100 &&
  tierExotic(10) === 'caviar' && tierExoticName(50) === 'King Crab');
T('tiers: handcrafted 1-12 respect tier max cal', (() => {
  for (let i = 0; i < 12; i++) {
    const mc = tierMaxCal(i + 1);
    for (const b of getLevel(i).barrels)
      if (b.kind === 'snack' && (CONTENT[b.content] || {}).cal > mc) return false;
  }
  return true;
})());
T('curve: 80lb impossible on L10, reachable ~L50, 130+ on L100', (() => {
  const maxLb = n => 5 + 0.3 * getLevel(n - 1).barrels
    .filter(b => b.kind === 'snack').reduce((a, b) => a + CONTENT[b.content].cal, 0);
  return maxLb(10) < 40 && maxLb(50) >= 75 && maxLb(50) <= 90 && maxLb(100) >= 130;
})());
T('curve: tier exotic present on 10/25/50/100', [10, 25, 50, 100].every(n =>
  getLevel(n - 1).barrels.some(b => b.kind === 'snack' && b.content === tierExotic(n))));
T('steel: unbreakable — ball bounces, barrel stands', (() => {
  loadLevel(11);
  const st = game.barrels.find(b => b.kind === 'steel');
  if (!st) return false;
  const ball = { x: st.x, y: st.y - 16, vx: 0, vy: 300, r: 8, life: 0, slowT: 0, bounces: 0 };
  let special = null;
  Physics.stepBall(ball, 1 / 60, game.barrels, () => {}, () => {}, k => { special = k; });
  return !st.cleared && special === 'steel' && ball.bounces > 0;
})());
T('bumper: power bounce + combo, never breaks', (() => {
  loadLevel(11);
  const bu = game.barrels.find(b => b.kind === 'bumper');
  if (!bu) return false;
  const c0 = game.combo;
  const ball = { x: bu.x, y: bu.y - 16, vx: 0, vy: 200, r: 8, life: 0, slowT: 0, bounces: 0 };
  Physics.stepBall(ball, 1 / 60, game.barrels, () => {}, () => {}, onBarrelSpecial);
  return !bu.cleared && game.combo === c0 + 1 && Math.hypot(ball.vx, ball.vy) > 200;
})());
T('keg: explodes neighbors, steel immune, chains', (() => {
  loadLevel(0);
  game.barrels.forEach(b => { b.cleared = true; });
  const mk = (x, kind, content) => ({ x, y: 400, r: 10, kind, content: content || null, cleared: false });
  const keg = mk(300, 'keg'), snack = mk(340, 'snack', 'kibble'), steel = mk(360, 'steel'), far = mk(500, 'snack', 'kibble');
  game.barrels.push(keg, snack, steel, far);
  const items0 = game.items.length;
  keg.cleared = true; onBarrelBurst(keg, null);
  const ok = snack.cleared && !steel.cleared && !far.cleared && game.items.length > items0;
  game.barrels = game.barrels.filter(b => ![keg, snack, steel, far].includes(b));
  return ok;
})());
T('gen: deterministic + symmetric + sane size', (() => {
  const a = JSON.stringify(genLevel(50)), b = JSON.stringify(genLevel(50));
  if (a !== b) return false;
  const bs = getLevel(49).barrels, set = new Set(bs.map(x => x.x + ',' + x.y));
  return bs.every(x => set.has((600 - x.x) + ',' + x.y)) && bs.length >= 60 && bs.length <= 115;
})());
T('gen: procedural levels include steel/keg/bumper', (() => {
  const kinds = new Set(getLevel(49).barrels.map(b => b.kind));
  return kinds.has('steel') && kinds.has('keg') && kinds.has('bumper');
})());
T('weigh: stars are weight-based (1 win / 2 @75% / 3 @90% of level food)', (() => {
  loadLevel(0);
  const L = game.level, max = START_LB + LB_PER_CAL * rawCal(L);
  return starsFor(START_LB + 0.95 * (max - START_LB), L) === 3 &&
         starsFor(START_LB + 0.8 * (max - START_LB), L) === 2 &&
         starsFor(START_LB + 0.1 * (max - START_LB), L) === 1;
})());
T('weigh: ceremony runs needle to target and fires finale', (() => {
  loadLevel(0);
  game.weightLb = 20; game.calories = 40; game.maxCombo = 3;
  endGame(true);
  const w = game.weigh;
  if (!w || w.target !== 20) return false;
  for (let i = 0; i < 300; i++) updateWeigh(1 / 60);
  return Math.abs(w.shown - 20) < 0.05 && w.finale === true;
})());
T('weigh: trombone + fanfare synths exist', typeof AudioSys.trombone === 'function' && typeof AudioSys.fanfare === 'function');
T('unlocks: species gated by total stars (never spent)', (() => {
  store.set('best', { 0: { stars: 3 }, 1: { stars: 3 }, 2: { stars: 2 } }); // 8 total
  const t = totalStars();
  store.set('cat', 3);
  const sel = selectedCat(); // calico locked at 8 stars -> falls back to tabby
  store.set('cat', 1);
  const sel2 = selectedCat(); // orange unlocked at 8
  const ok = t === 8 && catUnlocked(0) && catUnlocked(1) && !catUnlocked(2) && !catUnlocked(3) && sel === 0 && sel2 === 1;
  store.set('best', {}); store.set('cat', 0);
  return ok;
})());
T('unlocks: loadLevel uses the picked species', (() => {
  store.set('best', { 0: { stars: 3 }, 1: { stars: 3 }, 2: { stars: 2 } });
  store.set('cat', 1);
  loadLevel(0);
  const v = game.catVar;
  store.set('best', {}); store.set('cat', 0);
  return v === 1;
})());
T('v0.4: conveyor has 60px gaps on BOTH sides (symmetric)', (() => {
  const nb = (x) => Conveyor.onBelt(x, false);
  return !nb(50) && nb(100) && nb(300) && nb(500) && !nb(550) &&
         Conveyor.onBelt(50, true) && Conveyor.onBelt(550, true);
})());
T('v0.4: conveyor slats run left with the food', (() => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'conveyor.js'), 'utf8');
  return src.includes('40 - (this.t * this.SPEED) % 40');
})());

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
