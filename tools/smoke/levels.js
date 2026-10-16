/* CHONK'EM smoke suite: level pack, level-gen content, v0.4 level features
   Loaded by tools/smoke.js — shares the harness globals (T, step, ctxStub, game, ...). */
// 9. level pack (levels 2-12; 2-6 drafted by qwen-fast, 7-12 by stunkus, validated here)
T('levels: 12 levels ship', LEVELS.length === 12);
T('v0.4 levels: 60-125 barrels, growing by tier', LEVELS.every((L, i) =>
  L.barrels.length >= 60 && L.barrels.length <= 125 &&
  (i < 4 ? L.barrels.length <= 84 : L.barrels.length >= 84)));
T('v0.4 levels: tight hex spacing respected (min dist >= 25px, in bounds)', LEVELS.every(L => {
  for (let a = 0; a < L.barrels.length; a++) {
    const ba = L.barrels[a];
    if (ba.x < 40 || ba.x > 560 || ba.y < 130 || ba.y > 680) return false;
    for (let b = a + 1; b < L.barrels.length; b++) {
      if (Math.hypot(ba.x - L.barrels[b].x, ba.y - L.barrels[b].y) < 25) return false;
    }
  }
  return true;
}));
T('v0.4 levels: barrels are r=10', LEVELS.every(L => L.r === 10));
T('v0.4 levels: layout symmetric about x=300', LEVELS.every(L =>
  L.barrels.every(ba => L.barrels.some(bb => Math.abs(bb.x - (600 - ba.x)) < 2 && Math.abs(bb.y - ba.y) < 2))));
T('v0.4 levels: goal <= 65% of RAW snack calories (winnable with zero combo)', LEVELS.every(L => {
  const raw = L.barrels.reduce((t, b) => t + (b.kind === 'snack' ? CONTENT[b.content].cal : 0), 0);
  return L.goal <= raw * 0.65;
}));
const _calOf = b => (CONTENT[b.content] || { cal: 0 }).cal > 0;
T('balls = 35% of food barrels (handcrafted)', LEVELS.every(L => {
  const food = L.barrels.filter(b => b.kind === 'snack' && _calOf(b)).length;
  return L.balls === Math.max(8, Math.round(food * 0.35));
}));
T('balls = 35% of food barrels (procedural)', [13, 25, 50, 100].every(n => {
  const L = getLevel(n - 1);
  const food = L.barrels.filter(b => b.kind === 'snack' && _calOf(b)).length;
  return L.balls === Math.max(8, Math.round(food * 0.35));
}));
T('exotics capped at 3 per level (procedural)', [20, 40, 60, 80, 100].every(n => {
  const L = getLevel(n - 1);
  const EXK = new Set(EXOTICS.map(e => e[0]));
  return L.barrels.filter(b => EXK.has(b.content)).length <= 3;
}));
T('levels: calorie budget winnable (combo-aware effective cal >= 1.5x goal)', LEVELS.every(L => {
  // model real play: clean deliveries ramp the combo multiplier 1.5,1.5,1.5,2,2,2,2.5,2.5,2.5,3...
  const cals = L.barrels.filter(b => b.kind === 'snack').map(b => CONTENT[b.content].cal).sort((a, b) => a - b);
  let eff = 0;
  cals.forEach((c, i) => { eff += c * Math.min(3, 1.5 + 0.5 * Math.floor(i / 3)); });
  return eff >= L.goal * 1.5;
}));
T('v0.4 levels: goals are the 60%-of-raw set', LEVELS.map(L => L.goal).join() === '35,37,39,42,44,47,49,51,54,56,59,61');

// 18. v0.4 features
T('v0.4: menu API exists and boots open', typeof showMenu === 'function' && typeof hideMenu === 'function' && game.menuOpen === true);
T('v0.5: dry barrels 50-70% (no loot flood; veggie cut raised it)', LEVELS.every(L => {
  const e = L.barrels.filter(b => ['empty', 'steel', 'keg', 'bumper'].includes(b.kind)).length;
  const f = e / L.barrels.length;
  return f >= 0.5 && f <= 0.7;
}));
T('v0.4: empty barrel burst spawns no item', (() => {
  loadLevel(0);
  const before = game.items.length;
  const eb = game.barrels.find(b => b.kind === 'empty');
  onBarrelBurst(eb, null);
  return game.items.length === before;
})());
T('v0.5: hard mode = 20% fewer balls than normal, goals kept', (() => {
  Profile.setSetting('difficulty', 'hard'); loadLevel(0);
  const hardBalls = game.balls, hardGoal = game.goalNow;
  Profile.setSetting('difficulty', 'normal'); loadLevel(0);
  const ok = hardBalls === Math.round(game.balls * 0.8) && hardGoal === Math.round(LEVELS[0].goal * 1.2);
  return ok;
})());
T('v0.4: difficulty setting scales balls and goal', (() => {
  Profile.setSetting('difficulty', 'hard'); loadLevel(0);
  const ok = game.goalNow === Math.round(LEVELS[0].goal * 1.2) && game.balls === Math.round(LEVELS[0].balls * 0.64);
  Profile.setSetting('difficulty', 'normal'); loadLevel(0);
  return ok;
})());
T('v0.4: vacuum drawn after the main cat (never hidden)', (() => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'js', 'main.js'), 'utf8');
  return src.indexOf('Vacuum.draw(ctx, game.vacuum); // after the cat') > src.indexOf('Cats.drawMain(ctx, 252, 806');
})());
T('v0.4: vacuum cannot steal from the bowl chute', (() => {
  const v = Vacuum.create(1);
  const it = { x: 100, y: 720, vx: 0, vy: 0, r: 9, state: 'belt', cal: 3, gone: false };
  v.x = 100;
  Vacuum.tick(v, 1 / 60, [it], () => {});
  return !it.gone && !it.sucked;
})());
T('tiers: 100 levels, exotic every 5 (L1:5cal … L100:100cal)',
  NUM_LEVELS === 100 && tierMaxCal(1) === 5 && tierMaxCal(5) === 10 && tierMaxCal(10) === 15 && tierMaxCal(100) === 100 &&
  tierExotic(10) === 'caviar' && tierExoticName(50) === 'King Crab');
T('tiers: handcrafted 1-12 respect tier max cal', (() => {
  for (let i = 0; i < 12; i++) {
    const mc = tierMaxCal(i + 1);
    for (const b of getLevel(i).barrels)
      if (b.kind === 'snack' && (CONTENT[b.content] || {}).cal > mc) return false;
  }
  return true;
})());
T('curve: 80lb impossible on L10, reachable ~L50, 130+ on L100', (() => {
  const maxLb = n => 5 + 0.3 * getLevel(n - 1).barrels
    .filter(b => b.kind === 'snack').reduce((a, b) => a + CONTENT[b.content].cal, 0);
  return maxLb(10) < 40 && maxLb(50) >= 75 && maxLb(50) <= 90 && maxLb(100) >= 130;
})());
T('curve: tier exotic present on 10/25/50/100', [10, 25, 50, 100].every(n =>
  getLevel(n - 1).barrels.some(b => b.kind === 'snack' && b.content === tierExotic(n))));
T('steel: unbreakable — ball bounces, barrel stands', (() => {
  loadLevel(11);
  const st = game.barrels.find(b => b.kind === 'steel');
  if (!st) return false;
  const ball = { x: st.x, y: st.y - 16, vx: 0, vy: 300, r: 8, life: 0, slowT: 0, bounces: 0 };
  let special = null;
  Physics.stepBall(ball, 1 / 60, game.barrels, () => {}, () => {}, k => { special = k; });
  return !st.cleared && special === 'steel' && ball.bounces > 0;
})());
T('bumper: power bounce + combo, never breaks', (() => {
  loadLevel(11);
  const bu = game.barrels.find(b => b.kind === 'bumper');
  if (!bu) return false;
  const c0 = game.combo;
  const ball = { x: bu.x, y: bu.y - 16, vx: 0, vy: 200, r: 8, life: 0, slowT: 0, bounces: 0 };
  Physics.stepBall(ball, 1 / 60, game.barrels, () => {}, () => {}, onBarrelSpecial);
  return !bu.cleared && game.combo === c0 + 1 && Math.hypot(ball.vx, ball.vy) > 200;
})());
T('keg: explodes neighbors, steel immune, chains', (() => {
  loadLevel(0);
  game.barrels.forEach(b => { b.cleared = true; });
  const mk = (x, kind, content) => ({ x, y: 400, r: 10, kind, content: content || null, cleared: false });
  const keg = mk(300, 'keg'), snack = mk(340, 'snack', 'kibble'), steel = mk(360, 'steel'), far = mk(500, 'snack', 'kibble');
  game.barrels.push(keg, snack, steel, far);
  const items0 = game.items.length;
  keg.cleared = true; onBarrelBurst(keg, null);
  const ok = snack.cleared && !steel.cleared && !far.cleared && game.items.length > items0;
  game.barrels = game.barrels.filter(b => ![keg, snack, steel, far].includes(b));
  return ok;
})());
T('gen: deterministic + symmetric + sane size', (() => {
  const a = JSON.stringify(genLevel(50)), b = JSON.stringify(genLevel(50));
  if (a !== b) return false;
  const bs = getLevel(49).barrels, set = new Set(bs.map(x => x.x + ',' + x.y));
  return bs.every(x => set.has((600 - x.x) + ',' + x.y)) && bs.length >= 60 && bs.length <= 115;
})());
T('gen: procedural levels include steel/keg/bumper', (() => {
  const kinds = new Set(getLevel(49).barrels.map(b => b.kind));
  return kinds.has('steel') && kinds.has('keg') && kinds.has('bumper');
})());
T('unlocks: species gated by total stars (never spent)', (() => {
  Profile.reset(); Profile.reload();
  Profile.saveBest(0, 3, 0); Profile.saveBest(1, 3, 0); Profile.saveBest(2, 2, 0); // 8 total
  const t = totalStars();
  Profile.setSetting('cat', 3);
  const sel = selectedCat(); // calico locked at 8 stars -> falls back to tabby
  Profile.setSetting('cat', 1);
  const sel2 = selectedCat(); // orange unlocked at 8
  const ok = t === 8 && catUnlocked(0) && catUnlocked(1) && !catUnlocked(2) && !catUnlocked(3) && sel === 0 && sel2 === 1;
  Profile.reset(); Profile.reload();
  return ok;
})());
T('unlocks: loadLevel uses the picked species', (() => {
  Profile.reset(); Profile.reload();
  Profile.saveBest(0, 3, 0); Profile.saveBest(1, 3, 0); Profile.saveBest(2, 2, 0);
  Profile.setSetting('cat', 1);
  loadLevel(0);
  const v = game.catVar;
  Profile.reset(); Profile.reload();
  return v === 1;
})());
T('v0.5: veggies quartered, food untouched (handcrafted)', (() => {
  const orig = { 1: 6, 2: 9, 3: 3, 4: 14, 5: 9, 6: 12, 7: 8, 8: 22, 9: 13, 10: 9, 11: 9, 12: 16 };
  return LEVELS.every((L, i) => {
    const veg = L.barrels.filter(b => b.kind === 'veggie').length;
    return veg === Math.max(1, Math.round(orig[i + 1] / 4));
  });
})());
T('v0.5: veggies quartered (procedural ~3%)', (() => [13, 50, 100].every(n => {
  const L = getLevel(n - 1);
  const veg = L.barrels.filter(b => b.kind === 'veggie').length;
  return veg <= Math.ceil(L.barrels.length * 0.05);
}))());
T('v0.5: conveyor has 32px gaps on BOTH sides (symmetric)', (() => {
  const nb = (x) => Conveyor.onBelt(x, false);
  return !nb(50) && !nb(65) && nb(100) && nb(300) && nb(500) && !nb(540) && !nb(550) &&
         Conveyor.onBelt(50, true) && Conveyor.onBelt(550, true);
})());
T('v0.4: conveyor slats run left with the food', (() => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'js', 'conveyor.js'), 'utf8');
  return src.includes('40 - (this.t * this.SPEED) % 40');
})());

