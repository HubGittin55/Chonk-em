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
  wide:     { cal:  0, icon: '⭐', name: 'Wide Funnel', grav: 0.80, drift: 30, power: 'wide'   },
  slow:     { cal:  0, icon: '⭐', name: 'Slow-Mo',     grav: 0.80, drift: 30, power: 'slow'   },
  magnet:   { cal:  0, icon: '⭐', name: 'Magnet',      grav: 0.80, drift: 30, power: 'magnet' },
};

function drawBarrels(ctx, barrels, time) {
  for (const b of barrels) {
    if (b.cleared) continue;
    const c = CONTENT[b.content];

    // Wooden barrel body
    ctx.fillStyle = '#a9743c';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#7c5225'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 2, 0, 7); ctx.stroke();
    // Staves
    ctx.strokeStyle = 'rgba(124,82,37,0.55)'; ctx.lineWidth = 2;
    for (const a of [0.5, 1.7, 2.9, 4.1, 5.3]) {
      ctx.beginPath();
      ctx.moveTo(b.x + Math.cos(a) * 6, b.y + Math.sin(a) * 6);
      ctx.lineTo(b.x + Math.cos(a) * (b.r - 4), b.y + Math.sin(a) * (b.r - 4));
      ctx.stroke();
    }
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(b.x - 6, b.y - 7, 7, 0, 7); ctx.fill();

    // Contents badge — labeled, not a slot machine
    ctx.fillStyle = '#fff8ec';
    ctx.beginPath(); ctx.arc(b.x, b.y, 13, 0, 7); ctx.fill();
    ctx.strokeStyle = b.kind === 'veggie' ? '#c62828' : b.kind === 'power' ? '#ef6c00' : '#2e7d32';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(b.x, b.y, 13, 0, 7); ctx.stroke();
    ctx.font = '15px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.icon, b.x, b.y + 1);
  }
  ctx.textBaseline = 'alphabetic';
}
