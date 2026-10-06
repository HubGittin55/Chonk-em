'use strict';
/* Barrel contents + barrel rendering.
   grav: item gravity multiplier · drift: horizontal wobble accel · power: power-up key. */

const CONTENT = {
  kibble:   { cal:  1, icon: '🍪', name: 'Kibble',   grav: 1.00, drift:  0  },
  salmon:   { cal:  3, icon: '🍣', name: 'Salmon',   grav: 0.70, drift: 85  },
  tuna:     { cal:  5, icon: '🥫', name: 'Tuna',     grav: 1.50, drift:  0  },
  broccoli: { cal: -2, icon: '🥦', name: 'Broccoli', grav: 1.05, drift:  0  },
  celery:   { cal: -1, icon: '🥬', name: 'Celery',   grav: 1.00, drift:  0  },
  multi:    { cal:  0, icon: '⭐', name: 'Multi-Yarn',  grav: 0.80, drift: 30, power: 'multi'  },
  wide:     { cal:  0, icon: '⭐', name: 'Gap Bridge',  grav: 0.80, drift: 30, power: 'wide'   },
  slow:     { cal:  0, icon: '⭐', name: 'Slow-Mo',     grav: 0.80, drift: 30, power: 'slow'   },
  magnet:   { cal:  0, icon: '⭐', name: 'Magnet',      grav: 0.80, drift: 30, power: 'magnet' },
  split:    { cal:  0, icon: '⭐', name: 'Split Yarn',  grav: 0.80, drift: 30, power: 'split'  },
};

// Armor band + cracks drawn over generated skins (vector path inlines its own)
function drawArmor(ctx, b, r) {
  if (b.armor) {
    ctx.strokeStyle = '#3f434b'; ctx.lineWidth = Math.max(3, r * 0.32);
    ctx.beginPath(); ctx.moveTo(b.x - r * 0.95, b.y); ctx.lineTo(b.x + r * 0.95, b.y); ctx.stroke();
  }
  if (b.cracked) {
    ctx.strokeStyle = 'rgba(30,18,8,0.85)'; ctx.lineWidth = 1.8;
    for (const [x1, y1, x2, y2, x3, y3] of
         [[-0.5, -0.8, -0.1, -0.2, -0.4, 0.3], [0.4, -0.7, 0.15, -0.1, 0.5, 0.4]]) {
      ctx.beginPath();
      ctx.moveTo(b.x + x1 * r, b.y + y1 * r);
      ctx.lineTo(b.x + x2 * r, b.y + y2 * r);
      ctx.lineTo(b.x + x3 * r, b.y + y3 * r);
      ctx.stroke();
    }
  }
}

function drawBarrels(ctx, barrels, time) {
  for (const b of barrels) {
    if (b.cleared) continue;
    const c = CONTENT[b.content] || {};
    const r = b.r;

    // Generated barrel skin (AoT style), vector fallback below
    if (typeof Assets !== 'undefined' && Assets.ok('barrel_' + b.content)) {
      const im = Assets.imgs['barrel_' + b.content];
      const s = r * 2.75;
      ctx.drawImage(im, b.x - s / 2, b.y - s / 2, s, s);
      if (b.kind === 'power') { // dashed gold ring
        ctx.strokeStyle = '#ef6c00';
        ctx.lineWidth = 2.5;
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(b.x, b.y, r + 1.5, time * 1.5, time * 1.5 + Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      drawArmor(ctx, b, r);
      continue;
    }

    // Drop shadow
    ctx.fillStyle = 'rgba(60,35,10,0.16)';
    ctx.beginPath(); ctx.ellipse(b.x + 3, b.y + 5, r, r * 0.92, 0, 0, 7); ctx.fill();

    // Wooden body with light from upper-left (hollow gray for empty barrels)
    const g = ctx.createRadialGradient(b.x - r * 0.4, b.y - r * 0.45, r * 0.25, b.x, b.y, r);
    if (b.kind === 'empty') { g.addColorStop(0, '#a8a8b0'); g.addColorStop(0.6, '#84848e'); g.addColorStop(1, '#5e5e66'); }
    else { g.addColorStop(0, '#c99257'); g.addColorStop(0.6, '#a9743c'); g.addColorStop(1, '#7c5225'); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 7); ctx.fill();

    // Staves: full-face grain lines
    ctx.save();
    ctx.beginPath(); ctx.arc(b.x, b.y, r - 1, 0, 7); ctx.clip();
    ctx.strokeStyle = 'rgba(96,60,26,0.5)'; ctx.lineWidth = 1.5;
    for (const sx of [-0.66, -0.33, 0, 0.33, 0.66]) {
      ctx.beginPath();
      ctx.moveTo(b.x + r * sx, b.y - r);
      ctx.quadraticCurveTo(b.x + r * sx * 1.35, b.y, b.x + r * sx, b.y + r);
      ctx.stroke();
    }
    // Knot
    ctx.strokeStyle = 'rgba(96,60,26,0.4)';
    ctx.beginPath(); ctx.ellipse(b.x + r * 0.45, b.y + r * 0.35, 3.5, 2.2, 0.6, 0, 7); ctx.stroke();
    ctx.restore();

    // Iron hoops (top + bottom bands, with rivets)
    ctx.strokeStyle = '#5a5f68'; ctx.lineWidth = 5;
    for (const hy of [-r * 0.62, r * 0.62]) {
      const half = Math.sqrt(Math.max(0, r * r - hy * hy));
      ctx.beginPath();
      ctx.moveTo(b.x - half, b.y + hy);
      ctx.lineTo(b.x + half, b.y + hy);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(230,235,245,0.5)'; ctx.lineWidth = 1.5;
    for (const hy of [-r * 0.62, r * 0.62]) {
      const half = Math.sqrt(Math.max(0, r * r - hy * hy));
      ctx.beginPath();
      ctx.moveTo(b.x - half + 3, b.y + hy - 1.5);
      ctx.lineTo(b.x + half - 3, b.y + hy - 1.5);
      ctx.stroke();
    }

    // Rim
    ctx.strokeStyle = '#5f3d18'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(b.x, b.y, r - 1.5, 0, 7); ctx.stroke();
    // Specular sheen
    ctx.fillStyle = 'rgba(255,240,210,0.22)';
    ctx.beginPath(); ctx.ellipse(b.x - r * 0.38, b.y - r * 0.42, r * 0.34, r * 0.2, -0.6, 0, 7); ctx.fill();

    // Armor band under the badge: tough barrels need 2 hits
    if (b.armor) {
      ctx.strokeStyle = '#3f434b'; ctx.lineWidth = Math.max(3, r * 0.32);
      ctx.beginPath(); ctx.moveTo(b.x - r * 0.95, b.y); ctx.lineTo(b.x + r * 0.95, b.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(220,225,235,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(b.x - r * 0.95, b.y - 2); ctx.lineTo(b.x + r * 0.95, b.y - 2); ctx.stroke();
    }

    // Contents badge — labeled, not a slot machine (scaled to barrel)
    const br = r * 0.62;
    if (b.kind === 'empty') {
      // hollow: dashed gray ring, nothing inside
      ctx.strokeStyle = 'rgba(70,70,80,0.75)'; ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(b.x, b.y, br, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.arc(b.x, b.y + 2, br + 0.5, 0, 7); ctx.fill();
    ctx.fillStyle = b.kind === 'power' ? '#ffe9b8' : '#fff8ec';
    ctx.beginPath(); ctx.arc(b.x, b.y, br, 0, 7); ctx.fill();
    ctx.strokeStyle = b.kind === 'veggie' ? '#c62828' : b.kind === 'power' ? '#ef6c00' : '#2e7d32';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, br, 0, 7); ctx.stroke();
    if (b.kind === 'power') { // dashed gold ring
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(b.x, b.y, r + 1.5, time * 1.5, time * 1.5 + Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    ctx.font = Math.max(9, Math.round(r * 0.72)) + 'px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.icon, b.x, b.y + 1);

    // Cracks after the first hit on armored barrels
    if (b.cracked) {
      ctx.strokeStyle = 'rgba(30,18,8,0.85)'; ctx.lineWidth = 1.8;
      for (const [x1, y1, x2, y2, x3, y3] of
           [[-0.5, -0.8, -0.1, -0.2, -0.4, 0.3], [0.4, -0.7, 0.15, -0.1, 0.5, 0.4], [-0.1, 0.9, 0.1, 0.4, -0.2, 0.1]]) {
        ctx.beginPath();
        ctx.moveTo(b.x + x1 * r, b.y + y1 * r);
        ctx.lineTo(b.x + x2 * r, b.y + y2 * r);
        ctx.lineTo(b.x + x3 * r, b.y + y3 * r);
        ctx.stroke();
      }
    }
  }
  ctx.textBaseline = 'alphabetic';
}
