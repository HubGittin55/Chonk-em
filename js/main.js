'use strict';
/* CHONK'EM v0.1 — game orchestration: loop, states, scoring, rendering. */

const W = 600, H = 900;
let HUD_SAFE_RIGHT = W - 140; // game-x the HUD stage·cal line must not pass (top-right buttons); set properly by fitCanvas
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
document.getElementById('retry').addEventListener('click', () => {
  hideOverlay();
  if (game.daily) loadDaily(); // the old handler re-loaded level -1 (a crash) on daily losses
  else if (game.endless) loadEndless(game.endless.depth);
  else loadLevel(game.levelIndex);
});
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
  // Back the canvas with as many pixels as it DISPLAYS, not a fixed 600x900:
  // a 100%-CSS canvas stretched to 940px from a 600px backing was N64-fuzzy.
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const bw = Math.max(1, Math.round((r.width || W) * dpr));
  const bh = Math.max(1, Math.round((r.height || H) * dpr));
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  ctx.setTransform(bw / W, 0, 0, bh / H, 0, 0);
  // Sprite strips are downscaled ~2-3x per strip; the default 'low' filter makes
  // each strip a blurry block with hard edges. 'high' = sharp, seam-free chonk.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Top-right DOM button cluster (mute/menu/pause) ends 124 CSS px from the
  // wrap's right edge; the HUD stage·cal line must stop 8px short of it.
  // Converted to game coords so drawHUD can dodge the cluster at any width.
  HUD_SAFE_RIGHT = W - 132 * (W / (r.width || W));
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
  // NB: '\U0001...' is NOT a JS escape — must be '\u{1F431}' form (was rendering raw "U0001F431").
  { name: 'Tabby',  icon: '\u{1F431}', stars: 0 },
  { name: 'Orange', icon: '\u{1F408}', stars: 8 },
  { name: 'Tuxedo', icon: '\u{1F408}\u200D\u2B1B', stars: 25 },
  { name: 'Calico', icon: '\u{1F43E}', stars: 60 },
];
// 10 worlds × 10 levels — the world-map level select groups by these.
const WORLDS = [
  'Kitchen', 'Pantry', 'Garden', 'Fish Market', 'Bakery',
  'Diner', 'Farm', 'Park Picnic', 'Candy Shop', 'Banquet Hall',
];
// Per-world background wash (2026-10-16): a cheap procedural take on per-world
// backgrounds — one tinted gradient over the kitchen bg, different per world.
// Kitchen keeps the home look (no wash); the endless climb cycles worlds as it descends.
const WORLD_TINTS = [
  null,
  ['rgba(216,142,44,0.16)',  'rgba(216,142,44,0.05)'],  // Pantry — amber spice shelves
  ['rgba(66,158,74,0.16)',   'rgba(66,158,74,0.05)'],   // Garden — green
  ['rgba(54,128,196,0.16)',  'rgba(54,128,196,0.05)'],   // Fish Market — sea blue
  ['rgba(228,128,150,0.16)', 'rgba(228,128,150,0.05)'],  // Bakery — strawberry pink
  ['rgba(218,64,64,0.14)',   'rgba(218,64,64,0.05)'],    // Diner — ketchup red
  ['rgba(118,168,58,0.15)',  'rgba(118,168,58,0.05)'],   // Farm — field green
  ['rgba(96,178,228,0.15)',  'rgba(96,178,228,0.05)'],   // Park Picnic — sky blue
  ['rgba(228,118,218,0.16)', 'rgba(228,118,218,0.05)'],  // Candy Shop — candy pink
  ['rgba(148,96,218,0.18)',  'rgba(148,96,218,0.06)'],   // Banquet Hall — royal purple
];
function worldTintFor() { // which world wash to draw under the current board
  if (game.endless) return WORLD_TINTS[game.endless.depth % 10];
  const w = worldForLevel(game.levelIndex + 1);
  return WORLD_TINTS[w] || null;
}
function totalStars() { return Profile.totalStars(); }
function catUnlocked(i) { return totalStars() >= CAT_UNLOCKS[i].stars; }
function selectedCat() {
  const i = Math.max(0, Math.min(3, Profile.setting('cat', 0) | 0));
  return catUnlocked(i) ? i : 0;
} // 0.3 lb/cal: 100 cal = 30 lb; food in the barrels is the only limit
const DIFFS = {
  // balls cut 20% across the board (owner 2026-10-16: too much yarn on high levels)
  easy:   { balls: 1.05, goal: 0.8,  vacuum: 0.8,  label: '😌 Easy' },
  normal: { balls: 0.8, goal: 1.0,  vacuum: 1.0,  label: '😼 Normal' },
  hard:   { balls: 0.64, goal: 1.2,  vacuum: 1.25, label: '🙀 Hard' },
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
  levelIndex: 0, level: null, daily: null, endless: null, // daily: { date }; endless: { depth }
  balls: 0, shots: [], items: [], barrels: [], particles: [], rings: [],
  multiShots: 0, slowT: 0, magnetT: 0, bridgeT: 0, shotsFired: 0, lastBallTold: false,
  calories: 0, stage: 0, combo: 0, mult: 1,
  time: 0, over: null, paused: false, popups: [],
  nomT: 0, face: 'normal', faceT: 0,
  aim: null, aimAng: null, keyAng: null, // keyboard aim angle (persists across shots; null = straight down)
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

function loadLevel(i) { game.daily = null; game.endless = null; startLevel(getLevel(i), i); }

function loadDaily() { // one fresh date-seeded level per calendar day
  const date = dailyKey();
  game.daily = { date };
  game.endless = null;
  startLevel(genDailyLevel(date), -1);
  showDailySplash(date);
}

function loadEndless(depth) { // endless climb: one run, deeper every win, death ends the run
  game.daily = null;
  game.endless = { depth };
  startLevel(genEndlessLevel(depth), -2);
  showEndlessSplash(depth);
}

function startLevel(L, i) {
  const daily = !!game.daily, endless = !!game.endless;
  const dn = daily ? 100000 + (hashStr('chonk-deals-' + game.daily.date) % 800000)
         : endless ? 200000 + game.endless.depth
         : i + 1; // 1-based deal number
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
  game.multiShots = 0; game.maxCombo = 0; game.splitNext = false; game.weigh = null; game.shakeT = 0; game.shakeAmt = 36; game.goalMet = false; game.slowT = 0; game.magnetT = 0; game.bridgeT = 0; game.shotsFired = 0; game.lastBallTold = false; game.rings = [];
  game.paused = false; hidePause(); // fresh level: never start paused, overlay off
  game.bursts = 0; game.kegsBurst = 0; game.spooks = 0; // trophy counters + weigh-in stats
  game.cukeT = 0; game.scareJump = 0; game.hitstopT = 0; game.fxSlowT = 0; game.fxSlowScale = 0.45; // FX bus state
  game.weightLb = START_LB; // size resets every level (owner)
  game.lbPerCal = LB_PER_CAL; // flat 0.3 lb/cal — the food in the barrels is the only limit
  game.items = [];
  game.popups = [];
  game.vacuum = L.vacuum ? Vacuum.create((DIFFS[game.diffKey] || DIFFS.normal).vacuum *
    (1 + 0.05 * (daily ? 5 : endless ? 5 + game.endless.depth : worldForLevel(i + 1)))) : null;
  if (game.vacuum) addPopup(W / 2, 330, '⚠ VACUUM PATROL ⚠', '#c62828');
  game.barrels = L.barrels.map(b => ({ x: b.x, y: b.y, r: L.r || 15, kind: b.kind, content: b.content, armor: !!b.armor, cracked: false, cleared: false }));
  dealSpecialBarrels(game.barrels, dn); // golden + mystery + rare cuke, dealt from empty slots
  dealMovers(game.barrels, dn); // world 4+: moving snack barrels on slow sinusoidal tracks
  game.calories = 0;
  game.stage = 0;
  game.combo = 0; game.mult = 1;
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

// Unwobbled aim angle: the shooter's arc, clamped, null when the point is
// too high to aim at. aimAngleFor adds the cucumber-spook wobble on top.
function rawAimAngle(px, py) {
  const dx = px - SHOOT.x, dy = py - SHOOT.y;
  if (dy < 30) return null;
  const lo = 10 * Math.PI / 180, hi = 170 * Math.PI / 180;
  return Math.max(lo, Math.min(hi, Math.atan2(dy, dx)));
}

function aimAngleFor(px, py) {
  const ang = rawAimAngle(px, py);
  if (ang == null) return null;
  if (game.cukeT > 0 && !REDUCED) return Math.max(10 * Math.PI / 180, Math.min(170 * Math.PI / 180, ang + Math.sin(game.time * 9) * 0.07 * Math.min(1, game.cukeT))); // spooked: aim wobbles
  return ang;
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
      r: BALL_R, life: 0, slowT: 0, bounces: 0, gentleT: 0, stuckT: 0, trail: [], rot: 0,
    };
    if (game.splitNext && game.shots.length === 0) { nb.splitArmed = true; game.splitNext = false; }
    game.shots.push(nb);
    game.balls--;
    game.shotsFired++;
  }
  if (game.balls === 0 && game.goalMet && !game.over) FX.slowmo(0.45, 1.4); // final-ball win: dramatic beat before the score
  if (game.balls === 1 && !game.lastBallTold && !game.over) { // the tension shot
    game.lastBallTold = true;
    addPopup(300, 300, 'LAST BALL…', '#c62828');
    AudioSys.tick(880);
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

// Expanding shockwave rings (EMP blast, and anything else that wants one).
// Reduced-motion safe: the ring is information, not decoration — kept, but still.
function spawnRing(x, y, color, maxR, life) {
  game.rings.push({ x, y, color, maxR, t: 0, life: life || 0.5 });
}
function tickRings(dt) {
  for (let i = game.rings.length - 1; i >= 0; i--) {
    game.rings[i].t += dt;
    if (game.rings[i].t >= game.rings[i].life) game.rings.splice(i, 1);
  }
}
function drawRings(ctx) {
  for (const r of game.rings) {
    const f = r.t / r.life;
    ctx.save();
    ctx.globalAlpha = (1 - f) * 0.9;
    ctx.strokeStyle = r.color; ctx.lineWidth = 5 * (1 - f) + 1;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.maxR * f, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * (1 - f);
    ctx.beginPath(); ctx.arc(r.x, r.y, r.maxR * f * 0.82, 0, 7); ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// Mystery reveal: 65% tier snack, 20% power-up, 15% veggie dud (the spice of mystery)
function resolveMystery() {
  const roll = Math.random();
  if (roll < 0.15) return Math.random() < 0.5 ? 'broccoli' : 'celery';
  if (roll < 0.35) return ['multi', 'wide', 'slow', 'magnet', 'emp'][Math.floor(Math.random() * 5)];
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
  game.spooks = (game.spooks || 0) + 1; // trophy counters
  Achievements.unlock('jumpscare');
  if (game.spooks >= 3) Achievements.unlock('cuke-hunter');
}

function onBarrelCrack(barrel) {
  AudioSys.tink();
}

function onBarrelBurst(barrel, ball) {
  game.bursts = (game.bursts || 0) + 1; // weigh-in stats: barrels popped
  if (barrel.kind === 'golden') Achievements.unlock('jackpot');
  if (barrel.kind === 'keg') { // demolition crew: 3 kegs in one level
    game.kegsBurst = (game.kegsBurst || 0) + 1;
    if (game.kegsBurst >= 3) Achievements.unlock('demolition');
  }
  // Split-yarn: the armed ball divides into three on its first burst
  if (ball && ball.splitArmed && !ball.splitDone) {
    ball.splitDone = true;
    const sp = Math.hypot(ball.vx, ball.vy) || BALL_SPEED;
    const base = Math.atan2(ball.vy, ball.vx);
    for (const da of [-0.5, 0.5]) {
      game.shots.push({
        x: ball.x, y: ball.y,
        vx: Math.cos(base + da) * sp * 0.92, vy: Math.sin(base + da) * sp * 0.92,
        r: ball.r, life: 0, slowT: 0, bounces: 0, gentleT: 0, stuckT: 0, trail: [], rot: ball.rot || 0,
      });
    }
    AudioSys.pop();
  }
  spawnChips(barrel.x, barrel.y);
  if (barrel.kind === 'keg') { explode(barrel.x, barrel.y); return; } // powder keg: chain explosion
  if (barrel.kind === 'power' && barrel.content === 'emp') { fireEMP(barrel.x, barrel.y); return; } // short-circuit: burst-immediate, not on delivery — the counterplay has to land before the vacuum eats the loot
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
    if ((c.cal || 0) >= 15) FX.exoticFx(barrel.x, barrel.y, barrel.content); // jackpot exotics get their signature
    game.items.push({
      x: barrel.x, y: barrel.y,
      vx: (Math.random() - 0.5) * 150, vy: -60 - Math.random() * 90,
      r: 9, state: 'fall', cal: jackpot, icon: c.icon || '⭐', name: 'Golden ' + (c.name || 'Snack'),
      content: barrel.content, grav: c.grav || 1, drift: c.drift || 0, power: null, golden: true,
      t: 0, gone: false, rot: 0,
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
      t: 0, gone: false, rot: 0,
    });
    return;
  }
  const c = CONTENT[barrel.content];
  if (!c) { AudioSys.burst(); return; } // unknown content: burst sound, no loot, never crash
  AudioSys.burst();
  FX.burstJuice(barrel.kind, c.cal, barrel.x, barrel.y);
  if (c.cal >= 15) FX.exoticFx(barrel.x, barrel.y, barrel.content); // every exotic bursts with its signature
  const pop = 1 - 0.35 * (c.grav - 1); // heavy loot pops weaker
  game.items.push({
    x: barrel.x, y: barrel.y,
    vx: (Math.random() - 0.5) * 150, vy: (-60 - Math.random() * 90) * pop,
    r: 9, state: 'fall', cal: c.cal, icon: c.icon, name: c.name, content: barrel.content,
    grav: c.grav, drift: c.drift, power: c.power || null,
    t: 0, gone: false, rot: 0,
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

function fireEMP(x, y) { // EMP short-circuit: burst-immediate counterplay, not on delivery
  AudioSys.zap();
  FX.empBlast(x, y);
  if (game.vacuum) {
    Achievements.unlock('shortcircuit');
    game.vacuum.zapT = Vacuum.ZAP_SECS; // ten seconds of safe feeding
    game.vacuum.gulpT = 0;
    addPopup(300, 420, '⚡ SHORT-CIRCUIT! vacuum down ' + Vacuum.ZAP_SECS + 's', '#0288d1');
  } else {
    addPopup(300, 420, '⚡ SHORT-CIRCUIT! (no vacuum this level)', '#0288d1');
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
    Achievements.noteCombo(game.combo);
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

  // Combo calorie multiplier: +0.1x per clean delivery, cap 3x (owner 2026-10-22).
  // Rounded to 1dp so the HUD never prints float dust (1.2000000000000002x).
  game.mult = Math.min(3, Math.round((1 + 0.1 * game.combo) * 10) / 10);
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
    game.combo = 0; game.mult = 1;
    game.veggies++; game.stageVeggies++;
    game.face = 'disgust'; game.faceT = 1.8;
    AudioSys.sad();
    addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, gained + ' ugh', '#c62828');
  } else {
    game.combo++;
    game.maxCombo = Math.max(game.maxCombo || 0, game.combo);
    Achievements.noteCombo(game.combo);
    if (item.content === 'imperial') Achievements.unlock('imperial'); // the Imperial Feast itself, delivered
    AudioSys.nom();
    addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, '+' + gained, '#2e7d32');
    spawnCrumbs(Conveyor.BOWL_X, Conveyor.BOWL_Y - 18);
    if (item.cal >= 15 || item.golden) FX.confetti(Conveyor.BOWL_X, Conveyor.BOWL_Y - 40, item.golden ? 40 : 22); // exotics rain paper
    if (game.combo >= 2) {
      addPopup(Conveyor.BOWL_X + 96, Conveyor.BOWL_Y - 96,
        'COMBO ×' + game.combo + (game.mult > 1 ? '  (×' + game.mult.toFixed(1) + ' cal)' : ''), '#ff8f00');
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
  game.combo = 0; game.mult = 1;
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
  tickRings(dt);

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
    const b = game.shots[i];
    if (Physics.stepBall(b, wdt, game.barrels, onBarrelBurst, onBarrelCrack, onBarrelSpecial)) {
      game.shots.splice(i, 1);
      continue;
    }
    // rotation pass (2026-10-20): spin follows horizontal velocity like a real
    // rolling ball, clamped so flight-speed spin doesn't strobe into a blur.
    b.rot = (b.rot || 0) + Math.max(-30, Math.min(30, b.vx / (b.r || 10))) * wdt;
    if (!REDUCED && b.life > 0.04) { // yarn motion trail — a short fading wake behind the ball
      b.trail = b.trail || [];
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 7) b.trail.shift();
    }
  }

  for (const it of game.items) {
    it.t += wdt;
    if (it.state === 'fall') {
      it.airT = (it.airT || 0) + wdt;
      if (it.airT > 10 && !it.gone) { it.gone = true; loseItem(it); continue; } // never hover forever
      it.vy += ITEM_GRAV * (it.grav || 1) * wdt;
      if (it.drift) it.vx += Math.sin(it.t * 7) * it.drift * wdt;
      if (game.magnetT > 0) it.vx += Math.sign(Conveyor.BOWL_X - it.x) * 300 * wdt;
      const prevY = it.y; // lost-food-pop-bug: belt catch needs a plane crossing (conveyor.js)
      it.x += it.vx * wdt;
      it.y += it.vy * wdt;
      // rotation pass (2026-10-20): tumbling follows horizontal velocity; veggie
      // cubes and loot spin as they fly, capped so they don't strobe.
      it.rot = (it.rot || 0) + Math.max(-12, Math.min(12, it.vx * 0.09)) * wdt;
      // Food bounces off barrels but NEVER breaks them (burst is yarn-only).
      Physics.bounceItem(it, game.barrels);
      // Side walls
      if (it.x < 20) { it.x = 20; it.vx = Math.abs(it.vx) * 0.5; }
      if (it.x > 580) { it.x = 580; it.vx = -Math.abs(it.vx) * 0.5; }
      // Belt: bounce a couple of times, then settle and ride INWARD to the gap.
      // The catch is a plane CROSSING — food that fell below the belt line and
      // drifted back under it must NOT pop back up (lost-food-pop-bug, 2026-10-17).
      const crossing = Conveyor.crossesBelt(prevY, it.y, it.vy);
      const side = !it.sucked && crossing ? Conveyor.onBelt(it.x, game.bridgeT > 0) : null;
      if (side) {
        if (it.vy > 110) {
          it.y = Conveyor.BELT_Y;
          it.vy = -it.vy * 0.45;
          it.vx *= 0.7;
          it.bounces = (it.bounces || 0) + 1;
        } else {
          it.state = 'belt'; it.belt = side; it.y = Conveyor.BELT_Y; it.vy = 0;
          AudioSys.catch();
        }
      } else if (!it.sucked && crossing && it.x >= Conveyor.GAP_L && it.x <= Conveyor.GAP_R) {
        it.state = 'drop'; // straight down the center chute into the bowl
        AudioSys.catch();
      }
      // Tile floor: missed food bounces, then it's lost
      if (it.state === 'fall' && it.y >= 853 && it.vy > 0) {
        it.bounces = (it.bounces || 0) + 1;
        if (it.bounces >= 3 || it.vy < 90) { it.gone = true; loseItem(it); }
        else { it.y = 853; it.vy = -it.vy * 0.35; it.vx *= 0.6; }
      }
      if (it.y > H + 40 && !it.gone) { it.gone = true; loseItem(it); }
    } else if (it.state === 'belt') {
      it.x += (it.belt === 'L' ? 1 : -1) * Conveyor.SPEED * wdt; // inward, toward the gap
      // rotation pass (2026-10-25, Blarmo's directive): loot rides the belt
      // frozen at its landing angle — the 2026-10-20 damp-to-flat snapped it
      // visibly upright on landing. No rot update here at all: it.rot stays
      // whatever the fall tumble left it at when the belt catch fired.
      if (it.x >= Conveyor.GAP_L && it.x <= Conveyor.GAP_R) it.state = 'drop'; // into the bowl
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
  const bgim = typeof Assets !== 'undefined' ? Assets.prop('kitchen_bg') : null;
  if (bgim) {
    ctx.drawImage(bgim, 0, 0, W, H);
    const tint = worldTintFor();
    if (tint) { // per-world wash over the bg — endless cycles worlds as it descends
      const wg = ctx.createLinearGradient(0, 0, 0, H);
      wg.addColorStop(0, tint[0]); wg.addColorStop(0.75, tint[1]); wg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = wg;
      ctx.fillRect(0, 0, W, H);
    }
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

// Placement for the HUD stage·cal line: centered at W/2 normally; if the text
// would reach the top-right button cluster (safeRight), shift it left so its
// right edge stops at safeRight; if it still would not fit between the left
// stats (x < 140) and the cluster, shrink it (floor 11px). Never returns a
// center left of the band, and non-finite widths (stub contexts) stay centered.
function hudLinePlace(lw, size, safeRight) {
  const bandL = 140, cx = W / 2;
  if (!isFinite(lw) || cx + lw / 2 <= safeRight) return { x: cx, size };
  let s = size, w = lw;
  if (lw > safeRight - bandL) { s = Math.max(11, Math.floor(size * (safeRight - bandL) / lw)); w = lw * (s / size); }
  return { x: Math.max(bandL + w / 2, Math.min(cx, safeRight - w / 2)), size: s };
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
  const lastBall = game.balls === 1 && !game.over && !game.shots.length;
  const pulse = lastBall && !REDUCED ? 0.72 + 0.28 * Math.sin(game.time * 7) : 1;
  ctx.save();
  ctx.globalAlpha = pulse;
  hudText('🧶 × ' + game.balls, 24, 14, 22, lastBall ? '#ff8a80' : '#ffd9a8');
  ctx.restore();
  if (lastBall) hudText('LAST BALL', 24, 42, 13, '#ff8a80');
  else hudText('⚖ ' + game.weightLb.toFixed(1) + ' lb', 24, 42, 19, '#ffd9a8');

  // Chonk meter — star-progress edition (2026-10-23, owner directive; thresholds
  // retuned 2026-10-25 to 60/80/100): the fill and the hash marks live in
  // starsFor's coordinate system (weight gained as a fraction of the level's
  // total raw calories), so the marks sit at the REAL star thresholds:
  // 1★ = goal/raw (~60%), 2★ = 80%, 3★ = 100% (full bar = 3★).
  const mw = 230, mx = W / 2 - mw / 2, my = 14;
  ctx.fillStyle = 'rgba(91,58,30,0.18)';
  ctx.beginPath(); ctx.roundRect(mx, my, mw, 20, 10); ctx.fill();
  const rawTotal = Math.max(1, rawCal(game.level));
  const sfrac = Math.max(0, Math.min(1, (game.weightLb - START_LB) / (LB_PER_CAL * rawTotal)));
  if (sfrac > 0) {
    ctx.fillStyle = '#e8712b';
    ctx.beginPath(); ctx.roundRect(mx, my, mw * sfrac, 20, 10); ctx.fill();
  }
  // star hash marks — white ticks on the bar, tiny gold numerals above.
  // Positions from starMarks(): the real starsFor thresholds, so the marks
  // never drift from what the weigh-in awards.
  const marks = starMarks(game.level, game.goalNow);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  marks.forEach((m, i) => {
    const x = mx + mw * Math.max(0.02, m);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, my - 1); ctx.lineTo(x, my + 21); ctx.stroke();
    ctx.fillStyle = '#ffd54f'; ctx.font = 'bold 10px sans-serif';
    ctx.fillText(String(i + 1), x, my - 3);
  });
  // Stage·cal line: centered, but it used to slide under the top-right button
  // cluster on narrow windows. hudLinePlace shifts it left (shrinking only if
  // the band between the left stats and the cluster is too narrow), so the
  // line never hides under a button or the yarn/weight readouts.
  const hudLine = `${STAGES[game.stage].name} · ${game.calories}/${game.goalNow} cal` +
    (game.mult > 1 ? ` · ×${game.mult.toFixed(1)}` : '');
  ctx.font = 'bold 15px system-ui, sans-serif';
  const lp = hudLinePlace(ctx.measureText(hudLine).width, 15, HUD_SAFE_RIGHT);
  hudText(hudLine, lp.x, 40, lp.size, '#ffe9c9', 'center');
}

function drawPreview() {
  if (!game.aim || game.shots.length || game.over || game.balls <= 0) return;
  const ang = aimAngleFor(game.aim.x, game.aim.y);
  if (ang == null) return;
  game.aimAng = ang;
  // Multi-yarn previews all three ghost trajectories (the quirk where only the
  // center ball previewed is fixed — the outer paths preview dimmer).
  const angs = [ang];
  if (game.multiShots > 0) angs.push(ang - 0.13, ang + 0.13);
  const trace = (a, alpha) => {
    let x = SHOOT.x, y = SHOOT.y + 26;
    let vx = Math.cos(a) * BALL_SPEED, vy = Math.sin(a) * BALL_SPEED;
    const s = 1 / 60;
    ctx.fillStyle = 'rgba(91,58,30,' + alpha + ')';
    for (let i = 0; i < 36; i++) {
      vy += Physics.GRAV * s;
      x += vx * s; y += vy * s;
      if (i % 3 === 0 && y < 660) {
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill();
      }
    }
  };
  if (angs.length > 1) { trace(angs[1], 0.25); trace(angs[2], 0.25); }
  trace(angs[0], 0.45);
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
    ctx.save(); // rotation pass (2026-10-20 tumble, 2026-10-25 belt freeze): loot tumbles while airborne, rides the belt at its landing angle
    ctx.translate(it.x, it.y);
    ctx.rotate(it.rot || 0);
    const fim = typeof Assets !== 'undefined' ? Assets.food(it.content) : null;
    if (fim) {
      const im = fim, s = 40;
      ctx.drawImage(im, -s / 2, -s / 2, s, s);
    } else {
      ctx.fillText(it.icon, 0, 0);
    }
    ctx.restore();
  }
  ctx.textBaseline = 'alphabetic';
}

function drawBall() {
  for (const b of game.shots) {
    if (!REDUCED && b.trail && b.trail.length > 1) { // fading yarn wake — oldest points smallest and faintest
      for (let i = 0; i < b.trail.length; i++) {
        const p = b.trail[i], k = (i + 1) / (b.trail.length + 1);
        ctx.fillStyle = 'rgba(194,148,90,' + (k * 0.32).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, (b.r + 3) * k * 0.75, 0, 7); ctx.fill();
      }
    }
    drawYarn(ctx, b.x, b.y, b.r + 3, b.rot || 0);
  }
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
  if (game.combo >= 2) bits.push('🔥 COMBO ×' + game.combo + (game.mult > 1 ? ' · ×' + game.mult.toFixed(1) : ''));
  if (game.multiShots > 0) bits.push('🧶×3 NEXT');
  if (game.bridgeT > 0)     bits.push('⭐ BRIDGE ' + Math.ceil(game.bridgeT));
  if (game.slowT > 0)       bits.push('⭐ SLOW ' + Math.ceil(game.slowT));
  if (game.magnetT > 0)     bits.push('⭐ MAGNET ' + Math.ceil(game.magnetT));
  if (game.vacuum && game.vacuum.zapT > 0) bits.push('⚡ ZAP ' + Math.ceil(game.vacuum.zapT));
  if (!bits.length) return;
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ef6c00';
  ctx.fillText(bits.join('   ·   '), W / 2, 68);
}

function drawHint() {
  // Teaching hint: first two levels only, before the player's first shot —
  // it used to haunt the middle of the board on every level forever.
  if (game.levelIndex > 1 || game.shotsFired > 0) return;
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
  drawRings(ctx);
  drawParticles(ctx);
  ctx.restore();
  Cats.drawShooter(ctx, SHOOT.x, SHOOT.y, game.aimAng, !game.shots.length && game.balls > 0 && !game.over);
  Cats.drawMain(ctx, 400, 806 - (game.scareJump || 0), { // spooked cats hop — sits just right of the center bowl (bowl rim 359; the cat overlaps the rim in front, never behind it)
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

/* ---------------- pause ---------------- */
const pauseOverlay = document.getElementById('pauseOverlay');
function hidePause() { game.paused = false; pauseOverlay.classList.add('hidden'); }
function togglePause() {
  if (game.menuOpen || game.over) return; // nothing worth pausing on menus / results
  game.paused = !game.paused;
  pauseOverlay.classList.toggle('hidden', !game.paused);
  if (game.paused) { game.aim = null; game.aimAng = null; } // drop a mid-drag aim line
}
document.getElementById('pauseBtn').addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
document.getElementById('pauseResume').addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
document.getElementById('pauseRestart').addEventListener('click', (e) => {
  e.stopPropagation();
  hidePause();
  if (game.daily) loadDaily();
  else if (game.endless) loadEndless(game.endless.depth);
  else loadLevel(game.levelIndex);
});
document.getElementById('pauseMute').addEventListener('click', (e) => {
  e.stopPropagation();
  AudioSys.init(); AudioSys.toggle(); refreshMute();
  e.target.textContent = AudioSys.muted ? '🔇 sound' : '🔊 sound';
});
document.getElementById('pauseQuit').addEventListener('click', (e) => { e.stopPropagation(); hidePause(); showMenu(); });

/* ---------------- trophies (menu) ---------------- */
function renderTrophyPanel() {
  const won = Profile.trophies();
  document.getElementById('trophyCount').textContent = '(' + Object.keys(won).length + '/' + ACHIEVEMENTS.length + ')';
  const list = document.getElementById('trophyList');
  list.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const d = document.createElement('div');
    d.className = 'trophy ' + (won[a.id] ? 'won' : 'locked');
    const hint = won[a.id] ? null : Achievements.progress(a.id);
    d.innerHTML = '<div class="t-name">' + a.icon + ' ' + a.name + '</div>' +
      '<div class="t-desc">' + a.desc + '</div>' +
      (won[a.id] ? '<div class="t-date">' + new Date(won[a.id]).toLocaleDateString() + '</div>' :
        (hint ? '<div class="t-prog">' + hint + '</div>' : ''));
    list.appendChild(d);
  }
}
document.getElementById('trophyClose').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('trophyPanel').classList.add('hidden');
});
function renderTrophyRow() {
  const tRow = document.getElementById('trophyRow');
  tRow.innerHTML = '';
  const tBtn = document.createElement('button');
  tBtn.innerHTML = '🏆 Trophies <small>' + Achievements.count() + '/' + ACHIEVEMENTS.length + '</small>';
  tBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    renderTrophyPanel();
    document.getElementById('trophyPanel').classList.remove('hidden');
  });
  tRow.appendChild(tBtn);
  document.getElementById('trophyPanel').classList.add('hidden'); // rebuild hides the stale panel
}

// Keyboard aim (desktop-first, 2026-10-26): arrows sweep the aim angle, Space
// fires. The keyboard aim is a synthetic pointer point 200px out from the
// shooter, so drawPreview, drawShooter and fireShot behave exactly as they do
// for pointer aim — no physics or pointer-input changes. keyAng persists
// across shots, so repeat Space fires keep the last angle; arrows re-show the
// preview at that angle. Named function (not just the window listener) so the
// smoke harness can drive it headless. Coarse aim (2026-10-29): holding Shift
// steps 10° per press instead of 2°, so re-aiming across the 160° arc takes
// 16 presses, not 80; plain arrows keep the fine step.
function keyCanAim() { return !game.over && !game.menuOpen && !game.paused && !game.shots.length && game.balls > 0; }
const KEY_ARC = { lo: 10 * Math.PI / 180, hi: 170 * Math.PI / 180, step: 2 * Math.PI / 180, coarse: 10 * Math.PI / 180 };
function keyAimPoint() {
  const ang = game.keyAng != null ? game.keyAng : Math.PI / 2;
  return { x: SHOOT.x + Math.cos(ang) * 200, y: SHOOT.y + Math.sin(ang) * 200 };
}
function onKeyAim(key, shiftKey) {
  if (!keyCanAim()) return false;
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    // Arc runs 10° (right-down) to 170° (left-down): Left increases the angle.
    const step = shiftKey ? KEY_ARC.coarse : KEY_ARC.step;
    const base = game.keyAng != null ? game.keyAng : (game.aimAng != null ? game.aimAng : Math.PI / 2);
    game.keyAng = Math.max(KEY_ARC.lo, Math.min(KEY_ARC.hi, base + (key === 'ArrowLeft' ? step : -step)));
    const p = keyAimPoint();
    game.aim = p; game.aimAng = aimAngleFor(p.x, p.y);
    return true;
  }
  if (key === ' ') { // Space fires the keyboard aim (straight down if never aimed)
    const p = keyAimPoint();
    game.aim = null; game.aimAng = null; // match pointer onAimEnd clearing
    fireShot(p.x, p.y);
    return true;
  }
  return false;
}

// Pointer aim (2026-10-28): shared angle with keyboard aim. A mouse/touch
// aim updates keyAng (unwobbled, so the spook wobble stays live-only), so
// the next arrow press continues from the pointer's angle and Space after a
// pointer aim fires along it instead of straight down. Named, like
// onKeyAim, so the smoke harness drives it headless.
function onPointerAim(p) {
  game.aim = p; game.aimAng = aimAngleFor(p.x, p.y);
  const raw = rawAimAngle(p.x, p.y);
  if (raw != null) game.keyAng = raw;
}

Input.init({
  canAim: keyCanAim,
  onAimStart: (p) => { onPointerAim(p); },
  onAimMove: (p) => { if (game.aim) onPointerAim(p); },
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
  // endless climb card — post-campaign survival; vacuum gets faster the deeper you go
  const eBest = Profile.endlessBest();
  const eRow = document.getElementById('endlessRow');
  eRow.innerHTML = '';
  const eBtn = document.createElement('button');
  eBtn.innerHTML = '♾️ Endless Climb' +
    '<small>' + (eBest.bestDepth > 0
      ? 'best: depth ' + eBest.bestDepth + ' · ' + eBest.bestCal + ' cal' + (eBest.runs > 0 ? ' · ' + eBest.runs + ' runs' : '')
      : 'survive the climb — the vacuum gets faster') + '</small>';
  eBtn.addEventListener('click', (e) => { e.stopPropagation(); hideMenu(); loadEndless(1); });
  eRow.appendChild(eBtn);
  const L = Profile.lifetime();
  document.getElementById('lifeRow').textContent =
    L.levelsCleared > 0
      ? `lifetime: ${L.totalCal} cal fed · best chonk ${L.bestChonk.toFixed(1)} lb · ${L.levelsCleared} levels cleared · max combo ×${L.maxCombo}`
      : '';
  renderTrophyRow();
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
  if (typeof Mascot !== 'undefined') Mascot.mount(); // menu mascot: pupils track, blink, pettable
}
function hideMenu() { game.menuOpen = false; menuOverlay.classList.add('hidden'); if (typeof Mascot !== 'undefined') Mascot.rest(); }
document.getElementById('menuBtn').addEventListener('click', (e) => { e.stopPropagation(); showMenu(); });
document.getElementById('howtoGo').addEventListener('click', (e) => {
  e.stopPropagation();
  Profile.setSetting('howSeen', 1);
  document.getElementById('howto').classList.add('hidden');
});
document.getElementById('res-retry').addEventListener('click', () => {
  hideResults();
  if (game.daily) loadDaily();
  else if (game.endless) loadEndless(game.endless.depth);
  else loadLevel(game.levelIndex);
});
document.getElementById('res-menu').addEventListener('click', () => { hideResults(); showMenu(); });
document.getElementById('res-next').addEventListener('click', () => {
  hideResults();
  if (game.endless) { loadEndless(game.endless.depth + 1); } // the climb continues deeper
  else { loadLevel(game.levelIndex + 1); showSplash(game.levelIndex); }
});
document.getElementById('resetGame').addEventListener('click', (e) => {
  e.stopPropagation();
  if (confirm('Reset CHONK\'EM? This wipes best stars, lifetime stats and the cat\'s saved weight.')) {
    Profile.reset();
    location.reload();
  }
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { game.menuOpen ? hideMenu() : showMenu(); }
  else if (e.key === 'p' || e.key === 'P') togglePause();
  else if (onKeyAim(e.key, e.shiftKey)) e.preventDefault(); // arrows/Space handled: don't scroll the page
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

// Endless-climb splash card
function showEndlessSplash(depth) {
  const L = genEndlessLevel(depth);
  const D = DIFFS[Profile.setting('difficulty', 'normal')] || DIFFS.normal;
  document.getElementById('splashTitle').textContent = '♾️ Endless Climb — Depth ' + depth;
  document.getElementById('splashSub').textContent =
    L.name + ' · goal ' + Math.round(L.goal * D.goal) + ' cal · ' +
    Math.round(L.balls * D.balls) + ' yarn · vacuum ×' +
    (1 + 0.05 * (5 + depth)).toFixed(2) + ' · lose and the run ends';
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
    if (typeof Mascot !== 'undefined') Mascot.frame(now); // menu mascot blink driver (no-op off-menu)
    if (game.menuOpen || game.paused) { render(); return; } // paused: frozen sim, live canvas
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
