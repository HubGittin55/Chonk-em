'use strict';
/* FX bus — one API for all game feel. New juice becomes a one-liner anywhere:
   FX.popup / FX.shake / FX.hitstop / FX.slowmo / FX.confetti / FX.burstJuice.
   Loaded before main.js; methods only run at call time (after game exists).
   Honors REDUCED (prefers-reduced-motion) — feel degrades to zero, never negative. */

const FX = {
  popup(x, y, text, color) { addPopup(x, y, text, color); },

  shake(amt, dur) { // screen shake: magnitude px + duration s
    if (typeof REDUCED !== 'undefined' && REDUCED) return;
    game.shakeAmt = Math.max(game.shakeAmt || 0, amt);
    game.shakeT = Math.max(game.shakeT || 0, dur);
  },

  hitstop(sec) { // brief full freeze of the world (rendering continues)
    if (typeof REDUCED !== 'undefined' && REDUCED) return;
    game.hitstopT = Math.max(game.hitstopT || 0, sec);
  },

  slowmo(scale, dur) { // brief world slow-mo; stacks under frenzy / slow-mo power-up
    game.fxSlowT = dur;
    game.fxSlowScale = scale;
  },

  confetti(x, y, n) { // bright paper burst (exotic deliveries, jackpots)
    if (typeof REDUCED !== 'undefined' && REDUCED) return;
    const cols = ['#e91e63', '#ff9800', '#ffeb3b', '#4caf50', '#2196f3', '#9c27b0', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, sp = 120 + Math.random() * 260;
      game.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16,
        size: 3 + Math.random() * 4, life: 0.7 + Math.random() * 0.6,
        color: cols[i % cols.length],
      });
    }
    if (game.particles.length > 220) game.particles.splice(0, game.particles.length - 220);
  },

  // One-liner per barrel burst: hit-stop + shake scale with the payload.
  burstJuice(kind, cal, x, y) {
    if (kind === 'keg')    { this.shake(64, 0.45); this.hitstop(0.06); return; }
    if (kind === 'golden') { this.shake(48, 0.35); this.hitstop(0.05); this.confetti(x, y, 30); return; }
    if (kind === 'mystery'){ this.hitstop(0.04); return; }
    if (kind === 'cuke')   { this.shake(30, 0.25); return; }
    if (cal >= 50)      { this.shake(28, 0.22); this.hitstop(0.035); }
    else if (cal >= 25) { this.shake(18, 0.16); this.hitstop(0.025); }
    else if (cal >= 10) { this.hitstop(0.02); }
  },

  // EMP short-circuit: expanding shockwave ring + electric sparks + shake + hit-stop.
  empBlast(x, y) {
    this.shake(34, 0.32); this.hitstop(0.05);
    if (typeof spawnRing === 'function') spawnRing(x, y, '#40c4ff', 260, 0.6);
    if (typeof REDUCED !== 'undefined' && REDUCED) return;
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, sp = 100 + Math.random() * 340;
      game.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rot: 0, vr: 0, size: 2.5 + Math.random() * 3.5, life: 0.4 + Math.random() * 0.4,
        color: ['#40c4ff', '#e1f5fe', '#0288d1', '#ffffff'][i % 4],
      });
    }
    if (game.particles.length > 220) game.particles.splice(0, game.particles.length - 220);
  },

  // Per-exotic signature burst: named popup + signature particle palette (EXOTIC_FX
  // table in barrels.js). The biggest feasts (75+ cal) steal a dramatic slow-mo beat.
  exoticFx(x, y, content) {
    const fx = (typeof EXOTIC_FX !== 'undefined' && EXOTIC_FX[content]) || null;
    if (!fx) return;
    addPopup(x, y - 34, fx.text, '#ffd54f');
    if (typeof REDUCED !== 'undefined' && REDUCED) return;
    for (let i = 0; i < 22; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = 140 + Math.random() * 280;
      game.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16,
        size: 3 + Math.random() * 4, life: 0.7 + Math.random() * 0.6,
        color: fx.colors[i % fx.colors.length],
      });
    }
    if (game.particles.length > 220) game.particles.splice(0, game.particles.length - 220);
    if ((CONTENT[content] || {}).cal >= 30) this.slowmo(0.5, 0.8); // imperial-tier beat (top-3 exotics)
  },

  tick(dt) { // real-time decay of FX slow-mo (hit-stop is consumed in tick())
    if (game.fxSlowT > 0) game.fxSlowT -= dt;
  },
};
