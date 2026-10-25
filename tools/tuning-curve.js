'use strict';
/* Tuning-curve calibration (2026-10-17 tuning deep-dive): headless check that the
   foodFactor curve (-10% food @ L20 → -50% @ L100) lands as specified across the
   campaign, Endless Climb, and the daily challenge — and that goals, balls, par
   and star thresholds stay sane everywhere.
   Run: node tools/tuning-curve.js (exit 1 on any invariant failure). */

const fs = require('fs'), vm = require('vm'), path = require('path');
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
  key: (i) => [...lsStore.keys()][i] ?? null,
  get length() { return lsStore.size; },
};
const root = path.join(__dirname, '..');
const src = ['audio', 'save', 'physics', 'levels', 'barrels', 'conveyor', 'vacuum',
  'catphysics', 'cats', 'input', 'fx', 'achievements', 'weighin', 'main']
  .map(f => fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8')).join('\n');
vm.runInThisContext(src, { filename: 'chonk.bundle.js' });

let fail = 0;
const check = (name, cond, detail) => {
  console.log((cond ? '  ok  ' : '  BAD ') + name + (detail ? ' — ' + detail : ''));
  if (!cond) fail++;
};
const food = L => L.barrels.filter(b => b.kind === 'snack').length;
const raw = L => L.barrels.filter(b => b.kind === 'snack')
  .reduce((a, b) => a + ((CONTENT[b.content] || {}).cal || 0), 0);

console.log('level | fm   | food | rawCal | goal | balls | par | vacuum');
const f13base = food(getLevel(12)); // unscaled early-curve baseline for the spec ratio
for (const n of [13, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]) {
  const L = getLevel(n - 1), f = food(L), r = raw(L), fm = foodFactor(n);
  console.log(`L${String(n).padStart(3)} | ${fm.toFixed(2)} | ${String(f).padStart(4)} | ${String(r).padStart(6)} | ${String(L.goal).padStart(4)} | ${String(L.balls).padStart(5)} | ${String(L.par).padStart(3)} | ${L.vacuum}`);
  // invariants
  check(`L${n}: raw tracks the scaled target`, Math.abs(r - Math.round(rawTarget(n) * fm)) <= 12, `raw=${r} target=${Math.round(rawTarget(n) * fm)}`);
  check(`L${n}: goal is 60% of raw`, L.goal === Math.round(r * 0.6), `goal=${L.goal} raw=${r}`);
  check(`L${n}: balls = 35% of food (min 8)`, L.balls === Math.max(8, Math.round(f * 0.35)), `balls=${L.balls} food=${f}`);
  check(`L${n}: par <= balls`, L.par <= L.balls);
  check(`L${n}: 1★ reachable below 2★ (goal < 80% raw)`, L.goal < r * 0.8, `goal=${L.goal} 80%raw=${Math.round(r * 0.8)}`);
  check(`L${n}: food floor holds`, f >= 8, `food=${f}`);
  check(`L${n}: food matches the spec ratio (f/f13 ≈ fm)`, Math.abs(f / f13base - fm) <= 0.15, `f=${f} f13=${f13base} fm=${fm}`);
}
// spec anchors: -10% @ L20, -50% @ L100 vs the unscaled L13 baseline
const f13 = food(getLevel(12)), f100 = food(getLevel(99));
check('spec: L100 food ≈ 50% of early-curve food', f100 <= f13 * 0.62 && f100 >= f13 * 0.38, `L13=${f13} L100=${f100}`);

console.log('\nendless depth | fm   | food | rawCal | goal | balls | vacuum');
let prevGoal = 0;
for (const d of [1, 5, 10, 20]) {
  const L = genEndlessLevel(d), f = food(L), r = raw(L), fm = foodFactor(100 + d);
  console.log(`depth ${String(d).padStart(2)} | ${fm.toFixed(2)} | ${String(f).padStart(4)} | ${String(r).padStart(6)} | ${String(L.goal).padStart(4)} | ${String(L.balls).padStart(5)} | ${L.vacuum}`);
  check(`endless d${d}: vacuum always on`, L.vacuum === true);
  check(`endless d${d}: goal climbs with depth`, L.goal > prevGoal, `goal=${L.goal}`);
  check(`endless d${d}: playable (balls, goal)`, L.balls >= 8 && L.goal > 0 && L.goal <= r);
  check(`endless d${d}: food trimmed by the extended curve`, f >= 8 && f <= 60, `food=${f}`);
  prevGoal = L.goal;
}

console.log('\ndaily challenge (sample week)');
for (const ds of ['20261011', '20261012', '20261013', '20261014', '20261015', '20261016', '20261017']) {
  const L = genDailyLevel(ds), f = food(L), r = raw(L);
  check(`daily ${ds}: playable`, L.balls >= 8 && L.goal > 0 && L.goal <= r && f >= 8, `food=${f} raw=${r} goal=${L.goal} balls=${L.balls}`);
}

console.log('\nhandcrafted 1-12 untouched by the curve');
check('L1 food unchanged', food(getLevel(0)) > 0 && getLevel(0).goal === 35, `goal=${getLevel(0).goal}`);

console.log(fail ? `\n${fail} INVARIANT(S) FAILED` : '\ncurve sane — all invariants hold');
process.exit(fail ? 1 : 0);
