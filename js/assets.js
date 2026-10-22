'use strict';
/* Sprite asset manifest (2026-10-18, roadmap P0 architecture).
   One declared list of every generated sprite the game can use, loaded here,
   with a fallback chain per category: specific → generic → vector renderer.
   A missing PNG is never a crash — check tools/check-assets.js for the gap
   report the asset pipeline (Qwen) works from.

   Load order: after barrels.js (CONTENT) and cats.js (CAT_VARS, STAGE_LBS). */

const ASSET_MANIFEST = {
  // hand-drawn-by-pipeline props
  props: ['bowl', 'yarn', 'shooter', 'kitchen_bg'],
  // one skin per barrel content key (barrel.js CONTENT)
  barrels: Object.keys(CONTENT).map(k => 'barrel_' + k),
  // one falling-loot sprite per content key
  foods: Object.keys(CONTENT).map(k => 'food_' + k),
  // 4 cat varieties × 8 chonk stages (10→80 lb)
  cats: CAT_VARS.flatMap(v => STAGE_LBS.map(lb => v + '_w' + lb)),
};
ASSET_MANIFEST.all = [...ASSET_MANIFEST.props, ...ASSET_MANIFEST.barrels,
                       ...ASSET_MANIFEST.foods, ...ASSET_MANIFEST.cats];

const Assets = {
  imgs: {},
  init() {
    if (typeof Image !== 'function') return; // headless: everything falls back to vector
    for (const k of ASSET_MANIFEST.all) {
      const im = new Image();
      im.src = 'assets/' + k + '.png';
      this.imgs[k] = im;
    }
  },
  ok(k) { // readable on disk: complete with real pixels
    const im = this.imgs[k];
    return !!(im && im.complete && im.naturalWidth > 0);
  },
  img(k) { return this.ok(k) ? this.imgs[k] : null; }, // null-safe: null means "draw vector"
  prop(name) { return this.img(name); },
  barrel(content) { return this.img('barrel_' + content); }, // no generic barrel skin exists yet — vector fallback
  food(content) { return this.img('food_' + content); },
  missing() { return ASSET_MANIFEST.all.filter(k => !this.ok(k)); },
  missingByCategory() {
    const out = {};
    for (const cat of ['props', 'barrels', 'foods', 'cats'])
      out[cat] = ASSET_MANIFEST[cat].filter(k => !this.ok(k));
    return out;
  },
};
Assets.init();

// Generated cat sprites (Qwen Image 2.1 turbo pipeline, alpha PNGs).
// If any sprite is missing the vector renderer takes over (asset 404 safe).
// Reuses the Assets loader above — one Image object per sprite, no double fetch.
const Sprites = {
  imgs: [],
  ready: 0,
  init() {
    if (typeof Image !== 'function') return; // headless: imgs stays [], ok() is false
    this.imgs = CAT_VARS.map(v => STAGE_LBS.map(lb => {
      const im = Assets.imgs[v + '_w' + lb];
      if (im) im.onload = () => { this.ready++; };
      return im || null;
    }));
  },
  ok() { return this.ready === CAT_VARS.length * STAGE_LBS.length; },
};
Sprites.init();
