'use strict';
/* Tiny WebAudio synth — no audio files needed. */

/* Real SFX manifest — drop generated .mp3s in assets/sfx/ and AudioSys plays them,
   falling back to the synth versions until each file lands. See AUDIO_SPEC.md. */
const SFX_FILES = ['ui_click', 'shoot', 'burst', 'bounce', 'belt_catch', 'nom',
  'combo2', 'combo3', 'combo4', 'star_pop', 'needle_tick', 'trombone', 'fanfare',
  'jingle_win', 'jingle_lose', 'slurp', 'vacuum_full', 'meow1', 'meow2', 'meow3',
  'powerup', 'frenzy', 'splash', 'unlock', 'clang', 'boing', 'boom'];

const AudioSys = {
  ctx: null,
  muted: false,

  init() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      } catch (e) { /* no audio */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    this.loadSfx();
  },

  loadMute() {
    try { this.muted = localStorage.getItem('chonk-em:mute') === '1'; } catch (e) {}
  },

  toggle() {
    this.muted = !this.muted;
    try { localStorage.setItem('chonk-em:mute', this.muted ? '1' : '0'); } catch (e) {}
    return this.muted;
  },

  buffers: {},
  async loadSfx() {
    if (!this.ctx) return;
    for (const n of SFX_FILES) {
      if (this.buffers[n]) continue;
      try {
        const r = await fetch('assets/sfx/' + n + '.mp3');
        if (!r.ok) continue;
        this.buffers[n] = await this.ctx.decodeAudioData(await r.arrayBuffer());
      } catch (e) { /* synth fallback stays */ }
    }
  },
  play(name, vol) { // true if a real file played
    const b = this.buffers[name];
    if (!b || !this.ctx || this.muted) return false;
    try {
      const src = this.ctx.createBufferSource(); src.buffer = b;
      const g = this.ctx.createGain(); g.gain.value = vol || 1;
      src.connect(g); g.connect(this.ctx.destination); src.start();
      return true;
    } catch (e) { return false; }
  },
  sfx(name, synth) { if (!this.play(name) && synth) synth.call(this); },

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  },

  pop()    { this.sfx('burst', function() { this.tone(420 + Math.random() * 140, 0.08, 'triangle', 0.10); }); },
  tink()   { this.tone(1350 + Math.random() * 500, 0.07, 'square', 0.06, 2100); },
  burst()  { this.sfx('burst', function() { this.tone(170, 0.12, 'square', 0.08, 90); this.tone(620 + Math.random() * 220, 0.10, 'sine', 0.10, 900); }); },
  catch()  { this.sfx('belt_catch', function() { this.tone(880, 0.07, 'sine', 0.07, 1200); }); },
  nom()    { this.sfx('nom', function() { this.tone(210, 0.09, 'sawtooth', 0.07, 110); setTimeout(() => this.tone(170, 0.10, 'sawtooth', 0.07, 90), 95); }); },
  sad()    { this.sfx('bounce', function() { this.tone(320, 0.28, 'sawtooth', 0.06, 150); }); },
  jingle() { this.sfx('jingle_win', function() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.12, 'sine', 0.09), i * 90)); }); },
  powerup(){ [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.tone(f, 0.10, 'triangle', 0.10), i * 70)); },
  frenzy() { [392, 523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'sawtooth', 0.07), i * 80)); },
  win()    { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.10), i * 110)); },
  tick(pitch) { this.tone(pitch || 700, 0.05, 'square', 0.05); },
  starPop()   { this.tone(1568, 0.12, 'sine', 0.10, 2093); },
  trombone() { // sad trombone: womp womp womp womppp
    const seq = [[233.1, 0.22], [220.0, 0.22], [207.7, 0.22], [196.0, 0.55]];
    let t = 0;
    seq.forEach(([f, d], i) => {
      setTimeout(() => this.tone(f, d, 'sawtooth', 0.09, i === 3 ? f * 0.82 : f * 0.97), t * 1000);
      t += d + 0.03;
    });
  },
  fanfare()  { [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 'triangle', 0.11), i * 120)); },
  shoot()   { this.sfx('shoot', function() { this.tone(300, 0.12, 'triangle', 0.09, 700); }); },
  slurp()   { this.sfx('slurp', function() { this.tone(500, 0.15, 'sine', 0.08, 150); }); },
  clang()   { this.sfx('clang', function() { this.tone(1900, 0.09, 'square', 0.06, 800); this.tone(2600, 0.06, 'square', 0.04, 1200); }); },
  boing()   { this.sfx('boing', function() { this.tone(180, 0.28, 'sine', 0.10, 640); }); },
  boom()    { this.sfx('boom', function() { this.tone(90, 0.45, 'sawtooth', 0.14, 38); this.tone(55, 0.5, 'sine', 0.12, 30); }); },
  meow(big) { // big 0..1 — pitch drops as the chonk grows
    this.sfx(big > 0.66 ? 'meow3' : big > 0.33 ? 'meow2' : 'meow1', function() {
      const f = 700 - big * 350;
      this.tone(f, 0.18, 'sawtooth', 0.06, f * 1.4);
      setTimeout(() => this.tone(f * 1.2, 0.14, 'sawtooth', 0.05, f * 0.8), 130);
    });
  },
  lose()   { this.sfx('jingle_lose', function() { [400, 350, 300, 220].forEach((f, i) => setTimeout(() => this.tone(f, 0.20, 'sawtooth', 0.07), i * 140)); }); },
};
