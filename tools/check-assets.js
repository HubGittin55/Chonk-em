'use strict';
/* Asset gap report for the sprite pipeline (Qwen).
   Run: node tools/check-assets.js
   Compares the declared manifest (js/assets.js) against assets/*.png on disk.
   Always exits 0 — it's a report, not a gate. */

const fs = require('fs'), path = require('path'), vm = require('vm');

const root = path.join(__dirname, '..');
const load = f => fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8');

// Headless sandbox: Image is undefined so the loader no-ops, but the manifest
// (which only needs CONTENT + the cat key vocabulary) still builds.
const sandbox = {
  console,
  Image: undefined,
  CAT_VARS: ['cat', 'orange', 'tuxedo', 'calico'],
  STAGE_LBS: [10, 20, 30, 40, 50, 60, 70, 80],
};
vm.createContext(sandbox);
vm.runInContext(load('barrels'), sandbox, { filename: 'barrels.js' });
vm.runInContext(load('assets'), sandbox, { filename: 'assets.js' });
// const/let don't land on the sandbox object — read the manifest back explicitly.
const M = vm.runInContext('ASSET_MANIFEST', sandbox);

const exists = k => fs.existsSync(path.join(root, 'assets', k + '.png'));
let totalMissing = 0;
for (const cat of ['props', 'barrels', 'foods', 'cats']) {
  const missing = M[cat].filter(k => !exists(k));
  totalMissing += missing.length;
  console.log(`\n## ${cat} — ${M[cat].length - missing.length}/${M[cat].length} present`);
  for (const k of missing) console.log('  MISSING  assets/' + k + '.png');
}

// Strays: files on disk the manifest doesn't declare (legacy / renamed).
const onDisk = fs.readdirSync(path.join(root, 'assets'))
  .filter(f => f.endsWith('.png')).map(f => f.slice(0, -4));
const stray = onDisk.filter(k => !M.all.includes(k));
if (stray.length) {
  console.log('\n## on disk but not in the manifest (stray/legacy)');
  for (const k of stray) console.log('  STRAY    assets/' + k + '.png');
}
console.log(`\n${totalMissing} missing of ${M.all.length} declared sprites.`);
