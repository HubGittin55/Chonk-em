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
  key: (i) => [...lsStore.keys()][i] ?? null,
  get length() { return lsStore.size; },
};

// ---------- boot the game ----------
const root = path.join(__dirname, '..', '..'); // tools/smoke/ -> repo root
const files = ['audio', 'save', 'physics', 'levels', 'barrels', 'conveyor', 'vacuum', 'catphysics', 'cats', 'input', 'fx', 'weighin', 'main'];
const src = files.map(f => fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8')).join('\n');
vm.runInThisContext(src, { filename: 'chonk.bundle.js' });

// ---------- test kit ----------
let pass = 0, fail = 0;
function T(name, cond) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}
const step = (n) => { for (let i = 0; i < n; i++) tick(1 / 120); };
global.T = T; global.step = step; global.ctxStub = ctxStub; global.lsStore = lsStore; global.elStub = elStub;


function finish() {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
module.exports = { finish };
