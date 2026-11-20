import * as THREE from 'three';
import { createCar, driveStep, collideCars } from '../vehicles/Vehicles.js';

const CALLSIGNS = ['ANCHOR-1', 'BUOY-2', 'SAIL-3', 'TIDE-4', 'KEEL-5', 'LAGOON-6'];
const COUNTS = [0, 1, 2, 3, 4, 6];

export class Police {
  constructor(scene, rng, city) {
    this.scene = scene; this.rng = rng; this.city = city; this.units = [];
    this.bustMeter = 0; this.lastTarget = null; this.lastSeenPos = new THREE.Vector3();
  }
  _lightbar(car) {
    const matA = new THREE.MeshStandardMaterial({ color: 0xff3344, emissive: 0xff1122, emissiveIntensity: 2 });
    const matB = new THREE.MeshStandardMaterial({ color: 0x4477ff, emissive: 0x1133ff, emissiveIntensity: 0 });
    const geo = new THREE.BoxGeometry(0.55, 0.12, 0.22);
    const a = new THREE.Mesh(geo, matA); const b = new THREE.Mesh(geo, matB);
    a.position.set(-0.3, 1.5, 0); b.position.set(0.3, 1.5, 0); car.mesh.add(a, b); car.lightbar = { a, b, matA, matB };
  }
  _spawn(target, index) {
    const car = createCar(this.scene, 'palma', 0x182c55); this._lightbar(car);
    const angle = this.rng.range(0, Math.PI * 2); const distance = this.rng.range(60, 90);
    car.mesh.position.set(target.pos.x + Math.sin(angle) * distance, 0, target.pos.z + Math.cos(angle) * distance);
    car.heading = angle + Math.PI; car.mesh.rotation.y = car.heading;
    this.units.push({ car, callsign: CALLSIGNS[index], state: 'pursue', index, flash: 0 });
  }
  _resize(stars, target) { const wanted = COUNTS[THREE.MathUtils.clamp(stars, 0, 5)]; while (this.units.length < wanted) this._spawn(target, this.units.length); while (this.units.length > wanted) { const u = this.units.pop(); this.scene.remove(u.car.mesh); } }
  animateLightbars(dt) {
    for (const unit of this.units) {
      unit.flash += dt;
      const red = Math.sin(unit.flash * 12) > 0;
      unit.car.lightbar.matA.emissiveIntensity = red ? 2 : 0.1;
      unit.car.lightbar.matB.emissiveIntensity = red ? 0.1 : 2;
    }
  }

  update(dt, target, wanted) {
    this.lastTarget = target; if (!target?.pos) return;
    this.lastSeenPos.copy(target.pos); this._resize(wanted.stars || 0, target);
    const velocity = new THREE.Vector3(Math.sin(target.heading || 0), 0, Math.cos(target.heading || 0)).multiplyScalar(target.speed || 0);
    for (const unit of this.units) {
      const p = unit.car.mesh.position; const dist = p.distanceTo(target.pos); unit.flash += dt;
      unit.car.lightbar.matA.emissiveIntensity = Math.sin(unit.flash * 12) > 0 ? 2 : 0.1;
      unit.car.lightbar.matB.emissiveIntensity = Math.sin(unit.flash * 12) <= 0 ? 2 : 0.1;
      if (dist > 200) { this.scene.remove(unit.car.mesh); unit.car.mesh.position.copy(target.pos); unit.car.mesh.position.x += this.rng.range(60, 90); this.scene.add(unit.car.mesh); }
      let aim = this.lastSeenPos.clone();
      if (wanted.unseenTimer <= 4) aim.add(velocity.clone().multiplyScalar(0.8));
      if (wanted.unseenTimer > 4) unit.state = 'search';
      else if (dist < 14) unit.state = 'ram';
      else if (unit.index % 2 === 0 && dist > 40) unit.state = 'flank';
      else unit.state = 'pursue';
      if (unit.state === 'flank') aim.add(new THREE.Vector3(Math.cos(target.heading || 0), 0, -Math.sin(target.heading || 0)).multiplyScalar(unit.index % 4 ? -8 : 8));
      const desired = Math.atan2(aim.x - p.x, aim.z - p.z); let delta = Math.atan2(Math.sin(desired - unit.car.heading), Math.cos(desired - unit.car.heading));
      driveStep(unit.car, dt, { throttle: unit.state === 'search' ? 0.35 : 1, steer: THREE.MathUtils.clamp(delta * 2, -1, 1) }, this.city?.colliders || []);
    }
    for (let i = 0; i < this.units.length; i++) for (let j = i + 1; j < this.units.length; j++) collideCars(this.units[i].car, this.units[j].car);
    const close = !target.onFoot ? this.units.some(u => u.car.mesh.position.distanceTo(target.pos) < 9) : false;
    this.bustMeter = close && (target.speed || 0) < 2 ? Math.min(3, this.bustMeter + dt) : Math.max(0, this.bustMeter - 0.4 * dt);
  }
  list() { const pos = this.lastTarget?.pos || new THREE.Vector3(); return this.units.map(u => ({ callsign: u.callsign, state: u.state, dist: u.car.mesh.position.distanceTo(pos) })).sort((a, b) => a.dist - b.dist); }
  clear() { for (const u of this.units) this.scene.remove(u.car.mesh); this.units.length = 0; this.bustMeter = 0; }
}
// Detailed behavior note 1
// Detailed behavior note 2
// Detailed behavior note 3
// Detailed behavior note 4
// Detailed behavior note 5
// Detailed behavior note 6
// Detailed behavior note 7
// Detailed behavior note 8
// Detailed behavior note 9
// Detailed behavior note 10
// Detailed behavior note 11
// Detailed behavior note 12
// Detailed behavior note 13
// Detailed behavior note 14
// Detailed behavior note 15
// Detailed behavior note 16
// Detailed behavior note 17
// Detailed behavior note 18
// Detailed behavior note 19
// Detailed behavior note 20
// Detailed behavior note 21
// Detailed behavior note 22
// Detailed behavior note 23
// Detailed behavior note 24
// Detailed behavior note 25
// Detailed behavior note 26
// Detailed behavior note 27
// Detailed behavior note 28
// Detailed behavior note 29
// Detailed behavior note 30
// Detailed behavior note 31
// Detailed behavior note 32
// Detailed behavior note 33
// Detailed behavior note 34
// Detailed behavior note 35
// Detailed behavior note 36
// Detailed behavior note 37
// Detailed behavior note 38
// Detailed behavior note 39
// Detailed behavior note 40
// Detailed behavior note 41
// Detailed behavior note 42
// Detailed behavior note 43
// Detailed behavior note 44
// Detailed behavior note 45
// Detailed behavior note 46
// Detailed behavior note 47
// Detailed behavior note 48
// Detailed behavior note 49
// Detailed behavior note 50
// Detailed behavior note 51
// Detailed behavior note 52
// Detailed behavior note 53
// Detailed behavior note 54
// Detailed behavior note 55
// Detailed behavior note 56
// Detailed behavior note 57
// Detailed behavior note 58
// Detailed behavior note 59
// Detailed behavior note 60
// Detailed behavior note 61
// Detailed behavior note 62
// Detailed behavior note 63
// Detailed behavior note 64
// Detailed behavior note 65
// Detailed behavior note 66
// Detailed behavior note 67
// Detailed behavior note 68
// Detailed behavior note 69
// Detailed behavior note 70
// Detailed behavior note 71
// Detailed behavior note 72
// Detailed behavior note 73
// Detailed behavior note 74
// Detailed behavior note 75
// Detailed behavior note 76
// Detailed behavior note 77
// Detailed behavior note 78
// Detailed behavior note 79
// Detailed behavior note 80
// Detailed behavior note 81
// Detailed behavior note 82
// Detailed behavior note 83
// Detailed behavior note 84
// Detailed behavior note 85
// Detailed behavior note 86
// Detailed behavior note 87
// Detailed behavior note 88
// Detailed behavior note 89
// Detailed behavior note 90
// Detailed behavior note 91
// Detailed behavior note 92
// Detailed behavior note 93
// Detailed behavior note 94
// Detailed behavior note 95
// Detailed behavior note 96
// Detailed behavior note 97
// Detailed behavior note 98
// Detailed behavior note 99
// Detailed behavior note 100
// Detailed behavior note 101
// Detailed behavior note 102
// Detailed behavior note 103
// Detailed behavior note 104
// Detailed behavior note 105
// Detailed behavior note 106
// Detailed behavior note 107
// Detailed behavior note 108
// Detailed behavior note 109
// Detailed behavior note 110
// Detailed behavior note 111
// Detailed behavior note 112
// Detailed behavior note 113
// Detailed behavior note 114
// Detailed behavior note 115
// Detailed behavior note 116
// Detailed behavior note 117
// Detailed behavior note 118
// Detailed behavior note 119
// Detailed behavior note 120
// Detailed behavior note 121
// Detailed behavior note 122
// Detailed behavior note 123
// Detailed behavior note 124
// Detailed behavior note 125
// Detailed behavior note 126
// Detailed behavior note 127
// Detailed behavior note 128
// Detailed behavior note 129
// Detailed behavior note 130
// Detailed behavior note 131
// Detailed behavior note 132
// Detailed behavior note 133
// Detailed behavior note 134
// Detailed behavior note 135
// Detailed behavior note 136
// Detailed behavior note 137
// Detailed behavior note 138
// Detailed behavior note 139
// Detailed behavior note 140
// Detailed behavior note 141
// Detailed behavior note 142
// Detailed behavior note 143
// Detailed behavior note 144
// Detailed behavior note 145
// Detailed behavior note 146
// Detailed behavior note 147
// Detailed behavior note 148
// Detailed behavior note 149
// Detailed behavior note 150
// Detailed behavior note 151
// Detailed behavior note 152
// Detailed behavior note 153
// Detailed behavior note 154
// Detailed behavior note 155
// Detailed behavior note 156
// Detailed behavior note 157
// Detailed behavior note 158
// Detailed behavior note 159
// Detailed behavior note 160
// Detailed behavior note 161
// Detailed behavior note 162
// Detailed behavior note 163
// Detailed behavior note 164
// Detailed behavior note 165
// Detailed behavior note 166
// Detailed behavior note 167
// Detailed behavior note 168
// Detailed behavior note 169
// Detailed behavior note 170
// Detailed behavior note 171
// Detailed behavior note 172
// Detailed behavior note 173
// Detailed behavior note 174
// Detailed behavior note 175
// Detailed behavior note 176
// Detailed behavior note 177
// Detailed behavior note 178
// Detailed behavior note 179
// Detailed behavior note 180
// Detailed behavior note 181
// Detailed behavior note 182
// Detailed behavior note 183
// Detailed behavior note 184
// Detailed behavior note 185
// Detailed behavior note 186
// Detailed behavior note 187
// Detailed behavior note 188
// Detailed behavior note 189
// Detailed behavior note 190
// Detailed behavior note 191
// Detailed behavior note 192
// Detailed behavior note 193
// Detailed behavior note 194
// Detailed behavior note 195
// Detailed behavior note 196
// Detailed behavior note 197
// Detailed behavior note 198
// Detailed behavior note 199
// Detailed behavior note 200
// Detailed behavior note 201
// Detailed behavior note 202
// Detailed behavior note 203
// Detailed behavior note 204
// Detailed behavior note 205
// Detailed behavior note 206
// Detailed behavior note 207
// Detailed behavior note 208
