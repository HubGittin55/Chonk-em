'use strict';
/* CHONK'EM player profile — save schema v2 (2026-10-15).
   One versioned JSON blob at 'chonk-em:profile-v2', replacing the flat keys
   ('chonk-em:best', 'chonk-em:difficulty', 'chonk-em:cat', 'chonk-em:howSeen',
   'chonk-em:mute', 'chonk-em:worldopen:N'). First load migrates everything
   over and deletes the legacy keys, so the reset wipe stays a single prefix.

   Shape:
   { version: 2,
     best:      { [levelIdx]: {stars, cal} },   // migrated from 'best'
     lifetime:  { totalCal, bestChonk, levelsCleared, shotsFired, maxCombo },
     settings:  { difficulty, mute, cat, howSeen, worldopen: { [w]: bool } },
     daily:     { last: 'YYYYMMDD'|null, streak: 0, best: { [date]: {stars, cal} } },
     weight:    5.0,   // the cat's saved weight across sessions (START_LB default)
   } */

const PROFILE_KEY = 'chonk-em:profile-v2';
const LEGACY_KEYS = ['best', 'difficulty', 'cat', 'howSeen', 'mute', 'weight'];

function _lsGet(k) {
  try { const v = localStorage.getItem('chonk-em:' + k); return v == null ? null : JSON.parse(v); }
  catch (e) { return null; }
}
function _lsSet(k, v) {
  try { localStorage.setItem('chonk-em:' + k, JSON.stringify(v)); } catch (e) {}
}
function _lsDel(k) {
  try { localStorage.removeItem('chonk-em:' + k); } catch (e) {}
}

function _freshProfile() {
  return {
    version: 2,
    best: {},
    lifetime: { totalCal: 0, bestChonk: 0, levelsCleared: 0, shotsFired: 0, maxCombo: 0 },
    settings: { difficulty: 'normal', mute: false, cat: 0, howSeen: 0, worldopen: {} },
    daily: { last: null, streak: 0, best: {} },
    weight: 5.0,
  };
}

const Profile = {
  _p: null,

  // Load (and migrate) the profile. Idempotent — safe to call any time.
  load() {
    let p = null;
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) p = JSON.parse(raw);
    } catch (e) { p = null; }
    if (p && p.version === 2) { this._p = p; return p; }
    p = _freshProfile();
    // migrate legacy flat keys
    const lb = _lsGet('best');
    if (lb && typeof lb === 'object') p.best = lb;
    const d = _lsGet('difficulty');
    if (typeof d === 'string') p.settings.difficulty = d;
    const c = _lsGet('cat');
    if (typeof c === 'number') p.settings.cat = c;
    const h = _lsGet('howSeen');
    if (typeof h === 'number') p.settings.howSeen = h;
    const w = _lsGet('weight');
    if (typeof w === 'number') p.weight = w;
    try {
      if (localStorage.getItem('chonk-em:mute') === '1') p.settings.mute = true;
    } catch (e) {}
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('chonk-em:worldopen:') === 0) {
          p.settings.worldopen[k.slice('chonk-em:worldopen:'.length)] = localStorage.getItem(k) === 'true';
          _lsDel(k.slice('chonk-em:'.length));
        }
      }
    } catch (e) {}
    for (const k of LEGACY_KEYS) _lsDel(k);
    this._p = p;
    this.save();
    return p;
  },

  get() { if (!this._p) this.load(); return this._p; },

  // Re-read from localStorage (migration included). Smoke-test hook.
  reload() { this._p = null; return this.load(); },

  save() { _lsSet('profile-v2', this.get()); },

  // ---- per-level bests ----
  best() { return this.get().best; },
  totalStars() {
    return Object.values(this.get().best).reduce((a, r) => a + ((r && r.stars) || 0), 0);
  },
  saveBest(idx, stars, cal) {
    const b = this.get().best;
    const cur = b[idx] || { stars: 0, cal: 0 };
    b[idx] = { stars: Math.max(cur.stars, stars), cal: Math.max(cur.cal, cal) };
    this.save();
  },

  // ---- settings ----
  setting(k, d) {
    const s = this.get().settings;
    return s[k] !== undefined ? s[k] : d;
  },
  setSetting(k, v) { this.get().settings[k] = v; this.save(); },
  worldOpen(w, fallback) {
    const o = this.get().settings.worldopen;
    return o[w] !== undefined ? o[w] : fallback;
  },
  setWorldOpen(w, open) { this.get().settings.worldopen[w] = !!open; this.save(); },

  // ---- lifetime stats (every win feeds these; shots land on every shot) ----
  recordWin(cal, weightLb, maxCombo, shotsFired) {
    const L = this.get().lifetime;
    L.totalCal += cal;
    L.bestChonk = Math.max(L.bestChonk, weightLb);
    L.levelsCleared++;
    L.maxCombo = Math.max(L.maxCombo, maxCombo || 0);
    L.shotsFired += shotsFired || 0;
    this.save();
  },
  lifetime() { return this.get().lifetime; },

  // ---- daily challenge ----
  recordDaily(date, stars, cal) {
    const D = this.get().daily;
    const cur = D.best[date] || { stars: 0, cal: 0 };
    D.best[date] = { stars: Math.max(cur.stars, stars), cal: Math.max(cur.cal, cal) };
    if (D.last !== date) { // first play of this date: roll the streak forward
      const y = new Date(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8));
      y.setDate(y.getDate() - 1);
      const yest = y.getFullYear() + String(y.getMonth() + 1).padStart(2, '0') + String(y.getDate()).padStart(2, '0');
      D.streak = (D.last === yest) ? D.streak + 1 : 1;
      D.last = date;
    }
    this.save();
  },
  dailyBest(date) { return this.get().daily.best[date] || null; },
  streak() { return this.get().daily.streak || 0; },

  // ---- saved weight (across sessions) ----
  weight() { const w = this.get().weight; return typeof w === 'number' ? w : 5.0; },
  setWeight(lb) { this.get().weight = lb; this.save(); },

  // ---- wipe ----
  reset() {
    try {
      const dead = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('chonk-em:') === 0) dead.push(k);
      }
      dead.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    this._p = null;
  },
};
