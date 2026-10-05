'use strict';
/* Tiny WebAudio synth — no audio files needed. */

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
  },

  loadMute() {
    try { this.muted = localStorage.getItem('chonk-em:mute') === '1'; } catch (e) {}
  },

  toggle() {
    this.muted = !this.muted;
    try { localStorage.setItem('chonk-em:mute', this.muted ? '1' : '0'); } catch (e) {}
    return this.muted;
  },

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

  pop()    { this.tone(420 + Math.random() * 140, 0.08, 'triangle', 0.10); },
  burst()  { this.tone(170, 0.12, 'square', 0.08, 90); this.tone(620 + Math.random() * 220, 0.10, 'sine', 0.10, 900); },
  catch()  { this.tone(880, 0.07, 'sine', 0.07, 1200); },
  nom()    { this.tone(210, 0.09, 'sawtooth', 0.07, 110); setTimeout(() => this.tone(170, 0.10, 'sawtooth', 0.07, 90), 95); },
  sad()    { this.tone(320, 0.28, 'sawtooth', 0.06, 150); },
  jingle() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.12, 'sine', 0.09), i * 90)); },
  powerup(){ [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.tone(f, 0.10, 'triangle', 0.10), i * 70)); },
  frenzy() { [392, 523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'sawtooth', 0.07), i * 80)); },
  win()    { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.10), i * 110)); },
  lose()   { [400, 350, 300, 220].forEach((f, i) => setTimeout(() => this.tone(f, 0.20, 'sawtooth', 0.07), i * 140)); },
};
