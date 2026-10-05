'use strict';
/* Conveyor belt + food bowl. Loot rides left, drops into the bowl. */

const Conveyor = {
  BELT_Y: 752,   // belt centerline
  SPEED: 130,    // px/s, leftward
  BOWL_X: 100,
  BOWL_Y: 794,
  t: 0,

  draw(ctx) {
    const by = this.BELT_Y;

    // Legs
    ctx.fillStyle = '#4a4a52';
    for (const lx of [110, 250, 390]) {
      ctx.fillRect(lx - 5, by + 12, 10, 96);
    }

    // Belt body
    ctx.fillStyle = '#5b5b66';
    ctx.beginPath();
    ctx.roundRect(64, by - 13, 410, 26, 13);
    ctx.fill();
    // Moving slats
    ctx.strokeStyle = '#7a7a85'; ctx.lineWidth = 3;
    const off = (this.t * this.SPEED) % 40;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(64, by - 13, 410, 26, 13); ctx.clip();
    for (let x = 64 - 40 + off; x < 480; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, by - 13); ctx.lineTo(x, by + 13); ctx.stroke();
    }
    ctx.restore();
    // Rollers
    ctx.fillStyle = '#3d3d44';
    for (const rx of [76, 462]) {
      ctx.beginPath(); ctx.arc(rx, by, 15, 0, 7); ctx.fill();
      ctx.fillStyle = '#7a7a85';
      ctx.beginPath(); ctx.arc(rx, by, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#3d3d44';
    }

    // Bowl
    const bx = this.BOWL_X, wy = this.BOWL_Y;
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
