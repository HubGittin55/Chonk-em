'use strict';
/* Shooter cat + main cat, drawn in code. No assets, no mercy — now with fur. */

function drawYarn(ctx, x, y, r) {
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
  const open = face !== 'happy' && face !== 'bliss' && face !== 'disgust';
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
  void open;
}

// -----------------------------------------------------------------------------

const Cats = {
  // Shooter cat perched at the top. aimAng in radians (canvas coords), loaded = yarn ready.
  drawShooter(ctx, x, y, aimAng, loaded) {
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

  // Main cat beside the bowl. rx = eased body half-width, jiggle = spring wobble.
  // face: normal|happy|bliss|disgust|sad
  drawMain(ctx, x, y, rx, nomT, face, time, jiggle) {
    const ry = 58;
    const j = jiggle || 0;
    ctx.save();
    ctx.translate(x, y);
    const bob = nomT > 0 ? Math.abs(Math.sin(nomT * 28)) * 5 : 0;

    // Ground shadow
    ctx.fillStyle = 'rgba(60,35,10,0.18)';
    ctx.beginPath(); ctx.ellipse(0, ry + 14, rx * 1.05, 12, 0, 0, 7); ctx.fill();

    // Tail (swish, striped tip)
    const swish = Math.sin(time * 2.2) * 8;
    ctx.strokeStyle = '#f2a24b'; ctx.lineWidth = 13; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(rx - 8, 12);
    ctx.quadraticCurveTo(rx + 46, 8, rx + 40, -44 + swish);
    ctx.stroke();
    ctx.strokeStyle = '#d98a35'; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(rx + 40, -44 + swish); ctx.lineTo(rx + 40, -30 + swish); ctx.stroke();

    // Body: gradient loaf, squash-stretch on jiggle
    const bg = ctx.createRadialGradient(-rx * 0.25, -ry * 0.35, rx * 0.2, 0, 0, rx * 1.15);
    bg.addColorStop(0, '#fbc783'); bg.addColorStop(0.6, '#f2a24b'); bg.addColorStop(1, '#dd8f3a');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry * (1 + j * 0.10), 0, 0, 7); ctx.fill();
    furEdge(ctx, 0, 0, rx, ry * (1 + j * 0.10), 'rgba(217,138,53,0.75)', Math.min(34, 14 + rx / 6));
    tabby(ctx, 0, 0, rx, ry * (1 + j * 0.10), 'rgba(200,120,40,0.75)');

    // Belly with jiggle sag
    const bellyRy = ry * 0.52 * (1 + j * 0.16);
    const bg2 = ctx.createRadialGradient(0, 26, 4, 0, 22, rx * 0.7);
    bg2.addColorStop(0, '#fbe6c4'); bg2.addColorStop(1, '#f3cf9a');
    ctx.fillStyle = bg2;
    ctx.beginPath(); ctx.ellipse(0, 20 + j * 26, rx * 0.62, bellyRy, 0, 0, 7); ctx.fill();

    // Front paws in front of the loaf
    ctx.fillStyle = '#f6b25c';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(s * rx * 0.32, ry * 0.78, 13, 9, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(200,120,40,0.6)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(s * rx * 0.32 - 5, ry * 0.78 + 5); ctx.lineTo(s * rx * 0.32 - 5, ry * 0.78 + 8);
      ctx.moveTo(s * rx * 0.32, ry * 0.78 + 6); ctx.lineTo(s * rx * 0.32, ry * 0.78 + 9);
      ctx.stroke();
    }

    // Head (left, toward the bowl)
    const hx = -rx - 12, hy = -54 + bob;
    // ears behind head, with fluff
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#f6b25c';
      ctx.beginPath();
      ctx.moveTo(hx + s * 15, hy - 28); ctx.lineTo(hx + s * 30, hy - 56); ctx.lineTo(hx + s * 4, hy - 40);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e88ca0';
      ctx.beginPath();
      ctx.moveTo(hx + s * 17, hy - 32); ctx.lineTo(hx + s * 25, hy - 47); ctx.lineTo(hx + s * 10, hy - 38);
      ctx.closePath(); ctx.fill();
    }
    const hg = ctx.createRadialGradient(hx - 10, hy - 12, 6, hx, hy, 42);
    hg.addColorStop(0, '#fbc783'); hg.addColorStop(1, '#ef9f45');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(hx, hy, 38, 0, 7); ctx.fill();
    furEdge(ctx, hx, hy, 38, 38, 'rgba(217,138,53,0.7)', 22);
    // head stripes
    ctx.strokeStyle = '#d98a35'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
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

    // Whiskers (curved)
    ctx.strokeStyle = 'rgba(58,42,26,0.55)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      for (const wy of [-2, 6, 14]) {
        ctx.beginPath();
        ctx.moveTo(hx + s * 30, hy + wy);
        ctx.quadraticCurveTo(hx + s * 45, hy + wy - 6, hx + s * 60, hy + wy - 3);
        ctx.stroke();
      }
    }
    ctx.restore();
  },
};
