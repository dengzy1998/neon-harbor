# Neon Harbor

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dengzy1998/neon-harbor/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dengzy1998/neon-harbor/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Neon Harbor is an original open-world crime game set in the fictional coastal city of Neon Harbor. Play as Mara Venn, taking on dangerous jobs, racing through golden-hour streets, and staying ahead of the NHPD.

## Features

- A 6-mission story with a named cast and dialogue
- A 5-star NHPD wanted system with named units, a helicopter spotlight, and roadblocks
- On-foot gunplay with 4 weapons
- 3 street races against Tomas Rhee
- Near-miss bonuses
- RP ranks from Deckhand to Harbor Legend
- A full city map and Harbor Card
- 2 synth radio stations
- Golden-hour lighting

## Controls

- **WASD / arrow keys:** move or drive
- **E or F:** enter or exit a car
- **Mouse aim + click:** shoot on foot
- **1–4:** switch weapons
- **R:** change radio station
- **M:** open the map
- **Esc:** pause or return from the map
- **Space:** brake
- **Shift:** run

## How to run

Serve the `game/` directory with any static file server, or run the repository's Node server:

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

## Tech note

Three.js is vendored locally. The city and its vehicles are procedural, the radio is synthesized with WebAudio, and the game has no build step. Its world uses a deterministic seed.

---
<sub>Entered on [make.fun](https://make.fun/?ref=01wh7qnm&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
