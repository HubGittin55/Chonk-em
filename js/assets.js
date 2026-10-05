'use strict';
/* Image asset pipeline. Blarmo generates the art (see assets/SPEC.md); the
   game loads it at boot with graceful fallback to the procedural vector art
   whenever a file is missing. Nothing breaks if assets/ is empty. */

const Assets = {
  manifest: {
    'logo':          'assets/logo.png',
    'bg':            'assets/kitchen-bg.png',
    'shooter':       'assets/shooter-cat.png',
    'barrel-snack':  'assets/barrel-snack.png',
    'barrel-veggie': 'assets/barrel-veggie.png',
    'barrel-power':  'assets/barrel-power.png',
    'bowl':          'assets/bowl.png',
    'yarn':          'assets/yarn.png',
    'cat-0': 'assets/cat-0.png',
    'cat-1': 'assets/cat-1.png',
    'cat-2': 'assets/cat-2.png',
    'cat-3': 'assets/cat-3.png',
    'cat-4': 'assets/cat-4.png',
  },
  img: {},
  ready: false,

  // Returns the loaded HTMLImageElement, or null when missing → use vector art.
  get(name) { return this.img[name] || null; },

  load(timeoutMs) {
    // Headless/node: no Image constructor — resolve at once, vector everywhere.
    if (typeof Image === 'undefined') { this.ready = true; return Promise.resolve(); }
    const jobs = Object.entries(this.manifest).map(([name, src]) => new Promise((res) => {
      const im = new Image();
      im.onload = () => { this.img[name] = im; res(); };
      im.onerror = () => res(); // missing file → null → vector fallback
      im.src = src;
    }));
    const timeout = new Promise((res) => setTimeout(res, timeoutMs || 2500));
    return Promise.race([
      Promise.all(jobs).then(() => { this.ready = true; }),
      timeout.then(() => { this.ready = true; }),
    ]);
  },
};
