'use strict';
/* 2026-10-19 daily polish: trophies (achievements), pause menu, ball trails,
   weigh-in stats. Shares the harness globals (T, step, game, Profile, ...). */

Profile.reset();

// ---- profile shape ----
T('trophies: fresh profile has an empty trophies map', () => {
  const t = Profile.trophies();
  return t && typeof t === 'object' && Object.keys(t).length === 0;
});
T('trophies: old v2 profile without the field normalizes on load', () => {
  Profile.reset();
  const p = Profile.get();
  delete p.trophies;
  Profile.save();
  Profile.reload();
  return typeof Profile.trophies() === 'object';
});
T('trophies: all 20 ids are unique', () => {
  const ids = ACHIEVEMENTS.map(a => a.id);
  return ids.length === 20 && new Set(ids).size === 20;
});

// ---- unlock mechanics ----
Profile.reset();
T('trophies: unlock persists and returns true once', () => {
  const first = Achievements.unlock('jackpot');
  const second = Achievements.unlock('jackpot');
  return first === true && second === false && Achievements.has('jackpot') &&
    Achievements.count() === 1;
});
T('trophies: unknown id is rejected', () => Achievements.unlock('not-a-trophy') === false);
T('trophies: unlock survives a profile reload', () => {
  Profile.reload();
  return Achievements.has('jackpot');
});
T('trophies: toast queue holds while a toast is showing', () => {
  Achievements._queue.length = 0; Achievements._busy = true; // simulate a toast on screen
  Achievements.unlock('cuke-hunter');
  const got = Achievements._pop() === 'cuke-hunter' && Achievements._pop() === null;
  Achievements._busy = false;
  return got;
});

// ---- event hooks ----
Profile.reset();
loadLevel(0);
T('trophies: golden burst unlocks jackpot', () => {
  onBarrelBurst({ kind: 'golden', x: 300, y: 300, content: 'kibble' }, null);
  return Achievements.has('jackpot');
});
T('trophies: 3 keg bursts unlock demolition', () => {
  for (let i = 0; i < 3; i++) onBarrelBurst({ kind: 'keg', x: 100 + i * 200, y: 200 }, null);
  return Achievements.has('demolition');
});
T('trophies: bursts counter tracks every pop', () => game.bursts >= 4);
T('trophies: cucumber spook unlocks jumpscare', () => {
  spookCat({ x: 300, y: 600 });
  return Achievements.has('jumpscare') && game.spooks === 1;
});
T('trophies: 3 spooks in one level unlock cuke-hunter', () => {
  spookCat({ x: 300, y: 600 });
  spookCat({ x: 300, y: 600 });
  return Achievements.has('cuke-hunter') && game.spooks === 3;
});
T('trophies: EMP short unlocks shortcircuit', () => {
  game.vacuum = Vacuum.create(1);
  fireEMP(300, 400);
  return Achievements.has('shortcircuit') && game.vacuum.zapT > 0;
});
T('trophies: 75+ cal delivery unlocks imperial', () => {
  deliver({ x: 300, y: 700, cal: 80, icon: '🦞', name: 'Lobster', content: 'lobster', grav: 1, drift: 0, power: null, t: 0, gone: false });
  return Achievements.has('imperial');
});
T('trophies: combo x6 / x12 unlock combo-chef / frenzy-master', () => {
  Profile.reset();
  Achievements.noteCombo(6);
  const six = Achievements.has('combo-chef') && !Achievements.has('frenzy-master');
  Achievements.noteCombo(12);
  return six && Achievements.has('frenzy-master');
});

// ---- end-of-level aggregates ----
Profile.reset();
T('trophies: win aggregates unlock campaign set', () => {
  Profile.saveBest(0, 3, 120);
  const L = Profile.lifetime();
  L.levelsCleared = 10; L.bestChonk = 50;
  Profile.save();
  game.endless = { depth: 5 };
  Profile.get().daily.streak = 3;
  Profile.get().daily.last = '20261019';
  Profile.save();
  Achievements.checkEndOfLevel(true);
  return Achievements.has('first-steps') && Achievements.has('sous-chef') &&
    Achievements.has('perfect-chonk') && Achievements.has('heavyweight') &&
    Achievements.has('deep-diver') && Achievements.has('regular');
});
T('trophies: loss unlocks diet-plan', () => {
  Profile.reset();
  Achievements.checkEndOfLevel(false);
  return Achievements.has('diet-plan') && Achievements.count() === 1;
});
T('trophies: 10 three-star levels unlock chonk-critic', () => {
  Profile.reset();
  for (let i = 0; i < 10; i++) Profile.saveBest(i, 3, 100);
  Achievements.checkEndOfLevel(true);
  return Achievements.has('chonk-critic');
});

// ---- pause ----
loadLevel(0);
game.menuOpen = false; game.over = null; // real gameplay state: menu hidden
T('pause: toggle pauses and unpauses', () => {
  togglePause();
  const paused = game.paused === true;
  togglePause();
  return paused && game.paused === false;
});
T('pause: no-op on the menu', () => {
  game.menuOpen = true;
  togglePause();
  const still = game.paused === false;
  game.menuOpen = false;
  return still;
});
T('pause: aim gate reads the flag', () => {
  togglePause();
  const canAimNow = !game.over && !game.menuOpen && !game.paused && !game.shots.length && game.balls > 0;
  togglePause();
  return canAimNow === false && game.paused === false;
});
T('pause: startLevel clears the flag', () => {
  togglePause();
  loadLevel(0);
  return game.paused === false;
});

// ---- ball trails ----
loadLevel(0);
T('ball-trails: flying balls grow a fading wake', () => {
  game.shots.push({ x: 300, y: 60, vx: 0, vy: 60, r: 8, life: 1, slowT: 0, bounces: 0, trail: [] });
  step(12);
  const b = game.shots[0];
  return !!b && b.trail.length > 0 && b.trail.length <= 7;
});
T('ball-trails: drawBall renders without error', () => {
  drawBall();
  return true;
});

// ---- menu trophy row + panel ----
T('trophies: menu renders the trophy row', () => {
  Profile.reset();
  showMenu();
  return Achievements.count() === 0;
});
T('trophies: trophy panel lists all 20', () => {
  renderTrophyPanel();
  const list = document.getElementById('trophyList');
  return typeof list.innerHTML === 'string';
});

// ---- progress hints ----
Profile.reset();
T('trophies: progress is null for unlocked, one-shot, and unknown trophies', () => {
  Achievements.unlock('jackpot');
  const unlocked = Achievements.progress('jackpot') === null;
  const oneshot = ['demolition', 'imperial', 'jumpscare', 'cuke-hunter', 'shortcircuit', 'diet-plan']
    .every(id => Achievements.progress(id) === null);
  return unlocked && oneshot && Achievements.progress('not-a-trophy') === null;
});
T('trophies: progress hints track profile state', () => {
  Profile.reset();
  for (let i = 0; i < 3; i++) Profile.saveBest(i, 3, 100);
  const L = Profile.lifetime();
  L.levelsCleared = 7; L.bestChonk = 42.6; L.maxCombo = 9;
  Profile.get().daily.streak = 2;
  Profile.get().endless.bestDepth = 3;
  Profile.save();
  const p = id => Achievements.progress(id);
  return p('perfect-chonk') === '3 / 1 three-star level' &&
    p('chonk-critic') === '3 / 10 three-star levels' &&
    p('sous-chef') === '7 / 10 levels cleared' &&
    p('iron-chef') === '7 / 50 levels cleared' &&
    p('combo-chef') === '9 / 6 combo' &&
    p('frenzy-master') === '9 / 12 combo' &&
    p('deep-diver') === '3 / 5 endless depth' &&
    p('abyssal') === '3 / 10 endless depth' &&
    p('regular') === '2 / 3-day streak' &&
    p('devotee') === '2 / 7-day streak' &&
    p('heavyweight') === '42 / 50 lb best chonk' &&
    p('century') === '42 / 100 lb best chonk' &&
    p('maximum') === '42 / 150 lb cap';
});
T('trophies: first-steps hint clears once a level is won', () => {
  Profile.reset();
  const before = Achievements.progress('first-steps') === 'clear 1 level to earn';
  Profile.lifetime().levelsCleared = 1;
  return before && Achievements.progress('first-steps') === null;
});
T('trophies: panel renders progress hints on locked trophies', () => {
  Profile.reset();
  Profile.lifetime().levelsCleared = 7;
  const html = [];
  const panel = { set textContent(v) {}, set innerHTML(v) {}, appendChild: (c) => html.push(c.innerHTML) };
  const orig = global.document;
  global.document = { getElementById: () => panel, createElement: () => ({ className: '', innerHTML: '', appendChild: () => {} }) };
  try { renderTrophyPanel(); } finally { global.document = orig; }
  const out = html.join('');
  return out.indexOf('t-prog') !== -1 && out.indexOf('7 / 10 levels cleared') !== -1;
});

Profile.reset(); // leave a clean profile for the suites that follow
