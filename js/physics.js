'use strict';
/* Fixed-timestep friendly physics: yarn ball flight + barrel collision. */

const Physics = {
  GRAV: 950,   // px/s^2 for yarn balls
  REST: 0.72,  // wall restitution

  // Returns true when the ball is dead.
  stepBall(ball, dt, barrels, onBurst) {
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

    // Barrel hits: burst it, reflect, lose energy (chaining costs speed).
    for (const b of barrels) {
      if (b.cleared) continue;
      const dx = ball.x - b.x, dy = ball.y - b.y;
      const d = Math.hypot(dx, dy), min = ball.r + b.r;
      if (d < min && d > 0.001) {
        const nx = dx / d, ny = dy / d;
        const dot = ball.vx * nx + ball.vy * ny;
        ball.vx = (ball.vx - 2 * dot * nx) * 0.8;
        ball.vy = (ball.vy - 2 * dot * ny) * 0.8;
        ball.x = b.x + nx * min;
        ball.y = b.y + ny * min;
        b.cleared = true;
        b.popT = 0;
        ball.bounces++;
        onBurst(b);
      }
    }

    const sp = Math.hypot(ball.vx, ball.vy);
    ball.slowT = sp < 90 ? ball.slowT + dt : 0;

    return ball.life > 14 || ball.slowT > 0.7 || ball.bounces > 14 || ball.y > 940;
  },

  // Food/item bounce off barrels. Food NEVER bursts barrels — burst is yarn-only.
  // Push-out + velocity reflect with restitution; the barrel is untouched.
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
        if (vn < 0) { // restitution 0.5 — food bounces off, barrel stands
          it.vx -= 1.5 * vn * nx;
          it.vy -= 1.5 * vn * ny;
        }
      }
    }
  },
};
