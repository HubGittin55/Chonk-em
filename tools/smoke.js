'use strict';
/* CHONK'EM headless smoke test — run: node tools/smoke.js [--only=core,save]
   Stubs the browser, boots the game, drives tick() manually, asserts behaviors.
   Suites live in tools/smoke/*.js and share the harness globals (T, step, ctxStub, game, ...). */

const harness = require('./smoke/harness.js');

const suites = {
  core: 'core.js',           // boot, shots, power-ups, fall physics, magnet, chains
  systems: 'systems.js',     // combo/frenzy/jiggle systems, win path, weight + wobble
  levels: 'levels.js',       // level pack, level-gen content, v0.4 level features
  barrels: 'barrels.js',     // barrel types, vacuum hazard, food physics, movers
  catphysics: 'catphysics.js', // cat stages, CatPhysics integration, face/aliveness draw
  save: 'save.js',           // save schema v2 — versioned profile + migration
  ui: 'ui.js',               // weigh-in ceremony, music loader, daily challenge, menu
};

let names = Object.keys(suites);
const onlyArg = process.argv.find(a => a.startsWith('--only='));
if (onlyArg) {
  const wanted = onlyArg.slice('--only='.length).split(',').map(s => s.trim()).filter(Boolean);
  names = names.filter(n => wanted.includes(n));
  if (!names.length) { console.error('unknown suite(s): ' + wanted.join(',')); process.exit(2); }
}

console.log('CHONK-EM smoke test (v0.2 contents-full)' + (onlyArg ? ' [' + names.join(',') + ']' : ''));
for (const n of names) require('./smoke/' + suites[n]);
harness.finish();
