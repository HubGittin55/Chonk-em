'use strict';
/* Fixed-timestep friendly physics: yarn ball flight + barrel collision. */

const Physics = {
  GRAV: 950,   // px/s^2 for yarn balls
  REST: 0.72,  // wall restitution

  // Returns true when the ball is dead.
  stepBall(ball, dt, barrels, onBurst, onCrack, onSpecial) {
    const P = Physics;
    ball.vy += P.GRAV * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.life += dt;

    // Playfield walls (barrel zone). Left/right/top only — the bottom is open.
    const L = 24, R = 576, T = 40;
    if (ball.x < L + ball.r) { ball.x = L + ball.r; ball.vx = Math.abs(ball.vx) * P.REST; ball.bounces++; }
    if (ball.x > R - ball.r) { ball.x = R - ball.r; ball.vx = -Math.abs(ball.vx) * P.REST; ball.bounces++; }
    if (ball.y < T + ball.r) { ball.y = T + ball.r; ball.vy = Math.abs(ball.vy) * P.REST; ball.bounces++; }

    // Barrel hits: reflect, lose energy (chaining costs speed).
    // Armored barrels need 2 hits — the first only cracks them.
    for (const b of barrels) {
      if (b.cleared) continue;
      const dx = ball.x - b.x, dy = ball.y - b.y;
      const d = Math.hypot(dx, dy), min = ball.r + b.r;
      if (d < min && d > 0.001) {
        const nx = dx / d, ny = dy / d;
        const dot = ball.vx * nx + ball.vy * ny;
        if (b.kind === 'steel') { // unbreakable obstacle: dead bounce, never bursts
          ball.vx = (ball.vx - 2 * dot * nx) * 0.85;
          ball.vy = (ball.vy - 2 * dot * ny) * 0.85;
          ball.x = b.x + nx * min;
          ball.y = b.y + ny * min;
          ball.bounces++;
          if (onSpecial) onSpecial('steel', b, ball);
          continue;
        }
        if (b.kind === 'bumper') { // chrome bumper: power bounce + combo, never bursts
          let vx = (ball.vx - 2 * dot * nx) * 1.25, vy = (ball.vy - 2 * dot * ny) * 1.25;
          const sp = Math.hypot(vx, vy), MAXSP = 950;
          if (sp > MAXSP) { vx *= MAXSP / sp; vy *= MAXSP / sp; }
          ball.vx = vx; ball.vy = vy;
          ball.x = b.x + nx * min;
          ball.y = b.y + ny * min;
          ball.bounces++;
          if (onSpecial) onSpecial('bumper', b, ball);
          continue;
        }
        ball.vx = (ball.vx - 2 * dot * nx) * 0.8;
        ball.vy = (ball.vy - 2 * dot * ny) * 0.8;
        ball.x = b.x + nx * min;
        ball.y = b.y + ny * min;
        ball.bounces++;
        if (b.armor && !b.cracked) {
          b.cracked = true;
          onCrack(b);
        } else {
          b.cleared = true;
          b.popT = 0;
          onBurst(b, ball);
        }
      }
    }

    const sp = Math.hypot(ball.vx, ball.vy);
    ball.slowT = sp < 90 ? ball.slowT + dt : 0;

    return ball.life > 14 || ball.slowT > 0.7 || ball.bounces > 14 || ball.y > 940;
  },

  // Food/item bounce off barrels. Food NEVER bursts barrels — burst is yarn-only.
  // Push-out + velocity reflect with restitution; the barrel is untouched.
  // Gentle rests slide off tangentially instead of micro-bouncing in place
  // forever (that wedged items mid-field and soft-locked the level — the
  // exhaustion check waits for game.items to empty).
  bounceItem(it, barrels) {
    for (const b of barrels) {
      if (b.cleared) continue;
      const dx = it.x - b.x, dy = it.y - b.y;
      const min = it.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < min * min && d2 > 0.0001) {
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        it.x = b.x + nx * min;
        it.y = b.y + ny * min;
        const vn = it.vx * nx + it.vy * ny;
        if (vn < 0) {
          if (vn < -60) { // solid hit: restitution 0.5 — food bounces off, barrel stands
            it.vx -= 1.5 * vn * nx;
            it.vy -= 1.5 * vn * ny;
          } else { // gentle rest: slide off around the barrel instead of hovering
            const tx = -ny, ty = nx, vt = it.vx * tx + it.vy * ty;
            it.vx = tx * vt + nx * 14;
            it.vy = ty * vt + ny * 14;
          }
        }
      }
    }
  },
};
