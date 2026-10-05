'use strict';
/* The swaying funnel: catches falling loot, drops it onto the conveyor. */

const Funnel = {
  x: 300, y: 636, half: 48,
  cx: 300, range: 120, speed: 0.9, t: 0, wideT: 0,

  reset(cfg) {
    this.cx = cfg.cx; this.range = cfg.range;
    this.speed = cfg.speed; this.half = cfg.half;
    this.y = cfg.y; this.t = 0; this.x = cfg.cx; this.wideT = 0;
  },

  effHalf() { return this.half * (this.wideT > 0 ? 2 : 1); },

  update(dt) {
    this.t += dt;
    if (this.wideT > 0) this.wideT -= dt;
    this.x = this.cx + Math.sin(this.t * this.speed * 2) * this.range;
  },

  // Returns true if the item was caught.
  tryCatch(item) {
    if (item.state !== 'fall' || item.vy <= 0) return false;
    if (item.y > this.y - 8 && item.y < this.y + 34 &&
        Math.abs(item.x - this.x) < this.effHalf()) {
      item.state = 'chute';
      item.vy = 0;
      item.x = this.x + (item.x - this.x) * 0.4;
      AudioSys.catch();
      return true;
    }
    return false;
  },

  draw(ctx) {
    const fx = this.x, fy = this.y, hw = this.effHalf();
    // Throat shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.moveTo(fx - hw, fy); ctx.lineTo(fx + hw, fy);
    ctx.lineTo(fx + 16, fy + 52); ctx.lineTo(fx - 16, fy + 52);
    ctx.closePath(); ctx.fill();
    // Metal body
    ctx.fillStyle = '#9aa3ad';
    ctx.beginPath();
    ctx.moveTo(fx - hw - 8, fy - 6); ctx.lineTo(fx + hw + 8, fy - 6);
    ctx.lineTo(fx + 16, fy + 52); ctx.lineTo(fx - 16, fy + 52);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6e757d'; ctx.lineWidth = 3; ctx.stroke();
    // Rim highlight
    ctx.strokeStyle = '#c9d1d8'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(fx - hw - 8, fy - 6); ctx.lineTo(fx + hw + 8, fy - 6); ctx.stroke();
    // Hanger
    ctx.strokeStyle = '#6e757d'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(fx, fy - 6); ctx.lineTo(fx, fy - 46); ctx.stroke();
  },
};
