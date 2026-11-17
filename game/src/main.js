// main.js — the bootstrap. It builds the Game on the page's canvas, then
// either opens on the title menu or, when the URL carries ?scene=<name>,
// jumps straight into one of the staged scenes the screenshots are taken
// from (cover, drive, chase, mission). The game handle is exposed for
// headless play-testing probes.

import { Game } from './game.js';

const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);

const scene = new URLSearchParams(window.location.search).get('scene');
if (scene) game.stage(scene);

game.start();
window.__neonHarbor = game;
