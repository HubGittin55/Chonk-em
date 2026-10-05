'use strict';
/* Barrel contents + barrel rendering. */

const CONTENT = {
  kibble:   { cal:  1, icon: '🍪', name: 'Kibble'   },
  salmon:   { cal:  3, icon: '🍣', name: 'Salmon'   },
  tuna:     { cal:  5, icon: '🥫', name: 'Tuna'     },
  broccoli: { cal: -2, icon: '🥦', name: 'Broccoli' },
  celery:   { cal: -1, icon: '🥬', name: 'Celery'   },
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
    ctx.strokeStyle = b.kind === 'veggie' ? '#c62828' : '#2e7d32';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(b.x, b.y, 13, 0, 7); ctx.stroke();
    ctx.font = '15px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.icon, b.x, b.y + 1);
  }
  ctx.textBaseline = 'alphabetic';
}
