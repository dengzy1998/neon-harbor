# Neon Harbor

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dengzy1998/neon-harbor/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dengzy1998/neon-harbor/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Neon Harbor is an original three.js open-world crime game set in a sunlit coastal city. Play as Mara Venn, running jobs with fixer Otto Lindqvist, club owner Bea Lark, and smuggler Captain Ilya Sorin while rival driver Tomas Rhee and the NHPD close in around the harbor.

## Features

- A six-mission story told through character dialogue, with Mara Venn, Otto Lindqvist, Bea Lark, Captain Ilya Sorin, Tomas Rhee, and NHPD Dispatch
- A five-star NHPD wanted system with patrol units ANCHOR-1, BUOY-2, SAIL-3, TIDE-4, KEEL-5, and LAGOON-6, plus a helicopter spotlight and roadblocks
- On-foot gunplay with four weapons: fists, pistol, SMG, and shotgun
- Three street races against Tomas Rhee: Strand Sprint, Docklands Dash, and Lantern Loop
- Near-miss driving bonuses that build combo multipliers
- Contact favors with cooldowns: Bea's Swap Plates lowers wanted heat; Otto's Quick Fix repairs your car
- RP progression through Deckhand, Runner, Wheelman, Fixer, Kingpin, and Harbor Legend
- A full city map and Harbor Card with objectives, races, and career stats
- Two synthesized radio stations, golden-hour lighting, and localStorage saves

## Controls

- **WASD / arrow keys:** move on foot or steer and drive
- **E or F:** enter or exit a car
- **Mouse aim + click:** shoot on foot
- **1–4:** switch weapons
- **Q:** call Bea for Swap Plates
- **T:** call Otto for Quick Fix
- **R:** change radio station
- **M:** open or close the city map
- **Esc / P:** pause; **Esc** also returns from the map
- **Space:** brake
- **Shift:** run

## How to run

Serve the `game/` directory with any static file server, or run the repository's Node server:

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

## Tech

Three.js is vendored locally. The city and vehicles are procedural, radio music is synthesized with WebAudio, and the game runs without a build step. Its world uses a deterministic seed, while progress is saved in the browser's localStorage.

---
<sub>Entered on [make.fun](https://make.fun/?ref=01wh7qnm&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
