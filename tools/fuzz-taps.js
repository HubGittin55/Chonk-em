'use strict';
/* Multi-tap freeze fuzz: simulates rapid/impatient taps (including taps during
   ball flight) across several levels, watching for stuck shots, exceptions,
   or states where the game stops progressing. Run: node tools/fuzz-taps.js */

const fs = require('fs'), vm = require('vm'), path = require('path');

const ctxStub = new Proxy({ canvas: {} }, {
  get(t, k) { if (k in t) return t[k]; return (...a) => ctxStub; },
  set(t, k, v) { t[k] = v; return true; },
});
const handlers = {};
const elStub = () => ({
  addEventListener: (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); },
  classList: { add: () => {}, remove: () => {} },
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
  keys: () => [...lsStore.keys()],
};
Object.keys = ((orig) => (o) => o === global.localStorage ? [...lsStore.keys()] : orig(o))(Object.keys);

const root = path.join(__dirname, '..');
const files = ['audio', 'physics', 'levels', 'barrels', 'conveyor', 'vacuum', 'catphysics', 'cats', 'input', 'fx', 'main'];
const src = files.map(f => fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8')).join('\n');
vm.runInThisContext(src, { filename: 'chonk.bundle.js' });

// synthetic pointer events
let pid = 1;
function tap(x, y, holdMs = 30) {
  const id = pid++;
  const ev = (type) => ({ type, pointerId: id, clientX: x, clientY: y, preventDefault: () => {} });
  for (const fn of (handlers.pointerdown || [])) fn(ev('pointerdown'));
  step(Math.max(1, Math.round(holdMs / 1000 * 120)));
  for (const fn of (handlers.pointerup || [])) fn(ev('pointerup'));
}
const step = (n) => { for (let i = 0; i < n; i++) tick(1 / 120); };

let stuckShots = 0, exceptions = 0, stuckAim = 0, levelsPlayed = 0;
const rand = (a, b) => a + Math.random() * (b - a);

for (const lvl of [0, 3, 5, 8, 11, 20, 40]) {
  loadLevel(lvl); levelsPlayed++;
  game.menuOpen = false;
  let ticks = 0;
  const maxTicks = 120 * 240; // 4 minutes of game time per level, plenty
  while (ticks < maxTicks && !game.over) {
    try {
      // impatient player: tap to shoot, then keep tapping DURING flight
      if (!game.shots.length && game.balls > 0) {
        tap(rand(100, 500), rand(300, 700), rand(10, 80));
        // mash 0-4 extra taps while the ball is (maybe) in flight
        const mashes = Math.floor(rand(0, 5));
        for (let m = 0; m < mashes; m++) { tap(rand(100, 500), rand(300, 700), rand(5, 40)); }
      }
      step(30); ticks += 30;
      // stuck-shot watchdog: no ball may live longer than ~16s of game time
      for (const s of game.shots) {
        if (s.life > 16) { stuckShots++; console.log(`  STUCK BALL lvl ${lvl + 1}: life=${s.life.toFixed(1)} x=${s.x.toFixed(0)} y=${s.y.toFixed(0)}`); s.life = 999; }
      }
      // input watchdog: balls left, nothing in flight, level not over, but can't aim for 5s
      if (!game.shots.length && game.balls > 0 && !game.over) {
        // canAim is the input hook's gate; replicate it
        const canAim = !game.over && !game.menuOpen && !game.shots.length && game.balls > 0;
        if (!canAim) { stuckAim++; console.log(`  STUCK AIM lvl ${lvl + 1}`); break; }
      }
    } catch (e) { exceptions++; console.log(`  EXCEPTION lvl ${lvl + 1}: ${e.message}`); break; }
  }
  console.log(`level ${lvl + 1}: ${game.over ? 'ended' : 'TIMEOUT'} after ${(ticks / 120).toFixed(0)}s, balls left ${game.balls}`);
}

console.log(`\nlevels: ${levelsPlayed}, stuck balls: ${stuckShots}, stuck aim: ${stuckAim}, exceptions: ${exceptions}`);
process.exit(stuckShots || stuckAim || exceptions ? 1 : 0);
