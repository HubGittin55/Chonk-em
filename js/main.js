'use strict';
/* CHONK'EM v0.1 — game orchestration: loop, states, scoring, rendering. */

const W = 600, H = 900;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
document.getElementById('retry').addEventListener('click', () => loadLevel(game.levelIndex));

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

const game = {
  levelIndex: 0, level: null,
  balls: 0, shots: [], items: [], barrels: [],
  multiShots: 0, slowT: 0, magnetT: 0,
  calories: 0, stage: 0, combo: 0,
  time: 0, over: null, popups: [],
  nomT: 0, face: 'normal', faceT: 0,
  aim: null, aimAng: null,
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
  game.balls = L.balls;
  game.shots = [];
  game.multiShots = 0; game.slowT = 0; game.magnetT = 0;
  game.items = [];
  game.popups = [];
  game.barrels = L.barrels.map(b => ({ x: b.x, y: b.y, r: 22, kind: b.kind, content: b.content, cleared: false }));
  game.calories = 0;
  game.stage = 0;
  game.combo = 0;
  game.over = null;
  game.aim = null; game.aimAng = null;
  game.nomT = 0; game.face = 'normal'; game.faceT = 0;
  Funnel.reset(L.funnel);
  hideOverlay();
}

function addPopup(x, y, text, color) {
  game.popups.push({ x, y, text, color: color || '#fff', t: 0 });
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
  }
  AudioSys.pop();
}

function onBarrelBurst(barrel) {
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
  if (item.power) {
    game.combo++;
    game.nomT = 0.6;
    game.face = 'happy'; game.faceT = 1.2;
    AudioSys.jingle();
    if (item.power === 'multi')  { game.multiShots = 1;    addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, '★ MULTI-YARN!', '#ef6c00'); }
    if (item.power === 'wide')   { Funnel.wideT = 15;      addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, '★ WIDE FUNNEL!', '#ef6c00'); }
    if (item.power === 'slow')   { game.slowT = 5;         addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, '★ SLOW-MO!', '#ef6c00'); }
    if (item.power === 'magnet') { game.magnetT = 15;      addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, '★ MAGNET!', '#ef6c00'); }
    return;
  }
  const before = game.stage;
  game.calories = Math.max(0, game.calories + item.cal);
  game.stage = stageFor(game.calories);
  game.nomT = 0.6;

  if (item.cal < 0) {
    game.combo = 0;
    game.face = 'disgust'; game.faceT = 1.8;
    AudioSys.sad();
    addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, item.cal + ' ugh', '#c62828');
  } else {
    game.combo++;
    AudioSys.nom();
    addPopup(Conveyor.BOWL_X, Conveyor.BOWL_Y - 64, '+' + item.cal, '#2e7d32');
    if (game.combo >= 2) addPopup(Conveyor.BOWL_X + 96, Conveyor.BOWL_Y - 96, 'COMBO ×' + game.combo, '#ff8f00');
  }

  if (game.stage > before) {
    game.face = game.stage >= 3 ? 'bliss' : 'happy';
    game.faceT = 2.2;
    addPopup(360, 660, 'CHONK UP: ' + STAGES[game.stage].name + '!', '#6a1b9a');
    AudioSys.jingle();
  }

  if (game.calories >= game.level.goal) endGame(true);
}

function loseItem(item) {
  game.combo = 0;
  game.face = 'sad'; game.faceT = 1.2;
  AudioSys.sad();
  addPopup(Math.max(40, Math.min(W - 40, item.x)), H - 70, 'lost…', '#8a7a66');
}

function endGame(win) {
  if (game.over) return;
  game.over = win ? 'win' : 'lose';
  overlayTitle.textContent = win ? 'CHONK ACHIEVED!' : 'Still scrawny…';
  overlaySub.textContent = win
    ? `${game.calories} calories — the cat is ${STAGES[game.stage].name}.`
    : `${game.calories}/${game.level.goal} calories. The cat demands another try.`;
  overlay.classList.remove('hidden');
}

function hideOverlay() { overlay.classList.add('hidden'); }

function tick(dt) {
  game.time += dt;
  Funnel.update(dt);
  Conveyor.t += dt;

  for (const p of game.popups) p.t += dt;
  game.popups = game.popups.filter(p => p.t < 1.3);
  if (game.nomT > 0) game.nomT -= dt;
  if (game.faceT > 0) { game.faceT -= dt; if (game.faceT <= 0) game.face = 'normal'; }

  if (game.magnetT > 0) game.magnetT -= dt;

  for (let i = game.shots.length - 1; i >= 0; i--) {
    if (Physics.stepBall(game.shots[i], dt, game.barrels, onBarrelBurst)) game.shots.splice(i, 1);
  }

  for (const it of game.items) {
    it.t += dt;
    if (it.state === 'fall') {
      it.vy += ITEM_GRAV * (it.grav || 1) * dt;
      if (it.drift) it.vx += Math.sin(it.t * 7) * it.drift * dt;
      if (game.magnetT > 0) it.vx += Math.sign(Funnel.x - it.x) * 300 * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      Funnel.tryCatch(it);
      if (it.y > H + 40 && !it.gone) { it.gone = true; if (!game.over) loseItem(it); }
    } else if (it.state === 'chute') {
      it.y += 340 * dt;
      if (it.y >= Conveyor.BELT_Y) { it.y = Conveyor.BELT_Y; it.state = 'belt'; }
    } else if (it.state === 'belt') {
      it.x -= Conveyor.SPEED * dt;
      if (it.x <= Conveyor.BOWL_X) it.state = 'drop';
    } else if (it.state === 'drop') {
      it.y += 460 * dt;
      if (it.y >= Conveyor.BOWL_Y && !it.gone) { it.gone = true; if (!game.over) deliver(it); }
    }
  }
  game.items = game.items.filter(i => !i.gone);

  if (!game.over && game.balls <= 0 && !game.shots.length && game.items.length === 0) endGame(false);
}

/* ---------------- rendering ---------------- */

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#f9ecd8');
  g.addColorStop(1, '#f0d5ae');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Playfield side walls
  ctx.fillStyle = '#dfc092';
  ctx.fillRect(12, 120, 10, 540);
  ctx.fillRect(578, 120, 10, 540);
  ctx.fillStyle = '#c8a06e';
  ctx.fillRect(12, 120, 10, 6);
  ctx.fillRect(578, 120, 10, 6);
  // Floor
  ctx.fillStyle = '#d9b380';
  ctx.fillRect(0, 862, W, 38);
}

function drawHUD() {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#5b3a1e';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🧶 × ' + game.balls, 24, 36);

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
  ctx.fillText(`${STAGES[game.stage].name} · ${game.calories}/${game.level.goal} cal`, W / 2, 50);
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
  if (Funnel.wideT > 0)     bits.push('⭐ WIDE ' + Math.ceil(Funnel.wideT));
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

function render() {
  drawBackground();
  drawBarrels(ctx, game.barrels, game.time);
  Funnel.draw(ctx);
  Conveyor.draw(ctx);
  drawItems();
  drawPreview();
  drawBall();
  Cats.drawShooter(ctx, SHOOT.x, SHOOT.y, game.aimAng, !game.shots.length && game.balls > 0 && !game.over);
  Cats.drawMain(ctx, 360, 806, game.stage, game.nomT, game.face, game.time);
  drawHUD();
  drawPowerHUD();
  drawPopups();
  drawHint();
}

/* ---------------- boot ---------------- */

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
  if (game.slowT > 0) game.slowT -= dt; // slow-mo timer runs in real time
  const scale = game.slowT > 0 ? 0.45 : 1;
  acc += dt;
  while (acc >= STEP) { tick(STEP * scale); acc -= STEP; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
