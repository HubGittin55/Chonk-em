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
// 10 worlds × 10 levels — the world-map level select groups by these.
const WORLDS = [
  'Kitchen', 'Pantry', 'Garden', 'Fish Market', 'Bakery',
  'Diner', 'Farm', 'Park Picnic', 'Candy Shop', 'Banquet Hall',
];
function totalStars() { return Profile.totalStars(); }
function catUnlocked(i) { return totalStars() >= CAT_UNLOCKS[i].stars; }
function selectedCat() {
  const i = Math.max(0, Math.min(3, Profile.setting('cat', 0) | 0));
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

// save helpers → Profile v2 (js/save.js). `store` survives for legacy read-only
// compat in the smoke harness; all live code goes through Profile.
const store = {
  get(k, d) { try { const v = localStorage.getItem('chonk-em:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('chonk-em:' + k, JSON.stringify(v)); } catch (e) {} },
};
function saveBest(idx, stars, cal) { Profile.saveBest(idx, stars, cal); }

const game = {
  levelIndex: 0, level: null, daily: null, // daily: { date } when playing the daily challenge
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

function loadLevel(i) { game.daily = null; startLevel(getLevel(i), i); }

function loadDaily() { // one fresh date-seeded level per calendar day
  const date = dailyKey();
  game.daily = { date };
  startLevel(genDailyLevel(date), -1);
  showDailySplash(date);
}

function startLevel(L, i) {
  const daily = !!game.daily;
  const dn = daily ? 100000 + (hashStr('chonk-deals-' + game.daily.date) % 800000) : i + 1; // 1-based deal number
  game.levelIndex = i;
  game.level = L;
  game.catVar = selectedCat(); // player's unlocked species
  game.particles = [];
  nextBtn.classList.add('hidden');
  game.diffKey = Profile.setting('difficulty', 'normal');
  const D = DIFFS[game.diffKey] || DIFFS.normal;
  game.balls = Math.round(L.balls * D.balls);
  game.par = Math.round(L.par * D.balls);
  game.goalNow = Math.round(L.goal * D.goal);
  game.shots = [];
  game.multiShots = 0; game.maxCombo = 0; game.splitNext = false; game.weigh = null; game.shakeT = 0; game.shakeAmt = 36; game.goalMet = false; game.slowT = 0; game.magnetT = 0; game.bridgeT = 0; game.shotsFired = 0;
  game.cukeT = 0; game.scareJump = 0; game.hitstopT = 0; game.fxSlowT = 0; game.fxSlowScale = 0.45; // FX bus state
  game.weightLb = START_LB; // size resets every level (owner)
  game.lbPerCal = LB_PER_CAL; // flat 0.3 lb/cal — the food in the barrels is the only limit
  game.items = [];
  game.popups = [];
  game.vacuum = L.vacuum ? Vacuum.create((DIFFS[game.diffKey] || DIFFS.normal).vacuum * (1 + 0.05 * (daily ? 5 : worldForLevel(i + 1)))) : null;
  if (game.vacuum) addPopup(W / 2, 330, '⚠ VACUUM PATROL ⚠', '#c62828');
  game.barrels = L.barrels.map(b => ({ x: b.x, y: b.y, r: L.r || 15, kind: b.kind, content: b.content, armor: !!b.armor, cracked: false, cleared: false }));
  dealSpecialBarrels(game.barrels, dn); // golden + mystery + rare cuke, dealt from empty slots
  dealMovers(game.barrels, dn); // world 4+: moving snack barrels on slow sinusoidal tracks
  game.calories = 0;
  game.stage = 0;
  game.combo = 0; game.mult = 1.5;
  game.over = null;
  game.aim = null; game.aimAng = null;
  game.nomT = 0; game.face = 'normal'; game.faceT = 0;
  game.jiggle = 0; game.jiggleV = 0;
  game.phys = CatPhysics.create({ reduced: REDUCED });
  game.phys.setWeight(game.weightLb);
  game.wob = game.phys.wob; // legacy mirror (read-only view of the sim; do not mutate)
  game.displayRx = catRx(chonkT(game.weightLb));
  game.timeScale = 1; game.frenzy = 0;
  game.misses = 0; game.veggies = 0; game.stageMisses = 0; game.stageVeggies = 0;
  hideOverlay();
  if (AudioSys.music) AudioSys.music.setTrack('gameplay'); // bouncy warm kitchen-jazz
}

function addPopup(x, y, text, color) {
  game.popups.push({ x, y, text, color: color || '#fff', t: 0 });
}

// Wobble impulse, routed into CatPhysics (weight-aware + REDUCED-aware internally).
// Same call sites as the old multi-spring system.
function wobbleImpulse(part, amt) {
  if (game.phys) game.phys.impulse(part, amt);
}

const LB_MSGS = { 10: 'DOUBLE DIGITS!', 20: '20 LB CLUB!', 30: 'CERTIFIED CHONK!', 40: 'FAT CITY!', 50: 'HEAVYWEIGHT CHAMPION!', 60: 'WHEELED AWAY!', 70: 'COLOSSAL!', 80: 'ABSOLUTE UNIT!', 90: 'NINETY!', 100: 'CENTURY CHONK!', 110: 'MASSIVE!', 120: 'GARGANTUAN!', 130: 'PLANETARY!', 140: 'TITANIC!', 150: 'MAXIMUM CHONK!' };
function checkLbMilestones(before, after) {
  for (const m of LB_MILESTONES) {
    if (before < m && after >= m) {
      addPopup(300, 340, m + ' lb — ' + LB_MSGS[m], '#6a1b9a');
      AudioSys.meow(Math.min(1, m / 100));
      AudioSys.jingle();
      game.face = 'bliss'; game.faceT = 2.5;
      wobbleImpulse('belly', 2.5); wobbleImpulse('cheek', 1.5);
    }
  }
}

function aimAngleFor(px, py) {
  const dx = px - SHOOT.x, dy = py - SHOOT.y;
  if (dy < 30) return null;
  let ang = Math.atan2(dy, dx);
  const lo = 10 * Math.PI / 180, hi = 170 * Math.PI / 180;
  if (game.cukeT > 0 && !REDUCED) ang += Math.sin(game.time * 9) * 0.07 * Math.min(1, game.cukeT); // spooked: aim wobbles
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
  if (game.balls === 0 && game.goalMet && !game.over) FX.slowmo(0.45, 1.4); // final-ball win: dramatic beat before the score
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

// Mystery reveal: 65% tier snack, 20% power-up, 15% veggie dud (the spice of mystery)
function resolveMystery() {
  const roll = Math.random();
  if (roll < 0.15) return Math.random() < 0.5 ? 'broccoli' : 'celery';
  if (roll < 0.35) return ['multi', 'wide', 'slow', 'magnet'][Math.floor(Math.random() * 4)];
  const commons = tierCommons(game.levelIndex + 1).filter(k => ((CONTENT[k] || {}).cal || 0) > 0);
  return commons[Math.floor(Math.random() * commons.length)];
}

// The cucumber event: comedic hop, full-body wobble, aim wobbles for 4s. No calories, no combo change.
function spookCat(item) {
  game.nomT = 0.6;
  game.face = 'shocked'; game.faceT = 2.2;
  game.cukeT = 4;
  game.scareJump = 110;
  wobbleImpulse('belly', 6); wobbleImpulse('cheek', 3.5); wobbleImpulse('tail', 4);
  addPopup(item.x, Math.max(60, item.y - 40), '🥒 CUCUMBER!!', '#2e7d32');
  addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, 'SPOOKED! aim wobbles!', '#2e7d32');
  AudioSys.startle();
  FX.shake(34, 0.3);
}

function onBarrelCrack(barrel) {
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
    AudioSys.pop();
  }
  spawnChips(barrel.x, barrel.y);
  if (barrel.kind === 'keg') { explode(barrel.x, barrel.y); return; } // powder keg: chain explosion
  if (barrel.kind === 'empty') { AudioSys.burst(); return; } // hollow barrel: no loot inside
  if (barrel.kind === 'mystery') { // the reveal: tier snack, power-up, or rare veggie dud
    const resolved = resolveMystery();
    barrel.kind = (CONTENT[resolved] || {}).power ? 'power' : 'snack';
    barrel.content = resolved;
    AudioSys.powerup();
    FX.burstJuice('mystery', 0, barrel.x, barrel.y);
    // falls through to the generic spawn with the resolved content
  }
  if (barrel.kind === 'golden') { // jackpot: 2x the level's top snack
    const c = CONTENT[barrel.content] || {};
    const jackpot = (c.cal || 5) * 2;
    AudioSys.fanfare();
    FX.burstJuice('golden', jackpot, barrel.x, barrel.y);
    game.items.push({
      x: barrel.x, y: barrel.y,
      vx: (Math.random() - 0.5) * 150, vy: -60 - Math.random() * 90,
      r: 9, state: 'fall', cal: jackpot, icon: c.icon || '⭐', name: 'Golden ' + (c.name || 'Snack'),
      content: barrel.content, grav: c.grav || 1, drift: c.drift || 0, power: null, golden: true,
      t: 0, gone: false,
    });
    return;
  }
  if (barrel.kind === 'cuke') { // the green menace: spills a cucumber, terrifies the cat
    AudioSys.startle();
    FX.burstJuice('cuke', 0, barrel.x, barrel.y);
    game.items.push({
      x: barrel.x, y: barrel.y,
      vx: (Math.random() - 0.5) * 150, vy: -60 - Math.random() * 90,
      r: 9, state: 'fall', cal: 0, icon: '🥒', name: 'Cucumber',
      content: 'cucumber', grav: 1, drift: 40, power: null, spook: true,
      t: 0, gone: false,
    });
    return;
  }
  const c = CONTENT[barrel.content];
  if (!c) { AudioSys.burst(); return; } // unknown content: burst sound, no loot, never crash
  AudioSys.burst();
  FX.burstJuice(barrel.kind, c.cal, barrel.x, barrel.y);
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
  FX.burstJuice('keg', 0, x, y); // shake + hit-stop, REDUCED-safe (supersedes game.shakeT; BOOM! text removed per declutter)
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
    if (b.cleared || b.kind === 'steel' || b.kind === 'bumper') continue; // steel & bumpers are blast-proof: never burst
    if (Math.hypot(b.x - x, b.y - y) < 80) {
      b.cleared = true; b.popT = 0;
      onBarrelBurst(b, null); // chain: kegs recurse, loot spawns normally
    }
  }
}

function onBarrelSpecial(kind, b, ball) {
  if (kind === 'steel') {
    AudioSys.clang();
    spawnChips(b.x, b.y);
  } else if (kind === 'bumper') {
    AudioSys.boing();
    game.combo++;
    game.maxCombo = Math.max(game.maxCombo || 0, game.combo);
    spawnChips(b.x, b.y);
  }
}

function deliver(item) {
  if (game.over) return;
  if (item.spook) { spookCat(item); return; } // the cucumber: terror, not food
  if (item.power) {
    game.nomT = 0.6;
    game.face = 'happy'; game.faceT = 1.2;
    wobbleImpulse('cheek', 1); wobbleImpulse('belly', 0.8);
    AudioSys.powerup();
    if (item.power === 'multi')  { game.multiShots = 1;    addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, '★ MULTI-YARN!', '#ef6c00'); }
    if (item.power === 'wide')   { game.bridgeT = 15;      addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, '★ BRIDGE!', '#ef6c00'); }
    if (item.power === 'slow')   { game.slowT = 5;         addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, '★ SLOW-MO!', '#ef6c00'); }
    if (item.power === 'magnet') { game.magnetT = 15;      addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, '★ MAGNET!', '#ef6c00'); }
    if (item.power === 'split')  { game.splitNext = true;  addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, '★ SPLIT YARN!', '#ef6c00'); }
    return;
  }
  const before = game.stage;

  // Combo calorie multiplier: every 3 clean deliveries bumps it, cap 3x.
  game.mult = Math.min(3, 1.5 + 0.5 * Math.floor(game.combo / 3)); // 1.5x base, +0.5x per 3 combo, cap 3x (owner 2026-10-13)
  const gained = item.cal > 0 ? item.cal * game.mult : item.cal;

  game.calories = Math.max(0, game.calories + gained);
  game.stage = stageFor(game.calories);
  game.nomT = 0.6;

  // Weight from RAW calories only (no combo inflation). Veggies never slim the cat.
  if (item.cal > 0) {
    const beforeLb = game.weightLb;
    game.weightLb = Math.min(MAX_LB, game.weightLb + item.cal * (game.lbPerCal || LB_PER_CAL));
    Profile.setWeight(game.weightLb);
    checkLbMilestones(beforeLb, game.weightLb);
    // Size-up ceremony: crouch on the old sprite, hard cut, pop settle (shownLb holds the old stage)
    if (typeof stageIdxForLb === 'function' && stageIdxForLb(game.weightLb) > stageIdxForLb(beforeLb))
      game.phys.milestone(beforeLb, game.weightLb);
    game.phys.eat(gained, 1, 0.18); // meal lands at the mouth: belly wave + jowl + body squash
    wobbleImpulse('tail', 0.6);
  } else {
    wobbleImpulse('belly', 0.8);
    wobbleImpulse('cheek', 0.4);
    wobbleImpulse('tail', 0.6);
  }

  if (item.cal < 0) {
    game.combo = 0; game.mult = 1.5;
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
    if (item.cal >= 15 || item.golden) FX.confetti(Conveyor.BOWL_X, Conveyor.BOWL_Y - 40, item.golden ? 40 : 22); // exotics rain paper
    if (game.combo >= 2) {
      addPopup(Conveyor.BOWL_X + 96, Conveyor.BOWL_Y - 96,
        'COMBO ×' + game.combo + (game.mult > 1 ? '  (×' + game.mult + ' cal)' : ''), '#ff8f00');
      if (game.combo >= 6 && game.faceT < 1) { game.face = 'smug'; game.faceT = 1.6; } // the cat knows it's good
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

  if (!game.goalMet && game.calories >= game.goalNow) {
    game.goalMet = true;
    addPopup(300, 420, 'GOAL MET!', '#2e7d32');
    AudioSys.jingle();
  }
}

function triggerFrenzy() {
  game.frenzy = 6;          // seconds of slow-mo
  game.timeScale = 0.35;
  game.balls += 2;          // the cat demands MORE
  game.face = 'determined'; game.faceT = 6;
  wobbleImpulse('belly', 3); wobbleImpulse('cheek', 2); wobbleImpulse('tail', 2);
  addPopup(300, 420, 'FEAST FRENZY! +2 YARN', '#ff6f00');
  AudioSys.frenzy();
  if (AudioSys.music) AudioSys.music.setTrack('frenzy'); // the same band, getting excited
}

function loseItem(item) {
  if (game.over) return;
  game.combo = 0; game.mult = 1.5;
  game.misses++; game.stageMisses++;
  game.face = 'sad'; game.faceT = 1.2;
  AudioSys.sad();
  addPopup(Math.max(40, Math.min(W - 40, item.x)), H - 70, 'lost…', '#8a7a66');
}


function hideOverlay() { overlay.classList.add('hidden'); }

function tick(dt) {
  game.time += dt;

  if (game.hitstopT > 0) { game.hitstopT -= dt; return; } // hit-stop: world frozen, render continues

  updateWeigh(dt);
  if (game.shakeT > 0) game.shakeT -= dt;

  // Real-time UI timers (unaffected by slow-mo)
  for (const p of game.popups) p.t += dt;
  game.popups = game.popups.filter(p => p.t < 1.3);
  if (game.nomT > 0) game.nomT -= dt;
  if (game.faceT > 0) { game.faceT -= dt; if (game.faceT <= 0) game.face = 'normal'; }
  if (game.frenzy > 0) {
    game.frenzy -= dt;
    if (game.frenzy <= 0) {
      game.frenzy = 0; game.timeScale = 1;
      if (AudioSys.music) AudioSys.music.setTrack('gameplay'); // frenzy's over, back to the groove
    }
  }

  // World updates run at timeScale (slow-mo during FEAST FRENZY or slow-mo power-up)
  if (game.slowT > 0) { game.slowT -= dt; if (game.frenzy <= 0) game.timeScale = 0.45; }
  else if (game.frenzy <= 0) game.timeScale = 1;
  FX.tick(dt); // decays the FX slow-mo timer
  if (game.fxSlowT > 0) game.timeScale = Math.min(game.timeScale, game.fxSlowScale || 0.45); // stacks under frenzy/slow-mo power-up
  const wdt = dt * game.timeScale;
  Conveyor.t += wdt;
  tickParticles(dt);

  // CatPhysics: unified body sim (belly wave lattice + secondary springs + life).
  // game.jiggle mirrors the belly for smoke-test compatibility.
  if (game.phys) {
    game.phys.setWeight(game.weightLb);
    game.phys.update(wdt);
    game.jiggle = game.phys.wob.belly.x; game.jiggleV = game.phys.wob.belly.v;
  }
  const targetRx = catRx(chonkT(game.weightLb));
  game.displayRx += (targetRx - game.displayRx) * Math.min(1, dt * 4);

  if (game.magnetT > 0) game.magnetT -= dt;
  if (game.bridgeT > 0) game.bridgeT -= dt;
  if (game.cukeT > 0) game.cukeT -= dt; // spooked aim wobble
  if (game.scareJump > 0) game.scareJump = Math.max(0, game.scareJump - 420 * dt); // the hop lands

  // Moving barrels: slow sinusoidal drift on their track (slow-mo aware, ahead of
  // collision so balls and bouncing loot meet the fresh position).
  for (const b of game.barrels) {
    if (b.cleared || !b.mv) continue;
    b.mt = (b.mt || 0) + wdt;
    const o = Math.sin(b.mt * (Math.PI * 2 / b.mv.period) + b.mv.phase) * b.mv.amp;
    b.x = b.hx + (b.mv.axis === 'x' ? o : 0);
    b.y = b.hy + (b.mv.axis === 'y' ? o : 0);
  }

  for (let i = game.shots.length - 1; i >= 0; i--) {
    if (Physics.stepBall(game.shots[i], wdt, game.barrels, onBarrelBurst, onBarrelCrack, onBarrelSpecial)) game.shots.splice(i, 1);
  }

  for (const it of game.items) {
    it.t += wdt;
    if (it.state === 'fall') {
      it.airT = (it.airT || 0) + wdt;
      if (it.airT > 10 && !it.gone) { it.gone = true; loseItem(it); continue; } // never hover forever
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

  if (!game.over && !game.shots.length && game.items.length === 0) {
    // mystery/golden barrels always count as food left (their payload resolves at burst time)
    const foodLeft = game.barrels.some(b => !b.cleared &&
      ((b.kind === 'snack' || b.kind === 'golden') && (((CONTENT[b.content] || {}).cal) || 0) > 0 || b.kind === 'mystery'));
    if (game.balls <= 0 || !foodLeft) endGame(game.calories >= game.goalNow);
  }
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

function drawWalls() { // thin wooden side walls: the visible face of the ball/item physics bounds
  const top = 40, bot = 700, w = 12;
  for (const x0 of [12, 576]) {
    const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, '#8d6e63'); g.addColorStop(0.5, '#a1887f'); g.addColorStop(1, '#6d4c41');
    ctx.fillStyle = g;
    ctx.fillRect(x0, top, w, bot - top);
    ctx.strokeStyle = 'rgba(62,39,35,0.55)'; ctx.lineWidth = 1;
    for (const gx of [0.3, 0.65]) { // wood grain
      ctx.beginPath(); ctx.moveTo(x0 + w * gx, top + 4); ctx.lineTo(x0 + w * gx, bot - 4); ctx.stroke();
    }
    ctx.fillStyle = '#5d4037'; // pegs
    for (let y = top + 40; y < bot; y += 110) {
      ctx.beginPath(); ctx.arc(x0 + w / 2, y, 2.4, 0, 7); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; // inner shadow lip
    ctx.fillRect(x0 === 12 ? x0 + w - 2 : x0, top, 2, bot - top);
  }
}

function render() {
  drawBackground();
  drawWalls();
  ctx.save();
  if (game.shakeT > 0) {
    const mag = (game.shakeAmt || 36) * game.shakeT;
    ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
  }
  drawBarrels(ctx, game.barrels, game.time);
  Conveyor.draw(ctx, game.bridgeT > 0);
  drawItems();
  drawPreview();
  drawBall();
  drawParticles(ctx);
  ctx.restore();
  Cats.drawShooter(ctx, SHOOT.x, SHOOT.y, game.aimAng, !game.shots.length && game.balls > 0 && !game.over);
  Cats.drawMain(ctx, 252, 806 - (game.scareJump || 0), { // spooked cats hop
    t: chonkT(game.phys.shownLb), lb: game.phys.shownLb, phys: game.phys, wob: game.wob, var: game.catVar,
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
game.weightLb = Profile.weight();

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
function getBest() { return Profile.best(); }
function showMenu() {
  game.menuOpen = true;
  game.aim = null; game.aimAng = null;
  hideOverlay();
  const b = getBest();
  const dk = Profile.setting('difficulty', 'normal');
  const D = DIFFS[dk] || DIFFS.normal;
  const diffRow = document.getElementById('diffRow');
  diffRow.innerHTML = '<span>Difficulty:</span>';
  Object.keys(DIFFS).forEach(k => {
    const btn = document.createElement('button');
    btn.textContent = DIFFS[k].label;
    if (k === dk) btn.className = 'sel';
    btn.addEventListener('click', (e) => { e.stopPropagation(); Profile.setSetting('difficulty', k); showMenu(); });
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
    btn.addEventListener('click', (e) => { e.stopPropagation(); Profile.setSetting('cat', i); showMenu(); });
    catRow.appendChild(btn);
  });
  // daily challenge card + lifetime stats line
  const date = dailyKey();
  const dBest = Profile.dailyBest(date);
  const dRow = document.getElementById('dailyRow');
  dRow.innerHTML = '';
  const dBtn = document.createElement('button');
  const streak = Profile.streak();
  dBtn.innerHTML = '📅 Daily Challenge' +
    '<small>' + (dBest ? 'today: ' + '★'.repeat(dBest.stars) + ' · best ' + dBest.cal + ' cal' : 'fresh level, new every day') +
    (streak > 1 ? ' · 🔥 ' + streak + '-day streak' : '') + '</small>';
  dBtn.addEventListener('click', (e) => { e.stopPropagation(); hideMenu(); loadDaily(); });
  dRow.appendChild(dBtn);
  const L = Profile.lifetime();
  document.getElementById('lifeRow').textContent =
    L.levelsCleared > 0
      ? `lifetime: ${L.totalCal} cal fed · best chonk ${L.bestChonk.toFixed(1)} lb · ${L.levelsCleared} levels cleared · max combo ×${L.maxCombo}`
      : '';
  levelGrid.innerHTML = '';
  for (let w = 0; w < 10; w++) { // world-map level select: collapsible world sections
    let wStars = 0;
    for (let i = w * 10; i < w * 10 + 10; i++) wStars += (b[i] || { stars: 0 }).stars || 0;
    const open = Profile.worldOpen(w, w === Math.floor(game.levelIndex / 10));
    const sec = document.createElement('div');
    sec.className = 'world';
    const head = document.createElement('button');
    head.className = 'worldhead' + (open ? ' open' : '');
    head.innerHTML = '<span>World ' + (w + 1) + ' · ' + WORLDS[w] + '</span>' +
      '<span class="wstars">★ ' + wStars + '/30</span><span class="caret">' + (open ? '▾' : '▸') + '</span>';
    head.addEventListener('click', (e) => { e.stopPropagation(); Profile.setWorldOpen(w, !open); showMenu(); });
    sec.appendChild(head);
    if (open) {
      const grid = document.createElement('div');
      grid.className = 'worldgrid';
      for (let i = w * 10; i < w * 10 + 10; i++) {
        const L = getLevel(i);
        const btn = document.createElement('button');
        const rec = b[i] || { stars: 0 };
        btn.className = i === game.levelIndex ? 'cur' : '';
        const tierNote = tierExotic(i + 1) && !tierExotic(i) ? ' <small>🆕 ' + tierExoticName(i + 1) + '</small>' : '';
        const newMech = (i + 1) === 31 ? ' <small>🆕 moving barrels!</small>' : '';
        btn.innerHTML = (i + 1) + '. ' + L.name + tierNote + newMech +
          '<small>goal ' + Math.round(L.goal * D.goal) + ' cal' + (rec.cal ? ' · best ' + rec.cal : '') + '</small>' +
          '<span class="stars">' + ('★'.repeat(rec.stars) || '☆☆☆') + '</span>';
        btn.addEventListener('click', () => { hideMenu(); loadLevel(i); showSplash(i); });
        grid.appendChild(btn);
      }
      sec.appendChild(grid);
    }
    levelGrid.appendChild(sec);
  }
  menuOverlay.classList.remove('hidden');
  if (!Profile.setting('howSeen', 0)) document.getElementById('howto').classList.remove('hidden'); // first-run tutorial
  if (AudioSys.music) AudioSys.music.setTrack('menu'); // light, curious, playful
}
function hideMenu() { game.menuOpen = false; menuOverlay.classList.add('hidden'); }
document.getElementById('menuBtn').addEventListener('click', (e) => { e.stopPropagation(); showMenu(); });
document.getElementById('howtoGo').addEventListener('click', (e) => {
  e.stopPropagation();
  Profile.setSetting('howSeen', 1);
  document.getElementById('howto').classList.add('hidden');
});
document.getElementById('res-retry').addEventListener('click', () => { hideResults(); if (game.daily) loadDaily(); else loadLevel(game.levelIndex); });
document.getElementById('res-menu').addEventListener('click', () => { hideResults(); showMenu(); });
document.getElementById('res-next').addEventListener('click', () => { hideResults(); loadLevel(game.levelIndex + 1); showSplash(game.levelIndex); });
document.getElementById('resetGame').addEventListener('click', (e) => {
  e.stopPropagation();
  if (confirm('Reset CHONK\'EM? This wipes best stars, lifetime stats and the cat\'s saved weight.')) {
    Profile.reset();
    location.reload();
  }
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { game.menuOpen ? hideMenu() : showMenu(); }
});

// Level intro splash card
function showSplash(i) {
  const L = getLevel(i);
  const D = DIFFS[Profile.setting('difficulty', 'normal')] || DIFFS.normal;
  document.getElementById('splashTitle').textContent = (i + 1) + '. ' + L.name;
  let sub = 'Goal ' + Math.round(L.goal * D.goal) + ' cal · ' + Math.round(L.balls * D.balls) + ' yarn · ' + D.label;
  if (tierExotic(i + 1) && !tierExotic(i)) sub += ' · 🆕 NEW: ' + tierExoticName(i + 1) + ' (' + tierMaxCal(i + 1) + ' cal)!';
  if (i + 1 === 31) sub += ' · 🆕 NEW: moving barrels — watch the dashed tracks!';
  document.getElementById('splashSub').textContent = sub;
  const sp = document.getElementById('levelSplash');
  sp.classList.remove('hidden');
  clearTimeout(showSplash._t);
  showSplash._t = setTimeout(() => sp.classList.add('hidden'), 1800);
}

// Daily-challenge splash card
function showDailySplash(date) {
  const L = genDailyLevel(date);
  const D = DIFFS[Profile.setting('difficulty', 'normal')] || DIFFS.normal;
  document.getElementById('splashTitle').textContent = '📅 Daily Challenge';
  document.getElementById('splashSub').textContent =
    L.name + ' · goal ' + Math.round(L.goal * D.goal) + ' cal · ' +
    Math.round(L.balls * D.balls) + ' yarn · ' + D.label + ' · one fresh level per day';
  const sp = document.getElementById('levelSplash');
  sp.classList.remove('hidden');
  clearTimeout(showSplash._t);
  showSplash._t = setTimeout(() => sp.classList.add('hidden'), 2200);
}

showMenu(); // boot into the level select

let last = performance.now(), acc = 0;
const STEP = 1 / 120;
function frameError(e) { // a bad frame must never kill the loop — report it, keep playing
  try {
    console.error('[chonk-em] frame error:', e);
    const el = document.getElementById('errtoast');
    if (el) { el.textContent = 'hiccup: ' + (e && e.message ? e.message : e); el.classList.remove('hidden'); }
  } catch (_) {}
}
function frame(now) {
  requestAnimationFrame(frame); // reschedule FIRST: an exception below can't stop the loop
  try {
    if (game.menuOpen) { render(); return; }
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 0.1);
    acc += dt;
    let n = 0;
    while (acc >= STEP && n++ < 24) { tick(STEP); acc -= STEP; } // cap: never spiral
    if (n >= 24) acc = 0;
    render();
  } catch (e) { frameError(e); }
}
requestAnimationFrame(frame);
