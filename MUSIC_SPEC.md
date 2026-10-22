# CHONK 'EM music spec — for on-device generation (Qwenny)

Generate with a local music model (suggested: Stable Audio 3.0 Small, open weights —
runs fine on the 5090; Small SFX variant for the SFX clips in AUDIO_SPEC.md).
Drop finished files in `assets/music/<name>.mp3` (44.1 kHz, 128–160 kbps — keep
them small, this ships on a web page).

NOTE: the loader is already wired (2026-10-14, `AudioSys.music` in `js/audio.js`):
the four tracks auto-switch with game state, loop seamlessly, sit under the SFX,
and the game stays silent until files land here. This spec covers generation
only — generate the files below and drop them in, no code changes needed.

Art direction: chunky cartoon kitchen, warm and bouncy. Peggle meets a cat café.
**Instrumental only — no vocals, no lyrics.** Loops must be SEAMLESS (generate
with looping in mind; trim/crossfade in post if the model doesn't loop cleanly).
Leave headroom — music sits UNDER the SFX, so master it quieter than you think.

| file | where it plays | character | ~dur |
|---|---|---|---|
| `menu` | title / level-select screen | light, curious, playful — pizzicato strings, soft marimba, a hint of mischief | 60–90s loop |
| `gameplay` | main game | bouncy warm kitchen-jazz — walking bass, brushed drums, accordion or ukulele lead; steady energy, never frantic | 90–120s loop |
| `frenzy` | FEAST FRENZY (6s slow-mo bonus) | same palette as `gameplay` but hotter — double-time drums, brass stabs; must feel like the same band getting excited | 20–30s loop |
| `weighin` | weigh-in ceremony | playful suspense — music-box waltz that builds; ends on an unresolved lift so the star reveal lands | 30–45s loop |

Consistency notes:
- All four tracks should sound like the same band in the same kitchen. Generate
  `gameplay` first, then prompt the others as variations ("same instruments,
  same room, different mood").
- No sudden intros/outros — every track starts mid-groove and ends mid-groove
  so loops don't hiccup.
- Avoid prominent melodies that get annoying on the 50th loop; think groove
  and texture over hooks.

SFX: the 24 clips in AUDIO_SPEC.md (`assets/sfx/`) are still synth fallbacks —
fair game for the Small SFX model in the same session if you're on a roll.
