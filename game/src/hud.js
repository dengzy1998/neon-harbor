// hud.js — everything drawn over the 3D view: the wanted stars, cash and
// health readouts, the objective banner, prompts and toasts, the busted
// meter, and the canvas minimap with its roads, police blips and mission
// marker. It also owns the menu / pause / story / end screens' DOM, while
// game.js decides when each one shows.

import { ROAD_LINES, WATER_Z, PLACES } from './config.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.root = $('hud');
    this.starsEl = $('stars');
    this.cashEl = $('cash');
    this.districtEl = $('district');
    this.objectiveEl = $('objective');
    this.toastEl = $('toast');
    this.promptEl = $('prompt');
    this.bustedWrap = $('busted-wrap');
    this.bustedFill = $('busted-fill');
    this.speedEl = $('speedo');
    this.healthEl = $('health');
    this.map = $('minimap').getContext('2d');
    this.menuEl = $('menu');
    this.pauseEl = $('pause');
    this.storyEl = $('storycard');
    this.endEl = $('endcard');
    this.muteBtn = $('mute-btn');
    this.buttons = {
      newGame: $('new-game'),
      continueGame: $('continue-game'),
      resume: $('resume'),
      restart: $('restart'),
      respawn: $('respawn'),
    };
    this.toastTimer = 0;
    this.lastDistrict = '';
    this.starsEl.innerHTML = [0, 1, 2, 3, 4].map(() => '<span>★</span>').join('');
  }

  showGameHud(on) {
    this.root.classList.toggle('on', on);
    this.muteBtn.classList.toggle('on', on);
  }

  setStars(stars) {
    [...this.starsEl.children].forEach((el, i) => el.classList.toggle('lit', i < stars));
  }

  setCash(cash) { this.cashEl.textContent = '$' + cash.toLocaleString('en-US'); }

  setDistrict(name) {
    if (name !== this.lastDistrict) {
      this.lastDistrict = name;
      this.districtEl.textContent = name;
    }
  }

  setHealth(frac) { this.healthEl.style.width = Math.max(0, frac * 100) + '%'; }

  setSpeed(kmh) {
    if (kmh === null) { this.speedEl.style.display = 'none'; return; }
    this.speedEl.style.display = 'block';
    this.speedEl.textContent = Math.round(kmh) + ' km/h';
  }

  setObjective(html) {
    if (!html) { this.objectiveEl.style.display = 'none'; return; }
    this.objectiveEl.style.display = 'block';
    this.objectiveEl.innerHTML = html;
  }

  showPrompt(html) {
    if (!html) { this.promptEl.style.display = 'none'; return; }
    this.promptEl.style.display = 'block';
    this.promptEl.innerHTML = html;
  }

  toast(text, seconds = 2.6) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastEl.style.opacity = '0'; }, seconds * 1000);
  }

  setBust(frac) {
    this.bustedWrap.style.display = frac > 0.02 ? 'block' : 'none';
    this.bustedFill.style.width = (frac * 100) + '%';
  }

  showStory(who, text) {
    $('story-who').textContent = who;
    $('story-text').textContent = text;
    this.storyEl.classList.add('on');
  }

  hideStory() { this.storyEl.classList.remove('on'); }

  showEnd(title, text) {
    $('end-title').textContent = title;
    $('end-text').textContent = text;
    this.endEl.classList.add('on');
  }

  hideEnd() { this.endEl.classList.remove('on'); }

  setMutedLabel(muted) { this.muteBtn.textContent = muted ? 'Sound: off' : 'Sound: on'; }

  // The minimap: a fixed north-up plan of the whole bay, redrawn each frame.
  drawMinimap(s) {
    const g = this.map, W = 196;
    const px = (x) => (x + 215) * (W / 445);
    const pz = (z) => (z + 215) * (W / 445);
    g.fillStyle = '#274b63'; g.fillRect(0, 0, W, W);
    g.fillStyle = '#3f7f5f'; g.fillRect(px(-212), pz(-212), px(212) - px(-212), pz(WATER_Z) - pz(-212));
    g.fillStyle = '#14919b'; g.fillRect(0, pz(WATER_Z), W, W - pz(WATER_Z));
    g.fillStyle = '#eed9a4'; g.fillRect(0, pz(192), W, pz(WATER_Z) - pz(192));
    g.strokeStyle = '#d8d3c3'; g.lineWidth = 3;
    for (const line of ROAD_LINES) {
      g.beginPath(); g.moveTo(px(line), pz(-190)); g.lineTo(px(line), pz(190)); g.stroke();
      g.beginPath(); g.moveTo(px(-190), pz(line)); g.lineTo(px(190), pz(line)); g.stroke();
    }
    g.fillStyle = '#ffd166';
    g.fillRect(px(PLACES.garage.x) - 2, pz(PLACES.garage.z) - 2, 4, 4);
    if (s.target) {
      const pulse = 3 + Math.sin(s.time * 6) * 1.2;
      g.fillStyle = '#fbbf24';
      g.beginPath(); g.arc(px(s.target.x), pz(s.target.z), pulse + 2.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff7d6';
      g.beginPath(); g.arc(px(s.target.x), pz(s.target.z), 2, 0, Math.PI * 2); g.fill();
    }
    const flash = Math.floor(s.time * 3) % 2 === 0;
    for (const p of s.police) {
      g.fillStyle = flash ? '#ff4757' : '#3b82f6';
      g.beginPath(); g.arc(px(p.x), pz(p.z), 3, 0, Math.PI * 2); g.fill();
    }
    // The player: a white arrow turned to the facing direction.
    g.save();
    g.translate(px(s.playerPos.x), pz(s.playerPos.z));
    g.rotate(Math.atan2(Math.sin(s.playerHeading), Math.cos(s.playerHeading)) * -1 + Math.PI);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -6); g.lineTo(4, 5); g.lineTo(0, 2.4); g.lineTo(-4, 5);
    g.closePath(); g.fill();
    g.restore();
  }
}
