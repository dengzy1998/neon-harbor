import { Game } from './core/Game.js';

// All assets and modules are local; no service or account is required.
const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);
const scene = new URLSearchParams(location.search).get('scene');

// Staged scenes use exactly the same systems as normal play.
if (scene) {
  game.stage(scene);
} else {
  game.start();
}

// A small inspection surface for local development and screenshots.
window.__neonHarbor = game;
