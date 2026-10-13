'use strict';
/* Shooter cat + main cat. Vector rendering in code, with generated sprite
   assets (Qwen Image 2.1 turbo pipeline) layered on top: every draw site
   falls back to its vector renderer if its asset is missing. */

// Prop sprites (barrels, bowl, yarn, shooter, kitchen bg). Per-key readiness.
const ASSET_KEYS = ['bowl', 'yarn', 'shooter', 'kitchen_bg',
  'barrel_kibble', 'barrel_salmon', 'barrel_tuna', 'barrel_broccoli', 'barrel_celery',
  'barrel_multi', 'barrel_wide', 'barrel_slow', 'barrel_magnet',
  'food_kibble', 'food_salmon', 'food_tuna', 'food_broccoli', 'food_celery',
  'food_multi', 'food_wide', 'food_slow', 'food_magnet'];
const Assets = {
  imgs: (typeof Image === 'function') ? Object.fromEntries(ASSET_KEYS.map(k => {
    const im = new Image();
    im.src = 'assets/' + k + '.png';
    return [k, im];
  })) : {},
  ok(k) {
    const im = this.imgs[k];
    return !!(im && im.complete && im.naturalWidth > 0);
  },
};

function drawYarn(ctx, x, y, r) {
  if (Assets.ok('yarn')) {
    const im = Assets.imgs.yarn, s = r * 2.5;
    ctx.drawImage(im, x - s / 2, y - s / 2, s, s);
    return;
  }
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.2, x, y, r);
  g.addColorStop(0, '#ff7a9c');
  g.addColorStop(0.65, '#e84a6f');
  g.addColorStop(1, '#c23157');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  // wound yarn strands
  ctx.strokeStyle = 'rgba(150,20,60,0.55)'; ctx.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(x, y, r * (0.32 + i * 0.17), 0.3 + i * 1.4, 2.4 + i * 1.4);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,200,220,0.7)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.45, 3.6, 5.2); ctx.stroke();
  // loose trailing end
  ctx.strokeStyle = '#b83556'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.8, y + r * 0.5);
  ctx.quadraticCurveTo(x - r - 12, y + r + 10, x - r - 4, y + r + 20);
  ctx.stroke();
}

// Shared tabby fur helpers ---------------------------------------------------

function furEdge(ctx, cx, cy, rx, ry, color, n) {
  // short fur strokes around an ellipse edge
  ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.13;
    const x1 = cx + Math.cos(a) * rx * 0.97, y1 = cy + Math.sin(a) * ry * 0.97;
    const x2 = cx + Math.cos(a) * (rx + 4.5), y2 = cy + Math.sin(a) * (ry + 4.5);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
}

function tabby(ctx, cx, cy, rx, ry, stripe) {
  // curved dorsal stripes clipped to the body ellipse
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.clip();
  ctx.strokeStyle = stripe; ctx.lineWidth = 5; ctx.lineCap = 'round';
  const xs = [-0.62, -0.3, 0, 0.3, 0.62];
  for (const f of xs) {
    ctx.beginPath();
    ctx.moveTo(cx + rx * f - 7, cy - ry + 3);
    ctx.quadraticCurveTo(cx + rx * f + 2, cy - ry * 0.45, cx + rx * f - 5, cy - ry * 0.05);
    ctx.stroke();
  }
  ctx.restore();
}

function eyesMain(ctx, hx, hy, ex, face, time) {
  // green iris, slit pupil, specular dot; lids for happy/disgust
  for (const s of [-1, 1]) {
    const exx = hx + s * ex;
    if (face === 'disgust') {
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(exx - 6, hy - 12); ctx.lineTo(exx + 6, hy - 2);
      ctx.moveTo(exx + 6, hy - 12); ctx.lineTo(exx - 6, hy - 2);
      ctx.stroke();
      continue;
    }
    if (face === 'happy' || face === 'bliss') {
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(exx, hy - 3, 7, Math.PI, 2 * Math.PI); ctx.stroke();
      continue;
    }
    const blink = Math.sin(time * 0.7 + s) > 0.988;
    if (blink) {
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(exx - 6, hy - 5); ctx.lineTo(exx + 6, hy - 5); ctx.stroke();
      continue;
    }
    // iris
    const g = ctx.createRadialGradient(exx, hy - 5, 1, exx, hy - 5, 6.5);
    g.addColorStop(0, '#9ccf6a'); g.addColorStop(1, '#4e7d2f');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(exx, hy - 5, 6, 6.5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2c1f12'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(exx, hy - 5, 6, 6.5, 0, 0, 7); ctx.stroke();
    // slit pupil
    ctx.fillStyle = '#1a120a';
    ctx.beginPath(); ctx.ellipse(exx, hy - 5, 1.8, 5.4, 0, 0, 7); ctx.fill();
    // specular highlight
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(exx - 2, hy - 8, 1.6, 0, 7); ctx.fill();
  }
}

// -----------------------------------------------------------------------------

// Generated sprite assets (Qwen Image 2.1 turbo pipeline, alpha PNGs).
// 4 cat varieties × 8 chonk stages (10→80 lb). If any sprite is missing the
// vector renderer takes over (asset 404 safe).
const CAT_VARS = ['cat', 'orange', 'tuxedo', 'calico'];
const STAGE_LBS = [10, 20, 30, 40, 50, 60, 70, 80]; // sprite files on disk
// Exponential weight thresholds selecting each sprite: every size-up costs
// ~1.35x the pounds of the last — widely spaced, exponential (owner directive).
// In calories (@0.4 lb/cal from 10 lb): 0, 7.5, 19, 34, 54, 81, 117, 175.
const STAGE_AT_LB = [10, 13, 17.5, 23.5, 31.5, 42.5, 57, 80];
function stageIdxForLb(lb) {
  let st = 0;
  for (let i = 0; i < STAGE_AT_LB.length; i++) if (lb >= STAGE_AT_LB[i]) st = i;
  return st;
}
const Sprites = {
  imgs: (typeof Image === 'function') ? CAT_VARS.map(v => STAGE_LBS.map(lb => {
    const im = new Image();
    im.src = 'assets/' + v + '_w' + lb + '.png';
    return im;
  })) : [],
  ready: 0,
  init() {
    this.imgs.forEach(row => row.forEach(im => im.onload = () => { this.ready++; }));
  },
  ok() { return this.ready === CAT_VARS.length * STAGE_LBS.length; },
};
if (typeof Image === 'function') Sprites.init();

const Cats = {
  // Shooter cat perched at the top. aimAng in radians (canvas coords), loaded = yarn ready.
  drawShooter(ctx, x, y, aimAng, loaded) {
    if (Assets.ok('shooter')) {
      const im = Assets.imgs.shooter, h = 118, w = h * (im.width / im.height);
      ctx.drawImage(im, x - w / 2, y - 14, w, h);
      if (loaded) { // glow when a shot is ready
        ctx.fillStyle = 'rgba(255,220,80,0.5)';
        ctx.beginPath(); ctx.arc(x - w * 0.42, y + 34, 7 + Math.sin((Date.now() || 0) / 180) * 2, 0, 7); ctx.fill();
      }
      return;
    }
    ctx.save();
    ctx.translate(x, y);

    // Tail
    ctx.strokeStyle = '#f2a24b'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(30, 44);
    ctx.quadraticCurveTo(58, 42, 52, 12);
    ctx.stroke();
    ctx.strokeStyle = '#d98a35'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(52, 12); ctx.quadraticCurveTo(53, 20, 52, 26); ctx.stroke();

    // Body loaf with gradient + fur edge
    const bg = ctx.createRadialGradient(-10, 32, 6, 0, 42, 40);
    bg.addColorStop(0, '#f8c07a'); bg.addColorStop(1, '#e8963f');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(0, 42, 36, 24, 0, 0, 7); ctx.fill();
    furEdge(ctx, 0, 42, 36, 24, 'rgba(217,138,53,0.8)', 16);

    // Head
    const hg = ctx.createRadialGradient(-8, -8, 4, 0, 0, 32);
    hg.addColorStop(0, '#fbc783'); hg.addColorStop(1, '#ef9f45');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.fill();

    // Ears with fluff
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#f6b25c';
      ctx.beginPath();
      ctx.moveTo(s * 13, -20); ctx.lineTo(s * 27, -44); ctx.lineTo(s * 3, -30);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e88ca0';
      ctx.beginPath();
      ctx.moveTo(s * 15, -25); ctx.lineTo(s * 23, -37); ctx.lineTo(s * 9, -29);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,235,205,0.8)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(s * 10, -27); ctx.quadraticCurveTo(s * 14, -33, s * 12, -38);
      ctx.moveTo(s * 16, -26); ctx.quadraticCurveTo(s * 19, -31, s * 18, -35);
      ctx.stroke();
    }

    // Head stripes
    ctx.strokeStyle = '#d98a35'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const sx of [-8, 0, 8]) {
      ctx.beginPath(); ctx.moveTo(sx - 2, -28); ctx.lineTo(sx - 2, -18); ctx.stroke();
    }

    // Determined eyes (small version of the main eyes)
    eyesMain(ctx, 0, 0, 11, 'normal', 40); // time=40 → blink phase stable for shooter
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-17, -13); ctx.lineTo(-6, -9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(17, -13); ctx.lineTo(6, -9); ctx.stroke();
    // nose + mouth
    ctx.fillStyle = '#d96a72';
    ctx.beginPath(); ctx.moveTo(-3, 5); ctx.lineTo(3, 5); ctx.lineTo(0, 9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-5, 12); ctx.quadraticCurveTo(0, 16, 5, 12); ctx.stroke();
    // whiskers
    ctx.strokeStyle = 'rgba(58,42,26,0.5)'; ctx.lineWidth = 1.2;
    for (const s of [-1, 1]) for (const wy of [4, 10]) {
      ctx.beginPath(); ctx.moveTo(s * 12, wy); ctx.lineTo(s * 30, wy - 3); ctx.stroke();
    }

    // Paw + loaded yarn along the aim direction
    if (loaded && aimAng != null) {
      const px = Math.cos(aimAng) * 54, py = Math.sin(aimAng) * 54;
      ctx.strokeStyle = '#d98a35'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(px * 0.62, 24 + py * 0.62); ctx.stroke();
      // paw pad
      ctx.fillStyle = '#f6b25c';
      ctx.beginPath(); ctx.arc(px * 0.62, 24 + py * 0.62, 6, 0, 7); ctx.fill();
      drawYarn(ctx, px, 24 + py, 13);
    }
    ctx.restore();
  },

  // Main cat beside the bowl.
  // cat = { t: chonk factor 0..1 from lifetime weight, wob: {belly,cheek,tail} springs,
  //         nomT, face, time }
  // Every part grows at its own rate: belly sags, jowls bloom, haunches emerge,
  // paws chunk and splay, tail thickens — the head barely grows, like a real cat.
  drawMain(ctx, x, y, cat) {
    const t = Math.max(0, Math.min(1, cat.t || 0));
    const wob = cat.wob || { belly: { x: 0 }, cheek: { x: 0 }, tail: { x: 0 }, sub: { x: 0 } };
    const nomT = cat.nomT || 0, face = cat.face || 'normal', time = cat.time || 0;
    const jB = wob.belly.x || 0, jC = wob.cheek.x || 0, jT = wob.tail.x || 0;
    const bob = nomT > 0 ? Math.abs(Math.sin(nomT * 28)) * 5 : 0;

    // ---- Generated-sprite path: HARD stage cut (no crossfade — owner: crossfade ghosts),
    // squash-and-stretch jiggle with lagging sub-belly, pop on size-up ----
    if (typeof Image === 'function' && Sprites.ok()) {
      const row = Sprites.imgs[Math.max(0, Math.min(CAT_VARS.length - 1, cat.var | 0))];
      const idx = stageIdxForLb(cat.lb != null ? cat.lb : 10 + t * 70);
      if (idx !== Cats._lastIdx) { Cats._lastIdx = idx; Cats._popT0 = cat.time || 0; }
      const growAge = (cat.time || 0) - (Cats._popT0 || 0);
      const growK = Math.max(0, Math.min(1, growAge / 0.6));
      const grow = 1 + 0.20 * Math.sin(growK * Math.PI); // gentle 20% grow pulse, both axes (owner 2026-10-07)
      const H = 122 + (idx / (STAGE_LBS.length - 1)) * 58;   // stepped height, no ghost blend
      const jS = (wob.sub && wob.sub.x) || 0;
      const sy = (1 + jB * 0.13 + jS * 0.06) * (1 - bob * 0.012) * grow;
      const sx = (1 - jB * 0.06 - jS * 0.03) * grow;
      const baseY = y + 74;                          // feet anchor
      ctx.save();
      ctx.translate(x, baseY - H * sy / 2 - bob);
      ctx.scale(sx, sy);
      const im = row[idx];
      const w = H * (im.width / im.height);
      ctx.drawImage(im, -w / 2, -H / 2, w, H);
      ctx.restore();
      void face; void jC; void jT;
      return;
    }

    // ---- Vector fallback ----
    const breathe = 1 + 0.018 * Math.sin(time * 2.4);

    const rx = 62 + t * 88;
    const ry = 58 + t * 14;
    const FUR = '#f2a24b', FUR_D = '#d98a35', CREAM = '#f6b25c';

    ctx.save();
    ctx.translate(x, y);

    // Ground shadow (spreads with mass)
    ctx.fillStyle = 'rgba(60,35,10,0.18)';
    ctx.beginPath(); ctx.ellipse(0, ry + 16 + t * 6, rx * (1.02 + t * 0.06), 12 + t * 4, 0, 0, 7); ctx.fill();

    // Tail: thickens with chonk, wobble feeds the swish
    const swish = Math.sin(time * 2.2) * 8 + jT * 26;
    const tailW = 13 + t * 9;
    ctx.strokeStyle = FUR; ctx.lineWidth = tailW; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(rx - 8, 12);
    ctx.quadraticCurveTo(rx + 46, 8, rx + 40, -44 + swish);
    ctx.stroke();
    ctx.strokeStyle = FUR_D; ctx.lineWidth = tailW;
    ctx.beginPath(); ctx.moveTo(rx + 40, -44 + swish); ctx.lineTo(rx + 40, -30 + swish); ctx.stroke();

    // Haunch (thigh): emerges once there's real chonk, rear side
    const haunchT = Math.max(0, Math.min(1, (t - 0.15) / 0.35));
    if (haunchT > 0.01) {
      const hr = (10 + t * 26) * haunchT;
      const hg2 = ctx.createRadialGradient(rx * 0.5 - hr * 0.3, ry * 0.4 - hr * 0.3, hr * 0.2, rx * 0.5, ry * 0.4, hr);
      hg2.addColorStop(0, '#fbc783'); hg2.addColorStop(1, '#e8963f');
      ctx.fillStyle = hg2;
      ctx.beginPath(); ctx.arc(rx * 0.52, ry * 0.42, hr, 0, 7); ctx.fill();
      furEdge(ctx, rx * 0.52, ry * 0.42, hr, hr, 'rgba(217,138,53,0.75)', 12);
      tabby(ctx, rx * 0.52, ry * 0.42, hr, hr, 'rgba(200,120,40,0.6)');
    }

    // Torso
    const torsoRy = ry * (1 + jB * 0.05) * breathe;
    const bg = ctx.createRadialGradient(-rx * 0.25, -torsoRy * 0.35, rx * 0.2, 0, 0, rx * 1.15);
    bg.addColorStop(0, '#fbc783'); bg.addColorStop(0.6, '#f2a24b'); bg.addColorStop(1, '#dd8f3a');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, torsoRy, 0, 0, 7); ctx.fill();
    furEdge(ctx, 0, 0, rx, torsoRy, 'rgba(217,138,53,0.75)', Math.min(34, 14 + rx / 6));
    tabby(ctx, 0, 0, rx, torsoRy, 'rgba(200,120,40,0.75)');

    // Belly apron — the chonk showcase: droops lower and rounder with t
    const bellyCy = 18 + t * 22 + jB * 24;
    const bellyRx = rx * (0.60 + t * 0.10);
    const bellyRy = ry * (0.50 + t * 0.22) * (1 + jB * 0.12) * breathe;
    const bg2 = ctx.createRadialGradient(0, bellyCy - bellyRy * 0.4, 4, 0, bellyCy, bellyRx);
    bg2.addColorStop(0, '#fbe6c4'); bg2.addColorStop(1, '#f3cf9a');
    ctx.fillStyle = bg2;
    ctx.beginPath(); ctx.ellipse(0, bellyCy, bellyRx, bellyRy, 0, 0, 7); ctx.fill();

    // Chest ruff: fluffy cream bib
    const ruffRx = rx * 0.30, ruffRy = ry * (0.34 + t * 0.10);
    ctx.fillStyle = '#fbe6c4';
    ctx.beginPath(); ctx.ellipse(-rx * 0.52, ry * 0.22, ruffRx, ruffRy, 0.25, 0, 7); ctx.fill();
    furEdge(ctx, -rx * 0.52, ry * 0.22, ruffRx, ruffRy, 'rgba(243,207,154,0.9)', 10);

    // Front paws: chunk up and splay with t; pink toe beans on chonky paws
    for (const s of [-1, 1]) {
      const px = s * (rx * 0.32 + t * 12), py = ry * 0.78 + t * 6;
      const prx = 13 + t * 7, pry = 9 + t * 5;
      const pg = ctx.createRadialGradient(px - 3, py - 3, 2, px, py, prx);
      pg.addColorStop(0, '#fbc783'); pg.addColorStop(1, '#ef9f45');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.ellipse(px, py, prx, pry, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(200,120,40,0.6)'; ctx.lineWidth = 1.4;
      for (const to of [-5, 0, 5]) {
        ctx.beginPath(); ctx.moveTo(px + to, py + pry - 4); ctx.lineTo(px + to, py + pry - 1); ctx.stroke();
      }
      if (t > 0.3) {
        ctx.fillStyle = '#e88ca0';
        ctx.beginPath(); ctx.ellipse(px, py + 2, 4.5, 3.5, 0, 0, 7); ctx.fill();
        for (const to of [-6, 0, 6]) {
          ctx.beginPath(); ctx.arc(px + to * 0.9, py - 4, 2, 0, 7); ctx.fill();
        }
      }
    }

    // Head: barely grows (like a real cat), sinks toward the loaf as the neck vanishes
    const hx = -rx - 12 + t * 16, hy = -54 + bob + t * 10;
    if (t < 0.35) {
      // visible neck while slim
      ctx.fillStyle = CREAM;
      const nw = 20 * (1 - t / 0.35) + 6;
      ctx.beginPath(); ctx.ellipse(hx + 30, hy + 26, nw, 22, 0.5, 0, 7); ctx.fill();
    }
    // Ears: fixed absolute size — adorably small on a chonky head
    for (const s of [-1, 1]) {
      ctx.fillStyle = CREAM;
      ctx.beginPath();
      ctx.moveTo(hx + s * 15, hy - 28); ctx.lineTo(hx + s * 30, hy - 56); ctx.lineTo(hx + s * 4, hy - 40);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e88ca0';
      ctx.beginPath();
      ctx.moveTo(hx + s * 17, hy - 32); ctx.lineTo(hx + s * 25, hy - 47); ctx.lineTo(hx + s * 10, hy - 38);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,235,205,0.8)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(hx + s * 12, hy - 30); ctx.quadraticCurveTo(hx + s * 16, hy - 36, hx + s * 14, hy - 41);
      ctx.stroke();
    }
    const hg = ctx.createRadialGradient(hx - 10, hy - 12, 6, hx, hy, 42);
    hg.addColorStop(0, '#fbc783'); hg.addColorStop(1, '#ef9f45');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(hx, hy, 38, 0, 7); ctx.fill();
    furEdge(ctx, hx, hy, 38, 38, 'rgba(217,138,53,0.7)', 22);

    // JOWLS: cheek pouches blooming beside the muzzle — the chonk signature
    const jowlR = t * 15 + Math.max(0, jC) * 5;
    if (jowlR > 0.5) {
      ctx.fillStyle = CREAM;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.arc(hx + s * 24, hy + 8, jowlR, 0, 7); ctx.fill();
      }
      // cheek tufts
      ctx.strokeStyle = 'rgba(246,178,92,0.95)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
        const yy = hy + 2 + k * 7;
        ctx.beginPath();
        ctx.moveTo(hx + s * (24 + jowlR * 0.7), yy);
        ctx.lineTo(hx + s * (24 + jowlR * 0.7 + 5 + t * 7), yy + 3);
        ctx.stroke();
      }
    }

    // Head stripes
    ctx.strokeStyle = FUR_D; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    for (const sx of [-12, -4, 4, 12]) {
      ctx.beginPath();
      ctx.moveTo(hx + sx, hy - 36);
      ctx.quadraticCurveTo(hx + sx + 2, hy - 28, hx + sx, hy - 22);
      ctx.stroke();
    }

    // Eyes
    eyesMain(ctx, hx, hy, 14, face, time);

    // Nose
    ctx.fillStyle = '#d96a72';
    ctx.beginPath();
    ctx.moveTo(hx - 4, hy + 8); ctx.lineTo(hx + 4, hy + 8); ctx.lineTo(hx, hy + 13);
    ctx.closePath(); ctx.fill();
    // nose wrinkle when disgusted
    if (face === 'disgust') {
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(hx - 8, hy + 4); ctx.lineTo(hx - 4, hy + 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx + 8, hy + 4); ctx.lineTo(hx + 4, hy + 8); ctx.stroke();
    }

    // Cheek bulges when nomming
    if (nomT > 0) {
      ctx.fillStyle = 'rgba(246,178,92,0.9)';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(hx + s * 16, hy + 16, 10, 8 + nomT * 4, 0, 0, 7); ctx.fill();
      }
    }

    // Mouth
    if (nomT > 0) {
      ctx.fillStyle = '#7a3b2e';
      ctx.beginPath(); ctx.ellipse(hx - 1, hy + 18, 9, 4 + nomT * 16, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e88ca0';
      ctx.beginPath(); ctx.ellipse(hx - 1, hy + 22 + nomT * 8, 5, 3, 0, 0, 7); ctx.fill();
    } else if (face === 'bliss') {
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(hx - 1, hy + 10, 10, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    } else if (face === 'sad') {
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(hx - 1, hy + 24, 9, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
    } else if (face === 'disgust') {
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(hx - 1, hy + 22, 8, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke();
      ctx.fillStyle = '#e88ca0'; // tongue of regret
      ctx.beginPath(); ctx.ellipse(hx + 10, hy + 22, 6, 9, 0.3, 0, 7); ctx.fill();
    } else {
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx - 9, hy + 14); ctx.quadraticCurveTo(hx - 1, hy + 18, hx + 7, hy + 14);
      ctx.stroke();
    }

    // Whiskers (curved, drooping slightly with chonk)
    ctx.strokeStyle = 'rgba(58,42,26,0.55)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      for (const wy of [-2, 6, 14]) {
        ctx.beginPath();
        ctx.moveTo(hx + s * 30, hy + wy);
        ctx.quadraticCurveTo(hx + s * 45, hy + wy - 6 + t * 4, hx + s * 60, hy + wy - 3 + t * 6);
        ctx.stroke();
      }
    }
    ctx.restore();
  },
};
