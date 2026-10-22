'use strict';
/* Conveyor belt + food bowl. v0.2: belt spanned the playfield bottom (funnel cut,
   owner directive 2026-10-05), bowl on the left.
   2026-10-17 (Blarmo directive: center-bowl-dual-belts): the bowl moves to the
   CENTER and two separate belts — left and right — both run INWARD toward a
   center gap between them. Food riding either belt into the gap drops through
   into the bowl. Food off the far ends still falls to the tile floor and is
   lost; the Bridge power-up spans both outer gaps. */

const Conveyor = {
  BELT_Y: 700,
  SPEED: 130,    // px/s, inward toward the center gap (direction set per belt side)
  BOWL_X: 300,   // center bowl — both belts feed it
  BOWL_Y: 744,
  LEFT: 72, RIGHT: 528,       // outer belt extents — 32px lost-food gaps at the far ends
  EDGE: 32,                  // outer end-gap width
  GAP_L: 268, GAP_R: 332,    // center gap — food drops through into the bowl

  t: 0,

  // Which belt (if any) an x sits over: 'L' | 'R' | null.
  onBelt(x, bridged) {
    const L0 = bridged ? this.LEFT - this.EDGE : this.LEFT;
    const R1 = bridged ? this.RIGHT + this.EDGE : this.RIGHT;
    if (x >= L0 && x <= this.GAP_L) return 'L';
    if (x >= this.GAP_R && x <= R1) return 'R';
    return null;
  },

  // 2026-10-17 lost-food-pop-bug fix: the belt catch must be a plane CROSSING
  // (prevY < BELT_Y ≤ y with vy > 0). A y-only check re-catches food that fell
  // below the belt line and drifted back under it — the "pop" Blarmo reported.
  crossesBelt(prevY, y, vy) { return prevY < this.BELT_Y && y >= this.BELT_Y && vy > 0; },

  draw(ctx, bridged) {
    const by = this.BELT_Y;
    const segs = bridged
      ? [[this.LEFT - this.EDGE, this.GAP_L, 1], [this.GAP_R, this.RIGHT + this.EDGE, -1]]
      : [[this.LEFT, this.GAP_L, 1], [this.GAP_R, this.RIGHT, -1]];
    // dir: +1 slats run right (left belt), -1 slats run left (right belt) — inward with the food

    // Legs
    ctx.fillStyle = '#4a4a52';
    for (const [a, b] of segs) {
      for (let lx = a + 40; lx < b - 20; lx += 140) ctx.fillRect(lx - 5, by + 12, 10, 96);
    }

    for (const [a, b, dir] of segs) {
      // Belt body
      ctx.fillStyle = '#5b5b66';
      ctx.beginPath(); ctx.roundRect(a, by - 13, b - a, 26, 13); ctx.fill();
      // Moving slats — run inward with the food
      ctx.strokeStyle = '#7a7a85'; ctx.lineWidth = 3;
      const phase = (this.t * this.SPEED) % 40;
      const off = dir > 0 ? phase : 40 - phase;
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

    // Center gap: food drops through here into the bowl — dark recess + end caps
    ctx.fillStyle = '#3a3a41';
    ctx.fillRect(this.GAP_L - 6, by - 13, 12, 26);
    ctx.fillRect(this.GAP_R - 6, by - 13, 12, 26);

    // Bowl
    const bx = this.BOWL_X, wy = this.BOWL_Y;
    const bowlim = typeof Assets !== 'undefined' ? Assets.prop('bowl') : null;
    if (bowlim) {
      const im = bowlim, w = 118, h = w * (im.height / im.width);
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
