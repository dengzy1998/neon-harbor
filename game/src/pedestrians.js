// pedestrians.js — the people of Neon Harbor. Each pedestrian is a small
// articulated figure (legs, torso, arms, head) who strolls the sidewalks and
// the boardwalk, turns at corners, flees from fast cars and nearby violence,
// and goes down when hit — then gets back up and walks it off.

import * as THREE from 'three';
import { ROAD_LINES, ROAD_HALF, PROMENADE_Z } from './config.js';
import { collideCircle } from './city.js';

const WALK_OFF = ROAD_HALF + 2.1; // sidewalk strolling offset from a road line
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const SHIRTS = [0xef6461, 0x4cc9f0, 0xffd166, 0x8ac926, 0xf4f1de, 0x9b5de5, 0xff9f1c, 0x2ec4b6, 0xffffff];
const PANTS = [0x2b2d42, 0x4a4e69, 0x6c757d, 0x22252a, 0x7f5539];

class Pedestrian {
  constructor(scene, rng) {
    this.rng = rng;
    const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRTS) });
    const pants = new THREE.MeshLambertMaterial({ color: rng.pick(PANTS) });
    const skin = new THREE.MeshLambertMaterial({ color: rng.pick(SKIN) });
    const g = new THREE.Group();
    const mk = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
    };
    this.legL = mk(new THREE.BoxGeometry(0.16, 0.78, 0.18), pants, -0.11, 0.39, 0);
    this.legR = mk(new THREE.BoxGeometry(0.16, 0.78, 0.18), pants, 0.11, 0.39, 0);
    this.legL.geometry.translate(0, -0.3, 0); this.legR.geometry = this.legL.geometry;
    this.legL.position.y = 0.72; this.legR.position.y = 0.72;
    mk(new THREE.BoxGeometry(0.44, 0.62, 0.24), shirt, 0, 1.06, 0);
    this.armL = mk(new THREE.BoxGeometry(0.11, 0.6, 0.13), shirt, -0.29, 1.06, 0);
    this.armR = mk(new THREE.BoxGeometry(0.11, 0.6, 0.13), shirt, 0.29, 1.06, 0);
    this.armL.geometry = this.armL.geometry.clone(); this.armL.geometry.translate(0, -0.22, 0);
    this.armR.geometry = this.armL.geometry;
    this.armL.position.y = 1.3; this.armR.position.y = 1.3;
    mk(new THREE.SphereGeometry(0.16, 10, 8), skin, 0, 1.56, 0);
    this.group = g;
    scene.add(g);

    this.state = 'walk'; // walk | flee | down
    this.downTimer = 0;
    this.fleeTimer = 0;
    this.phase = rng.range(0, 6);
    this.speed = rng.range(1.4, 2.4);
    this.placeRandom(null);
  }

  get pos() { return this.group.position; }

  placeRandom(nearPos) {
    const rng = this.rng;
    this.axis = rng.chance(0.62) ? 'x' : 'z';
    if (rng.chance(0.22)) { // boardwalk stroller
      this.axis = 'x';
      this.fixed = PROMENADE_Z + 6;
      this.boardwalk = true;
    } else {
      this.boardwalk = false;
      const line = rng.pick(ROAD_LINES);
      this.fixed = line + (rng.chance(0.5) ? WALK_OFF : -WALK_OFF);
    }
    this.dir = rng.chance(0.5) ? 1 : -1;
    this.along = nearPos
      ? (this.axis === 'x' ? nearPos.x : nearPos.z) + rng.range(-70, 70)
      : rng.range(-170, 170);
    this.applyPosition(0);
  }

  applyPosition(t) {
    if (this.axis === 'x') { this.pos.x = this.along; this.pos.z = this.fixed; }
    else { this.pos.x = this.fixed; this.pos.z = this.along; }
    this.group.rotation.y = this.axis === 'x'
      ? (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (this.dir > 0 ? 0 : Math.PI);
    const stride = this.state === 'flee' ? 11 : 7;
    const swing = Math.sin(t * stride + this.phase) * (this.state === 'down' ? 0 : 0.5);
    this.legL.rotation.x = swing; this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.7; this.armR.rotation.x = swing * 0.7;
  }

  knockDown() {
    if (this.state === 'down') return;
    this.state = 'down';
    this.downTimer = 5;
    this.group.rotation.x = -Math.PI / 2;
    this.group.position.y = 0.25;
  }

  update(dt, t, ctx) {
    if (this.state === 'down') {
      this.downTimer -= dt;
      if (this.downTimer <= 0) {
        this.state = 'walk';
        this.group.rotation.x = 0;
        this.group.position.y = 0;
      }
      return;
    }
    // Threat scan: a fast car close by, or a scare event still fresh.
    let threat = null;
    for (const car of ctx.cars) {
      if (Math.abs(car.speed) < 5) continue;
      const d = this.pos.distanceTo(car.pos);
      if (d < 9) { threat = car.pos; break; }
    }
    if (!threat) {
      for (const s of ctx.scares) {
        if (Math.hypot(s.x - this.pos.x, s.z - this.pos.z) < 15) { threat = s; break; }
      }
    }
    if (threat && this.state !== 'flee') { this.state = 'flee'; this.fleeTimer = 1.6; }
    if (this.state === 'flee') {
      this.fleeTimer -= dt;
      // Run directly away from the threat, off the road if possible.
      const dx = this.pos.x - threat.x, dz = this.pos.z - threat.z;
      const len = Math.hypot(dx, dz) || 1;
      this.pos.x += (dx / len) * 5.2 * dt;
      this.pos.z += (dz / len) * 5.2 * dt;
      collideCircle(ctx.colliders, this.pos, 0.5);
      this.group.rotation.y = Math.atan2(dx, dz);
      this.along = this.axis === 'x' ? this.pos.x : this.pos.z;
      this.fixed = this.axis === 'x' ? this.pos.z : this.pos.x;
      const stride = Math.sin(t * 11 + this.phase) * 0.6;
      this.legL.rotation.x = stride; this.legR.rotation.x = -stride;
      if (this.fleeTimer <= 0) {
        this.state = 'walk';
        // Rejoin the nearest sensible walk line.
        this.axis = Math.abs(this.fixed) > Math.abs(this.along) ? 'z' : 'x';
        if (!this.boardwalk) {
          const lines = ROAD_LINES.map((l) => [l + WALK_OFF, l - WALK_OFF]).flat();
          const target = this.axis === 'x' ? this.pos.z : this.pos.x;
          this.fixed = lines.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a), lines[0]);
        }
      }
      return;
    }
    // Plain strolling along the current walk line.
    this.along += this.dir * this.speed * dt;
    if (Math.abs(this.along) > 182) this.dir *= -1;
    // Occasionally turn at a junction onto the crossing sidewalk.
    for (const line of ROAD_LINES) {
      const crossAt = line + (this.rng.chance(0.5) ? WALK_OFF : -WALK_OFF);
      if (Math.abs(this.along - line) < 0.4 && this.rng.chance(0.006)) {
        const oldFixed = this.fixed;
        this.axis = this.axis === 'x' ? 'z' : 'x';
        this.fixed = crossAt;
        this.along = oldFixed;
        this.dir = this.rng.chance(0.5) ? 1 : -1;
        break;
      }
    }
    this.applyPosition(t);
    if (this.pos.distanceTo(ctx.playerPos) > 240) this.placeRandom(ctx.playerPos);
  }
}

export class Pedestrians {
  constructor(scene, rng) {
    this.peds = [];
    for (let i = 0; i < 26; i++) this.peds.push(new Pedestrian(scene, rng));
  }

  update(dt, t, ctx) {
    for (const p of this.peds) p.update(dt, t, ctx);
  }

  // Nearest standing pedestrian within `range` of a point (for punching).
  nearestStanding(pos, range) {
    let best = null, bestD = range;
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const d = p.pos.distanceTo(pos);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
}
