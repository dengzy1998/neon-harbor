import { DISTRICTS } from '../world/City.js';
import { RACES } from '../activities/StreetRace.js';

/** The map is a paused, north-up atlas with a persistent progression card. */
export class MapScreen {
  constructor(rootEl, canvas) {
    this.el = rootEl;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Map screen needs a 2D canvas context');
    }
    this.open = false;
    this.padding = 28;
    this.extent = 760;
    this.fields = {};
    const names = [
      'rank',
      'rp',
      'cash',
      'story',
      'stolen',
      'near',
      'races',
      'deliveries',
      'busts',
    ];
    for (const name of names) {
      this.fields[name] = rootEl.querySelector(`#card-${name}`);
    }
    this.setOpen(false);
  }

  setOpen(value) {
    this.open = Boolean(value);
    this.el.hidden = !this.open;
    this.el.setAttribute('aria-hidden', String(!this.open));
  }

  toggle() {
    this.setOpen(!this.open);
    return this.open;
  }

  point(position) {
    const scale = (this.canvas.width - this.padding * 2) / this.extent;
    return {
      x: this.canvas.width / 2 + position.x * scale,
      y: this.canvas.height / 2 - position.z * scale,
      scale,
    };
  }

  label(text, x, y, color = '#fff1d8', size = 12) {
    const ctx = this.ctx;
    ctx.font = `600 ${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.strokeStyle = '#18252e';
    ctx.lineWidth = 3;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  drawDistricts() {
    const ctx = this.ctx;
    for (const district of DISTRICTS) {
      const bounds = district.bounds;
      const top = this.point({ x: bounds.minX, z: bounds.maxZ });
      const width = (Math.min(300, bounds.maxX) - bounds.minX) * top.scale;
      const height = (bounds.maxZ - bounds.minZ) * top.scale;
      ctx.fillStyle = `#${district.palette[0].toString(16).padStart(6, '0')}`;
      ctx.globalAlpha = 0.48;
      ctx.fillRect(top.x, top.y, width, height);
      ctx.globalAlpha = 1;
    }
  }

  drawRoads() {
    const ctx = this.ctx;
    ctx.strokeStyle = '#b0aa95';
    ctx.lineWidth = 3;
    for (let coordinate = -336; coordinate <= 336; coordinate += 56) {
      const top = this.point({ x: coordinate, z: 340 });
      const bottom = this.point({ x: coordinate, z: -340 });
      const left = this.point({ x: -340, z: coordinate });
      const right = this.point({ x: 300, z: coordinate });
      ctx.beginPath();
      if (coordinate < 300) {
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(bottom.x, bottom.y);
      }
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();
    }
  }

  drawPlace(name, position, symbol, offset = 16) {
    const ctx = this.ctx;
    const point = this.point(position);
    ctx.fillStyle = '#192c35';
    ctx.strokeStyle = '#7bdcda';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    this.label(symbol, point.x, point.y + 4, '#8ae6e0', 11);
    this.label(name, point.x, point.y + offset, '#fff3dc', 10);
  }

  drawPlaces(places = {}) {
    this.drawPlace('Freight Docks', places.docks || { x: -168, z: 216 }, 'D', -16);
    this.drawPlace('Club Solene', places.club || { x: 120, z: 144 }, 'S', 24);
    this.drawPlace("Otto's Garage", places.garage || { x: -56, z: 31 }, 'G', 24);
    this.drawPlace('Marina', places.marina || { x: 288, z: 168 }, 'M', -16);
    this.drawPlace('Palm Strand', places.strand || { x: 280, z: 23 }, 'P', 24);
    for (const race of RACES) {
      const point = this.point(race.checkpoints[0]);
      const ctx = this.ctx;
      ctx.fillStyle = '#f8ecd2';
      ctx.fillRect(point.x - 7, point.y - 7, 14, 14);
      ctx.fillStyle = '#132933';
      for (let row = 0; row < 4; row++) {
        for (let column = 0; column < 4; column++) {
          if ((row + column) % 2 === 0) {
            ctx.fillRect(point.x - 7 + column * 3.5, point.y - 7 + row * 3.5, 3.5, 3.5);
          }
        }
      }
      this.label(race.name, point.x, point.y + 22, '#ffe1a2', 10);
    }
  }

  drawMarker(marker) {
    if (!marker) {
      return;
    }
    const ctx = this.ctx;
    const point = this.point(marker);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd16d';
    ctx.strokeStyle = '#fff0ba';
    ctx.lineWidth = 2;
    ctx.fillRect(-6, -6, 12, 12);
    ctx.strokeRect(-6, -6, 12, 12);
    ctx.restore();
  }

  drawPlayer(position) {
    if (!position) {
      return;
    }
    const ctx = this.ctx;
    const point = this.point(position);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(position.heading || 0);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#18313a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  fillCard(card = {}) {
    const stats = card.stats || {};
    const values = {
      rank: card.rankName || 'Deckhand',
      rp: `${Math.round(card.rp || 0).toLocaleString('en-US')} RP`,
      cash: `$${Math.round(card.cash || 0).toLocaleString('en-US')}`,
      story: `${card.storyDone || 0} / ${card.storyTotal || 6}`,
      stolen: stats.carsStolen || 0,
      near: stats.nearMisses || 0,
      races: stats.racesWon || 0,
      deliveries: stats.deliveries || 0,
      busts: stats.busts || 0,
    };
    for (const [name, value] of Object.entries(values)) {
      if (this.fields[name]) {
        this.fields[name].textContent = String(value);
      }
    }
  }

  render(state = {}) {
    const ctx = this.ctx;
    ctx.fillStyle = '#204d5e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawDistricts();
    this.drawRoads();
    for (const district of DISTRICTS) {
      const bounds = district.bounds;
      const point = this.point({
        x: (bounds.minX + Math.min(bounds.maxX, 300)) / 2,
        z: (bounds.minZ + bounds.maxZ) / 2 + 45,
      });
      this.label(district.name.toUpperCase(), point.x, point.y, '#eed9b8', 11);
    }
    this.drawPlaces(state.places);
    this.drawMarker(state.marker);
    this.drawPlayer(state.playerPos);
    this.label('N ↑', 38, 28, '#ffffff', 14);
    this.label('HARBOR SEA', this.canvas.width - 37, 65, '#8ad3db', 9);
    this.fillCard(state.card);
  }
}
