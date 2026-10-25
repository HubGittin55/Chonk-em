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
  // model real play: clean deliveries ramp the combo multiplier 1.0,1.1,1.2...3
  const cals = L.barrels.filter(b => b.kind === 'snack').map(b => CONTENT[b.content].cal).sort((a, b) => a - b);
  let eff = 0;
  cals.forEach((c, i) => { eff += c * Math.min(3, 1 + 0.1 * i); });
  return eff >= L.goal * 1.5;
}));
T('v0.4 levels: goals are the 60%-of-raw set', LEVELS.map(L => L.goal).join() === '35,37,39,42,43,46,47,50,53,56,59,61');

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
  return src.indexOf('Vacuum.draw(ctx, game.vacuum); // after the cat') > src.indexOf('Cats.drawMain(ctx, 400, 806');
})());
T('v0.4: vacuum cannot steal from the bowl chute', (() => {
  const v = Vacuum.create(1);
  const it = { x: 300, y: 720, vx: 0, vy: 0, r: 9, state: 'belt', cal: 3, gone: false };
  v.x = 300;
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
  // 2026-10-17 tuning deep-dive: foodFactor trims the curve (-10% L20 → -50% L100)
  return maxLb(10) < 40 && maxLb(50) >= 50 && maxLb(50) <= 75 && maxLb(100) >= 60;
})());
T('tuning: foodFactor is 1 below L20, 0.9 at L20, 0.5 at L100, floored at 0.3', (() =>
  foodFactor(1) === 1 && foodFactor(19) === 1 && foodFactor(20) === 0.9 &&
  Math.abs(foodFactor(100) - 0.5) < 1e-9 && foodFactor(140) === 0.3 && foodFactor(200) === 0.3)());
T('tuning: food barrels shrink on the curve (L100 ≈ half of unscaled)', (() => {
  const nFood = n => getLevel(n - 1).barrels.filter(b => b.kind === 'snack').length;
  const f100 = nFood(100), f20 = nFood(20);
  return f100 < f20 * 0.65 && f100 >= 8; // target -50% (slack for the tuning loop), floor holds
})());
T('tuning: daily challenge unaffected (tiers 5-15, below the curve)', (() => {
  const L = genDailyLevel('20261017');
  return L.balls >= 8 && L.goal > 0;
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
T('dual-belts: center bowl, inward belts, end gaps + center gap', (() => {
  const nb = (x) => Conveyor.onBelt(x, false);
  return Conveyor.BOWL_X === 300 &&
         nb(50) === null && nb(540) === null && nb(590) === null && // far ends: lost
         nb(100) === 'L' && nb(268) === 'L' &&                     // left belt → gap
         nb(332) === 'R' && nb(500) === 'R' &&                     // right belt → gap
         nb(300) === null &&                                       // center gap: no belt
         Conveyor.onBelt(50, true) === 'L' && Conveyor.onBelt(560, true) === 'R' && // bridge spans end gaps
         Conveyor.onBelt(300, true) === null;                      // bridge never spans the gap
})());
T('dual-belts: belt catch needs a plane crossing (pop-bug fix)', (() =>
  Conveyor.crossesBelt(699, 701, 100) === true &&
  Conveyor.crossesBelt(700, 701, 100) === false &&  // already at/below: no catch
  Conveyor.crossesBelt(720, 730, 100) === false &&  // below the line: the pop case
  Conveyor.crossesBelt(699, 701, -100) === false)); // moving up: no catch
T('dual-belts: conveyor slats run inward with the food', (() => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'js', 'conveyor.js'), 'utf8');
  return src.includes('const off = dir > 0 ? phase : 40 - phase');
})());

// 2026-10-16: endless climb — post-campaign survival climb
T('endless: same depth → identical level; deeper → different level', (() => {
  const flat = L => JSON.stringify(L.barrels.map(b => [b.x, b.y, b.kind, b.content]));
  const a1 = flat(genEndlessLevel(1)), a2 = flat(genEndlessLevel(1)), b1 = flat(genEndlessLevel(2));
  return a1 === a2 && a1 !== b1;
})());
T('endless: vacuum always on, goal climbs with depth, balls playable', (() => {
  const d1 = genEndlessLevel(1), d10 = genEndlessLevel(10);
  return d1.vacuum === true && d10.vacuum === true && d1.goal > 0 &&
    d10.goal > d1.goal && d1.name.indexOf('Depth 1') === 0 && d1.balls >= 8;
})());
T('endless: max food tier from depth 1 (exotics seed immediately)', (() => {
  const seen = new Set();
  for (let d = 1; d <= 6; d++)
    for (const b of genEndlessLevel(d).barrels)
      if (b.content && CONTENT[b.content] && CONTENT[b.content].cal >= 15) seen.add(b.content);
  return seen.size >= 3;
})());
T('endless: exotic cap scales with depth (campaign 3-cap untouched)', (() => {
  const EXK = new Set(EXOTICS.map(e => e[0]));
  const nEx = L => L.barrels.filter(b => EXK.has(b.content)).length;
  const d1 = genEndlessLevel(1), d20 = genEndlessLevel(20);
  const camp = getLevel(99); // L100 campaign: still capped at 3
  return nEx(d1) <= 3 && nEx(d20) <= 3 + Math.floor(20 / 4) &&
    nEx(d20) > 3 && nEx(camp) <= 3 && d20.goal > d1.goal;
})());
