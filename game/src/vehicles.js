// vehicles.js — the car factory and the driving model. Every car in Neon
// Harbor, parked, traffic, police or player-driven, is a Car built here from
// boxes and cylinders: a body, a cabin, spinning wheels, lights, and for the
// police a flashing light bar. driveStep() is the arcade physics the player
// feels; move() integrates a car and resolves building collisions.

import * as THREE from 'three';
import { CAR, ROAD_LINES, ROAD_HALF } from './config.js';
import { collideCircle } from './city.js';

export const CAR_TYPES = {
  compact: { name: 'Brisa Compact', topSpeed: 24, accel: 13, length: 3.8, width: 1.8, height: 0.62, cabin: 0.5 },
  sedan: { name: 'Vantara S', topSpeed: 27, accel: 14, length: 4.4, width: 1.9, height: 0.58, cabin: 0.5 },
  wagon: { name: 'Solace Wagon', topSpeed: 23, accel: 12, length: 4.5, width: 1.95, height: 0.85, cabin: 0.62 },
  pickup: { name: 'Hauler Pickup', topSpeed: 25, accel: 13, length: 4.6, width: 2.0, height: 0.72, cabin: 0.55 },
  sport: { name: 'Komodo GT', topSpeed: 36, accel: 19, length: 4.3, width: 1.95, height: 0.45, cabin: 0.38 },
};
export const CAR_COLORS = [0xef6461, 0x4cc9f0, 0xffd166, 0x8ac926, 0xf4f1de, 0x9b5de5, 0xff9f1c, 0x6c757d, 0x2ec4b6];

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x17181c });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1d2b38 });
const lightMat = new THREE.MeshLambertMaterial({ color: 0x444444, emissive: 0xfff3b0 });
const tailMat = new THREE.MeshLambertMaterial({ color: 0x330000, emissive: 0xd90429 });

export class Car {
  constructor(typeKey, color, opts = {}) {
    this.type = CAR_TYPES[typeKey];
    this.typeKey = typeKey;
    this.name = this.type.name;
    this.topSpeed = this.type.topSpeed;
    this.accelRate = this.type.accel;
    this.heading = opts.heading ?? 0;
    this.speed = 0;
    this.steer = 0;
    this.radius = CAR.radius;
    this.parked = !!opts.parked;
    this.isPolice = !!opts.police;
    this.stolen = false;
    this.wheels = [];
    this.lightbar = null;

    const t = this.type;
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(t.width, t.height, t.length), bodyMat);
    body.position.y = 0.38 + t.height / 2;
    body.castShadow = true;
    group.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(t.width - 0.25, t.cabin, t.length * 0.48), glassMat);
    cabin.position.set(0, 0.38 + t.height + t.cabin / 2 - 0.04, typeKey === 'wagon' ? 0.1 : -0.25);
    cabin.castShadow = true;
    group.add(cabin);
    if (typeKey === 'sport') {
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(t.width - 0.1, 0.08, 0.4), bodyMat);
      spoiler.position.set(0, 1.05, -t.length / 2 + 0.3);
      group.add(spoiler);
    }
    if (typeKey === 'pickup') {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(t.width - 0.15, 0.3, 1.6), new THREE.MeshLambertMaterial({ color: 0x22252a }));
      bed.position.set(0, 0.95, -t.length / 2 + 0.95);
      group.add(bed);
    }
    for (const [wx, wz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx * (t.width / 2 - 0.05), 0.36, wz * (t.length / 2 - 0.85));
      group.add(wheel);
      this.wheels.push({ mesh: wheel, front: wz > 0 });
    }
    for (const s of [-1, 1]) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), lightMat);
      head.position.set(s * (t.width / 2 - 0.3), 0.72, t.length / 2 + 0.01);
      group.add(head);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.06), tailMat);
      tail.position.set(s * (t.width / 2 - 0.3), 0.74, -t.length / 2 - 0.01);
      group.add(tail);
    }
    if (this.isPolice) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(t.width + 0.02, 0.22, t.length * 0.5),
        new THREE.MeshLambertMaterial({ color: 0x1d4ed8 }));
      stripe.position.set(0, 0.62, 0);
      group.add(stripe);
      const bar = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.09, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
      bar.add(base);
      const red = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.34),
        new THREE.MeshLambertMaterial({ color: 0x550000, emissive: 0xff2233 }));
      red.position.set(-0.3, 0.12, 0); bar.add(red);
      const blue = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.34),
        new THREE.MeshLambertMaterial({ color: 0x000055, emissive: 0x2266ff }));
      blue.position.set(0.3, 0.12, 0); bar.add(blue);
      bar.position.set(0, 0.38 + t.height + t.cabin + 0.08, -0.25);
      group.add(bar);
      this.lightbar = { red, blue };
    }
    group.position.set(opts.x ?? 0, 0, opts.z ?? 0);
    this.mesh = group;
    this.syncMesh();
  }

  get pos() { return this.mesh.position; }

  forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }

  syncMesh() {
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.12;
    for (const w of this.wheels) {
      w.mesh.rotation.x += spin * 0.16;
      if (w.front) w.mesh.rotation.y = this.steer * 0.45;
    }
  }

  flashLights(t) {
    if (!this.lightbar) return;
    const phase = Math.floor(t * 5) % 2 === 0;
    this.lightbar.red.material.emissiveIntensity = phase ? 2.4 : 0.15;
    this.lightbar.blue.material.emissiveIntensity = phase ? 0.15 : 2.4;
  }

  // Integrate one step; resolves building collisions. Returns the impact
  // speed when the car struck a building hard, else 0.
  move(dt, colliders) {
    const f = this.forward();
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    let impact = 0;
    if (collideCircle(colliders, this.pos, this.radius)) {
      if (Math.abs(this.speed) > 6) impact = Math.abs(this.speed);
      this.speed *= Math.abs(this.speed) > 6 ? -0.22 : 0.3;
    }
    // Keep cars inside the world and out of the sea.
    this.pos.x = Math.max(-196, Math.min(196, this.pos.x));
    this.pos.z = Math.max(-196, Math.min(202, this.pos.z));
    this.syncMesh();
    return impact;
  }
}

export function createCar(scene, typeKey, color, x, z, heading, opts = {}) {
  const car = new Car(typeKey, color, { x, z, heading, ...opts });
  scene.add(car.mesh);
  return car;
}

// Arcade driving for the player's car. input: {throttle -1..1, steer -1..1,
// handbrake bool}. Returns nothing; read car.speed for the speedometer.
export function driveStep(car, dt, input) {
  const boost = input.boost ? 1.25 : 1;
  if (input.throttle > 0) {
    car.speed += car.accelRate * boost * dt * (car.speed < 0 ? 2.4 : 1);
  } else if (input.throttle < 0) {
    car.speed -= (car.speed > 0.5 ? CAR.brake : car.accelRate * 0.7) * dt;
  }
  car.speed -= car.speed * CAR.drag * dt * (input.handbrake ? 2.2 : 1);
  if (!input.throttle && Math.abs(car.speed) < 0.25) car.speed = 0;
  const top = car.topSpeed * boost;
  car.speed = Math.max(-CAR.maxReverse, Math.min(top, car.speed));
  const steerTarget = input.steer * (input.handbrake ? 1.35 : 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 7);
  const grip = Math.min(1, Math.abs(car.speed) / 7);
  car.heading -= car.steer * grip * dt * 1.55 * (car.speed < 0 ? -1 : 1);
}

// Circle collision between two cars: separates them and trades a little
// speed. Returns the closing impact speed (0 when they barely touched).
export function collideCars(a, b) {
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
  const dist = Math.hypot(dx, dz), min = a.radius + b.radius - 0.3;
  if (dist === 0 || dist >= min) return 0;
  const push = (min - dist) / 2, nx = dx / dist, nz = dz / dist;
  a.pos.x -= nx * push; a.pos.z -= nz * push;
  b.pos.x += nx * push; b.pos.z += nz * push;
  const rel = Math.abs(a.speed - b.speed);
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg * 0.82; b.speed = avg * 0.82;
  a.syncMesh(); b.syncMesh();
  return rel > 5 ? rel : 0;
}

// A spread of parked cars along the kerbs and on the waterfront lots, ready
// to be stolen. Deterministic for a given rng.
export function spawnParkedCars(scene, rng) {
  const cars = [];
  const keys = Object.keys(CAR_TYPES);
  for (let i = 0; i < 17; i++) {
    const alongX = rng.chance(0.5);
    const line = rng.pick(ROAD_LINES);
    let along = rng.range(-168, 168);
    for (const cross of ROAD_LINES) if (Math.abs(along - cross) < 13) along += 20;
    const side = rng.chance(0.5) ? 1 : -1;
    const off = (ROAD_HALF - 1.7) * side;
    const x = alongX ? along : line + off;
    const z = alongX ? line + off : along;
    const heading = alongX ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? Math.PI : 0);
    cars.push(createCar(scene, rng.pick(keys), rng.pick(CAR_COLORS), x, z, heading, { parked: true }));
  }
  // Waterfront extras: one at the docks, two by the marina, one at the garage.
  cars.push(createCar(scene, 'pickup', 0x2ec4b6, -108, 192, Math.PI / 2, { parked: true }));
  cars.push(createCar(scene, 'sedan', 0xf4f1de, 96, 181, 0, { parked: true }));
  cars.push(createCar(scene, 'compact', 0xef6461, 122, 181, 0, { parked: true }));
  cars.push(createCar(scene, 'wagon', 0x6c757d, 148, 108, -Math.PI / 2, { parked: true }));
  return cars;
}
