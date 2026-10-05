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
  textContent: '', style: {}, width: 0, height: 0,
  getContext: () => ctxStub,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 900 }),
  setPointerCapture: () => {},
});
global.document = { getElementById: () => elStub() };
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
const files = ['audio', 'physics', 'levels', 'barrels', 'conveyor', 'cats', 'input', 'main'];
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
T('boot: level 1 loads with 13 barrels (incl. 2 power)', game.barrels.length === 13 && game.balls === 10);
T('boot: power barrels present', game.barrels.some(b => b.kind === 'power' && b.content === 'wide') &&
  game.barrels.some(b => b.kind === 'power' && b.content === 'multi'));

// 2. single shot
fireShot(300, 500);
T('fire: single shot spawns 1 ball, spends 1 yarn', game.shots.length === 1 && game.balls === 9);
step(1200); // 10s: ball bursts the center column, then falls out
T('fire: ball dies out cleanly', game.shots.length === 0);

// 3. multi-yarn shot (fresh level: test 2's center-column run may have won the level)
loadLevel(0);
game.multiShots = 1;
fireShot(300, 500);
T('multi: fires 3 balls, spends 3 yarn', game.shots.length === 3 && game.balls === 7);
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
game.magnetT = 15;
game.items = [{ x: 480, y: 400, vx: 0, vy: 100, r: 9, state: 'fall', cal: 1, grav: 1, drift: 0, t: 0, gone: false }];
step(60);
T('magnet: loot drifts toward the bowl', game.items[0].vx < -20);
game.magnetT = 0; game.items = [];

// 7. full chain: shot bursts a barrel; magnet-assisted loot gets caught
loadLevel(0);
const target = game.barrels.find(b => b.x === 300 && b.y === 200);
fireShot(300, 300); // straight down at center column
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
// loot over the gap → lost
const comboBefore = game.combo;
game.items.push({ x: 490, y: 650, vx: 0, vy: 100, r: 9, state: 'fall', cal: 1, grav: 1, drift: 0, t: 0, gone: false });
let lost = false;
for (let i = 0; i < 120 * 4; i++) {
  tick(1 / 120);
  if (!game.items.some(it => it.x === 490 && !it.gone)) { lost = true; break; }
}
T('gap: loot through the gap is lost', lost);
// bridge power-up saves gap loot
game.bridgeT = 15;
game.items.push({ x: 490, y: 650, vx: 0, vy: 100, r: 9, state: 'fall', cal: 1, grav: 1, drift: 0, t: 0, gone: false });
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
game.calories = 11; game.stageMisses = 0; game.stageVeggies = 0;
const ballsBefore = game.balls;
deliver({ cal: 1 }); // clean stage-up → FEAST FRENZY
T('frenzy: clean stage-up triggers FEAST FRENZY (+2 yarn, 0.35× time)',
  game.frenzy === 6 && game.balls === ballsBefore + 2 && game.timeScale === 0.35);
step(60);
T('chonk-stages: body width eases toward weight-based target (not instant)',
  game.displayRx > catRx(0) && game.displayRx < catRx(chonkT(game.weightLb)));
T('saves: best stars persisted to localStorage', lsStore.has('chonk-em:best'));
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
T('levels: bounds + 56px spacing respected in every layout', LEVELS.every(L => {
  for (let a = 0; a < L.barrels.length; a++) {
    const ba = L.barrels[a];
    if (ba.x < 62 || ba.x > 538 || ba.y < 180 || ba.y > 620) return false;
    for (let b = a + 1; b < L.barrels.length; b++) {
      if (Math.hypot(ba.x - L.barrels[b].x, ba.y - L.barrels[b].y) < 56) return false;
    }
  }
  return true;
}));
T('levels: calorie budget winnable (combo-aware effective cal >= 1.5x goal)', LEVELS.every(L => {
  // model real play: clean deliveries ramp the combo multiplier 1,1,1,2,2,2,3,3,3,4...
  const cals = L.barrels.filter(b => b.kind === 'snack').map(b => CONTENT[b.content].cal).sort((a, b) => a - b);
  let eff = 0;
  cals.forEach((c, i) => { eff += c * Math.min(4, 1 + Math.floor(i / 3)); });
  return eff >= L.goal * 1.5;
}));
T('levels: goals scale 8→52', LEVELS.map(L => L.goal).join() === '8,12,16,20,24,28,30,34,38,30,32,52');

// 10. win path
game.calories = game.level.goal; // ensure threshold
game.over = null;
deliver({ cal: 1 });
T('win: reaching goal ends level with win', game.over === 'win');

// 11. weight system + wobble v2 (stunkus full-chonk pass)
loadLevel(0);
const w0 = game.weightLb;
deliver({ cal: 5 });
T('weight: snack deliveries add pounds to lifetime weight', game.weightLb === w0 + 5 * LB_PER_CAL);
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
