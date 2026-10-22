'use strict';
/* CHONK'EM trophies — the long-term progression hook (2026-10-19).
   ~20 achievements across campaign / endless / daily play. Unlocks are
   persisted in save-v2 (Profile.trophies = { id: timestampMs }), shown in a
   menu panel, and announced with an in-game toast + a soft fanfare.
   Call Achievements.unlock(id) for one-shot events; call
   Achievements.checkEndOfLevel(win) from endGame() for aggregate ones. */

const ACHIEVEMENTS = [
  // ---- campaign grind ----
  { id: 'first-steps',   icon: '🐾', name: 'First Steps',      desc: 'Win your first level.' },
  { id: 'perfect-chonk', icon: '⭐', name: 'Perfect Chonk',    desc: '3-star a level.' },
  { id: 'chonk-critic',  icon: '🌟', name: 'Chonk Critic',     desc: '3-star 10 levels.' },
  { id: 'sous-chef',     icon: '🔪', name: 'Sous Chef',        desc: 'Clear 10 levels (lifetime).' },
  { id: 'iron-chef',     icon: '🏅', name: 'Iron Chef',        desc: 'Clear 50 levels (lifetime).' },
  // ---- skill ----
  { id: 'combo-chef',    icon: '🔥', name: 'Combo Chef',       desc: 'Reach combo ×6 in one level.' },
  { id: 'frenzy-master', icon: '🌪️', name: 'Frenzy Master',    desc: 'Reach combo ×12 in one level.' },
  { id: 'jackpot',       icon: '💰', name: 'Jackpot',          desc: 'Burst a golden barrel.' },
  { id: 'demolition',    icon: '🧨', name: 'Demolition Crew',  desc: 'Blow 3 powder kegs in one level.' },
  { id: 'imperial',      icon: '👑', name: 'Imperial Banquet', desc: 'Deliver a 75+ calorie feast.' },
  // ---- chaos & counterplay ----
  { id: 'jumpscare',     icon: '🥒', name: 'Jumpscare',        desc: 'Get the cat spooked by a cucumber.' },
  { id: 'cuke-hunter',   icon: '😱', name: 'Cucumber Season',  desc: 'Spook the cat 3 times in one level.' },
  { id: 'shortcircuit',  icon: '⚡', name: 'Short Circuit',    desc: 'Short out the vacuum with an EMP barrel.' },
  { id: 'diet-plan',     icon: '🥗', name: 'Diet Plan',        desc: 'Lose a level. The cat is furious.' },
  // ---- endless & daily ----
  { id: 'deep-diver',    icon: '🤿', name: 'Deep Diver',       desc: 'Win endless depth 5.' },
  { id: 'abyssal',       icon: '🕳️', name: 'Abyssal Chonk',    desc: 'Win endless depth 10.' },
  { id: 'regular',       icon: '📅', name: 'Regular',          desc: 'Play the daily challenge 3 days in a row.' },
  { id: 'devotee',       icon: '🙏', name: 'Devotee',          desc: 'Play the daily challenge 7 days in a row.' },
  // ---- the cat itself ----
  { id: 'heavyweight',   icon: '🏋️', name: 'Heavyweight',      desc: 'Reach a 50 lb best chonk.' },
  { id: 'century',       icon: '💯', name: 'Century Chonk',    desc: 'Reach a 100 lb best chonk.' },
  { id: 'maximum',       icon: '🌍', name: 'Maximum Chonk',    desc: 'Hit the 150 lb cap.' },
];
const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map(a => a.id));

const Achievements = {
  _queue: [], // pending toast announcements (test hook: _pop)

  count() { return Object.keys(Profile.trophies()).length; },

  has(id) { return !!Profile.trophies()[id]; },

  unlock(id) { // one-shot event unlock; idempotent — double calls are free
    if (!ACHIEVEMENT_IDS.has(id) || this.has(id)) return false;
    const p = Profile.get();
    p.trophies[id] = Date.now();
    Profile.save();
    const def = ACHIEVEMENTS.find(a => a.id === id);
    this._queue.push(def);
    this._announce();
    return true;
  },

  noteCombo(n) { // called wherever combo increments (deliver + bumper hits)
    if (n >= 12) this.unlock('frenzy-master');
    else if (n >= 6) this.unlock('combo-chef');
  },

  // Aggregate checks — called from endGame() AFTER recordWin/recordDaily/
  // recordEndless so the profile already holds the fresh numbers.
  checkEndOfLevel(win) {
    if (!win) { this.unlock('diet-plan'); return; }
    this.unlock('first-steps');
    const L = Profile.lifetime();
    if (L.levelsCleared >= 10) this.unlock('sous-chef');
    if (L.levelsCleared >= 50) this.unlock('iron-chef');
    if (Profile.starCount(3) >= 1) this.unlock('perfect-chonk');
    if (Profile.starCount(3) >= 10) this.unlock('chonk-critic');
    if (L.bestChonk >= 50) this.unlock('heavyweight');
    if (L.bestChonk >= 100) this.unlock('century');
    if (L.bestChonk >= 150) this.unlock('maximum');
    if (game.endless && game.endless.depth >= 5) this.unlock('deep-diver');
    if (game.endless && game.endless.depth >= 10) this.unlock('abyssal');
    if (Profile.streak() >= 3) this.unlock('regular');
    if (Profile.streak() >= 7) this.unlock('devotee');
  },

  // ---- progress hints (2026-10-22) ----
  // A short "n / target" hint for trophies whose progress is derivable from
  // existing profile state — shown under locked trophies in the menu panel.
  // Unlocked trophies and one-shot event trophies (golden burst, keg chains,
  // feasts, spooks, EMP shorts, losses) return null: those live and die in a
  // single level, so nothing persists to count.
  progress(id) {
    if (!ACHIEVEMENT_IDS.has(id) || this.has(id)) return null;
    const L = Profile.lifetime();
    switch (id) {
      case 'first-steps':  return L.levelsCleared >= 1 ? null : 'clear 1 level to earn';
      case 'perfect-chonk': return Profile.starCount(3) + ' / 1 three-star level';
      case 'chonk-critic':  return Profile.starCount(3) + ' / 10 three-star levels';
      case 'sous-chef':     return L.levelsCleared + ' / 10 levels cleared';
      case 'iron-chef':     return L.levelsCleared + ' / 50 levels cleared';
      case 'combo-chef':    return L.maxCombo + ' / 6 combo';
      case 'frenzy-master': return L.maxCombo + ' / 12 combo';
      case 'deep-diver':    return Profile.endlessBest().bestDepth + ' / 5 endless depth';
      case 'abyssal':       return Profile.endlessBest().bestDepth + ' / 10 endless depth';
      case 'regular':       return Profile.streak() + ' / 3-day streak';
      case 'devotee':       return Profile.streak() + ' / 7-day streak';
      case 'heavyweight':   return Math.floor(L.bestChonk) + ' / 50 lb best chonk';
      case 'century':       return Math.floor(L.bestChonk) + ' / 100 lb best chonk';
      case 'maximum':       return Math.floor(L.bestChonk) + ' / 150 lb cap';
      default: return null;
    }
  },

  // ---- toast UI ----
  _announce() {
    const el = (typeof document !== 'undefined') ? document.getElementById('trophyToast') : null;
    if (!el) { this._queue.length = 0; return; } // headless without the toast element: unlocks still persist
    if (this._busy) return;
    const def = this._queue.shift();
    if (!def) return;
    this._busy = true;
    el.innerHTML = '';
    const ic = document.createElement('span'); ic.className = 'tt-icon'; ic.textContent = def.icon;
    const tx = document.createElement('span'); tx.className = 'tt-text';
    tx.innerHTML = '<b>🏆 ' + def.name + '</b><small>' + def.desc + '</small>';
    el.appendChild(ic); el.appendChild(tx);
    el.classList.remove('hidden');
    if (typeof AudioSys !== 'undefined' && AudioSys.sfx) {
      AudioSys.sfx('trophy', function() {
        [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.09), i * 110));
      });
    }
    setTimeout(() => {
      el.classList.add('hidden');
      this._busy = false;
      if (this._queue.length) this._announce(); // drain the queue one toast at a time
    }, 3600);
  },

  // Test hook: pop one pending announcement without timers.
  _pop() { const d = this._queue.shift(); return d ? d.id : null; },
};
