import { DISTRICTS } from '../world/City.js';

/** North stays at the top; positive world Z projects upward. */
export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Minimap needs a 2D canvas context');
    }
    this.range = 190;
    this.districtName = null;
  }

  point(position, origin, scale) {
    return {
      x: this.canvas.width / 2 + (position.x - origin.x) * scale,
      y: this.canvas.height / 2 - (position.z - origin.z) * scale,
    };
  }

  dot(position, origin, scale, color, radius = 3) {
    if (!position) {
      return;
    }
    const point = this.point(position, origin, scale);
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  diamond(position, origin, scale) {
    if (!position) {
      return;
    }
    const point = this.point(position, origin, scale);
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd478';
    ctx.strokeStyle = '#352718';
    ctx.lineWidth = 2;
    ctx.fillRect(-4, -4, 8, 8);
    ctx.strokeRect(-4, -4, 8, 8);
    ctx.restore();
  }

  draw(view) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const radius = Math.min(width, height) / 2 - 3;
    const origin = view.playerPos;
    if (!origin) {
      return;
    }
    const scale = radius / this.range;
    const project = (x, z) => this.point({ x, z }, origin, scale);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#203b3c';
    ctx.fillRect(0, 0, width, height);

    // District palettes come directly from the procedural city's definitions.
    for (const district of DISTRICTS) {
      const bounds = district.bounds;
      const corner = project(bounds.minX, bounds.maxZ);
      ctx.fillStyle = `#${district.palette[0].toString(16).padStart(6, '0')}`;
      ctx.globalAlpha = 0.46;
      ctx.fillRect(
        corner.x,
        corner.y,
        (Math.min(bounds.maxX, 300) - bounds.minX) * scale,
        (bounds.maxZ - bounds.minZ) * scale,
      );
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#b8b5a0';
    ctx.lineWidth = 3;
    const startX = Math.floor((origin.x - this.range) / 72) * 72;
    const startZ = Math.floor((origin.z - this.range) / 72) * 72;
    for (let x = startX; x <= origin.x + this.range; x += 72) {
      const point = project(x, origin.z);
      ctx.beginPath();
      ctx.moveTo(point.x, 0);
      ctx.lineTo(point.x, height);
      ctx.stroke();
    }
    for (let z = startZ; z <= origin.z + this.range; z += 72) {
      const point = project(origin.x, z);
      ctx.beginPath();
      ctx.moveTo(0, point.y);
      ctx.lineTo(width, point.y);
      ctx.stroke();
    }
    const coast = project(300, origin.z);
    ctx.fillStyle = '#245d70';
    ctx.fillRect(coast.x, 0, width + Math.abs(coast.x), height);
    ctx.strokeStyle = '#79c6c5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(coast.x, 0);
    ctx.lineTo(coast.x, height);
    ctx.stroke();
    this.diamond(view.marker, origin, scale);

    if (view.raceNext) {
      this.dot(view.raceNext, origin, scale, '#ffffff', 5);
      const flag = this.point(view.raceNext, origin, scale);
      ctx.fillStyle = '#14242e';
      ctx.fillRect(flag.x - 3, flag.y - 3, 3, 3);
      ctx.fillRect(flag.x, flag.y, 3, 3);
    }
    const flash = Math.floor(performance.now() / 330) % 2;
    for (const unit of view.police || []) {
      const position = unit.car?.mesh.position || unit.pos || unit;
      this.dot(position, origin, scale, flash ? '#ff6868' : '#6dbaff');
    }
    const heli = view.heli;
    const heliPos = heli?.active === false ? null : heli?.mesh?.position || heli?.pos || heli;
    if (heliPos && Number.isFinite(heliPos.x)) {
      const point = this.point(heliPos, origin, scale);
      ctx.fillStyle = '#7cdaff';
      ctx.beginPath();
      ctx.moveTo(point.x, point.y - 5);
      ctx.lineTo(point.x + 5, point.y + 4);
      ctx.lineTo(point.x - 5, point.y + 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(view.heading || 0);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#15232d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 4);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', width / 2, 17);
    ctx.restore();
    if (view.districtName !== this.districtName) {
      this.districtName = view.districtName;
      view.onDistrict?.(this.districtName);
    }
  }
}
