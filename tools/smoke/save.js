/* CHONK'EM smoke suite: save schema v2 — versioned profile + migration
   Loaded by tools/smoke.js — shares the harness globals (T, step, ctxStub, game, ...). */
// 2026-10-15: save schema v2 — versioned profile + legacy migration
T('save-v2: fresh profile has the v2 shape', (() => {
  Profile.reset(); Profile.reload();
  const p = Profile.get();
  return p.version === 2 && typeof p.best === 'object' && typeof p.lifetime === 'object' &&
    typeof p.settings === 'object' && typeof p.daily === 'object';
})());
T('save-v2: legacy flat keys migrate into the profile and are cleaned up', (() => {
  Profile.reset();
  localStorage.setItem('chonk-em:best', JSON.stringify({ 3: { stars: 2, cal: 50 } }));
  localStorage.setItem('chonk-em:difficulty', JSON.stringify('hard'));
  localStorage.setItem('chonk-em:cat', JSON.stringify(2));
  localStorage.setItem('chonk-em:howSeen', JSON.stringify(1));
  localStorage.setItem('chonk-em:mute', '1');
  localStorage.setItem('chonk-em:weight', JSON.stringify(33.3));
  localStorage.setItem('chonk-em:worldopen:4', 'true');
  Profile.reload();
  const ok = Profile.best()[3] && Profile.best()[3].stars === 2 &&
    Profile.setting('difficulty') === 'hard' && Profile.setting('cat') === 2 &&
    Profile.setting('howSeen') === 1 && Profile.setting('mute') === true &&
    Math.abs(Profile.weight() - 33.3) < 1e-9 && Profile.worldOpen(4, false) === true;
  const legacy = ['chonk-em:best', 'chonk-em:difficulty', 'chonk-em:cat', 'chonk-em:howSeen', 'chonk-em:mute', 'chonk-em:weight', 'chonk-em:worldopen:4']
    .every(k => localStorage.getItem(k) === null);
  return ok && legacy && localStorage.getItem('chonk-em:profile-v2') !== null;
})());
T('save-v2: saveBest keeps the max stars/cal', (() => {
  Profile.reset(); Profile.reload();
  Profile.saveBest(5, 2, 100); Profile.saveBest(5, 3, 80);
  const r = Profile.best()[5];
  return r.stars === 3 && r.cal === 100 && Profile.totalStars() === 3;
})());
T('save-v2: recordWin accumulates lifetime stats', (() => {
  Profile.reset(); Profile.reload();
  Profile.recordWin(120, 22.5, 7, 40);
  Profile.recordWin(80, 19.0, 4, 30);
  const L = Profile.lifetime();
  return L.totalCal === 200 && L.levelsCleared === 2 && L.maxCombo === 7 &&
    L.shotsFired === 70 && Math.abs(L.bestChonk - 22.5) < 1e-9;
})());
T('save-v2: win on a campaign level records best + lifetime', (() => {
  Profile.reset(); Profile.reload();
  loadLevel(0);
  game.calories = 90; game.weightLb = 40; game.maxCombo = 5; game.shotsFired = 12;
  endGame(true);
  const r = Profile.best()[0], L = Profile.lifetime();
  return r && r.stars >= 1 && r.cal === 90 && L.levelsCleared === 1 && L.totalCal === 90 && !game.daily;
})());

