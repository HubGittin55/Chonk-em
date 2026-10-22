'use strict';
/* CHONK'EM weigh-in results ceremony — extracted from main.js 2026-10-15.
   Owns: endGame, showResults/hideResults, updateWeigh, drawScale, starsFor/rawCal.
   Called from main.js tick() and UI buttons; shares the global game object. */
function rawCal(L) {
  return L.barrels.filter(b => b.kind === 'snack')
    .reduce((a, b) => a + ((CONTENT[b.content] || {}).cal || 0), 0);
}
// Stars are WEIGHT stars now: 1 = goal met, 2 = 70% of the level's food delivered, 3 = 82%.
// (Relaxed 2026-10-13: 75/90% punished normal item losses; breaking everything should star.)
function starsFor(lb, L) {
  const max = START_LB + LB_PER_CAL * rawCal(L);
  const frac = (lb - START_LB) / Math.max(1, max - START_LB);
  return frac >= 0.82 ? 3 : frac >= 0.7 ? 2 : 1;
}

function endGame(win) {
  if (game.over) return;
  game.over = win ? 'win' : 'lose';
  if (win) {
    const before = CAT_UNLOCKS.filter((c, i) => i > 0 && catUnlocked(i)).length;
    const n = starsFor(game.weightLb, game.level);
    if (game.daily) Profile.recordDaily(game.daily.date, n, game.calories);
    else if (game.endless) Profile.recordEndless(game.endless.depth, game.calories); // depth cleared, never the campaign board
    else saveBest(game.levelIndex, n, game.calories);
    Profile.recordWin(game.calories, game.weightLb, game.maxCombo, game.shotsFired);
    Achievements.checkEndOfLevel(true); // trophy aggregates run on the fresh profile numbers
    const after = CAT_UNLOCKS.filter((c, i) => i > 0 && catUnlocked(i)).length;
    game.justUnlocked = after > before ? CAT_UNLOCKS[after].name : null;
    showResults(n);
  } else {
    AudioSys.lose();
    Achievements.checkEndOfLevel(false); // diet-plan trophy, such as it is
    if (game.endless) { // the run ends at this depth — show how far the climb got
      const best = Profile.endlessBest();
      overlayTitle.textContent = 'The climb ends at depth ' + game.endless.depth;
      overlaySub.textContent = `depth ${game.endless.depth} · ${game.calories}/${game.goalNow} calories · best depth ${best.bestDepth}. The vacuum claims another chonk.`;
    } else {
      overlayTitle.textContent = 'Still scrawny…';
      overlaySub.textContent = `${game.calories}/${game.goalNow} calories. The cat demands another try.`;
    }
    nextBtn.classList.add('hidden');
    overlay.classList.remove('hidden');
  }
}

/* ---------------- weigh-in results ceremony ---------------- */
const resultsEl = () => document.getElementById('results');
const scaleCv = () => document.getElementById('scaleCanvas');

function showResults(nStars) {
  const w = game.weigh = {
    t: 0, dur: 2.6, shown: START_LB, target: game.weightLb, stars: nStars,
    lit: 0, ticked: START_LB, finale: false, confetti: [],
    stageIdx: (typeof stageIdxForLb === 'function') ? stageIdxForLb(START_LB) : 0,
  };
  for (let k = 0; k < 3; k++) {
    const sp = document.getElementById('rs' + k);
    sp.textContent = '☆'; sp.className = '';
  }
  document.getElementById('res-title').textContent =
    game.endless
      ? `Endless · Depth ${game.endless.depth} — Weigh-In`
      : game.daily
        ? `Daily ${game.daily.date.slice(4, 6)}/${game.daily.date.slice(6, 8)} — Weigh-In`
        : `Level ${game.levelIndex + 1} — Weigh-In`;
  document.getElementById('res-sub').textContent = '';
  for (const id of ['res-retry', 'res-menu', 'res-next']) document.getElementById(id).style.visibility = 'hidden';
  const nx = document.getElementById('res-next');
  if (game.endless) { nx.style.display = ''; nx.textContent = 'Climb →'; }
  else { nx.textContent = 'Next →'; nx.style.display = (!game.daily && game.levelIndex + 1 < NUM_LEVELS) ? '' : 'none'; }
  AudioSys.sfx('splash', function() { this.tone(400, 0.25, 'sine', 0.06, 800); });
  AudioSys.meow(chonkT(game.weightLb)); // the ceremony opens with a weight-appropriate meow
  resultsEl().classList.remove('hidden');
  drawScale(w);
  if (AudioSys.music) AudioSys.music.setTrack('weighin'); // music-box waltz for the ceremony
}

function hideResults() {
  resultsEl().classList.add('hidden'); game.weigh = null;
  if (AudioSys.music) AudioSys.music.setTrack(game.menuOpen ? 'menu' : 'gameplay');
}

function updateWeigh(dt) { // real-time, called from tick()
  const w = game.weigh;
  if (!w) return;
  w.t += dt;
  const k = Math.min(1, w.t / w.dur);
  const ease = 1 - Math.pow(1 - k, 3);
  w.shown = START_LB + (w.target - START_LB) * ease;
  // tick sounds as the needle climbs — each tick jiggles the chonk
  while (w.ticked + 2 <= w.shown) {
    w.ticked += 2; AudioSys.tick(600 + w.ticked * 9);
    wobbleImpulse('belly', 2);
  }
  // stage-up: the cat visibly size-pops with a big bounce
  if (typeof stageIdxForLb === 'function') {
    const idx = stageIdxForLb(w.shown);
    if (idx > w.stageIdx) {
      w.stageIdx = idx;
      wobbleImpulse('belly', 5); wobbleImpulse('cheek', 1.5); wobbleImpulse('tail', 1);
    }
  }
  // star pops as the needle crosses each star's weight — cumulative: earning
  // star N lights stars 1..N (the old code left star 1 dark on 2- and 3-star wins)
  const max = START_LB + LB_PER_CAL * rawCal(game.level);
  const need = [0, 0, START_LB + 0.7 * (max - START_LB), START_LB + 0.82 * (max - START_LB)];
  const span = i => document.getElementById('rs' + i);
  const lightTo = (st) => {
    for (let s = 0; s < st; s++) {
      const el = span(s);
      if (el.textContent !== '★') { el.textContent = '★'; el.className = 'lit pop'; }
    }
    if (w.lit < st) { w.lit = st; AudioSys.starPop(); }
  };
  for (let st = 2; st <= w.stars; st++) if (w.shown >= need[st]) lightTo(st);
  if (k >= 1) lightTo(w.stars); // first star always lights at the end
  drawScale(w);
  if (k >= 1 && !w.finale) {
    w.finale = true;
    const sub = document.getElementById('res-sub');
    // per-level stats card: cal delivered, best combo, shots fired, barrels
    // popped, final weight — the full post-game box score.
    const stats = `${game.calories} cal · combo ×${game.maxCombo || 1} · ${game.shotsFired} shots · ${game.bursts || 0} popped · ${w.target.toFixed(1)} lb`;
    if (w.stars === 1) {
      AudioSys.trombone();
      sub.textContent = stats + ' — the cat wanted more snacks. Womp womp.';
    } else if (w.stars === 2) {
      AudioSys.jingle();
      sub.textContent = stats + ' — a respectable chonk.';
    } else {
      AudioSys.fanfare();
      for (let i = 0; i < 90; i++) w.confetti.push({
        x: 160 + (Math.random() - 0.5) * 120, y: -10 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 60, vy: 60 + Math.random() * 120,
        c: ['#e91e63', '#ff9800', '#ffeb3b', '#4caf50', '#2196f3', '#9c27b0'][i % 6],
        r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 10,
      });
      sub.textContent = stats + ' — certified maximum chonk.';
    }
    if (game.justUnlocked) {
      sub.textContent += ` \U0001F408 NEW CAT UNLOCKED: ${game.justUnlocked}!`;
      AudioSys.sfx('unlock', function() { [660, 880, 1108, 1318].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'triangle', 0.10), i * 100)); });
    }
    if (game.levelIndex + 1 >= NUM_LEVELS) sub.textContent += ' All levels chonked!';
    for (const id of ['res-retry', 'res-menu', 'res-next']) document.getElementById(id).style.visibility = 'visible';
  }
  // confetti physics
  for (const c of w.confetti) { c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt; }
  w.confetti = w.confetti.filter(c => c.y < 260);
  if (w.confetti.length) drawScale(w);
}

function drawScale(w) {
  const cv = scaleCv(); if (!cv) return;
  const ctx = cv.getContext('2d');
  const lb = w.shown;
  ctx.clearRect(0, 0, 320, 250);
  const cx = 160, cy = 132, R = 92;
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  const ang = l => a0 + (Math.min(l, MAX_LB) / MAX_LB) * (a1 - a0);
  // dial face
  ctx.beginPath(); ctx.arc(cx, cy, R + 10, 0, 7); ctx.fillStyle = '#fffdf5'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.lineWidth = 12; ctx.strokeStyle = '#ffe9c4'; ctx.stroke();
  for (let v = 0; v <= MAX_LB; v += 10) {
    const a = ang(v), big = v % 30 === 0, r1 = R - (big ? 15 : 9), r2 = R - 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.lineWidth = big ? 3 : 1.5; ctx.strokeStyle = '#5d4037'; ctx.stroke();
    if (big) {
      ctx.fillStyle = '#5d4037'; ctx.font = '10px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(v, cx + Math.cos(a) * (R - 26), cy + Math.sin(a) * (R - 26));
    }
  }
  // needle
  const a = ang(lb);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
  ctx.fillStyle = '#d32f2f';
  ctx.beginPath(); ctx.moveTo(-8, -3.5); ctx.lineTo(R - 10, 0); ctx.lineTo(-8, 3.5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 7); ctx.fillStyle = '#5d4037'; ctx.fill();
  // scale platform + the chonk under test (squashes as the needle climbs)
  ctx.fillStyle = '#8d6e63';
  ctx.beginPath(); ctx.roundRect(70, 208, 180, 14, 6); ctx.fill();
  ctx.fillStyle = '#5d4037';
  ctx.beginPath(); ctx.roundRect(140, 222, 40, 8, 3); ctx.fill();
  // the actual chonk under test: real sprite asset, cycling 10 lb -> final size
  // as the needle climbs, jiggling on the live wobble springs
  ctx.save();
  ctx.translate(160, 208); ctx.scale(0.62, 0.62);
  Cats.drawMain(ctx, 0, -74, {
    t: chonkT(lb), lb: lb, phys: game.phys, wob: game.wob, var: game.catVar,
    nomT: 0, face: 'happy', time: game.time,
  });
  ctx.restore();
  // digital readout
  ctx.fillStyle = '#212121'; ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(lb.toFixed(1) + ' lb', 160, 226);
  // confetti
  for (const c of w.confetti) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r);
    ctx.fillStyle = c.c; ctx.fillRect(-4, -2.5, 8, 5); ctx.restore();
  }
}
