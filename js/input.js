'use strict';
/* Unified pointer input: touch + mouse + pen in one path. */

const Input = {
  init(hooks) {
    const toLogical = (e) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * W / r.width,
        y: (e.clientY - r.top) * H / r.height,
      };
    };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      AudioSys.init();
      if (hooks.canAim()) {
        hooks.onAimStart(toLogical(e));
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      hooks.onAimMove(toLogical(e));
    });
    const end = (e) => {
      hooks.onAimEnd(e ? toLogical(e) : null);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', () => end(null));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },
};
