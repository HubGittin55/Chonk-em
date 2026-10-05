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
const STAGES = [
  { at: 0,  name: 'Scrawny' },
  { at: 8,  name: 'Healthy' },
  { at: 18, name: 'Chubby' },
  { at: 32, name: 'Chonky' },
  { at: 50, name: 'ABSOLUTE UNIT' },
];
// (body half-width is now weight-driven: catRx(chonkT(weightLb)))

// ---- Lifetime weight system: the cat keeps its chonk between levels ----
const LB_PER_CAL = 0.4, START_LB = 5.0, MAX_VIS_LB = 30, MAX_LB = 40;
const LB_MILESTONES = [10, 15, 20, 25, 30];
const chonkT = (lb) => Math.max(0, Math.min(1, (lb - START_LB) / (MAX_VIS_LB - START_LB)));
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
  const L = LEVELS[i];
  game.levelIndex = i;
  game.level = L;
  game.particles = [];
  nextBtn.classList.add('hidden');
  game.balls = L.balls;
  game.shots = [];
  game.multiShots = 0; game.slowT = 0; game.magnetT = 0; game.bridgeT = 0; game.shotsFired = 0;
  game.items = [];
  game.popups = [];
  game.barrels = L.barrels.map(b => ({ x: b.x, y: b.y, r: 22, kind: b.kind, content: b.content, cleared: false }));
  game.calories = 0;
  game.stage = 0;
  game.combo = 0; game.mult = 1;
  game.over = null;
  game.aim = null; game.aimAng = null;
  game.nomT = 0; game.face = 'normal'; game.faceT = 0;
  game.jiggle = 0; game.jiggleV = 0;
  game.wob = { belly: { x: 0, v: 0 }, cheek: { x: 0, v: 0 }, tail: { x: 0, v: 0 } };
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
  w.v += amt * (REDUCED ? 0.35 : 1);
  if (part === 'belly') { game.jiggle = w.x; game.jiggleV = w.v; } // legacy mirror
}

const LB_MSGS = { 10: 'DOUBLE DIGITS!', 15: 'CERTIFIED CHONK!', 20: '20 LB CLUB!', 25: 'ABSOLUTE TERRITORY!', 30: 'MAXIMUM CHONK!' };
function checkLbMilestones(before, after) {
  for (const m of LB_MILESTONES) {
    if (before < m && after >= m) {
      addPopup(300, 340, '⚖ ' + m + ' lb — ' + LB_MSGS[m], '#6a1b9a');
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
  const lo = 25 * Math.PI / 180, hi = 155 * Math.PI / 180;
  return Math.max(lo, Math.min(hi, ang));
}

function fireShot(px, py) {
  if (game.over || game.shots.length || game.balls <= 0) return;
  const ang = aimAngleFor(px, py);
  if (ang == null) return;
  let angs = [ang];
  if (game.multiShots > 0) { game.multiShots--; angs = [ang - 0.13, ang, ang + 0.13]; }
  for (const a of angs) {
    if (game.balls <= 0) break;
    game.shots.push({
      x: SHOOT.x, y: SHOOT.y + 26,
      vx: Math.cos(a) * BALL_SPEED, vy: Math.sin(a) * BALL_SPEED,
      r: BALL_R, life: 0, slowT: 0, bounces: 0,
    });
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

function onBarrelBurst(barrel) {
  spawnChips(barrel.x, barrel.y);
  const c = CONTENT[barrel.content];
  const label = c.power ? '★' : (c.cal > 0 ? '+' + c.cal : '' + c.cal);
  addPopup(barrel.x, barrel.y - 28, label, c.power ? '#ef6c00' : c.cal > 0 ? '#2e7d32' : '#c62828');
  AudioSys.burst();
  const pop = 1 - 0.35 * (c.grav - 1); // heavy loot pops weaker
  game.items.push({
    x: barrel.x, y: barrel.y,
    vx: (Math.random() - 0.5) * 150, vy: (-60 - Math.random() * 90) * pop,
    r: 9, state: 'fall', cal: c.cal, icon: c.icon, name: c.name,
    grav: c.grav, drift: c.drift, power: c.power || null,
    t: 0, gone: false,
  });
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
    return;
  }
  const before = game.stage;

  // Combo calorie multiplier: every 3 clean deliveries bumps it, cap ×4.
  game.mult = Math.min(4, 1 + Math.floor(game.combo / 3));
  const gained = item.cal > 0 ? item.cal * game.mult : item.cal;

  game.calories = Math.max(0, game.calories + gained);
  game.stage = stageFor(game.calories);
  game.nomT = 0.6;

  // Lifetime weight: only real food adds pounds. Veggies never slim the cat.
  if (gained > 0) {
    const beforeLb = game.weightLb;
    game.weightLb = Math.min(MAX_LB, game.weightLb + gained * LB_PER_CAL);
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

  if (game.calories >= game.level.goal) endGame(true);
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

function endGame(win) {
  if (game.over) return;
  game.over = win ? 'win' : 'lose';
  let stars = '';
  if (win) {
    // 1 = goal met, +1 under par, +1 zero misses and zero veggies
    let n = 1;
    if (game.shotsFired <= game.level.par) n++;
    if (game.misses === 0 && game.veggies === 0) n++;
    stars = '★'.repeat(n) + '☆'.repeat(3 - n);
    saveBest(game.levelIndex, n, game.calories);
    AudioSys.win();
  } else {
    AudioSys.lose();
  }
  overlayTitle.textContent = win ? 'CHONK ACHIEVED!' : 'Still scrawny…';
  overlaySub.textContent = win
    ? `${stars}   ${game.calories} calories — the cat is ${STAGES[game.stage].name}, now ${game.weightLb.toFixed(1)} lb!`
    : `${game.calories}/${game.level.goal} calories. The cat demands another try.`;
  if (win && game.levelIndex + 1 < LEVELS.length) {
    nextBtn.textContent = 'Next: ' + LEVELS[game.levelIndex + 1].name + ' →';
    nextBtn.classList.remove('hidden');
  } else {
    nextBtn.classList.add('hidden');
    if (win) overlaySub.textContent += ' All levels chonked! 👑';
  }
  overlay.classList.remove('hidden');
}

function hideOverlay() { overlay.classList.add('hidden'); }

function tick(dt) {
  game.time += dt;

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
  const WOBK = { belly: { k: 90, c: 7 }, cheek: { k: 170, c: 10 }, tail: { k: 130, c: 6.5 } };
  for (const p of ['belly', 'cheek', 'tail']) {
    const w = game.wob[p], K = WOBK[p];
    w.v += (-K.k * w.x - K.c * w.v) * wdt;
    w.x += w.v * wdt;
  }
  game.jiggle = game.wob.belly.x; game.jiggleV = game.wob.belly.v;
  const targetRx = catRx(chonkT(game.weightLb));
  game.displayRx += (targetRx - game.displayRx) * Math.min(1, dt * 4);

  if (game.magnetT > 0) game.magnetT -= dt;
  if (game.bridgeT > 0) game.bridgeT -= dt;

  for (let i = game.shots.length - 1; i >= 0; i--) {
    if (Physics.stepBall(game.shots[i], wdt, game.barrels, onBarrelBurst)) game.shots.splice(i, 1);
  }

  for (const it of game.items) {
    it.t += wdt;
    if (it.state === 'fall') {
      it.vy += ITEM_GRAV * (it.grav || 1) * wdt;
      if (it.drift) it.vx += Math.sin(it.t * 7) * it.drift * wdt;
      if (game.magnetT > 0) it.vx += Math.sign(Conveyor.BOWL_X - it.x) * 300 * wdt;
      it.x += it.vx * wdt;
      it.y += it.vy * wdt;
      if (it.y >= Conveyor.BELT_Y && it.vy > 0 && Conveyor.onBelt(it.x, game.bridgeT > 0)) {
        it.state = 'belt'; it.y = Conveyor.BELT_Y; it.vy = 0;
        AudioSys.catch();
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

  if (!game.over && game.balls <= 0 && !game.shots.length && game.items.length === 0) endGame(false);
}

/* ---------------- rendering ---------------- */

function drawBackground() {
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

function drawHUD() {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#5b3a1e';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🧶 × ' + game.balls, 24, 36);
  // Lifetime weight under the yarn count
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText('⚖ ' + game.weightLb.toFixed(1) + ' lb', 24, 62);

  // Chonk meter
  const mw = 230, mx = W / 2 - mw / 2, my = 14;
  ctx.fillStyle = 'rgba(91,58,30,0.18)';
  ctx.beginPath(); ctx.roundRect(mx, my, mw, 20, 10); ctx.fill();
  const frac = Math.max(0, Math.min(1, game.calories / game.level.goal));
  if (frac > 0) {
    ctx.fillStyle = '#e8712b';
    ctx.beginPath(); ctx.roundRect(mx, my, mw * frac, 20, 10); ctx.fill();
  }
  ctx.fillStyle = '#5b3a1e';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${STAGES[game.stage].name} · ${game.calories}/${game.level.goal} cal` +
    (game.mult > 1 ? ` · ×${game.mult}` : ''), W / 2, 50);
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
      ctx.fillStyle = 'rgba(255,193,7,0.35)';
      ctx.beginPath(); ctx.arc(it.x, it.y, 15, 0, 7); ctx.fill();
    }
    // tiny shadow
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath(); ctx.ellipse(it.x, it.y + 10, 8, 3, 0, 0, 7); ctx.fill();
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
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
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
  drawBarrels(ctx, game.barrels, game.time);
  Conveyor.draw(ctx, game.bridgeT > 0);
  drawItems();
  drawPreview();
  drawBall();
  drawParticles(ctx);
  Cats.drawShooter(ctx, SHOOT.x, SHOOT.y, game.aimAng, !game.shots.length && game.balls > 0 && !game.over);
  Cats.drawMain(ctx, 252, 806, {
    t: chonkT(game.weightLb), wob: game.wob,
    nomT: game.nomT, face: game.face, time: game.time,
  });
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
  canAim: () => !game.over && !game.shots.length && game.balls > 0,
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

let last = performance.now(), acc = 0;
const STEP = 1 / 120;
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 0.1);
  acc += dt;
  while (acc >= STEP) { tick(STEP); acc -= STEP; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
