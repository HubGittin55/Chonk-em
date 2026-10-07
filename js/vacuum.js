'use strict';
/* Roomba-style vacuum hazard. Patrols slowly beneath the conveyor belt,
   hoovering up falling and belt-riding loot (food AND power-ups).
   Vector-drawn — no asset needed. Only spawns on levels flagged `vacuum: true`
   (kept rare by design: 3 of 12 levels). Once loot enters the bowl's drop
   chute it's the cat's — the vacuum can't steal from there. */

const Vacuum = {
  SPEED: 42,       // px/s — slow enough to play around, fast enough to matter
  SUCK_R: 55,      // suction radius from the mouth (tuned down — was 95)
  EAT_R: 20,       // capture radius — loot this close is gone (was 30)
  MEAL: 2,         // items eaten per shot, then it's full until the next shot
  PULL: 340,       // suction velocity px/s toward the mouth
  MIN_X: 70, MAX_X: 530,
  MOUTH_Y: 740,    // mouth height: just under the belt line
  BODY_Y: 792,

  create(speedMul) {
    return { x: 300, dir: Math.random() < 0.5 ? -1 : 1, t: Math.random() * 6.28, eaten: 0,
             eatenThisShot: 0, speedMul: speedMul || 1 };
  },

  // wdt: world dt (slow-mo aware). onEaten(x, y, item) fires effects in main.js.
  tick(v, wdt, items, onEaten) {
    v.t += wdt;
    v.x += v.dir * Vacuum.SPEED * (v.speedMul || 1) * wdt;
    if (v.x <= Vacuum.MIN_X) { v.x = Vacuum.MIN_X; v.dir = 1; }
    else if (v.x >= Vacuum.MAX_X) { v.x = Vacuum.MAX_X; v.dir = -1; }
    const mx = v.x, my = Vacuum.MOUTH_Y;
    for (const it of items) {
      if ((v.eatenThisShot || 0) >= Vacuum.MEAL) return; // full — no more sucking until the next shot
      if (it.gone || (it.state !== 'fall' && it.state !== 'belt')) continue;
      // bowl drop chute: once loot reaches the bowl it's the cat's, vacuum can't steal it
      if (typeof Conveyor !== 'undefined' && Math.abs(it.x - Conveyor.BOWL_X) < 44 && it.y > Conveyor.BELT_Y - 40) continue;
      const dx = mx - it.x, dy = my - it.y;
      const d = Math.hypot(dx, dy);
      // escaped the suction cone — allowed to land on the belt again
      if (d > Vacuum.SUCK_R) { if (it.sucked) it.sucked = false; continue; }
      if (d < Vacuum.EAT_R) {
        it.gone = true;
        v.eaten++;
        v.eatenThisShot = (v.eatenThisShot || 0) + 1;
        onEaten(it.x, it.y, it);
        continue;
      }
      // suction yank — belt loot gets ripped off the belt, falling loot bends in.
      // sucked items can't re-land on the belt until they escape the cone.
      it.sucked = true;
      const pull = Vacuum.PULL * wdt;
      it.x += (dx / d) * pull;
      it.y += (dy / d) * pull;
      if (it.state === 'belt') { it.state = 'fall'; it.vx = 0; it.vy = 120; }
    }
  },

  draw(ctx, v) {
    const y = Vacuum.BODY_Y + Math.sin(v.t * 9) * 1.5; // motor vibration
    ctx.save();
    ctx.translate(v.x, y);

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(0, 32, 42, 8, 0, 0, 7); ctx.fill();

    // wheels
    ctx.fillStyle = '#2b2b30';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 26, 18, 12, 0, 7); ctx.fill(); }

    // body
    const g = ctx.createLinearGradient(0, -34, 0, 26);
    g.addColorStop(0, '#8a8f98'); g.addColorStop(1, '#4c5158');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.fill();
    ctx.strokeStyle = '#33363c'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.stroke();

    // dome
    ctx.fillStyle = '#6d727b';
    ctx.beginPath(); ctx.arc(0, -12, 16, Math.PI, 0); ctx.fill();

    // angry red eye (blinks)
    const blink = (v.t % 3) < 0.15 ? 0.25 : 1;
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath(); ctx.ellipse(v.dir * 8, -6, 8, 5 * blink, 0, 0, 7); ctx.fill();

    // nozzle hose pointing up
    ctx.strokeStyle = '#3a3d42'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(v.dir * 6, -48); ctx.stroke();
    // mouth
    ctx.fillStyle = '#1c1e22';
    ctx.beginPath(); ctx.ellipse(v.dir * 6, -52, 14, 7, 0, 0, 7); ctx.fill();

    // suction shimmer — rings collapsing into the mouth
    ctx.strokeStyle = 'rgba(190,210,230,0.55)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const rr = 26 + ((v.t * 70 + i * 26) % 52);
      ctx.globalAlpha = 1 - (rr - 26) / 52;
      ctx.beginPath(); ctx.arc(v.dir * 6, -52, rr, -1.2, 1.2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  },
};
