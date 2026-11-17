// The Neon Harbor Police Department: a wanted level that answers crimes, squad cars
// that hunt the player down, shots at three stars and up, and the slow blue hand of
// the BUSTED meter when a chase ends at walking pace.

import * as THREE from 'three';
import { TUNING, PLACES } from './config.js';
import { streetCentres } from './city.js';
import { makeCar, stepCar } from './vehicles.js';
import { CAR_MODELS } from './config.js';

const CRIME_POINTS = {
  steal: 55,     // taking a car that is not yours
  pedCar: 75,    // running a walker down
  pedPunch: 45,  // laying a walker out by hand
  carHit: 22,    // a solid hit on another car
  package: 25,   // lifting the docks package
  hotCar: 165,   // the gold Komodo: three stars on the spot
  checkpoint: 10,
};

const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 });

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class PoliceSystem {
  /** events: { onBusted(), onPlayerShot(damage) } */
  constructor(scene, rng, colliders, events) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.events = events;
    this.heat = 0;            // points; 50 points make a star
    this.stars = 0;
    this.units = [];
    this.lastSeen = 99;       // seconds since a unit last had eyes on the player
    this.bust = 0;            // 0..1
    this.tracers = [];
    this.flashT = 0;
    this.model = CAR_MODELS[0];
  }

  addCrime(kind, _x, _z) {
    const pts = CRIME_POINTS[kind] ?? 10;
    this.heat = Math.min(260, this.heat + pts);
    this.stars = Math.max(this.stars, Math.min(5, Math.floor(this.heat / 50) + (this.heat >= 15 ? 1 : 0)));
    if (this.heat >= 15 && this.stars === 0) this.stars = 1;
    this.lastSeen = 0;
  }

  setWanted(stars) {
    this.stars = Math.max(this.stars, stars);
    this.heat = Math.max(this.heat, stars * 50);
    this.lastSeen = 0;
  }

  clearWanted() {
    this.heat = 0;
    this.stars = 0;
    this.bust = 0;
    for (const u of this.units) this.scene.remove(u.mesh);
    this.units = [];
  }

  desiredUnits() {
    if (this.stars === 0) return 0;
    return Math.min(8, Math.max(1, Math.round(this.stars * TUNING.policePerStar)));
  }

  spawnUnit(playerPos) {
    // Come from a street a good run away, never from thin air at the player's elbow.
    for (let tries = 0; tries < 12; tries++) {
      const vertical = this.rng.chance(0.5);
      const street = this.rng.pick(streetCentres);
      const along = playerPos[vertical ? 'z' : 'x'] + this.rng.pick([-1, 1]) * this.rng.range(55, 85);
      const x = vertical ? street : along;
      const z = vertical ? along : street;
      if (Math.hypot(x - playerPos.x, z - playerPos.z) < 45) continue;
      const car = makeCar(this.scene, this.model, 0xf2f4f6, x, z, this.rng.range(0, 6.28), { police: true });
      car.driver = 'police';
      car.cruiseSpeed = 15;
      car.stuckT = 0;
      car.shotT = this.rng.range(0.4, 1.2);
      this.units.push(car);
      return;
    }
  }

  driveUnit(unit, dt, target, targetSpeed) {
    const p = unit.mesh.position;
    const dx = target.x - p.x, dz = target.z - p.z;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    const diff = angleDiff(want, unit.heading);
    const steer = Math.max(-1, Math.min(1, diff * 1.5));
    let throttle = 0, brake = false;
    if (dist > 16) throttle = 1;
    else if (dist > 7) throttle = 0.55;
    else if (dist > 3.4) throttle = targetSpeed > 2 ? 0.3 : 0;
    else { throttle = unit.speed > 1 ? -0.8 : 0; brake = unit.speed > 1; }
    if (Math.abs(diff) > 2.4 && dist < 12) throttle = -0.6; // turn around when overshot
    const topChase = 17 + this.stars * 2.4;
    if (unit.speed > topChase) throttle = Math.min(throttle, 0);
    stepCar(unit, { throttle, steer, brake, handbrake: false }, dt, this.colliders);
    // Stuck on a wall? The dispatcher quietly reroutes the unit.
    if (Math.abs(unit.speed) < 0.8 && throttle > 0.4) {
      unit.stuckT += dt;
      if (unit.stuckT > 2.2) {
        unit.stuckT = 0;
        const street = this.rng.pick(streetCentres);
        unit.mesh.position.set(street, 0, target.z + this.rng.pick([-1, 1]) * 48);
        unit.speed = 0;
      }
    } else unit.stuckT = 0;
    return dist;
  }

  fireTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, 1.15, from.z),
      new THREE.Vector3(to.x + this.rng.range(-0.7, 0.7), 1 + this.rng.range(-0.3, 0.5), to.z + this.rng.range(-0.7, 0.7)),
    ]);
    const line = new THREE.Line(geo, tracerMat);
    line.userData.life = 0.07;
    this.scene.add(line);
    this.tracers.push(line);
  }

  /**
   * player: { pos: Vector3-like, speed: number, inCar: bool }
   * Returns { nearest: number } — distance to the closest unit, for the siren.
   */
  update(dt, player) {
    const p = player.pos;
    // Heat cools only while nobody is watching.
    let nearest = Infinity;
    for (const u of this.units) {
      const d = Math.hypot(u.mesh.position.x - p.x, u.mesh.position.z - p.z);
      if (d < nearest) nearest = d;
    }
    const seen = nearest < 58;
    if (seen) this.lastSeen = 0; else this.lastSeen += dt;
    if (this.lastSeen > TUNING.wantedDecaySeconds && this.heat > 0) {
      this.heat = Math.max(0, this.heat - 7 * dt);
      this.stars = this.heat >= 65 ? Math.min(5, Math.floor(this.heat / 50) + 1) : (this.heat >= 15 ? 1 : 0);
      if (this.heat < 15) this.stars = 0;
    }

    const want = this.desiredUnits();
    while (this.units.length < want) this.spawnUnit(p);
    while (this.units.length > want) {
      const u = this.units.pop();
      this.scene.remove(u.mesh);
    }

    let busting = false;
    for (const u of this.units) {
      const dist = this.driveUnit(u, dt, p, player.speed);
      if (dist < 11 && player.speed < 1.6) busting = true;
      // Gunfire at three stars and up.
      if (this.stars >= 3 && dist < 36) {
        u.shotT -= dt;
        if (u.shotT <= 0) {
          u.shotT = this.rng.range(0.55, 1.15);
          this.fireTracer(u.mesh.position, p);
          if (this.rng.chance(0.5)) this.events.onPlayerShot(this.rng.range(3, 7));
        }
      }
    }
    if (busting && this.stars > 0) {
      this.bust += dt / TUNING.bustSeconds;
      if (this.bust >= 1) {
        this.bust = 0;
        this.events.onBusted();
      }
    } else {
      this.bust = Math.max(0, this.bust - dt * 0.7);
    }

    // Light bars strobe.
    this.flashT += dt * 9;
    const phase = Math.sin(this.flashT) > 0;
    for (const u of this.units) {
      const bar = u.mesh.userData.lightbar;
      if (!bar) continue;
      bar.redMat.color.setHex(phase ? 0xff2d20 : 0x57120d);
      bar.blueMat.color.setHex(phase ? 0x123a75 : 0x2d7bff);
    }
    // Tracers fade.
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.userData.life -= dt;
      if (t.userData.life <= 0) {
        this.scene.remove(t);
        t.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }
    return { nearest };
  }
}

export { PLACES };
