'use strict';
/* Menu mascot (2026-10-21 daily polish — roadmap P0 menu overhaul: "mascot cat
   that tracks the cursor"). A CSS-drawn cat head in the level-select header
   (#mascot in index.html): pupils track the pointer, lids blink on the same
   ~3.7s cadence as the in-game cat, and clicking it pets the cat — a squish
   plus a weight-pitched meow (same pitch curve as the weigh-in ceremony).
   Fur tint follows the selected species (Tabby/Orange/Tuxedo/Calico).
   REDUCED-safe: no tracking, no blink, no squish under prefers-reduced-motion.
   Pure DOM, no canvas, no assets — works with the sprite pipeline untouched. */

const Mascot = {
  el: null,           // #mascot root element (set by mount)
  pupils: [],         // .m-pupil spans (synced from state)
  reduced: false,     // prefers-reduced-motion, sampled at mount
  pupil: { dx: 0, dy: 0 }, // current pupil offset, px — single source of truth
  PUPIL_MAX: 5,       // pupil travel radius, px (stays inside the 17x20 eye)
  lidsClosed: false,  // lid state mirror (classList is the visual)
  nextBlink: 0,       // performance.now() timestamp of the next blink start
  unblinkAt: 0,       // timestamp when the current blink ends
  BLINK_MS: 140,      // lids stay shut this long
  lastPet: 0,         // pet cooldown timestamp
  PET_COOLDOWN_MS: 700,

  // per-species look: [solid fur (ears/lids), full head background]
  LOOKS: [
    { fur: '#b08968', head: 'repeating-linear-gradient(115deg, rgba(96,64,32,.28) 0 5px, rgba(0,0,0,0) 5px 11px), radial-gradient(circle at 35% 28%, #c79f72, #a37f5c 78%)' }, // Tabby
    { fur: '#e8913a', head: 'repeating-linear-gradient(115deg, rgba(150,80,20,.30) 0 5px, rgba(0,0,0,0) 5px 11px), radial-gradient(circle at 35% 28%, #f2a24a, #d97f2b 78%)' }, // Orange
    { fur: '#4a4a52', head: 'radial-gradient(circle at 35% 28%, #5c5c66, #38383f 78%)' }, // Tuxedo
    { fur: '#e6d7bd', head: 'linear-gradient(135deg, #e8913a 0 30%, #e6d7bd 30% 62%, #8a8f98 62% 100%)' }, // Calico patches
  ],

  furFor(i) { // pure: species index -> look; out of range falls back to Tabby
    const n = (i | 0);
    return (n >= 0 && n < this.LOOKS.length) ? this.LOOKS[n] : this.LOOKS[0];
  },

  reducedMotion() {
    try {
      return typeof matchMedia === 'function' &&
        matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  },

  menuOpen() { // the mascot only lives while the level select is up
    try { return typeof game !== 'undefined' && !!game.menuOpen; }
    catch (e) { return false; }
  },

  pupilOffset(cx, cy, px, py, max) { // pure: pointer -> offset clamped to a radius
    const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy);
    if (!(d > 0)) return { dx: 0, dy: 0 };
    if (d <= max) return { dx, dy };
    return { dx: dx / d * max, dy: dy / d * max };
  },

  mount() { // idempotent; safe to call from showMenu() on every rebuild
    if (this.el) { this.refresh(); return; }
    let el = null;
    try { el = document.getElementById('mascot'); } catch (e) { /* headless */ }
    if (!el) return;
    this.el = el;
    try {
      this.pupils = el.querySelectorAll ? Array.from(el.querySelectorAll('.m-pupil')) : [];
    } catch (e) { this.pupils = []; }
    this.reduced = this.reducedMotion();
    const self = this;
    try {
      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('pointermove', function (e) { self.aimAt(e.clientX, e.clientY); }, { passive: true });
      }
    } catch (e) { /* older browsers */ }
    try { el.addEventListener('click', function (e) { e.stopPropagation(); self.pet(); }); }
    catch (e) { /* headless stub */ }
    this.refresh();
  },

  refresh() { // re-tint for the currently selected species; no-op before mount
    if (!this.el) return;
    let i = 0;
    try { i = (typeof selectedCat === 'function') ? selectedCat() : 0; }
    catch (e) { i = 0; }
    const look = this.furFor(i);
    try {
      if (this.el.style.setProperty) {
        this.el.style.setProperty('--mfur', look.fur);
        this.el.style.setProperty('--mhead', look.head);
      }
    } catch (e) { /* headless stub style */ }
  },

  aimAt(px, py) { // pointer position -> pupil state (+ DOM sync); no-op when reduced/hidden
    if (this.reduced || !this.el || !this.menuOpen()) return;
    let r;
    try { r = this.el.getBoundingClientRect(); } catch (e) { return; }
    if (!r) return;
    this.pupil = this.pupilOffset(r.left + r.width / 2, r.top + r.height / 2, px, py, this.PUPIL_MAX);
    this.syncPupils();
  },

  syncPupils() {
    const t = 'translate(' + this.pupil.dx.toFixed(1) + 'px,' + this.pupil.dy.toFixed(1) + 'px)';
    for (const p of this.pupils) {
      try { p.style.transform = t; } catch (e) { /* headless stub */ }
    }
  },

  frame(now) { // blink driver — called from the main frame() loop; now = rAF timestamp
    if (!this.el || !this.menuOpen()) return;
    if (this.reduced) { this.setLids(false); return; }
    if (now >= this.nextBlink) {
      this.setLids(true);
      this.unblinkAt = now + this.BLINK_MS;
      this.nextBlink = now + 2800 + Math.random() * 1800; // ~2.8–4.6s, same neighborhood as the in-game blink
    } else if (this.lidsClosed && now >= this.unblinkAt) {
      this.setLids(false);
    }
  },

  setLids(closed) {
    this.lidsClosed = closed;
    if (!this.el || !this.el.classList) return;
    try {
      if (closed) this.el.classList.add('blink');
      else this.el.classList.remove('blink');
    } catch (e) { /* headless stub */ }
  },

  rest() { // menu closing: pupils home, lids open (listener stays, aimAt no-ops)
    this.pupil = { dx: 0, dy: 0 };
    this.syncPupils();
    this.setLids(false);
  },

  pet() { // click the mascot: squish + weight-pitched meow, with a cooldown
    let now = 0;
    try { now = (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
    catch (e) { now = Date.now(); }
    if (now - this.lastPet < this.PET_COOLDOWN_MS) return;
    this.lastPet = now;
    if (!this.reduced && this.el && this.el.classList) {
      try {
        this.el.classList.remove('pet');
        void this.el.offsetWidth; // restart the CSS animation
        this.el.classList.add('pet');
      } catch (e) { /* headless stub */ }
    }
    try {
      if (typeof AudioSys !== 'undefined' && AudioSys.meow) {
        const big = (typeof chonkT === 'function' && typeof game !== 'undefined') ? chonkT(game.weightLb) : 0.3;
        AudioSys.meow(big); // same pitch curve as the weigh-in ceremony
      }
    } catch (e) { /* audio unavailable */ }
  },
};
