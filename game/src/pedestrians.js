// Pedestrians: the Harbor's walkers. They stroll the pavements on rails of their own,
// scatter when a fast car or a swinging fist comes close, and go down when hit —
// which the police notice, so the system reports every fall to its crime callback.

import * as THREE from 'three';
import { CITY } from './config.js';
import { streetCentres, resolveCollisions } from './city.js';

const SHIRTS = [0xffd23d, 0x47c2ff, 0xff5e8a, 0x7be495, 0xf2f4f6, 0xff8c42, 0xb18cff, 0x37b06f];
const PANTS = [0x2c3e50, 0x6b4f2e, 0x546e7a, 0x833471, 0x222f3e];
const SKIN = [0xf2c79b, 0xc68863, 0x8d5524, 0xffdbac, 0x6f4a2f];

const legGeo = new THREE.BoxGeometry(0.17, 0.78, 0.2);
legGeo.translate(0, -0.39, 0);
const torsoGeo = new THREE.BoxGeometry(0.52, 0.72, 0.3);
const armGeo = new THREE.BoxGeometry(0.13, 0.66, 0.16);
armGeo.translate(0, -0.3, 0);
const headGeo = new THREE.BoxGeometry(0.3, 0.34, 0.3);

function makeFigure(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: rng.pick(PANTS) });
  const skin = new THREE.MeshLambertMaterial({ color: rng.pick(SKIN) });
  const legL = new THREE.Mesh(legGeo, pants); legL.position.set(-0.13, 0.78, 0);
  const legR = new THREE.Mesh(legGeo, pants); legR.position.set(0.13, 0.78, 0);
  const torso = new THREE.Mesh(torsoGeo, shirt); torso.position.y = 1.14;
  const armL = new THREE.Mesh(armGeo, shirt); armL.position.set(-0.34, 1.44, 0);
  const armR = new THREE.Mesh(armGeo, shirt); armR.position.set(0.34, 1.44, 0);
  const head = new THREE.Mesh(headGeo, skin); head.position.y = 1.72;
  g.add(legL, legR, torso, armL, armR, head);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export class PedestrianSystem {
  /** onDown(ped, cause) fires when a walker is knocked down: cause 'car' | 'punch'. */
  constructor(scene, rng, colliders, onDown) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.onDown = onDown;
    this.peds = [];
  }

  spawn(count) {
    for (let i = 0; i < count; i++) {
      const mesh = makeFigure(this.rng);
      this.scene.add(mesh);
      const ped = {
        mesh,
        axis: this.rng.chance(0.5) ? 'x' : 'z',
        dir: this.rng.chance(0.5) ? 1 : -1,
        street: this.rng.pick(streetCentres),
        side: this.rng.chance(0.5) ? 1 : -1,
        along: this.rng.range(-CITY.half, CITY.half),
        speed: this.rng.range(1.1, 1.9),
        phase: this.rng.range(0, 6),
        mode: 'walk',         // walk | flee | down
        fleeT: 0, downT: 0, fleeDir: { x: 0, z: 0 },
        heading: 0,
      };
      this.place(ped);
      this.peds.push(ped);
    }
  }

  lateral(ped) {
    return ped.street + ped.side * (CITY.roadWidth / 2 + 2.1);
  }

  place(ped) {
    const lat = this.lateral(ped);
    if (ped.axis === 'z') ped.mesh.position.set(lat, 0, ped.along);
    else ped.mesh.position.set(ped.along, 0, lat);
    ped.heading = ped.axis === 'z' ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    ped.mesh.rotation.set(0, ped.heading, 0);
  }

  knockDown(ped, cause) {
    if (ped.mode === 'down') return;
    ped.mode = 'down';
    ped.downT = this.rng.range(3.5, 6.5);
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.25;
    this.onDown(ped, cause);
  }

  checkThreats(ped, threats) {
    const p = ped.mesh.position;
    for (const t of threats) {
      const dx = p.x - t.x, dz = p.z - t.z;
      const d2 = dx * dx + dz * dz;
      if (t.kind === 'car' && t.speed > 6 && d2 < 130) {
        ped.mode = 'flee';
        ped.fleeT = this.rng.range(1.4, 2.4);
        const d = Math.sqrt(d2) || 1;
        ped.fleeDir = { x: dx / d, z: dz / d };
        return;
      }
      if (t.kind === 'punch' && d2 < 30) {
        ped.mode = 'flee';
        ped.fleeT = this.rng.range(1.2, 2);
        const d = Math.sqrt(d2) || 1;
        ped.fleeDir = { x: dx / d, z: dz / d };
        return;
      }
    }
  }

  update(dt, threats, cars) {
    for (const ped of this.peds) {
      const p = ped.mesh.position;
      if (ped.mode === 'down') {
        ped.downT -= dt;
        if (ped.downT <= 0) {
          ped.mode = 'walk';
          ped.mesh.rotation.x = 0;
          ped.mesh.position.y = 0;
          this.place(ped);
        }
        continue;
      }
      // Run over? A moving car whose circle reaches the walker knocks them down.
      let hitByCar = false;
      for (const car of cars) {
        if (Math.abs(car.speed) < 2.5) continue;
        const dx = p.x - car.mesh.position.x, dz = p.z - car.mesh.position.z;
        if (dx * dx + dz * dz < 5.3) { hitByCar = true; break; }
      }
      if (hitByCar) { this.knockDown(ped, 'car'); continue; }

      this.checkThreats(ped, threats);
      let vx = 0, vz = 0, speedNow = ped.speed;
      if (ped.mode === 'flee') {
        ped.fleeT -= dt;
        if (ped.fleeT <= 0) { ped.mode = 'walk'; this.place(ped); continue; }
        speedNow = 5.2;
        vx = ped.fleeDir.x * speedNow;
        vz = ped.fleeDir.z * speedNow;
        ped.heading = Math.atan2(vx, vz);
      } else {
        // Stroll the rail; at an intersection, sometimes cross to another pavement.
        ped.along += ped.dir * ped.speed * dt;
        if (Math.abs(ped.along) > CITY.half + 26) ped.dir *= -1;
        for (const s of streetCentres) {
          if (Math.abs(ped.along - s) < 0.4 && this.rng.chance(0.012)) {
            ped.axis = ped.axis === 'z' ? 'x' : 'z';
            const crossStreet = ped.street;
            ped.street = s;
            ped.along = crossStreet + ped.side * (CITY.roadWidth / 2 + 2.1) * (ped.axis === 'x' ? 1 : 1);
            ped.side = this.rng.chance(0.5) ? 1 : -1;
            break;
          }
        }
        const lat = this.lateral(ped);
        if (ped.axis === 'z') { p.x += (lat - p.x) * Math.min(1, dt * 4); p.z = ped.along; }
        else { p.z += (lat - p.z) * Math.min(1, dt * 4); p.x = ped.along; }
        ped.heading = ped.axis === 'z' ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        vx = Math.sin(ped.heading) * ped.speed;
        vz = Math.cos(ped.heading) * ped.speed;
      }
      if (ped.mode === 'flee') {
        p.x += vx * dt;
        p.z += vz * dt;
        resolveCollisions(p, 0.4, this.colliders);
      }
      ped.mesh.rotation.y = ped.heading;
      // A simple two-beat stride.
      const swing = Math.sin(performance.now() * 0.001 * (4 + speedNow * 2.4) + ped.phase) * (0.25 + speedNow * 0.09);
      const u = ped.mesh.userData;
      u.legL.rotation.x = swing;
      u.legR.rotation.x = -swing;
      u.armL.rotation.x = -swing * 0.8;
      u.armR.rotation.x = swing * 0.8;
    }
  }
}
