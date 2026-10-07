'use strict';
/* Conveyor belt + food bowl. v0.2: belt spans the playfield bottom (funnel cut,
   owner directive 2026-10-05). Loot landing on the belt rides left to the bowl;
   loot falling through the static gap on the right is lost. */

const Conveyor = {
  BELT_Y: 700,
  SPEED: 130,    // px/s, leftward
  BOWL_X: 100,
  BOWL_Y: 744,
  LEFT: 100, RIGHT: 500,     // belt extent — 60px empty gaps on BOTH sides (symmetric)
  EDGE: 60,                  // end-gap width, each side
  t: 0,

  onBelt(x, bridged) {
    if (bridged) return x >= this.LEFT - this.EDGE && x <= this.RIGHT + this.EDGE;
    return x >= this.LEFT && x <= this.RIGHT;
  },

  draw(ctx, bridged) {
    const by = this.BELT_Y;
    const segs = bridged ? [[this.LEFT - this.EDGE, this.RIGHT + this.EDGE]]
                         : [[this.LEFT, this.RIGHT]];

    // Legs
    ctx.fillStyle = '#4a4a52';
    for (const [a, b] of segs) {
      for (let lx = a + 40; lx < b - 20; lx += 140) ctx.fillRect(lx - 5, by + 12, 10, 96);
    }

    for (const [a, b] of segs) {
      // Belt body
      ctx.fillStyle = '#5b5b66';
      ctx.beginPath(); ctx.roundRect(a, by - 13, b - a, 26, 13); ctx.fill();
      // Moving slats
      ctx.strokeStyle = '#7a7a85'; ctx.lineWidth = 3;
      const off = 40 - (this.t * this.SPEED) % 40; // slats run left, with the food
      ctx.save();
      ctx.beginPath(); ctx.roundRect(a, by - 13, b - a, 26, 13); ctx.clip();
      for (let x = a - 40 + off; x < b; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, by - 13); ctx.lineTo(x, by + 13); ctx.stroke();
      }
      ctx.restore();
      // Rollers at segment ends
      ctx.fillStyle = '#3d3d44';
      for (const rx of [a + 12, b - 12]) {
        ctx.beginPath(); ctx.arc(rx, by, 15, 0, 7); ctx.fill();
        ctx.fillStyle = '#7a7a85';
        ctx.beginPath(); ctx.arc(rx, by, 6, 0, 7); ctx.fill();
        ctx.fillStyle = '#3d3d44';
      }
    }

    // Bridge power-up: belt extends over both end gaps (segs above already cover it)

    // Bowl
    const bx = this.BOWL_X, wy = this.BOWL_Y;
    if (typeof Assets !== 'undefined' && Assets.ok('bowl')) {
      const im = Assets.imgs.bowl, w = 118, h = w * (im.height / im.width);
      ctx.drawImage(im, bx - w / 2, wy - h / 2, w, h);
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(bx, wy + 22, 52, 10, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#d94f3d';
    ctx.beginPath(); ctx.ellipse(bx, wy, 50, 24, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#b23a2b';
    ctx.beginPath(); ctx.ellipse(bx, wy - 6, 50, 20, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7e271d';
    ctx.beginPath(); ctx.ellipse(bx, wy - 6, 36, 13, 0, 0, 7); ctx.fill();
    // Bowl shine
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.ellipse(bx - 24, wy - 2, 10, 5, -0.4, 0, 7); ctx.fill();
  },
};
