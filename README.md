# Lantern Shadows — a stealth game

[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759/rmdap/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759/rmdap/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

**Lantern Shadows** is a complete, original top-down stealth game that plays
offline in a desktop browser from its own static files. You are Pip, a
fox-thief slipping into the moonlit garden of Lantern Manor: pocket all three
moon gems and leave by the garden gate — unseen.

## How it plays

- **WASD / arrow keys** move, **Shift** sneaks (slower, harder to spot).
- **Click** anywhere to toss a pebble: nearby wardens leave their patrol to
  investigate the sound.
- Four lantern wardens patrol the garden with **visible vision cones**,
  clipped by hedge walls and bushes. Step into a cone and their suspicion
  fills — faster up close, slower while you sneak. At full suspicion they
  give chase; lose sight of you and they go back to patrolling, still wary.
- **Lantern bushes** hide you outright, and **shadow beds** blind the
  wardens' eyes. The HUD's eye meter shows how close anyone is to raising
  the alarm.
- Collect all three moon gems to open the gate, then reach it to escape.
  Get caught and the garden keeps its gems — press R and try again.
- Synthesized WebAudio sound throughout: footsteps, gem chimes, the alert
  sting, and the escape arpeggio. No audio files, no network requests.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Node 22.18+ and a desktop browser. No build step, no dependencies.

## Layout

- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with `vendor/makefun-game.ts`.
- `game/index.html` — the page; `game/src/` holds one file per job:
  `config.js` (tuning), `level.js` (the garden map), `guards.js` (patrols,
  vision cones, suspicion), `world.js` (rules), `render.js` (drawing),
  `input.js` (keyboard and mouse), `audio.js` (synthesized sound),
  `shots.js` (staged screenshot scenes), `main.js` (boot and loop).
- `screenshots/` — four real renders of the game's own code: title,
  mid-sneak, spotted, and the escape.
- `shots.json` — which `?shot=` scene each screenshot was taken from.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

## License

MIT — see [LICENSE](LICENSE).
