# CHONK 'EM SFX spec — for audio generation

Drop finished files in `assets/sfx/<name>.mp3` (44.1 kHz, mono is fine). The game
auto-plays them via `AudioSys.play(name)` and falls back to the built-in WebAudio
synth for any file that's missing — so generate in any order, nothing breaks.

Art direction: chunky cartoon kitchen, warm and bouncy. Nothing realistic; think
Peggle meets a cat café. Keep clips tight — most are under half a second.

| file | trigger | character | ~dur |
|---|---|---|---|
| `ui_click` | any button | soft wooden click | 0.08s |
| `shoot` | yarn launched | cartoon twang/boing | 0.15s |
| `burst` | barrel bursts | pop + tiny debris | 0.20s |
| `bounce` | food bounces | soft thud | 0.10s |
| `belt_catch` | food lands on belt | muted thock | 0.10s |
| `nom` | food delivered to bowl | happy munch | 0.25s |
| `combo2` | combo ×2 reached | rising chime, low tier | 0.30s |
| `combo3` | combo ×3 reached | rising chime, mid tier | 0.30s |
| `combo4` | combo ×4 reached | rising chime, top tier | 0.35s |
| `star_pop` | weigh-in star lights | sparkle ping | 0.20s |
| `needle_tick` | scale needle climbs | mechanical click | 0.05s |
| `trombone` | 1-star weigh-in | sad trombone: womp womp womp womppp | 1.2s |
| `fanfare` | 3-star weigh-in | brass fanfare, triumphant | 1.5s |
| `jingle_win` | 2-star weigh-in | happy little arpeggio | 0.8s |
| `jingle_lose` | level failed | descending, deflated | 0.8s |
| `slurp` | vacuum eats food | cartoon slurp | 0.30s |
| `vacuum_full` | vacuum hits 2-per-shot cap | stuffed clunk | 0.30s |
| `meow1` | small milestone (10–30 lb) | bright kitten meow | 0.4s |
| `meow2` | mid milestone (40–70 lb) | adult meow | 0.4s |
| `meow3` | big milestone (80+ lb) | deep, enormous meow | 0.5s |
| `powerup` | powerup collected | shimmer | 0.4s |
| `frenzy` | FEAST FRENZY triggers | hype riser | 0.6s |
| `splash` | level intro card | soft whoosh | 0.3s |
| `unlock` | new cat species unlocked | magical unlock | 0.8s |
| `clang` | ball hits steel barrel | metallic clang | 0.15s |
| `boing` | ball hits bumper | cartoon boing, springy up-pitch | 0.28s |
| `boom` | powder keg explodes | deep cartoon explosion | 0.5s |

Notes:
- `needle_tick` plays every ~2 lb of needle climb — keep it clicky, not tonal.
- The three meows should feel like the *same cat* at different sizes.
- `trombone` is the emotional centerpiece of failure — make it properly pathetic.
