// The HUD: wanted stars, cash, health, the busted meter, speed, the objective
// banner, prompts and toasts — and the round minimap, drawn fresh each frame with
// the streets, the law, and wherever the work is.

import { CITY } from './config.js';
import { streetCentres } from './city.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.root = $('hud');
    this.cashEl = $('cash-value');
    this.wantedEl = $('wanted');
    this.healthEl = $('health-fill');
    this.bustedWrap = $('busted-wrap');
    this.bustedEl = $('busted-fill');
    this.speedoEl = $('speedo');
    this.speedEl = $('speed-num');
    this.objEl = $('objective');
    this.objTitle = $('objective-title');
    this.objText = $('objective-text');
    this.objDist = $('objective-dist');
    this.promptEl = $('prompt');
    this.toastEl = $('toast');
    this.vignette = $('damage-vignette');
    this.map = $('minimap').getContext('2d');
    this.toastT = 0;
    this.lastCash = null;
    this.lastStars = -1;
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  setCash(n) {
    if (n === this.lastCash) return;
    this.lastCash = n;
    this.cashEl.textContent = '$' + Math.round(n).toLocaleString('en-US');
  }

  setStars(n, flashing) {
    if (n === this.lastStars && !flashing) return;
    this.lastStars = n;
    let html = '';
    for (let i = 1; i <= 5; i++) {
      const cls = i <= n ? (flashing ? 'flash' : 'lit') : '';
      html += `<span class="${cls}">★</span>`;
    }
    this.wantedEl.innerHTML = html;
  }

  setHealth(frac) {
    this.healthEl.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  }

  setBust(frac) {
    if (frac === null || frac <= 0.01) {
      this.bustedWrap.classList.add('hidden');
      return;
    }
    this.bustedWrap.classList.remove('hidden');
    this.bustedEl.style.width = `${Math.min(1, frac) * 100}%`;
  }

  setSpeed(mph) {
    if (mph === null) {
      this.speedoEl.classList.add('hidden');
      return;
    }
    this.speedoEl.classList.remove('hidden');
    this.speedEl.textContent = String(Math.round(mph));
  }

  setObjective(title, text, distText) {
    this.objEl.classList.remove('hidden');
    this.objTitle.textContent = title;
    this.objText.textContent = text;
    this.objDist.textContent = distText || '';
  }

  clearObjective() { this.objEl.classList.add('hidden'); }

  prompt(html) {
    if (!html) {
      this.promptEl.classList.add('hidden');
      return;
    }
    this.promptEl.classList.remove('hidden');
    this.promptEl.innerHTML = html;
  }

  toast(text, seconds = 2.6) {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    this.toastT = seconds;
  }

  setVignette(opacity) {
    this.vignette.style.opacity = String(Math.max(0, Math.min(0.9, opacity)));
  }

  update(dt) {
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toastEl.classList.add('hidden');
    }
  }

  /** view: { player:{x,z,heading}, units:[{x,z}], target:{x,z}|null, hideout:{x,z} } */
  drawMinimap(view) {
    const g = this.map;
    const S = 376;               // canvas pixels
    const VIEW = 300;            // world metres across the map
    const px = (wx) => S / 2 + ((wx - view.player.x) / VIEW) * S;
    const pz = (wz) => S / 2 + ((wz - view.player.z) / VIEW) * S;
    g.fillStyle = '#274b63';
    g.fillRect(0, 0, S, S);
    // Land, then the bay to the east.
    g.fillStyle = '#8fa383';
    g.fillRect(px(-CITY.half - 40), pz(-CITY.half - 40), ((CITY.beachX + 40 + CITY.half + 40) / VIEW) * S, ((CITY.half * 2 + 80) / VIEW) * S);
    g.fillStyle = '#1e7f9e';
    g.fillRect(px(CITY.waterX), 0, S, S);
    g.fillStyle = '#eed9a4';
    g.fillRect(px(CITY.beachX), 0, ((CITY.waterX - CITY.beachX) / VIEW) * S, S);
    // Streets.
    g.strokeStyle = '#454f58';
    g.lineWidth = (CITY.roadWidth / VIEW) * S;
    g.beginPath();
    for (const s of streetCentres) {
      g.moveTo(px(s), pz(-CITY.half - 30)); g.lineTo(px(s), pz(CITY.half + 30));
      g.moveTo(px(-CITY.half - 30), pz(s)); g.lineTo(px(CITY.half + 30), pz(s));
    }
    g.stroke();
    // The hideout that washes a record clean.
    g.fillStyle = '#2ee6c8';
    g.fillRect(px(view.hideout.x) - 5, pz(view.hideout.z) - 5, 10, 10);
    // Police blips.
    g.fillStyle = '#3d8bff';
    for (const u of view.units) {
      g.beginPath();
      g.arc(px(u.x), pz(u.z), 5, 0, Math.PI * 2);
      g.fill();
    }
    // The job.
    if (view.target) {
      g.strokeStyle = '#ffc44d';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(px(view.target.x), pz(view.target.z), 10, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#ffc44d';
      g.beginPath();
      g.arc(px(view.target.x), pz(view.target.z), 4, 0, Math.PI * 2);
      g.fill();
    }
    // Jett, an arrow that turns with him.
    const cx = S / 2, cy = S / 2, h = view.player.heading;
    g.save();
    g.translate(cx, cy);
    g.rotate(Math.atan2(Math.sin(h), Math.cos(h)) * 0 + h * 0); // heading handled below
    g.restore();
    g.fillStyle = '#fdf6e9';
    g.strokeStyle = '#0b1620';
    g.lineWidth = 2;
    g.beginPath();
    const tipX = cx + Math.sin(h) * 11, tipY = cy + Math.cos(h) * 11;
    const leftX = cx + Math.sin(h + 2.5) * 8, leftY = cy + Math.cos(h + 2.5) * 8;
    const rightX = cx + Math.sin(h - 2.5) * 8, rightY = cy + Math.cos(h - 2.5) * 8;
    g.moveTo(tipX, tipY); g.lineTo(leftX, leftY); g.lineTo(rightX, rightY);
    g.closePath();
    g.fill(); g.stroke();
  }
}
