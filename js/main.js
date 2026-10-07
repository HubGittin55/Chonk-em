'use strict';
/* CHONK'EM v0.1 — game orchestration: loop, states, scoring, rendering. */

const W = 600, H = 900;
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
document.getElementById('retry').addEventListener('click', () => loadLevel(game.levelIndex));
const nextBtn = document.getElementById('next');
nextBtn.addEventListener('click', () => { hideOverlay(); loadLevel(game.levelIndex + 1); });

// ctx.roundRect fallback for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

function fitCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

const SHOOT = { x: 300, y: 86 };
const BALL_SPEED = 640, BALL_R = 10;
const ITEM_GRAV = 1150;
// Exponential stage thresholds (~2.3x per stage): each size-up costs
// dramatically more calories than the last (owner directive).
const STAGES = [
  { at: 0,    name: 'Scrawny' },
  { at: 25,   name: 'Chonklet' },
  { at: 60,   name: 'Chunky' },
  { at: 140,  name: 'Chonky' },
  { at: 320,  name: 'Big Chonk' },
  { at: 730,  name: 'Heavyweight' },
  { at: 1650, name: 'Massive' },
  { at: 3750, name: 'Colossal' },
  { at: 8500, name: 'ABSOLUTE UNIT' },
];
// (body half-width is now weight-driven: catRx(chonkT(weightLb)))

// ---- Lifetime weight system: the cat keeps its chonk between levels ----
const LB_PER_CAL = 0.3, START_LB = 5.0, MAX_VIS_LB = 80, MAX_LB = 150; // even bigger chonk
// Species unlocks: total stars are never spent, they just gate the roster.
const CAT_UNLOCKS = [
  { name: 'Tabby',  icon: '\U0001F431', stars: 0 },
  { name: 'Orange', icon: '\U0001F408', stars: 8 },
  { name: 'Tuxedo', icon: '\U0001F408\u200D\u2B1B', stars: 25 },
  { name: 'Calico', icon: '\U0001F43E', stars: 60 },
];
function totalStars() {
  const b = store.get('best', {});
  return Object.values(b).reduce((a, r) => a + ((r && r.stars) || 0), 0);
}
function catUnlocked(i) { return totalStars() >= CAT_UNLOCKS[i].stars; }
function selectedCat() {
  const i = Math.max(0, Math.min(3, store.get('cat', 0) | 0));
  return catUnlocked(i) ? i : 0;
} // 0.3 lb/cal: 100 cal = 30 lb; food in the barrels is the only limit
const DIFFS = {
  easy:   { balls: 1.3, goal: 0.8,  vacuum: 0.8,  label: '😌 Easy' },
  normal: { balls: 1.0, goal: 1.0,  vacuum: 1.0,  label: '😼 Normal' },
  hard:   { balls: 0.8, goal: 1.2,  vacuum: 1.25, label: '🙀 Hard' },
};
const LB_MILESTONES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150];
const chonkT = (lb) => Math.max(0, Math.min(1, (lb - 10) / (MAX_VIS_LB - 10)));
const catRx = (t) => 62 + t * 88; // body half-width from chonk factor

// localStorage helpers (best stars, settings)
const store = {
  get(k, d) { try { const v = localStorage.getItem('chonk-em:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('chonk-em:' + k, JSON.stringify(v)); } catch (e) {} },
};
function saveBest(idx, stars, cal) {
  const best = store.get('best', {});
  const cur = best[idx] || { stars: 0, cal: 0 };
  best[idx] = { stars: Math.max(cur.stars, stars), cal: Math.max(cur.cal, cal) };
  store.set('best', best);
}

const game = {
  levelIndex: 0, level: null,
  balls: 0, shots: [], items: [], barrels: [], particles: [],
  multiShots: 0, slowT: 0, magnetT: 0, bridgeT: 0, shotsFired: 0,
  calories: 0, stage: 0, combo: 0, mult: 1,
  time: 0, over: null, popups: [],
  nomT: 0, face: 'normal', faceT: 0,
  aim: null, aimAng: null,
  jiggle: 0, jiggleV: 0, displayRx: catRx(0), // jiggle mirrors wob.belly (smoke-test compat)
  wob: { belly: { x: 0, v: 0 }, cheek: { x: 0, v: 0 }, tail: { x: 0, v: 0 } },
  weightLb: START_LB,
  timeScale: 1, frenzy: 0,
  misses: 0, veggies: 0, stageMisses: 0, stageVeggies: 0,
};

function stageFor(cal) {
  let s = 0;
  for (let i = 0; i < STAGES.length; i++) if (cal >= STAGES[i].at) s = i;
  return s;
}

function loadLevel(i) {
  const L = getLevel(i);
  game.levelIndex = i;
  game.level = L;
  game.catVar = selectedCat(); // player's unlocked species
  game.particles = [];
  nextBtn.classList.add('hidden');
  game.diffKey = store.get('difficulty', 'normal');
  const D = DIFFS[game.diffKey] || DIFFS.normal;
  game.balls = Math.round(L.balls * D.balls);
  game.par = Math.round(L.par * D.balls);
  game.goalNow = Math.round(L.goal * D.goal);
  game.shots = [];
  game.multiShots = 0; game.maxCombo = 0; game.splitNext = false; game.weigh = null; game.shakeT = 0; game.slowT = 0; game.magnetT = 0; game.bridgeT = 0; game.shotsFired = 0;
  game.weightLb = START_LB; // size resets every level (owner)
  game.lbPerCal = LB_PER_CAL; // flat 0.3 lb/cal — the food in the barrels is the only limit
  game.items = [];
  game.popups = [];
  game.vacuum = L.vacuum ? Vacuum.create((DIFFS[game.diffKey] || DIFFS.normal).vacuum) : null;
  if (game.vacuum) addPopup(W / 2, 330, '⚠ VACUUM PATROL ⚠', '#c62828');
  game.barrels = L.barrels.map(b => ({ x: b.x, y: b.y, r: L.r || 15, kind: b.kind, content: b.content, armor: !!b.armor, cracked: false, cleared: false }));
  game.calories = 0;
  game.stage = 0;
  game.combo = 0; game.mult = 1;
  game.over = null;
  game.aim = null; game.aimAng = null;
  game.nomT = 0; game.face = 'normal'; game.faceT = 0;
  game.jiggle = 0; game.jiggleV = 0;
  game.wob = { belly: { x: 0, v: 0 }, cheek: { x: 0, v: 0 }, tail: { x: 0, v: 0 }, sub: { x: 0, v: 0 } };
  game.displayRx = catRx(chonkT(game.weightLb));
  game.timeScale = 1; game.frenzy = 0;
  game.misses = 0; game.veggies = 0; game.stageMisses = 0; game.stageVeggies = 0;
  hideOverlay();
}

function addPopup(x, y, text, color) {
  game.popups.push({ x, y, text, color: color || '#fff', t: 0 });
}

// Multi-spring wobble impulse: part is 'belly' | 'cheek' | 'tail'
function wobbleImpulse(part, amt) {
  const w = game.wob[part];
  if (!w) return;
  const chonkScale = part === 'belly' ? 1 + chonkT(game.weightLb) * 1.5 : 1;
  w.v += amt * chonkScale * (REDUCED ? 0.35 : 1);
  if (part === 'belly') { game.jiggle = w.x; game.jiggleV = w.v; } // legacy mirror
}

const LB_MSGS = { 10: 'DOUBLE DIGITS!', 20: '20 LB CLUB!', 30: 'CERTIFIED CHONK!', 40: 'FAT CITY!', 50: 'HEAVYWEIGHT CHAMPION!', 60: 'WHEELED AWAY!', 70: 'COLOSSAL!', 80: 'ABSOLUTE UNIT!', 90: 'NINETY!', 100: 'CENTURY CHONK!', 110: 'MASSIVE!', 120: 'GARGANTUAN!', 130: 'PLANETARY!', 140: 'TITANIC!', 150: 'MAXIMUM CHONK!' };
function checkLbMilestones(before, after) {
  for (const m of LB_MILESTONES) {
    if (before < m && after >= m) {
      addPopup(300, 340, '⚖ ' + m + ' lb — ' + LB_MSGS[m], '#6a1b9a');
      AudioSys.meow(Math.min(1, m / 100));
      AudioSys.jingle();
      game.face = 'bliss'; game.faceT = 2.5;
      wobbleImpulse('belly', 4); wobbleImpulse('cheek', 2);
    }
  }
}

function aimAngleFor(px, py) {
  const dx = px - SHOOT.x, dy = py - SHOOT.y;
  if (dy < 30) return null;
  let ang = Math.atan2(dy, dx);
  const lo = 10 * Math.PI / 180, hi = 170 * Math.PI / 180;
  return Math.max(lo, Math.min(hi, ang));
}

function fireShot(px, py) {
  AudioSys.shoot();
  if (game.vacuum) game.vacuum.eatenThisShot = 0; // vacuum gets 2 items per shot
  if (game.over || game.shots.length || game.balls <= 0) return;
  const ang = aimAngleFor(px, py);
  if (ang == null) return;
  let angs = [ang];
  if (game.multiShots > 0) { game.multiShots--; angs = [ang - 0.13, ang, ang + 0.13]; }
  for (const a of angs) {
    if (game.balls <= 0) break;
    const nb = {
      x: SHOOT.x, y: SHOOT.y + 26,
      vx: Math.cos(a) * BALL_SPEED, vy: Math.sin(a) * BALL_SPEED,
      r: BALL_R, life: 0, slowT: 0, bounces: 0,
    };
    if (game.splitNext && game.shots.length === 0) { nb.splitArmed = true; game.splitNext = false; }
    game.shots.push(nb);
    game.balls--;
    game.shotsFired++;
  }
  AudioSys.pop();
}

function spawnChips(x, y) {
  if (REDUCED) return;
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 260;
    game.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14,
      size: 3 + Math.random() * 5, life: 0.5 + Math.random() * 0.5,
      color: i % 3 === 0 ? '#8a5a2b' : (i % 3 === 1 ? '#b5813f' : '#6f451f'),
    });
  }
  if (game.particles.length > 140) game.particles.splice(0, game.particles.length - 140);
}

function spawnCrumbs(x, y) {
  if (REDUCED) return;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.6, sp = 60 + Math.random() * 120;
    game.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      rot: 0, vr: 0, size: 2 + Math.random() * 2.5, life: 0.35 + Math.random() * 0.3,
      color: '#e9c58a',
    });
  }
}

function tickParticles(dt) {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.life -= dt;
    if (p.life <= 0) { game.particles.splice(i, 1); continue; }
    p.vy += 900 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
  }
}

function drawParticles(ctx) {
  for (const p of game.particles) {
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.globalAlpha = Math.min(1, p.life * 2.5);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function onBarrelCrack(barrel) {
  addPopup(barrel.x, barrel.y - 28, 'CRACKED!', '#78909c');
  AudioSys.tink();
}

function onBarrelBurst(barrel, ball) {
  // Split-yarn: the armed ball divides into three on its first burst
  if (ball && ball.splitArmed && !ball.splitDone) {
    ball.splitDone = true;
    const sp = Math.hypot(ball.vx, ball.vy) || BALL_SPEED;
    const base = Math.atan2(ball.vy, ball.vx);
    for (const da of [-0.5, 0.5]) {
      game.shots.push({
        x: ball.x, y: ball.y,
        vx: Math.cos(base + da) * sp * 0.92, vy: Math.sin(base + da) * sp * 0.92,
        r: ball.r, life: 0, slowT: 0, bounces: 0,
      });
    }
    addPopup(ball.x, ball.y - 24, 'SPLIT!', '#7b1fa2');
    AudioSys.pop();
  }
  spawnChips(barrel.x, barrel.y);
  if (barrel.kind === 'keg') { explode(barrel.x, barrel.y); return; } // powder keg: chain explosion
  if (barrel.kind === 'empty') { AudioSys.burst(); return; } // hollow barrel: no loot inside
  const c = CONTENT[barrel.content];
  const label = c.power ? '★' : (c.cal > 0 ? '+' + c.cal : '' + c.cal);
  addPopup(barrel.x, barrel.y - 28, label, c.power ? '#ef6c00' : c.cal > 0 ? '#2e7d32' : '#c62828');
  AudioSys.burst();
  const pop = 1 - 0.35 * (c.grav - 1); // heavy loot pops weaker
  game.items.push({
    x: barrel.x, y: barrel.y,
    vx: (Math.random() - 0.5) * 150, vy: (-60 - Math.random() * 90) * pop,
    r: 9, state: 'fall', cal: c.cal, icon: c.icon, name: c.name, content: barrel.content,
    grav: c.grav, drift: c.drift, power: c.power || null,
    t: 0, gone: false,
  });
}

function explode(x, y) {
  AudioSys.boom();
  game.shakeT = 0.35;
  addPopup(x, y - 30, 'BOOM!', '#d32f2f');
  if (!REDUCED) for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 320;
    game.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14,
      size: 3 + Math.random() * 6, life: 0.5 + Math.random() * 0.6,
      color: ['#ff6f00', '#ffca28', '#d32f2f', '#616161'][i % 4],
    });
  }
  for (const b of game.barrels) {
    if (b.cleared || b.kind === 'steel') continue; // steel is blast-proof
    if (Math.hypot(b.x - x, b.y - y) < 80) {
      b.cleared = true; b.popT = 0;
      onBarrelBurst(b, null); // chain: kegs recurse, loot spawns normally
    }
  }
}

function onBarrelSpecial(kind, b, ball) {
  if (kind === 'steel') {
    AudioSys.clang();
    addPopup(b.x, b.y - 26, 'CLANG!', '#78909c');
    spawnChips(b.x, b.y);
  } else if (kind === 'bumper') {
    AudioSys.boing();
    game.combo++;
    game.maxCombo = Math.max(game.maxCombo || 0, game.combo);
    addPopup(b.x, b.y - 26, 'BOING! +1', '#ef6c00');
    spawnChips(b.x, b.y);
  }
}

function deliver(item) {
  if (game.over) return;
  if (item.power) {
    game.nomT = 0.6;
    game.face = 'happy'; game.faceT = 1.2;
    wobbleImpulse('cheek', 1.5); wobbleImpulse('belly', 1);
    AudioSys.powerup();
    if (item.power === 'multi')  { game.multiShots = 1;    addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, '★ MULTI-YARN!', '#ef6c00'); }
    if (item.power === 'wide')   { game.bridgeT = 15;      addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, '★ BRIDGE!', '#ef6c00'); }
    if (item.power === 'slow')   { game.slowT = 5;         addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, '★ SLOW-MO!', '#ef6c00'); }
    if (item.power === 'magnet') { game.magnetT = 15;      addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, '★ MAGNET!', '#ef6c00'); }
    if (item.power === 'split')  { game.splitNext = true;  addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, '★ SPLIT YARN!', '#ef6c00'); }
    return;
  }
  const before = game.stage;

  // Combo calorie multiplier: every 3 clean deliveries bumps it, cap ×4.
  game.mult = Math.min(4, 1 + Math.floor(game.combo / 3));
  const gained = item.cal > 0 ? item.cal * game.mult : item.cal;

  game.calories = Math.max(0, game.calories + gained);
  game.stage = stageFor(game.calories);
  game.nomT = 0.6;

  // Weight from RAW calories only (no combo inflation). Veggies never slim the cat.
  if (item.cal > 0) {
    const beforeLb = game.weightLb;
    game.weightLb = Math.min(MAX_LB, game.weightLb + item.cal * (game.lbPerCal || LB_PER_CAL));
    store.set('weight', game.weightLb);
    checkLbMilestones(beforeLb, game.weightLb);
  }
  wobbleImpulse('belly', item.cal > 0 ? 1.6 + gained * 0.35 : 1.0);
  wobbleImpulse('cheek', item.cal > 0 ? 1.2 : 0.5);
  wobbleImpulse('tail', 0.8);

  if (item.cal < 0) {
    game.combo = 0; game.mult = 1;
    game.veggies++; game.stageVeggies++;
    game.face = 'disgust'; game.faceT = 1.8;
    AudioSys.sad();
    addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, gained + ' ugh', '#c62828');
  } else {
    game.combo++;
    game.maxCombo = Math.max(game.maxCombo || 0, game.combo);
    AudioSys.nom();
    addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, '+' + gained, '#2e7d32');
    spawnCrumbs(Conveyor.BOWL_X, Conveyor.BOWL_Y - 18);
    if (game.combo >= 2) {
      addPopup(Conveyor.BOWL_X + 96, Conveyor.BOWL_Y - 96,
        'COMBO ×' + game.combo + (game.mult > 1 ? '  (×' + game.mult + ' cal)' : ''), '#ff8f00');
    }
  }

  if (game.stage > before) {
    const cleanStage = game.stageMisses === 0 && game.stageVeggies === 0;
    game.face = game.stage >= 3 ? 'bliss' : 'happy';
    game.faceT = 2.2;
    addPopup(360, 660, 'CHONK UP: ' + STAGES[game.stage].name + '!', '#6a1b9a');
    AudioSys.jingle();
    game.stageMisses = 0; game.stageVeggies = 0;
    if (cleanStage) triggerFrenzy();
  }

  if (game.calories >= game.goalNow) endGame(true);
}

function triggerFrenzy() {
  game.frenzy = 6;          // seconds of slow-mo
  game.timeScale = 0.35;
  game.balls += 2;          // the cat demands MORE
  game.face = 'bliss'; game.faceT = 6;
  wobbleImpulse('belly', 5); wobbleImpulse('cheek', 3); wobbleImpulse('tail', 3);
  addPopup(300, 420, 'FEAST FRENZY! +2 🧶', '#ff6f00');
  AudioSys.frenzy();
}

function loseItem(item) {
  if (game.over) return;
  game.combo = 0; game.mult = 1;
  game.misses++; game.stageMisses++;
  game.face = 'sad'; game.faceT = 1.2;
  AudioSys.sad();
  addPopup(Math.max(40, Math.min(W - 40, item.x)), H - 70, 'lost…', '#8a7a66');
}

function rawCal(L) {
  return L.barrels.filter(b => b.kind === 'snack')
    .reduce((a, b) => a + ((CONTENT[b.content] || {}).cal || 0), 0);
}
// Stars are WEIGHT stars now: 1 = goal met, 2 = 75% of the level's food delivered, 3 = 90%.
function starsFor(lb, L) {
  const max = START_LB + LB_PER_CAL * rawCal(L);
  const frac = (lb - START_LB) / Math.max(1, max - START_LB);
  return frac >= 0.9 ? 3 : frac >= 0.75 ? 2 : 1;
}

function endGame(win) {
  if (game.over) return;
  game.over = win ? 'win' : 'lose';
  if (win) {
    const before = CAT_UNLOCKS.filter((c, i) => i > 0 && catUnlocked(i)).length;
    const n = starsFor(game.weightLb, game.level);
    saveBest(game.levelIndex, n, game.calories);
    const after = CAT_UNLOCKS.filter((c, i) => i > 0 && catUnlocked(i)).length;
    game.justUnlocked = after > before ? CAT_UNLOCKS[after].name : null;
    showResults(n);
  } else {
    AudioSys.lose();
    overlayTitle.textContent = 'Still scrawny…';
    overlaySub.textContent = `${game.calories}/${game.goalNow} calories. The cat demands another try.`;
    nextBtn.classList.add('hidden');
    overlay.classList.remove('hidden');
  }
}

/* ---------------- weigh-in results ceremony ---------------- */
const resultsEl = () => document.getElementById('results');
const scaleCv = () => document.getElementById('scaleCanvas');

function showResults(nStars) {
  const w = game.weigh = {
    t: 0, dur: 2.6, shown: START_LB, target: game.weightLb, stars: nStars,
    lit: 0, ticked: START_LB, finale: false, confetti: [],
  };
  for (let k = 0; k < 3; k++) {
    const sp = document.getElementById('rs' + k);
    sp.textContent = '☆'; sp.className = '';
  }
  document.getElementById('res-title').textContent = '⚖ WEIGH-IN! ⚖';
  document.getElementById('res-sub').textContent = '';
  for (const id of ['res-retry', 'res-menu', 'res-next']) document.getElementById(id).style.visibility = 'hidden';
  document.getElementById('res-next').style.display = game.levelIndex + 1 < NUM_LEVELS ? '' : 'none';
  AudioSys.sfx('splash', function() { this.tone(400, 0.25, 'sine', 0.06, 800); });
  resultsEl().classList.remove('hidden');
  drawScale(w);
}

function hideResults() { resultsEl().classList.add('hidden'); game.weigh = null; }

function updateWeigh(dt) { // real-time, called from tick()
  const w = game.weigh;
  if (!w) return;
  w.t += dt;
  const k = Math.min(1, w.t / w.dur);
  const ease = 1 - Math.pow(1 - k, 3);
  w.shown = START_LB + (w.target - START_LB) * ease;
  // tick sounds as the needle climbs
  while (w.ticked + 2 <= w.shown) { w.ticked += 2; AudioSys.tick(600 + w.ticked * 9); }
  // star pops as the needle crosses each star's weight
  const max = START_LB + LB_PER_CAL * rawCal(game.level);
  const need = [0, 0, START_LB + 0.75 * (max - START_LB), START_LB + 0.9 * (max - START_LB)];
  const span = i => document.getElementById('rs' + i);
  for (let st = 2; st <= w.stars; st++) {
    if (w.shown >= need[st] && w.lit < st) {
      w.lit = st;
      span(st - 1).textContent = '★'; span(st - 1).className = 'lit pop';
      AudioSys.starPop();
    }
  }
  if (w.lit < 1 && k >= 1) { // first star always lights at the end
    w.lit = 1; span(0).textContent = '★'; span(0).className = 'lit pop'; AudioSys.starPop();
  }
  drawScale(w);
  if (k >= 1 && !w.finale) {
    w.finale = true;
    const sub = document.getElementById('res-sub');
    if (w.stars === 1) {
      AudioSys.trombone();
      sub.textContent = `${game.calories} cal · best combo ×${game.maxCombo || 1} · ${w.target.toFixed(1)} lb — the cat wanted more snacks. Womp womp.`;
    } else if (w.stars === 2) {
      AudioSys.jingle();
      sub.textContent = `${game.calories} cal · best combo ×${game.maxCombo || 1} · ${w.target.toFixed(1)} lb — a respectable chonk!`;
    } else {
      AudioSys.fanfare();
      for (let i = 0; i < 90; i++) w.confetti.push({
        x: 160 + (Math.random() - 0.5) * 120, y: -10 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 60, vy: 60 + Math.random() * 120,
        c: ['#e91e63', '#ff9800', '#ffeb3b', '#4caf50', '#2196f3', '#9c27b0'][i % 6],
        r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 10,
      });
      sub.textContent = `${game.calories} cal · best combo ×${game.maxCombo || 1} · ${w.target.toFixed(1)} lb — CERTIFIED MAXIMUM CHONK!`;
    }
    if (game.justUnlocked) {
      sub.textContent += ` \U0001F408 NEW CAT UNLOCKED: ${game.justUnlocked}!`;
      AudioSys.sfx('unlock', function() { [660, 880, 1108, 1318].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'triangle', 0.10), i * 100)); });
    }
    if (game.levelIndex + 1 >= NUM_LEVELS) sub.textContent += ' All levels chonked! 👑';
    for (const id of ['res-retry', 'res-menu', 'res-next']) document.getElementById(id).style.visibility = 'visible';
  }
  // confetti physics
  for (const c of w.confetti) { c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt; }
  w.confetti = w.confetti.filter(c => c.y < 260);
  if (w.confetti.length) drawScale(w);
}

function drawScale(w) {
  const cv = scaleCv(); if (!cv) return;
  const ctx = cv.getContext('2d');
  const lb = w.shown;
  ctx.clearRect(0, 0, 320, 250);
  const cx = 160, cy = 132, R = 92;
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  const ang = l => a0 + (Math.min(l, MAX_LB) / MAX_LB) * (a1 - a0);
  // dial face
  ctx.beginPath(); ctx.arc(cx, cy, R + 10, 0, 7); ctx.fillStyle = '#fffdf5'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.lineWidth = 12; ctx.strokeStyle = '#ffe9c4'; ctx.stroke();
  for (let v = 0; v <= MAX_LB; v += 10) {
    const a = ang(v), big = v % 30 === 0, r1 = R - (big ? 15 : 9), r2 = R - 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.lineWidth = big ? 3 : 1.5; ctx.strokeStyle = '#5d4037'; ctx.stroke();
    if (big) {
      ctx.fillStyle = '#5d4037'; ctx.font = '10px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(v, cx + Math.cos(a) * (R - 26), cy + Math.sin(a) * (R - 26));
    }
  }
  // needle
  const a = ang(lb);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
  ctx.fillStyle = '#d32f2f';
  ctx.beginPath(); ctx.moveTo(-8, -3.5); ctx.lineTo(R - 10, 0); ctx.lineTo(-8, 3.5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 7); ctx.fillStyle = '#5d4037'; ctx.fill();
  // scale platform + the chonk under test (squashes as the needle climbs)
  ctx.fillStyle = '#8d6e63';
  ctx.beginPath(); ctx.roundRect(70, 208, 180, 14, 6); ctx.fill();
  ctx.fillStyle = '#5d4037';
  ctx.beginPath(); ctx.roundRect(140, 222, 40, 8, 3); ctx.fill();
  const cs = 30 + lb * 0.32, squash = 1 - Math.min(0.3, lb / 500);
  ctx.save(); ctx.translate(160, 208); ctx.scale(1 + (1 - squash) * 0.7, squash);
  ctx.font = cs + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('🐱', 0, 0); ctx.restore();
  // digital readout
  ctx.fillStyle = '#212121'; ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(lb.toFixed(1) + ' lb', 160, 226);
  // confetti
  for (const c of w.confetti) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r);
    ctx.fillStyle = c.c; ctx.fillRect(-4, -2.5, 8, 5); ctx.restore();
  }
}

function hideOverlay() { overlay.classList.add('hidden'); }

function tick(dt) {
  game.time += dt;

  updateWeigh(dt);
  if (game.shakeT > 0) game.shakeT -= dt;

  // Real-time UI timers (unaffected by slow-mo)
  for (const p of game.popups) p.t += dt;
  game.popups = game.popups.filter(p => p.t < 1.3);
  if (game.nomT > 0) game.nomT -= dt;
  if (game.faceT > 0) { game.faceT -= dt; if (game.faceT <= 0) game.face = 'normal'; }
  if (game.frenzy > 0) {
    game.frenzy -= dt;
    if (game.frenzy <= 0) { game.frenzy = 0; game.timeScale = 1; }
  }

  // World updates run at timeScale (slow-mo during FEAST FRENZY or slow-mo power-up)
  if (game.slowT > 0) { game.slowT -= dt; if (game.frenzy <= 0) game.timeScale = 0.45; }
  else if (game.frenzy <= 0) game.timeScale = 1;
  const wdt = dt * game.timeScale;
  Conveyor.t += wdt;
  tickParticles(dt);

  // Multi-spring wobble: belly (slow, heavy), cheek (quick), tail (sway).
  // game.jiggle mirrors the belly spring for smoke-test compatibility.
  const WOBK = { belly: { k: 26, c: 3.6 }, cheek: { k: 55, c: 5 }, tail: { k: 40, c: 3.4 } };
  for (const p of ['belly', 'cheek', 'tail']) {
    const w = game.wob[p], K = WOBK[p];
    w.v += (-K.k * w.x - K.c * w.v) * wdt;
    w.x += w.v * wdt;
  }
  game.jiggle = game.wob.belly.x; game.jiggleV = game.wob.belly.v;
  // sub-belly: slow secondary wobble lagging the main belly spring
  const sb = game.wob.sub, bw = game.wob.belly;
  sb.v += (-14 * (sb.x - bw.x * 0.6) - 2.2 * sb.v) * wdt;
  sb.x += sb.v * wdt;
  const targetRx = catRx(chonkT(game.weightLb));
  game.displayRx += (targetRx - game.displayRx) * Math.min(1, dt * 4);

  if (game.magnetT > 0) game.magnetT -= dt;
  if (game.bridgeT > 0) game.bridgeT -= dt;

  for (let i = game.shots.length - 1; i >= 0; i--) {
    if (Physics.stepBall(game.shots[i], wdt, game.barrels, onBarrelBurst, onBarrelCrack, onBarrelSpecial)) game.shots.splice(i, 1);
  }

  for (const it of game.items) {
    it.t += wdt;
    if (it.state === 'fall') {
      it.vy += ITEM_GRAV * (it.grav || 1) * wdt;
      if (it.drift) it.vx += Math.sin(it.t * 7) * it.drift * wdt;
      if (game.magnetT > 0) it.vx += Math.sign(Conveyor.BOWL_X - it.x) * 300 * wdt;
      it.x += it.vx * wdt;
      it.y += it.vy * wdt;
      // Food bounces off barrels but NEVER breaks them (burst is yarn-only).
      Physics.bounceItem(it, game.barrels);
      // Side walls
      if (it.x < 20) { it.x = 20; it.vx = Math.abs(it.vx) * 0.5; }
      if (it.x > 580) { it.x = 580; it.vx = -Math.abs(it.vx) * 0.5; }
      // Belt: bounce a couple of times, then settle and ride
      if (it.y >= Conveyor.BELT_Y && it.vy > 0 && !it.sucked && Conveyor.onBelt(it.x, game.bridgeT > 0)) {
        if (it.vy > 110) {
          it.y = Conveyor.BELT_Y;
          it.vy = -it.vy * 0.45;
          it.vx *= 0.7;
          it.bounces = (it.bounces || 0) + 1;
        } else {
          it.state = 'belt'; it.y = Conveyor.BELT_Y; it.vy = 0;
          AudioSys.catch();
        }
      }
      // Tile floor: missed food bounces, then it's lost
      if (it.state === 'fall' && it.y >= 853 && it.vy > 0) {
        it.bounces = (it.bounces || 0) + 1;
        if (it.bounces >= 3 || it.vy < 90) { it.gone = true; loseItem(it); }
        else { it.y = 853; it.vy = -it.vy * 0.35; it.vx *= 0.6; }
      }
      if (it.y > H + 40 && !it.gone) { it.gone = true; loseItem(it); }
    } else if (it.state === 'belt') {
      it.x -= Conveyor.SPEED * wdt;
      if (it.x <= Conveyor.BOWL_X) it.state = 'drop';
    } else if (it.state === 'drop') {
      it.y += 460 * wdt;
      if (it.y >= Conveyor.BOWL_Y && !it.gone) { it.gone = true; deliver(it); }
    }
  }
  game.items = game.items.filter(i => !i.gone);

  if (game.vacuum) Vacuum.tick(game.vacuum, wdt, game.items, (x, y, it) => {
    AudioSys.slurp();
    addPopup(x, y - 22, 'VACUUM\'D!', '#7b1fa2');
    spawnCrumbs(x, y);
    if ((game.vacuum.eatenThisShot || 0) >= 2) addPopup(x, y - 44, 'VACUUM FULL', '#7b1fa2');
  });

  if (!game.over && game.balls <= 0 && !game.shots.length && game.items.length === 0) endGame(false);
}

/* ---------------- rendering ---------------- */

function drawBackground() {
  if (typeof Assets !== 'undefined' && Assets.ok('kitchen_bg')) {
    ctx.drawImage(Assets.imgs.kitchen_bg, 0, 0, W, H);
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#f9ecd8');
  g.addColorStop(0.7, '#f0d5ae');
  g.addColorStop(1, '#e8c493');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Kitchen window, upper right, with sunbeam
  const wx = 428, wy = 128, ww = 132, wh = 118;
  const sky = ctx.createLinearGradient(wx, wy, wx, wy + wh);
  sky.addColorStop(0, '#bfe3f2'); sky.addColorStop(1, '#e8f4d8');
  ctx.fillStyle = sky;
  ctx.fillRect(wx, wy, ww, wh);
  // sun + distant hills through the glass
  ctx.fillStyle = '#ffe98a';
  ctx.beginPath(); ctx.arc(wx + 96, wy + 30, 16, 0, 7); ctx.fill();
  ctx.fillStyle = '#a8c98a';
  ctx.beginPath();
  ctx.moveTo(wx, wy + wh); ctx.quadraticCurveTo(wx + 40, wy + 74, wx + 82, wy + wh);
  ctx.closePath(); ctx.fill();
  // frame + mullions
  ctx.strokeStyle = '#8a5f33'; ctx.lineWidth = 8;
  ctx.strokeRect(wx, wy, ww, wh);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
  ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
  ctx.stroke();
  // soft sunbeam across the playfield
  ctx.fillStyle = 'rgba(255,232,160,0.10)';
  ctx.beginPath();
  ctx.moveTo(wx + 20, wy + wh); ctx.lineTo(wx + ww - 10, wy + wh);
  ctx.lineTo(wx - 190, 660); ctx.lineTo(wx - 260, 660);
  ctx.closePath(); ctx.fill();

  // Playfield side walls (wood posts with bolt caps)
  ctx.fillStyle = '#8a5f33';
  ctx.fillRect(12, 120, 10, 540);
  ctx.fillRect(578, 120, 10, 540);
  ctx.fillStyle = '#6d4a26';
  for (const py of [130, 300, 470, 640]) {
    ctx.fillRect(12, py, 10, 5);
    ctx.fillRect(578, py, 10, 5);
  }
  ctx.fillStyle = '#c8a06e';
  ctx.fillRect(12, 120, 10, 6);
  ctx.fillRect(578, 120, 10, 6);

  // Wainscot strip + baseboard above the belt zone
  ctx.fillStyle = 'rgba(160,110,60,0.14)';
  ctx.fillRect(0, 640, W, 26);
  ctx.fillStyle = 'rgba(120,80,40,0.22)';
  ctx.fillRect(0, 662, W, 4);

  // Tile floor with grout lines and a few paw prints
  ctx.fillStyle = '#d9b380';
  ctx.fillRect(0, 862, W, 38);
  ctx.strokeStyle = 'rgba(120,80,40,0.35)'; ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += 75) {
    ctx.beginPath(); ctx.moveTo(x, 862); ctx.lineTo(x - 14, H); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(120,80,40,0.18)';
  for (const [px, py, s] of [[330, 878, 1], [415, 888, 0.8], [70, 884, 0.9]]) {
    ctx.beginPath(); ctx.ellipse(px, py, 7 * s, 5 * s, 0, 0, 7); ctx.fill();
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath(); ctx.arc(px + k * 6 * s, py - 7 * s, 2.4 * s, 0, 7); ctx.fill();
    }
  }

  // Vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(60,35,10,0.14)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// High-contrast canvas text: dark outline under bright fill, readable over the kitchen bg.
function hudText(txt, x, y, size, color, align) {
  ctx.font = 'bold ' + size + 'px system-ui, sans-serif';
  ctx.textAlign = align || 'left'; ctx.textBaseline = 'top';
  ctx.lineWidth = Math.max(2, Math.round(size / 5));
  ctx.strokeStyle = 'rgba(18,9,4,0.92)';
  ctx.strokeText(txt, x, y);
  ctx.fillStyle = color; ctx.fillText(txt, x, y);
  ctx.textBaseline = 'alphabetic';
}
function drawHUD() {
  hudText('🧶 × ' + game.balls, 24, 14, 22, '#ffd9a8');
  hudText('⚖ ' + game.weightLb.toFixed(1) + ' lb', 24, 42, 19, '#ffd9a8');

  // Chonk meter
  const mw = 230, mx = W / 2 - mw / 2, my = 14;
  ctx.fillStyle = 'rgba(91,58,30,0.18)';
  ctx.beginPath(); ctx.roundRect(mx, my, mw, 20, 10); ctx.fill();
  const frac = Math.max(0, Math.min(1, game.calories / game.goalNow));
  if (frac > 0) {
    ctx.fillStyle = '#e8712b';
    ctx.beginPath(); ctx.roundRect(mx, my, mw * frac, 20, 10); ctx.fill();
  }
  hudText(`${STAGES[game.stage].name} · ${game.calories}/${game.goalNow} cal` +
    (game.mult > 1 ? ` · ×${game.mult}` : ''), W / 2, 40, 15, '#ffe9c9', 'center');
}

function drawPreview() {
  if (!game.aim || game.shots.length || game.over || game.balls <= 0) return;
  const ang = aimAngleFor(game.aim.x, game.aim.y);
  if (ang == null) return;
  game.aimAng = ang;
  let x = SHOOT.x, y = SHOOT.y + 26;
  let vx = Math.cos(ang) * BALL_SPEED, vy = Math.sin(ang) * BALL_SPEED;
  const s = 1 / 60;
  ctx.fillStyle = 'rgba(91,58,30,0.45)';
  for (let i = 0; i < 36; i++) {
    vy += Physics.GRAV * s;
    x += vx * s; y += vy * s;
    if (i % 3 === 0 && y < 660) {
      ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill();
    }
  }
}

function drawItems() {
  ctx.font = '22px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const it of game.items) {
    if (it.power) { // golden glow for power-ups
      ctx.fillStyle = 'rgba(255,193,7,0.45)';
      ctx.beginPath(); ctx.arc(it.x, it.y, 17, 0, 7); ctx.fill();
    }
    // tiny shadow
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath(); ctx.ellipse(it.x, it.y + 10, 8, 3, 0, 0, 7); ctx.fill();
    const key = 'food_' + it.content;
    if (typeof Assets !== 'undefined' && Assets.ok(key)) {
      const im = Assets.imgs[key], s = 40;
      ctx.drawImage(im, it.x - s / 2, it.y - s / 2, s, s);
      continue;
    }
    ctx.fillText(it.icon, it.x, it.y);
  }
  ctx.textBaseline = 'alphabetic';
}

function drawBall() {
  for (const b of game.shots) drawYarn(ctx, b.x, b.y, b.r + 3);
}

function drawPopups() {
  ctx.textAlign = 'center';
  for (const p of game.popups) {
    const a = p.t < 0.9 ? 1 : 1 - (p.t - 0.9) / 0.4;
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = p.color;
    ctx.strokeStyle = 'rgba(15,8,4,0.9)';
    ctx.lineWidth = 5;
    const y = p.y - p.t * 46;
    ctx.strokeText(p.text, p.x, y);
    ctx.fillText(p.text, p.x, y);
  }
  ctx.globalAlpha = 1;
}

function drawPowerHUD() {
  const bits = [];
  if (game.multiShots > 0) bits.push('🧶×3 NEXT');
  if (game.bridgeT > 0)     bits.push('⭐ BRIDGE ' + Math.ceil(game.bridgeT));
  if (game.slowT > 0)       bits.push('⭐ SLOW ' + Math.ceil(game.slowT));
  if (game.magnetT > 0)     bits.push('⭐ MAGNET ' + Math.ceil(game.magnetT));
  if (!bits.length) return;
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ef6c00';
  ctx.fillText(bits.join('   ·   '), W / 2, 68);
}

function drawHint() {
  if (game.over || game.shots.length || game.aim || game.balls <= 0) return;
  const pulse = 0.55 + 0.25 * Math.sin(game.time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#5b3a1e';
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('drag or tap to aim, release to feed', W / 2, 620);
  ctx.globalAlpha = 1;
}

function drawFrenzy() {
  if (game.frenzy <= 0) return;
  const pulse = 1 + 0.07 * Math.sin(game.time * 10);
  ctx.save();
  ctx.translate(W / 2, 116);
  ctx.scale(pulse, pulse);
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.fillStyle = '#ff6f00';
  ctx.strokeText('FEAST FRENZY!', 0, 0);
  ctx.fillText('FEAST FRENZY!', 0, 0);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,111,0,0.4)';
  ctx.fillRect(W / 2 - 60, 128, 120 * Math.max(0, game.frenzy / 6), 6);
}

function render() {
  drawBackground();
  ctx.save();
  if (game.shakeT > 0) ctx.translate((Math.random() - 0.5) * game.shakeT * 36, (Math.random() - 0.5) * game.shakeT * 36);
  drawBarrels(ctx, game.barrels, game.time);
  Conveyor.draw(ctx, game.bridgeT > 0);
  drawItems();
  drawPreview();
  drawBall();
  drawParticles(ctx);
  ctx.restore();
  Cats.drawShooter(ctx, SHOOT.x, SHOOT.y, game.aimAng, !game.shots.length && game.balls > 0 && !game.over);
  Cats.drawMain(ctx, 252, 806, {
    t: chonkT(game.weightLb), lb: game.weightLb, wob: game.wob, var: game.catVar,
    nomT: game.nomT, face: game.face, time: game.time,
  });
  if (game.vacuum) Vacuum.draw(ctx, game.vacuum); // after the cat: never hidden behind the chonk
  drawHUD();
  drawPowerHUD();
  drawFrenzy();
  drawPopups();
  drawHint();
}

/* ---------------- boot ---------------- */

const muteBtn = document.getElementById('mute');
function refreshMute() { muteBtn.textContent = AudioSys.muted ? '🔇' : '🔊'; }
muteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  AudioSys.init();
  AudioSys.toggle();
  refreshMute();
});
AudioSys.loadMute();
refreshMute();
game.weightLb = store.get('weight', START_LB);

Input.init({
  canAim: () => !game.over && !game.menuOpen && !game.shots.length && game.balls > 0,
  onAimStart: (p) => { game.aim = p; game.aimAng = aimAngleFor(p.x, p.y); },
  onAimMove: (p) => { if (game.aim) { game.aim = p; game.aimAng = aimAngleFor(p.x, p.y); } },
  onAimEnd: (p) => {
    if (game.aim) {
      const target = p || game.aim;
      game.aim = null;
      fireShot(target.x, target.y);
    }
    game.aimAng = null;
  },
});

loadLevel(0);

// ---- level select menu + reset ----
game.menuOpen = false;
const menuOverlay = document.getElementById('menuOverlay');
const levelGrid = document.getElementById('levelGrid');
function getBest() { return store.get('best', {}); }
function showMenu() {
  game.menuOpen = true;
  game.aim = null; game.aimAng = null;
  hideOverlay();
  const b = getBest();
  const dk = store.get('difficulty', 'normal');
  const D = DIFFS[dk] || DIFFS.normal;
  const diffRow = document.getElementById('diffRow');
  diffRow.innerHTML = '<span>Difficulty:</span>';
  Object.keys(DIFFS).forEach(k => {
    const btn = document.createElement('button');
    btn.textContent = DIFFS[k].label;
    if (k === dk) btn.className = 'sel';
    btn.addEventListener('click', (e) => { e.stopPropagation(); store.set('difficulty', k); showMenu(); });
    diffRow.appendChild(btn);
  });
  // species picker — total stars gate, never spent
  const catRow = document.getElementById('catRow');
  catRow.innerHTML = '<span>Cat:</span>';
  const tot = totalStars(), sel = selectedCat();
  CAT_UNLOCKS.forEach((c, i) => {
    const btn = document.createElement('button');
    const un = tot >= c.stars;
    btn.textContent = un ? `${c.icon} ${c.name}` : `🔒 ${c.stars}★`;
    btn.title = un ? c.name : `Earn ${c.stars} total stars to unlock ${c.name}`;
    if (i === sel) btn.className = 'sel';
    if (!un) btn.disabled = true;
    btn.addEventListener('click', (e) => { e.stopPropagation(); store.set('cat', i); showMenu(); });
    catRow.appendChild(btn);
  });
  levelGrid.innerHTML = '';
  for (let i = 0; i < NUM_LEVELS; i++) {
    const L = getLevel(i);
    const btn = document.createElement('button');
    const rec = b[i] || { stars: 0 };
    btn.className = i === game.levelIndex ? 'cur' : '';
    const tierNote = tierExotic(i + 1) && !tierExotic(i) ? ' <small>🆕 ' + tierExoticName(i + 1) + '</small>' : '';
    btn.innerHTML = (i + 1) + '. ' + L.name + tierNote +
      '<small>goal ' + Math.round(L.goal * D.goal) + ' cal</small>' +
      '<span class="stars">' + ('★'.repeat(rec.stars) || '☆☆☆') + '</span>';
    btn.addEventListener('click', () => { hideMenu(); loadLevel(i); showSplash(i); });
    levelGrid.appendChild(btn);
  }
  menuOverlay.classList.remove('hidden');
}
function hideMenu() { game.menuOpen = false; menuOverlay.classList.add('hidden'); }
document.getElementById('menuBtn').addEventListener('click', (e) => { e.stopPropagation(); showMenu(); });
document.getElementById('res-retry').addEventListener('click', () => { hideResults(); loadLevel(game.levelIndex); });
document.getElementById('res-menu').addEventListener('click', () => { hideResults(); showMenu(); });
document.getElementById('res-next').addEventListener('click', () => { hideResults(); loadLevel(game.levelIndex + 1); showSplash(game.levelIndex); });
document.getElementById('resetGame').addEventListener('click', (e) => {
  e.stopPropagation();
  if (confirm('Reset CHONK\'EM? This wipes best stars and the cat\'s saved weight.')) {
    Object.keys(localStorage).filter(k => k.startsWith('chonk-em:')).forEach(k => localStorage.removeItem(k));
    location.reload();
  }
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { game.menuOpen ? hideMenu() : showMenu(); }
});

// Level intro splash card
function showSplash(i) {
  const L = getLevel(i);
  const D = DIFFS[store.get('difficulty', 'normal')] || DIFFS.normal;
  document.getElementById('splashTitle').textContent = (i + 1) + '. ' + L.name;
  let sub = 'Goal ' + Math.round(L.goal * D.goal) + ' cal · ' + Math.round(L.balls * D.balls) + ' yarn · ' + D.label;
  if (tierExotic(i + 1) && !tierExotic(i)) sub += ' · 🆕 NEW: ' + tierExoticName(i + 1) + ' (' + tierMaxCal(i + 1) + ' cal)!';
  document.getElementById('splashSub').textContent = sub;
  const sp = document.getElementById('levelSplash');
  sp.classList.remove('hidden');
  clearTimeout(showSplash._t);
  showSplash._t = setTimeout(() => sp.classList.add('hidden'), 1800);
}

showMenu(); // boot into the level select

let last = performance.now(), acc = 0;
const STEP = 1 / 120;
function frame(now) {
  if (game.menuOpen) { render(); requestAnimationFrame(frame); return; }
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 0.1);
  acc += dt;
  while (acc >= STEP) { tick(STEP); acc -= STEP; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
