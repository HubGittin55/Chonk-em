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
};

function drawBarrels(ctx, barrels, time) {
  for (const b of barrels) {
    if (b.cleared) continue;
    const c = CONTENT[b.content];
    const r = b.r;

    // Drop shadow
    ctx.fillStyle = 'rgba(60,35,10,0.16)';
    ctx.beginPath(); ctx.ellipse(b.x + 3, b.y + 5, r, r * 0.92, 0, 0, 7); ctx.fill();

    // Wooden body with light from upper-left
    const g = ctx.createRadialGradient(b.x - r * 0.4, b.y - r * 0.45, r * 0.25, b.x, b.y, r);
    g.addColorStop(0, '#c99257'); g.addColorStop(0.6, '#a9743c'); g.addColorStop(1, '#7c5225');
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

    // Contents badge — labeled, not a slot machine
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.arc(b.x, b.y + 2, 13.5, 0, 7); ctx.fill();
    ctx.fillStyle = b.kind === 'power' ? '#ffe9b8' : '#fff8ec';
    ctx.beginPath(); ctx.arc(b.x, b.y, 13, 0, 7); ctx.fill();
    ctx.strokeStyle = b.kind === 'veggie' ? '#c62828' : b.kind === 'power' ? '#ef6c00' : '#2e7d32';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(b.x, b.y, 13, 0, 7); ctx.stroke();
    if (b.kind === 'power') { // dashed gold ring
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(b.x, b.y, 16.5, time * 1.5, time * 1.5 + Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    ctx.font = '15px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.icon, b.x, b.y + 1);
  }
  ctx.textBaseline = 'alphabetic';
}
