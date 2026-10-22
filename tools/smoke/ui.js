/* CHONK'EM smoke suite: weigh-in ceremony, music loader, daily challenge, menu,
   menu mascot. Loaded by tools/smoke.js — shares the harness globals. */
T('weigh: stars are weight-based (1 win / 2 @70% / 3 @82% of level food)', (() => {
  loadLevel(0);
  const L = game.level, max = START_LB + LB_PER_CAL * rawCal(L);
  return starsFor(START_LB + 0.85 * (max - START_LB), L) === 3 &&
         starsFor(START_LB + 0.75 * (max - START_LB), L) === 2 &&
         starsFor(START_LB + 0.1 * (max - START_LB), L) === 1;
})());
T('weigh: ceremony runs needle to target and fires finale', (() => {
  loadLevel(0);
  game.weightLb = 20; game.calories = 40; game.maxCombo = 3;
  endGame(true);
  const w = game.weigh;
  if (!w || w.target !== 20) return false;
  for (let i = 0; i < 300; i++) updateWeigh(1 / 60);
  return Math.abs(w.shown - 20) < 0.05 && w.finale === true;
})());
T('weigh: trombone + fanfare synths exist', typeof AudioSys.trombone === 'function' && typeof AudioSys.fanfare === 'function');
T('v0.5: weigh-in cat cycles 10 lb sprite -> final size', (() => {
  loadLevel(0);
  game.weightLb = 42; game.calories = 40; game.maxCombo = 3;
  endGame(true);
  const w = game.weigh;
  if (!w || w.stageIdx !== stageIdxForLb(10)) return false;
  for (let i = 0; i < 150; i++) updateWeigh(1 / 60); // halfway: mid-size
  const mid = w.stageIdx;
  for (let i = 0; i < 300; i++) updateWeigh(1 / 60);
  return mid > stageIdxForLb(10) && w.stageIdx === stageIdxForLb(42);
})());
T('v0.5: weigh-in needle ticks jiggle the chonk', (() => {
  loadLevel(0);
  game.weightLb = 60; game.calories = 60; game.maxCombo = 3;
  endGame(true);
  const w = game.weigh;
  for (let i = 0; i < 300; i++) { updateWeigh(1 / 60); game.phys.update(1 / 60); } // tick() interleaves these
  return Math.abs(game.wob.belly.x) + Math.abs(game.wob.belly.v) > 0.01;
})());
T('v0.5: no item wedges forever (freeze regression)', (() => {
  loadLevel(10); // L11, dense field
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let shot = 0; shot < 8 && game.balls > 0; shot++) {
    fireShot(100 + rnd() * 400, 200 + rnd() * 300);
    for (let i = 0; i < 2400 && game.shots.length; i++) tick(1 / 120);
    for (let i = 0; i < 3600; i++) tick(1 / 120);
  }
  return game.items.length === 0;
})());
T('v0.5: big bites no longer 2x the cat (capped eating kick)', (() => {
  loadLevel(0);
  game.wob.belly.x = 0; game.wob.belly.v = 0;
  deliver({ cal: 100 }); // imperial feast: old kick 1.6+35 -> ~2x height blowup
  let peak = 0;
  for (let i = 0; i < 600; i++) { tick(1 / 120); peak = Math.max(peak, Math.abs(game.wob.belly.x)); }
  return peak < 3.5; // capped: old formula peaked ~16 (2x+ visual blowup)
})());
T('v0.5: barrel hits spawn no floating text (decluttered)', (() => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'js', 'main.js'), 'utf8');
  const burst = src.split('function onBarrelBurst')[1].split('function explode')[0];
  const special = src.split('function onBarrelSpecial')[1].split('function deliver')[0];
  return !/addPopup/.test(burst) && !/addPopup/.test(special) && !/CRACKED|CLANG|BOING|BOOM!|SPLIT!/.test(burst + special);
})());
T('v0.5: weigh-in stars light cumulatively (1st star not skipped)', (() => {
  const run = frac => {
    loadLevel(0);
    const max = START_LB + LB_PER_CAL * rawCal(game.level);
    game.weightLb = START_LB + frac * (max - START_LB);
    game.calories = game.goalNow; game.maxCombo = 3;
    endGame(true);
    for (let i = 0; i < 400; i++) updateWeigh(1 / 60);
    return game.weigh.lit;
  };
  return run(0.5) === 1 && run(0.8) === 2 && run(0.95) === 3;
})());
T('v0.5: frame loop is unkillable (reschedule-first + try/catch + step cap)', (() => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'js', 'main.js'), 'utf8');
  const seg = src.split('function frame(now)')[1].split('\nrequestAnimationFrame(frame);\n')[0];
  const reschedFirst = seg.indexOf('requestAnimationFrame(frame);') < seg.indexOf('try {');
  return reschedFirst && /try \{[\s\S]*tick\(STEP\)[\s\S]*catch \(e\)/.test(seg) && /n\+\+ < 24/.test(seg);
})());
T('v0.5: weigh-in draws the real sprite, not an emoji', (() => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'js', 'weighin.js'), 'utf8');
  const seg = src.split('function drawScale')[1] || '';
  return seg.includes('Cats.drawMain') && !seg.includes("'🐱'");
})());
// 2026-10-14: music loader — safe no-ops until the files land
T('music: setTrack/stop are safe headless (no ctx, no files)', (() => {
  try {
    AudioSys.music.setTrack('menu');
    AudioSys.music.setTrack('gameplay');
    AudioSys.music.setTrack('frenzy');
    AudioSys.music.setTrack('weighin');
    AudioSys.music.stop();
    return AudioSys.music.track === null && AudioSys.music.src === null;
  } catch (e) { return false; }
})());
T('music: mute toggle applies to music without throwing', (() => {
  try {
    AudioSys.music.setTrack('menu');
    AudioSys.toggle(); AudioSys.toggle();
    return !AudioSys.muted;
  } catch (e) { return false; }
})());
T('menu-worlds: showMenu builds 10 world sections without throwing', (() => {
  try { showMenu(); return game.menuOpen === true; } catch (e) { return false; }
})());

// 2026-10-15: daily challenge — deterministic per date, fresh per day
T('daily: same date → identical level; different date → different level', (() => {
  const a1 = JSON.stringify(genDailyLevel('20261015').barrels.map(b => [b.x, b.y, b.kind, b.content]));
  const a2 = JSON.stringify(genDailyLevel('20261015').barrels.map(b => [b.x, b.y, b.kind, b.content]));
  const b1 = JSON.stringify(genDailyLevel('20261016').barrels.map(b => [b.x, b.y, b.kind, b.content]));
  return a1 === a2 && a1 !== b1;
})());
T('daily: level is playable (goal, balls, movers deals)', (() => {
  const L = genDailyLevel('20261015');
  return L.goal > 0 && L.balls >= 8 && L.barrels.length >= 60 && L.name.indexOf('Daily:') === 0;
})());
T('daily: loadDaily sets game.daily and wins record to the date, not the campaign board', (() => {
  Profile.reset(); Profile.reload();
  loadDaily();
  const isDaily = !!game.daily && typeof game.daily.date === 'string' && game.levelIndex === -1 && game.barrels.length > 0;
  game.calories = 120; game.weightLb = 45; game.maxCombo = 6; game.shotsFired = 15;
  endGame(true);
  const rec = Profile.dailyBest(game.daily.date);
  return isDaily && rec && rec.stars >= 1 && Object.keys(Profile.best()).length === 0 && Profile.lifetime().levelsCleared === 1;
})());
T('daily: streak rolls forward on consecutive days, resets after a gap', (() => {
  Profile.reset(); Profile.reload();
  Profile.recordDaily('20261013', 2, 60);
  Profile.recordDaily('20261014', 3, 70);
  const s1 = Profile.streak();
  Profile.recordDaily('20261020', 1, 40); // 6-day gap
  const s2 = Profile.streak();
  Profile.recordDaily('20261020', 3, 90); // same day again: keeps best, streak unchanged
  return s1 === 2 && s2 === 1 && Profile.streak() === 1 && Profile.dailyBest('20261020').stars === 3;
})());


// 2026-10-16: endless climb — mode flow
T('endless: loadEndless sets mode state and starts depth 1 with the vacuum out', (() => {
  loadEndless(1);
  return !!game.endless && game.endless.depth === 1 && !game.daily &&
    game.levelIndex === -2 && game.barrels.length > 0 && game.vacuum !== null;
})());
T('endless: win records the depth + lifetime, never the campaign board', (() => {
  Profile.reset(); Profile.reload();
  loadEndless(2);
  game.calories = 300; game.weightLb = 60; game.maxCombo = 5; game.shotsFired = 20;
  endGame(true);
  const E = Profile.endlessBest();
  return E.bestDepth === 2 && E.bestCal === 300 && Object.keys(Profile.best()).length === 0 &&
    Profile.lifetime().levelsCleared === 1;
})());
T('endless: loss names the depth in the overlay', (() => {
  Profile.reset(); Profile.reload();
  loadEndless(4);
  game.calories = 10;
  endGame(false);
  return /depth 4/i.test(overlayTitle.textContent) && /best depth 0/i.test(overlaySub.textContent);
})());

// 2026-10-16: world tints — per-world background wash
T('world-tints: 10 worlds defined, kitchen = no wash', (() =>
  WORLD_TINTS.length === 10 && WORLD_TINTS[0] === null &&
  WORLD_TINTS.slice(1).every(t => t && t.length === 2))());
T('world-tints: worldTintFor follows the level world; endless cycles worlds', (() => {
  loadLevel(10); // L11 → world 1 (Pantry)
  const pan = worldTintFor();
  loadLevel(0);  // L1 → world 0 (Kitchen)
  const kit = worldTintFor();
  loadEndless(19); // depth 19 % 10 = 9 → Banquet Hall
  const ban = worldTintFor();
  return !!pan && kit === null && ban === WORLD_TINTS[9];
})());

// 2026-10-21: menu mascot — cursor-tracking pupils, blink cycle, pet meow
T('mascot: module loads and mounts headless without throwing', (() => {
  Mascot.mount(); Mascot.mount(); // idempotent
  return !!Mascot.el && Mascot.reduced === false;
})());
T('mascot: pupilOffset is identity inside the radius, clamped outside', (() => {
  const a = Mascot.pupilOffset(300, 450, 302, 451, 5);   // inside
  const b = Mascot.pupilOffset(300, 450, 1300, 450, 5);  // far right
  const c = Mascot.pupilOffset(300, 450, 300, 450, 5);   // dead center
  const d = Mascot.pupilOffset(300, 450, 800, 950, 5);   // diagonal
  return a.dx === 2 && a.dy === 1 &&
    b.dx === 5 && b.dy === 0 &&
    c.dx === 0 && c.dy === 0 &&
    Math.abs(Math.hypot(d.dx, d.dy) - 5) < 1e-9 && Math.abs(d.dx - d.dy) < 1e-9;
})());
T('mascot: aimAt moves pupils toward the pointer, clamped to PUPIL_MAX', (() => {
  game.menuOpen = true; Mascot.reduced = false;
  Mascot.aimAt(300, 450); // stub rect center
  const home = Mascot.pupil.dx === 0 && Mascot.pupil.dy === 0;
  Mascot.aimAt(3000, 450);
  const right = Mascot.pupil.dx === Mascot.PUPIL_MAX && Mascot.pupil.dy === 0;
  Mascot.aimAt(300, -5000);
  const up = Mascot.pupil.dx === 0 && Mascot.pupil.dy === -Mascot.PUPIL_MAX;
  Mascot.rest();
  return home && right && up && Mascot.pupil.dx === 0 && Mascot.pupil.dy === 0;
})());
T('mascot: aimAt is a no-op when reduced-motion or off-menu', (() => {
  game.menuOpen = true; Mascot.reduced = true;
  Mascot.rest();
  Mascot.aimAt(3000, 450);
  const frozen = Mascot.pupil.dx === 0 && Mascot.pupil.dy === 0;
  Mascot.reduced = false; game.menuOpen = false;
  Mascot.aimAt(3000, 450);
  const hidden = Mascot.pupil.dx === 0 && Mascot.pupil.dy === 0;
  game.menuOpen = true;
  return frozen && hidden;
})());
T('mascot: blink closes lids for BLINK_MS then reopens on schedule', (() => {
  game.menuOpen = true; Mascot.reduced = false; Mascot.setLids(false);
  Mascot.nextBlink = 1000;
  Mascot.frame(999);
  const open1 = !Mascot.lidsClosed;
  Mascot.frame(1000);
  const shut = Mascot.lidsClosed && Mascot.unblinkAt === 1000 + Mascot.BLINK_MS &&
    Mascot.nextBlink >= 3800 && Mascot.nextBlink < 5600; // 1000 + 2800 + rand*1800
  Mascot.frame(1000 + Mascot.BLINK_MS - 1);
  const still = Mascot.lidsClosed;
  Mascot.frame(1000 + Mascot.BLINK_MS);
  const open2 = !Mascot.lidsClosed;
  Mascot.setLids(false); Mascot.nextBlink = 1e15;
  return open1 && shut && still && open2;
})());
T('mascot: frame is a no-op off-menu and never blinks when reduced', (() => {
  game.menuOpen = false; Mascot.setLids(false); Mascot.nextBlink = 500;
  Mascot.frame(600);
  const offMenu = !Mascot.lidsClosed;
  game.menuOpen = true; Mascot.reduced = true;
  Mascot.frame(600);
  const reduced = !Mascot.lidsClosed;
  Mascot.reduced = false; Mascot.nextBlink = 1e15;
  return offMenu && reduced;
})());
T('mascot: furFor maps all four species, falls back to Tabby', (
  Mascot.furFor(0).fur === '#b08968' &&
  Mascot.furFor(1).fur === '#e8913a' &&
  Mascot.furFor(2).fur === '#4a4a52' &&
  Mascot.furFor(3).fur === '#e6d7bd' &&
  Mascot.furFor(9).fur === '#b08968' &&
  Mascot.furFor(-1).fur === '#b08968' &&
  Mascot.LOOKS.every(l => typeof l.head === 'string' && l.head.length > 10)
));
T('mascot: refresh re-tints without throwing for every species', (() => {
  const keep = Profile.setting('cat', 0);
  for (let i = 0; i < 4; i++) { Profile.setSetting('cat', i); Mascot.refresh(); }
  Profile.setSetting('cat', keep); Mascot.refresh();
  return true;
})());
T('mascot: pet meows weight-pitched, then the cooldown blocks spam', (() => {
  loadLevel(0); // weightLb = START_LB
  const realMeow = AudioSys.meow;
  const calls = [];
  AudioSys.meow = function (big) { calls.push(big); };
  Mascot.lastPet = -1e9; Mascot.reduced = false;
  Mascot.pet();
  Mascot.pet(); // inside the 700ms cooldown: swallowed
  AudioSys.meow = realMeow;
  return calls.length === 1 && calls[0] === chonkT(game.weightLb);
})());
