'use strict';
/* Shooter cat + main cat, drawn in code. No assets, no mercy. */

function drawYarn(ctx, x, y, r) {
  ctx.fillStyle = '#e84a6f';
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#b83556'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0.4, 2.6); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.62, 3.4, 5.6); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r * 0.8, y + r * 0.5);
  ctx.quadraticCurveTo(x - r - 12, y + r + 10, x - r - 4, y + r + 20);
  ctx.stroke();
}

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

    // Body loaf
    ctx.fillStyle = '#f2a24b';
    ctx.beginPath(); ctx.ellipse(0, 42, 36, 24, 0, 0, 7); ctx.fill();

    // Head
    ctx.fillStyle = '#f6b25c';
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.fill();

    // Ears
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#f6b25c';
      ctx.beginPath();
      ctx.moveTo(s * 13, -20); ctx.lineTo(s * 27, -44); ctx.lineTo(s * 3, -30);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e88ca0';
      ctx.beginPath();
      ctx.moveTo(s * 15, -25); ctx.lineTo(s * 23, -37); ctx.lineTo(s * 9, -29);
      ctx.closePath(); ctx.fill();
    }

    // Head stripes
    ctx.strokeStyle = '#d98a35'; ctx.lineWidth = 3;
    for (const sx of [-8, 0, 8]) {
      ctx.beginPath(); ctx.moveTo(sx - 2, -28); ctx.lineTo(sx - 2, -18); ctx.stroke();
    }

    // Determined face
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath(); ctx.arc(-11, -2, 3.6, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(11, -2, 3.6, 0, 7); ctx.fill();
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-17, -13); ctx.lineTo(-6, -9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(17, -13); ctx.lineTo(6, -9); ctx.stroke();
    // Mouth
    ctx.beginPath(); ctx.moveTo(-5, 10); ctx.quadraticCurveTo(0, 14, 5, 10); ctx.stroke();

    // Paw + loaded yarn along the aim direction
    if (loaded && aimAng != null) {
      const px = Math.cos(aimAng) * 54, py = Math.sin(aimAng) * 54;
      ctx.strokeStyle = '#d98a35'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(px * 0.62, 24 + py * 0.62); ctx.stroke();
      drawYarn(ctx, px, 24 + py, 13);
    }
    ctx.restore();
  },

  // Main cat beside the bowl. stage 0..4 widens the body. face: normal|happy|bliss|disgust|sad
  drawMain(ctx, x, y, stage, nomT, face, time) {
    const rx = 62 + stage * 24, ry = 58;
    ctx.save();
    ctx.translate(x, y);
    const bob = nomT > 0 ? Math.abs(Math.sin(nomT * 28)) * 5 : 0;

    // Tail (swish)
    const swish = Math.sin(time * 2.2) * 8;
    ctx.strokeStyle = '#f2a24b'; ctx.lineWidth = 13; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(rx - 8, 12);
    ctx.quadraticCurveTo(rx + 46, 8, rx + 40, -44 + swish);
    ctx.stroke();
    ctx.strokeStyle = '#d98a35'; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(rx + 40, -44 + swish); ctx.lineTo(rx + 40, -30 + swish); ctx.stroke();

    // Body
    ctx.fillStyle = '#f2a24b';
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.fill();
    // Belly
    ctx.fillStyle = '#f8d9a8';
    ctx.beginPath(); ctx.ellipse(0, 20, rx * 0.62, ry * 0.52, 0, 0, 7); ctx.fill();
    // Body stripes
    ctx.strokeStyle = '#d98a35'; ctx.lineWidth = 4;
    for (const sx of [-0.4, 0, 0.4]) {
      ctx.beginPath();
      ctx.moveTo(rx * sx - 6, -ry + 8);
      ctx.quadraticCurveTo(rx * sx, -ry + 22, rx * sx - 6, -ry + 36);
      ctx.stroke();
    }

    // Head (left, toward the bowl)
    const hx = -rx - 12, hy = -54 + bob;
    ctx.fillStyle = '#f6b25c';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hx + s * 15, hy - 28); ctx.lineTo(hx + s * 30, hy - 56); ctx.lineTo(hx + s * 4, hy - 40);
      ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(hx, hy, 38, 0, 7); ctx.fill();

    // Face
    const ex = 14, ey = -6;
    ctx.fillStyle = '#3a2a1a';
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    if (face === 'happy' || face === 'bliss') {
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.arc(hx + s * ex, ey + hy, 7, Math.PI, 2 * Math.PI); ctx.stroke();
      }
    } else if (face === 'disgust') {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(hx + s * ex - 6, hy - 12); ctx.lineTo(hx + s * ex + 6, hy - 2);
        ctx.moveTo(hx + s * ex + 6, hy - 12); ctx.lineTo(hx + s * ex - 6, hy - 2);
        ctx.stroke();
      }
      // Tongue of regret
      ctx.fillStyle = '#e88ca0';
      ctx.beginPath(); ctx.ellipse(hx + 10, hy + 22, 6, 9, 0.3, 0, 7); ctx.fill();
    } else if (face === 'sad') {
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath(); ctx.arc(hx - ex, hy - 6, 4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(hx + ex, hy - 6, 4, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath(); ctx.arc(hx - ex, hy - 6, 4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(hx + ex, hy - 6, 4, 0, 7); ctx.fill();
      // Blinking
      if (Math.sin(time * 0.7) > 0.985) {
        ctx.fillStyle = '#f6b25c';
        ctx.fillRect(hx - ex - 5, hy - 11, 10, 10);
        ctx.fillRect(hx + ex - 5, hy - 11, 10, 10);
      }
    }

    // Mouth
    if (nomT > 0) {
      ctx.fillStyle = '#7a3b2e';
      ctx.beginPath(); ctx.ellipse(hx - 4, hy + 16, 9, 4 + nomT * 16, 0, 0, 7); ctx.fill();
    } else if (face === 'bliss') {
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(hx - 4, hy + 8, 10, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    } else if (face === 'sad') {
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(hx - 4, hy + 22, 9, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
    } else if (face !== 'disgust') {
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(hx - 10, hy + 12); ctx.quadraticCurveTo(hx - 4, hy + 16, hx + 2, hy + 12); ctx.stroke();
    }

    // Whiskers
    ctx.strokeStyle = 'rgba(58,42,26,0.6)'; ctx.lineWidth = 1.5;
    for (const s of [-1, 1]) {
      for (const wy of [-2, 6, 14]) {
        ctx.beginPath();
        ctx.moveTo(hx + s * 30, hy + wy);
        ctx.lineTo(hx + s * 58, hy + wy - 4);
        ctx.stroke();
      }
    }
    ctx.restore();
  },
};
