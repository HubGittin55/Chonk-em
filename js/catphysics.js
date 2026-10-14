'use strict';
/* CatPhysics — unified, headless cat-body simulation for CHONK 'EM.
   ---------------------------------------------------------------------------
   ONE core, TWO thin adapters (sprite + vector), zero DOM, zero Date.now().

   How it works (the short version)
   - The belly is a free-free 1D "string" of fat sampled by NM=8 cosine modes.
     Each mode is an independent damped oscillator integrated with its EXACT
     2x2 transition matrix (no Euler error, unconditionally stable for any dt
     or weight). Superposing the modes gives a spatial field h(u), u=0 head
     end .. u=1 tail end. A localized impact excites all modes in phase, so a
     narrow tap launches a pulse that travels, disperses and reflects off the
     ends (slosh). A broad impact only excites the slow modes: one lazy lurch.
   - Frequencies come from a dispersion relation f_k = sqrt(f0^2 + (k*fs)^2),
     then each mode is slowed by weight at its OWN rate: the low "mass" modes
     slow down a lot at 150 lb, the high "skin" modes barely do. That is the
     decoupling of timescales: a heavy cat sways slowly while its skin still
     shivers fast.
   - Momentum transfer: eat(cal, speed, u) injects J = impact*cal*speed into
     the belly at landing position u. Bigger food = wider footprint = lower
     spectrum; tiny food = narrow tap = skin ping. It also compresses the
     whole body, loads the stomach (cumulative distension, slower/heavier
     response) and, on big meals, schedules a delayed "gulp" secondary slosh.
   - milestone(prevLb, newLb): anticipation crouch (old sprite still shown),
     release kick, hard sprite cut, then a low-frequency under-damped settle.
   - Secondary motion (head, jowl, ear, 3-mode tail whip) is driven by the
     ACCELERATION of the body, so it lags and overshoots like real follow-through.
   - Life: breathing (rate/depth tied to weight + stomach load), tail swish,
     random ear flicks (internal seeded RNG), purr shiver.

   Hot path rules: no allocation, no array/object literals, no closures, trig
   only at (re)tune time and per-impulse (bounded), phasors are rotated with
   precomputed (cos,sin).

   API
     const cat = CatPhysics.create({ reduced: REDUCED, tune: {...}, seed: 1 });
     cat.setWeight(lb);                 // cheap; retunes only when lb moved >0.4%
     cat.update(dt);                    // any dt; runs fixed 1/120 s substeps
     cat.eat(cal, speedRatio, u);       // food landing
     cat.impulse(part, amt);            // legacy wobbleImpulse('belly'|'cheek'|'tail'|'sub')
     cat.milestone(prevLb, newLb);      // size-up ceremony (crouch -> pop -> settle)
     cat.pose();                        // fill cat.sprite / cat.vec (idempotent per update)
     cat.setReduced(bool)               // live prefers-reduced-motion switch
     cat.shownLb                        // pass THIS to the sprite picker (holds old stage during crouch)
     cat.wob                            // legacy {belly,cheek,tail,sub}:{x,v} mirror
*/

const CatPhysics = (function () {

  // ---- constants -----------------------------------------------------------
  const FIXED_DT = 1 / 120;
  const MAX_SUBSTEPS = 16;           // spiral-of-death guard: drops backlog beyond ~0.13 s
  const NM = 8;                      // belly modes
  const NC = 24;                     // output columns across the body
  const NT = 3;                      // tail whip modes
  const PI = Math.PI, TAU = PI * 2;
  const LN15 = Math.log(15);         // 10 lb -> 150 lb is a 15x range
  const SOFT = 1.8;                  // soft-clamp knee for visual outputs
  const SEC_MAX = 1.5;               // amplitude cap per secondary oscillator (body/pop/head/jowl/ear)
  const TAIL_MAX = 1.2;              // shared amplitude cap over the tail modes
  const O_BODY = 0, O_POP = 1, O_HEAD = 2, O_JOWL = 3, O_EAR = 4, NO = 5;
  const PH_BREATH = 0, PH_SWISH = 1, PH_PURR = 2;

  // ---- tuning (see CAT-PHYSICS-INTEGRATION.md §3) ---------------------------
  const DEFAULTS = {
    // 1. timescale
    bellyHz: 2.4,        // belly mode-0 frequency of a 10 lb cat
    bellySpread: 2.7,    // Hz added per mode index (dispersion: wave speed)
    slowdown: 0.30,      // heavy/light frequency ratio of the slow "mass" modes (150 lb vs 10 lb)
    skinSlowdown: 0.72,  // same ratio for the fast "skin" modes (closer to 1 = skin stays quick)
    // 2. settle
    ringLight: 0.70,     // seconds for the slow belly mode to decay by 1/e at 10 lb
    ringHeavy: 2.2,      // ... at 150 lb
    skinRing: 0.14,      // ... for the fastest skin ripples
    // 3. impact
    impact: 0.032,       // eat(): momentum -> mode velocity gain
    inertia: 0.35,       // impulse is divided by (lb/10)^inertia (heavier = harder to move)
    tapMin: 0.04,        // footprint half-width (0..1 of body) of a tiny food item
    tapMax: 0.30,        // ... of a >= tapCal food item
    tapCal: 40,          // calories at which the footprint is widest
    skinKick: 0.85,      // 0 = pure velocity impulse, 1 = equal displacement per mode (skin ripple visibility)
    // 4. amplitude
    amp: 1.0,            // master visual amplitude
    jelly: 1.2,          // extra amplitude at 150 lb (heavier cats displace more px)
    // 5. size-up
    crouch: 0.09,        // anticipation squash depth (fraction of height)
    crouchTime: 0.15,    // seconds of anticipation at 10 lb (grows ~+0.12 s at 150 lb)
    pop: 0.20,           // peak uniform grow pulse on release (owner-approved 20%)
    popHz: 1.6,          // settle frequency of the pop at 10 lb (slowed by weight)
    popZeta: 0.40,       // pop damping ratio (lower = more bounces / deeper undershoot)
    // 6. stomach load (cumulative eating)
    stomachCal: 40,      // calories to fill the stomach to 1.0
    stomachTau: 7,       // seconds for the load to drain by 1/e
    distend: 0.10,       // static belly bulge at full load
    loadMass: 0.35,      // effective extra mass at full load (slows everything)
    // 7. life
    breath: 1.0,         // breathing depth multiplier
    swish: 1.0,          // tail idle swish multiplier
    // 8. safety
    maxAmp: 2.5,         // hard cap on belly modal amplitude (RMS over modes)
    maxImpulse: 30,      // per-call cap on injected momentum
    gulpCal: 18,         // meals at/above this schedule a delayed gulp slosh
    // secondary-motion couplings (rarely touched)
    bodyHz: 2.0, headHz: 3.0, jowlHz: 6.0, earHz: 9.0, tailHz: 1.8,
    bodyKick: 0.30, headCouple: 6.0, jowlCouple: 4.0, earCouple: 3.0, tailCouple: 2.5
  };

  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const lerp = (a, b, t) => a + (b - a) * t;
  const soft = (x, L) => x / (1 + Math.abs(x) / L);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ---- shared lookup tables (built once) ------------------------------------
  const PHI = new Float64Array(NM * NC);          // mode shapes at column centres
  const PSI = new Float64Array(NM * (NC + 1));    // longitudinal displacement shapes at column edges
  const W_HEAD = new Float64Array(NC);            // column weight: head region
  const W_TAIL = new Float64Array(NC);            // column weight: tail region
  const REG_BELLY = new Float64Array(NM);         // modal projection of region weights
  const REG_CHEST = new Float64Array(NM);
  const REG_RUMP = new Float64Array(NM);
  (function buildTables() {
    for (let k = 0; k < NM; k++) {
      for (let j = 0; j < NC; j++) PHI[k * NC + j] = Math.cos(k * PI * (j + 0.5) / NC);
      for (let j = 0; j <= NC; j++) {
        const u = j / NC;
        PSI[k * (NC + 1) + j] = k === 0 ? (u - 0.5) : 2 * Math.sin(k * PI * u) / (k * PI);
      }
    }
    for (let j = 0; j < NC; j++) {
      const u = (j + 0.5) / NC;
      W_HEAD[j] = 1 - smooth(0.12, 0.36, u);
      W_TAIL[j] = smooth(0.80, 0.93, u);
    }
    const region = (out, a, b, c, d) => {
      let sum = 0;
      for (let i = 0; i < 96; i++) {
        const u = (i + 0.5) / 96, w = smooth(a, b, u) * (1 - smooth(c, d, u));
        sum += w;
        for (let k = 0; k < NM; k++) out[k] += w * Math.cos(k * PI * u);
      }
      for (let k = 0; k < NM; k++) out[k] /= sum;
    };
    region(REG_BELLY, 0.14, 0.30, 0.72, 0.88);
    region(REG_CHEST, 0.04, 0.12, 0.38, 0.50);
    region(REG_RUMP, 0.52, 0.64, 0.86, 0.97);
  })();

  // Exact 2x2 transition of x'' = -w^2 x - 2 z w x' over one FIXED_DT.
  function coef(A, i, w, z) {
    const a = i * 4, zw = z * w, wd = w * Math.sqrt(1 - z * z);
    const e = Math.exp(-zw * FIXED_DT), c = Math.cos(wd * FIXED_DT), s = Math.sin(wd * FIXED_DT);
    A[a] = e * (c + zw * s / wd);
    A[a + 1] = e * s / wd;
    A[a + 2] = -e * w * w * s / wd;
    A[a + 3] = e * (c - zw * s / wd);
  }
  const zetaFor = (w, tau) => clamp(1 / (w * tau), 0.03, 0.95);

  // ---- the body ---------------------------------------------------------------
  class CatBody {
    constructor(opts) {
      opts = opts || {};
      this.P = Object.assign({}, DEFAULTS, opts.tune || {});
      this.gain = opts.reduced ? 0.35 : 1;       // prefers-reduced-motion
      this._soft = SOFT * this.gain;             // soft(g*x, g*L) = g*soft(x, L): reduced output is EXACTLY gain x normal
      this._rng = (opts.seed | 0) || 0x2545F491;
      this.lb = 10; this.heft = 0; this.um = 0;
      this.load = 0; this.mood = 0; this.purr = 0;
      this._dirty = true; this._lastLoad = 0;
      this._acc = 0; this._simVer = 0; this._poseVer = -1;

      // belly lattice modes
      this.bx = new Float64Array(NM); this.bv = new Float64Array(NM);
      this.bA = new Float64Array(NM * 4); this.bw = new Float64Array(NM);
      this.inj = new Float64Array(NM);           // per-mode injection gain (velocity per unit J)
      // single oscillators: body squash, pop settle, head, jowl, ear
      this.ox = new Float64Array(NO); this.ov = new Float64Array(NO);
      this.oA = new Float64Array(NO * 4); this.ow = new Float64Array(NO);
      // tail whip modes
      this.tx = new Float64Array(NT); this.tv = new Float64Array(NT);
      this.tA = new Float64Array(NT * 4); this.tw = new Float64Array(NT);
      // life phasors (breath, swish, purr): [c, s] pairs and per-tick rotations
      this.ph = new Float64Array(6); this.ph[0] = 1; this.ph[2] = 1; this.ph[4] = 1;
      this.phR = new Float64Array(6);
      this.phR[4] = Math.cos(TAU * 24 * FIXED_DT); this.phR[5] = Math.sin(TAU * 24 * FIXED_DT);

      // scheduled events / state machine
      this.phase = 0; this.phT = 0; this.crouchDur = 0.15; this.crouchDepth = 0; this.crouchNow = 0;
      this.holdLb = 0; this.shownLb = 10;
      this._gulpT = 0; this._gulpJ = 0; this._earT = 3;
      this._moodK = Math.exp(-FIXED_DT / 4);
      this._loadK = Math.exp(-FIXED_DT / this.P.stomachTau);
      this._inert = 1; this._ampK = 1; this._eq0 = 0;

      // scalar summary (cheap, every update) + legacy mirror
      this.belly = 0; this.chest = 0; this.rump = 0; this.jowl = 0; this.head = 0; this.tail = 0; this.ear = 0;
      this.sub = 0; this.prevBelly = 0; this.prevJowl = 0; this.prevTail = 0; this.prevSub = 0;
      this.wob = { belly: { x: 0, v: 0 }, cheek: { x: 0, v: 0 }, tail: { x: 0, v: 0 }, sub: { x: 0, v: 0 } };

      // adapter outputs, preallocated
      this.sprite = {
        sx: 1, sy: 1, rot: 0, skew: 0, ox: 0, oy: 0, grow: 1,
        strips: false,
        cy: new Float32Array(NC).fill(1),            // per-column vertical scale about the feet
        cb: new Float32Array(NC + 1),                // per-edge horizontal offset (fraction of sprite width)
        ck: new Float32Array(NC)                     // per-column x-shear (tail sway)
      };
      this.vec = {
        belly: 0, chest: 0, rump: 0, jowl: 0, head: 0, tail: 0, ear: 0,
        sx: 1, sy: 1, rot: 0, skew: 0, grow: 1, breath: 1
      };
      this._retune();
    }

    // ---- public ------------------------------------------------------------
    // Live prefers-reduced-motion switch (matchMedia 'change' listener).
    setReduced(on) { this.gain = on ? 0.35 : 1; this._soft = SOFT * this.gain; this._dirty = true; }

    setTune(partial) { Object.assign(this.P, partial); this._dirty = true; }

    setWeight(lb) {
      if (!(lb > 0)) return;
      if (Math.abs(lb - this.lb) > this.lb * 0.004) { this.lb = lb; this._dirty = true; }
      if (this.phase !== 1) this.shownLb = this.lb;
    }

    reset() {
      this.bx.fill(0); this.bv.fill(0); this.ox.fill(0); this.ov.fill(0); this.tx.fill(0); this.tv.fill(0);
      this.load = 0; this.mood = 0; this.phase = 0; this.crouchNow = 0; this._gulpT = 0; this._acc = 0;
      this.ph[0] = 1; this.ph[1] = 0; this.ph[2] = 1; this.ph[3] = 0; this.ph[4] = 1; this.ph[5] = 0;
      this._dirty = true; this._simVer++;
    }

    update(dt) {
      if (!(dt > 0)) return;
      if (dt > 0.25) dt = 0.25;
      if (this._dirty || Math.abs(this.load - this._lastLoad) > 0.04) this._retune();
      this._acc += dt;
      let n = 0;
      while (this._acc >= FIXED_DT - 1e-9 && n < MAX_SUBSTEPS) { this._tick(); this._acc -= FIXED_DT; n++; }
      if (n === MAX_SUBSTEPS) this._acc = 0;
      if (this._acc < 0) this._acc = 0;
      this._limit();
      this._scalars(dt);
      this._simVer++;
    }

    // Food landing. cal = calories gained (your `gained`), speedRatio = landing speed /
    // typical (omit => 1), u = landing position along the body (0 head .. 1 tail).
    eat(cal, speedRatio, u) {
      if (!(cal > 0)) return;
      const P = this.P;
      cal = Math.min(cal, 120);
      const vf = 0.6 + 0.4 * clamp(speedRatio == null ? 1 : speedRatio, 0, 2.5);
      const J = Math.min(P.impact * cal * vf * this._inert, P.maxImpulse) * this.gain;
      const s = Math.min(cal / P.tapCal, 1);
      this._inject(u == null ? 0.3 : clamp(u, 0, 1), lerp(P.tapMin, P.tapMax, s), J);
      this.ov[O_BODY] -= P.bodyKick * J;                              // momentum compresses the body
      this.ov[O_HEAD] -= 0.35 * J * (0.4 + 0.6 * s);
      this.ov[O_JOWL] += 1.6 * J * (0.5 + 0.5 * s);
      this.load = Math.min(1, this.load + cal / P.stomachCal);
      this.mood = Math.min(1, this.mood + 0.3 + cal / 80);
      if (cal >= P.gulpCal) { this._gulpT = 0.20 + 0.08 * this.heft; this._gulpJ = J * 0.55; }
      this._clampStates();
      this._limit();
    }

    // Legacy wobbleImpulse(part, amt) — same call sites, weight handled in here.
    impulse(part, amt) {
      if (!(amt > 0) && !(amt < 0)) return;
      const P = this.P, g = this.gain;
      if (part === 'belly') {
        const J = clamp(amt * 0.075 * this._inert * g, -P.maxImpulse, P.maxImpulse);
        this._inject(0.45, 0.22, J);
        this.ov[O_BODY] -= 0.35 * J;
      } else if (part === 'cheek') {
        this.ov[O_JOWL] += clamp(amt * 7 * g, -40, 40);
        this.ov[O_HEAD] += amt * 0.6 * g;
      } else if (part === 'tail') {
        const a = clamp(amt * 4.5 * g, -30, 30);
        this.tv[0] += a; this.tv[1] -= 0.5 * a; this.tv[2] += 0.3 * a;
      }
      this._clampStates();
      this._limit();
    }

    // Size-up ceremony. Pass the weight BEFORE and AFTER the gain. The old sprite stays
    // on screen (via shownLb) while the cat crouches; the new one cuts in on release.
    milestone(prevLb, newLb) {
      if (this.phase === 1) this._release();
      this.setWeight(newLb);
      this.phase = 1; this.phT = 0;
      this.holdLb = prevLb > 0 ? prevLb : newLb;
      this.shownLb = this.holdLb;
      this.crouchDur = this.P.crouchTime + 0.12 * this.heft;
      this.crouchDepth = this.P.crouch * (0.75 + 0.5 * this.heft) * this.gain;
      this.mood = 1;
    }

    // Dynamic (non-forced) modal amplitude^2 of everything — for tests / debugging.
    energy() {
      let a2 = 0;
      for (let k = 0; k < NM; k++) {
        const y = this.bx[k] - (k === 0 ? this._eq0 : 0), q = this.bv[k] / this.bw[k];
        a2 += y * y + q * q;
      }
      for (let i = 0; i < NO; i++) { const q = this.ov[i] / this.ow[i]; a2 += this.ox[i] * this.ox[i] + q * q; }
      for (let i = 0; i < NT; i++) { const q = this.tv[i] / this.tw[i]; a2 += this.tx[i] * this.tx[i] + q * q; }
      return a2;
    }

    // ---- adapters: pure number -> pure number ---------------------------------
    pose() {
      if (this._poseVer === this._simVer) return;
      this._poseVer = this._simVer;
      this._adaptCommon();
      this._adaptSprite();
      this._adaptVector();
    }

    // ---- internals -------------------------------------------------------------
    _rand() {                                   // xorshift32 -> [0,1)
      let x = this._rng;
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      this._rng = x;
      return ((x >>> 0) % 1000003) / 1000003;
    }

    _retune() {
      const P = this.P, lb = Math.max(this.lb, 4);
      this._lastLoad = this.load; this._dirty = false;
      this.heft = clamp(Math.log(lb / 10) / LN15, 0, 1);
      const um = clamp(Math.log(Math.max(lb * (1 + P.loadMass * this.load), 4) / 10) / LN15, -0.3, 1.25);
      this.um = um;
      this._inert = Math.pow(lb / 10, -P.inertia);
      this._ampK = P.amp * (1 + P.jelly * this.heft);
      this._loadK = Math.exp(-FIXED_DT / P.stomachTau);
      const ringMass = lerp(P.ringLight, P.ringHeavy, clamp(um, 0, 1));
      const wRef = TAU * P.bellyHz;

      for (let k = 0; k < NM; k++) {
        const base = Math.sqrt(P.bellyHz * P.bellyHz + (k * P.bellySpread) * (k * P.bellySpread));
        const kk = Math.min(k / 5, 1);
        const f = Math.min(base * Math.pow(lerp(P.slowdown, P.skinSlowdown, kk), um), 22);
        const w = TAU * f;
        this.bw[k] = w;
        coef(this.bA, k, w, zetaFor(w, lerp(ringMass, P.skinRing, kk)));
        this.inj[k] = wRef * Math.pow(w / wRef, P.skinKick);
      }
      const pm = Math.pow(P.slowdown, um), ps = Math.pow(P.skinSlowdown, um);
      this._setOsc(O_BODY, P.bodyHz * pm, ringMass * 0.7);
      let w = TAU * P.popHz * pm;
      this.ow[O_POP] = w; coef(this.oA, O_POP, w, P.popZeta);
      this._setOsc(O_HEAD, P.headHz * Math.pow(P.slowdown, 0.5 * um), 0.5);
      this._setOsc(O_JOWL, P.jowlHz * ps, 0.3);
      this._setOsc(O_EAR, P.earHz, 0.2);
      for (let k = 0; k < NT; k++) {
        w = TAU * P.tailHz * Math.pow(2 * k + 1, 0.85) * Math.pow(P.slowdown, 0.6 * um);
        this.tw[k] = w; coef(this.tA, k, w, zetaFor(w, 1.0 / (k + 1)));
      }
      // life phasors
      const bHz = lerp(0.62, 0.42, this.heft) * (1 + 0.3 * this.load);
      const sHz = lerp(0.55, 0.30, this.heft);
      this.phR[0] = Math.cos(TAU * bHz * FIXED_DT); this.phR[1] = Math.sin(TAU * bHz * FIXED_DT);
      this.phR[2] = Math.cos(TAU * sHz * FIXED_DT); this.phR[3] = Math.sin(TAU * sHz * FIXED_DT);
    }

    _setOsc(i, hz, tau) {
      const w = TAU * hz;
      this.ow[i] = w; coef(this.oA, i, w, zetaFor(w, tau));
    }

    // Inject a localized velocity impulse J at u0 with Gaussian footprint sigma.
    _inject(u0, sigma, J) {
      const ps = PI * sigma, c1 = Math.cos(PI * u0), q1 = Math.exp(-0.5 * ps * ps), r = Math.exp(-ps * ps);   // g_k = exp(-(k*pi*sigma)^2 / 2)
      let cm2 = 1, cm1 = c1, g = 1, q = q1;
      const bv = this.bv, inj = this.inj;
      bv[0] += J * inj[0];
      for (let k = 1; k < NM; k++) {
        const phi = k === 1 ? c1 : (2 * c1 * cm1 - cm2);
        if (k > 1) { cm2 = cm1; cm1 = phi; }
        g *= q; q *= r;
        bv[k] += J * phi * g * inj[k];
      }
    }

    _clampStates() {
      for (let k = 0; k < NM; k++) {
        const vm = 6 * this.bw[k];
        if (this.bv[k] > vm) this.bv[k] = vm; else if (this.bv[k] < -vm) this.bv[k] = -vm;
      }
    }

    // Uniformly scale belly modes about equilibrium if total amplitude exceeds maxAmp.
    _limit() {
      let a2 = 0;
      const bx = this.bx, bv = this.bv, bw = this.bw, eq = this._eq0;
      for (let k = 0; k < NM; k++) {
        const y = bx[k] - (k === 0 ? eq : 0), q = bv[k] / bw[k];
        a2 += y * y + q * q;
      }
      const M = this.P.maxAmp;
      if (a2 > M * M) {
        const s = M / Math.sqrt(a2);
        for (let k = 0; k < NM; k++) {
          const e = k === 0 ? eq : 0;
          bx[k] = (bx[k] - e) * s + e; bv[k] *= s;
        }
      }
      // secondary oscillators: per-oscillator amplitude cap (x and v/w both within SEC_MAX)
      for (let i = 0; i < NO; i++) {
        const w = this.ow[i], q = this.ov[i] / w, a2 = this.ox[i] * this.ox[i] + q * q;
        if (a2 > SEC_MAX * SEC_MAX) { const s = SEC_MAX / Math.sqrt(a2); this.ox[i] *= s; this.ov[i] *= s; }
      }
      // tail whip: one shared cap across its modes (same trick as the belly)
      let t2 = 0;
      for (let i = 0; i < NT; i++) { const q = this.tv[i] / this.tw[i]; t2 += this.tx[i] * this.tx[i] + q * q; }
      if (t2 > TAIL_MAX * TAIL_MAX) {
        const s = TAIL_MAX / Math.sqrt(t2);
        for (let i = 0; i < NT; i++) { this.tx[i] *= s; this.tv[i] *= s; }
      }
    }

    _release() {
      const P = this.P, w = this.ow[O_POP], z = P.popZeta, wd = w * Math.sqrt(1 - z * z);
      const tpk = Math.atan2(wd, z * w) / wd;
      const perV = Math.exp(-z * w * tpk) * Math.sin(wd * tpk) / wd;      // peak displacement per unit velocity
      const peak = P.pop * (0.8 + 0.4 * this.heft) * this.gain;
      this.ov[O_POP] += peak / perV;
      this.ox[O_BODY] += this.crouchNow; this.crouchNow = 0;             // hand the squash to the spring...
      this.ov[O_BODY] += 1.5 * this.crouchDepth * this.ow[O_BODY];        // ...and fire it upward
      this._inject(0.5, 0.40, 2.2 * this._inert * (0.6 + 0.8 * this.heft) * this.gain);
      this.phase = 0; this.shownLb = this.lb; this.holdLb = 0;
      this.mood = 1;
      this._clampStates();
    }

    _tick() {
      const bx = this.bx, bv = this.bv, bA = this.bA;
      const ox = this.ox, ov = this.ov, oA = this.oA;
      const tx = this.tx, tv = this.tv, tA = this.tA;
      const P = this.P, ph = this.ph, phR = this.phR, g = this.gain;

      // --- life phasors (rotation by precomputed angle, renormalized) ---
      for (let p = 0; p < 3; p++) {
        const c = ph[p * 2], s = ph[p * 2 + 1], cd = phR[p * 2], sd = phR[p * 2 + 1];
        let nc = c * cd - s * sd, ns = s * cd + c * sd;
        const k = 1.5 - 0.5 * (nc * nc + ns * ns);
        ph[p * 2] = nc * k; ph[p * 2 + 1] = ns * k;
      }
      const breathS = ph[PH_BREATH * 2 + 1], swishS = ph[PH_SWISH * 2 + 1];
      this.mood *= this._moodK;
      this.load *= this._loadK;

      // --- size-up state machine: anticipation squash ---
      const bodyEq = 0;
      if (this.phase === 1) {
        this.phT += FIXED_DT;
        const r = Math.min(this.phT / this.crouchDur, 1);
        this.crouchNow = -this.crouchDepth * r * r * (3 - 2 * r);
        if (this.phT >= this.crouchDur) this._release();
      }
      // --- delayed gulp ---
      if (this._gulpT > 0) {
        this._gulpT -= FIXED_DT;
        if (this._gulpT <= 0) {
          this._inject(0.52, 0.2, this._gulpJ);
          ov[O_BODY] += 0.5 * this._gulpJ; ov[O_JOWL] += 1.2 * this._gulpJ;
        }
      }
      // --- ear flicks ---
      this._earT -= FIXED_DT;
      if (this._earT <= 0) {
        ov[O_EAR] += (this._rand() < 0.5 ? -1 : 1) * (14 + 10 * this._rand()) * g;
        this._earT = 2.5 + 5.5 * this._rand();
      }

      // --- belly modes (exact) ---
      const eq0 = P.distend * this.load + 0.010 * P.breath * g * (1 + this.heft) * breathS;
      this._eq0 = eq0;
      const bv1Prev = bv[1];
      for (let k = 0; k < NM; k++) {
        const a = k * 4, e = k === 0 ? eq0 : 0, y = bx[k] - e, v = bv[k];
        bx[k] = bA[a] * y + bA[a + 1] * v + e;
        bv[k] = bA[a + 2] * y + bA[a + 3] * v;
      }
      const dBv1 = bv[1] - bv1Prev;

      // --- body, pop (exact, body has crouch equilibrium) ---
      const vBodyPrev = ov[O_BODY];
      {
        const y = ox[O_BODY] - bodyEq, v = ov[O_BODY];
        ox[O_BODY] = oA[0] * y + oA[1] * v + bodyEq;
        ov[O_BODY] = oA[2] * y + oA[3] * v;
      }
      {
        const a = O_POP * 4, y = ox[O_POP], v = ov[O_POP];
        ox[O_POP] = oA[a] * y + oA[a + 1] * v;
        ov[O_POP] = oA[a + 2] * y + oA[a + 3] * v;
      }
      const dVBody = ov[O_BODY] - vBodyPrev;

      // --- secondary chain: head <- body accel, jowl/ear <- head accel, tail <- body+slosh ---
      ov[O_HEAD] -= P.headCouple * dVBody;
      const vHeadPrev = ov[O_HEAD];
      {
        const a = O_HEAD * 4, y = ox[O_HEAD], v = ov[O_HEAD];
        ox[O_HEAD] = oA[a] * y + oA[a + 1] * v;
        ov[O_HEAD] = oA[a + 2] * y + oA[a + 3] * v;
      }
      const dVHead = ov[O_HEAD] - vHeadPrev;
      ov[O_JOWL] -= P.jowlCouple * (dVHead + dVBody);
      ov[O_EAR] -= P.earCouple * (dVHead + dVBody);
      for (let i = O_JOWL; i <= O_EAR; i++) {
        const a = i * 4, y = ox[i], v = ov[i];
        ox[i] = oA[a] * y + oA[a + 1] * v;
        ov[i] = oA[a + 2] * y + oA[a + 3] * v;
      }
      const swishEq = 0.45 * P.swish * g * (0.35 + 0.65 * this.mood) * swishS;
      for (let k = 0; k < NT; k++) {
        tv[k] += P.tailCouple * (dVBody * (k === 1 ? -1 : 1) + 0.03 * dBv1) / (k + 1);
        const a = k * 4, e = k === 0 ? swishEq : 0, y = tx[k] - e, v = tv[k];
        tx[k] = tA[a] * y + tA[a + 1] * v + e;
        tv[k] = tA[a + 2] * y + tA[a + 3] * v;
      }
    }

    // Cheap scalar summary + legacy {x,v} mirror, every update().
    _scalars(dt) {
      const bx = this.bx, A = this._ampK, L = this._soft, g = this.gain;
      let b = 0, c = 0, r = 0;
      for (let k = 0; k < NM; k++) { b += REG_BELLY[k] * bx[k]; c += REG_CHEST[k] * bx[k]; r += REG_RUMP[k] * bx[k]; }
      this.belly = soft(A * b, L); this.chest = soft(A * c, L); this.rump = soft(A * r, L);
      this.head = soft(A * this.ox[O_HEAD], L);
      this.jowl = soft(A * this.ox[O_JOWL], L);
      this.ear = soft(this.ox[O_EAR], 1.2 * g);
      const tx = this.tx;
      this.tail = soft(A * (tx[0] - tx[1] + tx[2]) * 0.8, 1.6 * g);
      this.sub += (0.6 * this.belly - this.sub) * Math.min(1, dt * 4);   // legacy slow-lag mirror
      const w = this.wob, id = 1 / dt;
      w.belly.v = (this.belly - w.belly.x) * id; w.belly.x = this.belly;
      w.cheek.v = (this.jowl - w.cheek.x) * id; w.cheek.x = this.jowl;
      w.tail.v = (this.tail - w.tail.x) * id; w.tail.x = this.tail;
      w.sub.v = (this.sub - w.sub.x) * id; w.sub.x = this.sub;
      // NaN/Inf guard: one finite check per update
      const chk = bx[0] + this.bv[0] + this.ox[0] + this.ov[0] + this.tx[0] + this.tv[0] + this.belly;
      if (!Number.isFinite(chk)) this.reset();
    }

    // Shared global body transform (both paths read these).
    _adaptCommon() {
      const A = this._ampK, g = this.gain, L = this._soft, P = this.P, ox = this.ox, bx = this.bx;
      const breathS = this.ph[PH_BREATH * 2 + 1];
      const breath = 1 + 0.012 * P.breath * g * (1 + 0.9 * this.heft) * (1 + 0.6 * this.load) * breathS;
      const body = soft(ox[O_BODY] * A, 0.16 * g) + this.crouchNow;
      this._sy = (1 + body) * breath;
      this._sx = 1 - 0.55 * body - 0.4 * (breath - 1);
      this._grow = 1 + clamp(ox[O_POP], -0.3, 0.3);     // stacked pops can't run away
      this._rot = 0.020 * soft(A * bx[1], L);
      this._skew = 0.020 * soft(A * bx[2], L);
      this._breath = breath;
    }

    // ADAPTER 1/2 — sprite renderer: whole-image params + optional column strips.
    _adaptSprite() {
      const S = this.sprite, A = this._ampK, L = this._soft, bx = this.bx, ph = this.ph, g = this.gain;
      S.sx = this._sx; S.sy = this._sy; S.grow = this._grow; S.rot = this._rot; S.skew = this._skew;
      S.ox = -0.004 * bx[1] * A;
      S.oy = this.purr > 0 ? this.purr * g * 0.0022 * ph[PH_PURR * 2 + 1] : 0;
      const headSc = soft(A * this.ox[O_HEAD], L);
      const tailSc = soft(A * (this.tx[0] - this.tx[1] + this.tx[2]) * 0.8, 1.2 * g);
      let mx = 0;
      for (let j = 0; j < NC; j++) {
        let h = 0;
        for (let k = 0; k < NM; k++) h += bx[k] * PHI[k * NC + j];
        h = soft(A * h, L);
        const a = h < 0 ? -h : h; if (a > mx) mx = a;
        S.cy[j] = 1 + 0.065 * h + W_HEAD[j] * 0.045 * headSc;
        S.ck[j] = W_TAIL[j] * 0.22 * tailSc;
      }
      let prev = 0;
      for (let j = 0; j <= NC; j++) {
        let d = 0;
        for (let k = 0; k < NM; k++) d += bx[k] * PSI[k * (NC + 1) + j];
        d = 0.03 * soft(A * d, L);
        if (j > 0) {                       // never fold columns over each other
          const lo = prev - 0.6 / NC, hi = prev + 2.0 / NC;
          d = d < lo ? lo : d > hi ? hi : d;
        }
        S.cb[j] = d; prev = d;
      }
      // Strips only when something visibly moves (hysteresis avoids seam flicker at rest).
      const m = mx + Math.abs(headSc) * 0.7 + Math.abs(tailSc) * 0.3;
      S.strips = S.strips ? m > 0.004 : m > 0.012;
    }

    // ADAPTER 2/2 — vector renderer: per-part deformations (drop-in for jB/jC/jT).
    _adaptVector() {
      const V = this.vec;
      V.belly = this.belly; V.chest = this.chest; V.rump = this.rump;
      V.jowl = this.jowl; V.head = this.head; V.tail = this.tail; V.ear = this.ear;
      V.sx = this._sx; V.sy = this._sy; V.rot = this._rot; V.skew = this._skew;
      V.grow = this._grow; V.breath = this._breath;
    }
  }

  return {
    create(opts) { return new CatBody(opts); },
    landingU(x, x0, x1) { return clamp((x - x0) / ((x1 - x0) || 1), 0, 1); },
    FIXED_DT, NM, NC, NT, DEFAULTS
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CatPhysics;
