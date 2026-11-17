// Cars: how they look and how they move. One mesh builder and one arcade physics step
// shared by the player's driving, the traffic and the police, so every car on the
// street behaves the same way.

import * as THREE from 'three';
import { resolveCollisions } from './city.js';

const glassMat = new THREE.MeshLambertMaterial({ color: 0x1d2b36 });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x14181c });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6cf });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
const trimMat = new THREE.MeshLambertMaterial({ color: 0x232a31 });

const bodyGeo = new THREE.BoxGeometry(1.92, 0.62, 4.35);
const cabinGeo = new THREE.BoxGeometry(1.7, 0.55, 2.1);
const wheelGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.3, 10);
wheelGeo.rotateZ(Math.PI / 2);
const lightGeo = new THREE.BoxGeometry(0.34, 0.14, 0.06);

export function createCarMesh(model, color, opts = {}) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(bodyGeo, paint);
  body.position.y = 0.58;
  group.add(body);
  const cabin = new THREE.Mesh(cabinGeo, opts.police ? trimMat : glassMat);
  cabin.position.set(0, 1.12, -0.25);
  group.add(cabin);
  if (opts.van) {
    cabin.scale.set(1.05, 1.5, 1.7);
    cabin.position.set(0, 1.3, -0.5);
  }
  if (opts.police) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.3, 4.4), trimMat);
    stripe.position.y = 0.52;
    group.add(stripe);
    const bar = new THREE.Group();
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff2d20 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x2d7bff });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.5), redMat);
    red.position.set(-0.32, 0, 0);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.5), blueMat);
    blue.position.set(0.32, 0, 0);
    bar.add(red); bar.add(blue);
    bar.position.set(0, 1.5, -0.25);
    group.add(bar);
    group.userData.lightbar = { redMat, blueMat };
  }
  const wheels = [];
  for (const [x, z] of [[-0.98, 1.45], [0.98, 1.45], [-0.98, -1.45], [0.98, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, tyreMat);
    w.position.set(x, 0.37, z);
    group.add(w);
    wheels.push(w);
  }
  for (const x of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(lightGeo, lightMat);
    hl.position.set(x, 0.62, 2.19);
    group.add(hl);
    const tl = new THREE.Mesh(lightGeo, tailMat);
    tl.position.set(x, 0.66, -2.19);
    group.add(tl);
  }
  group.userData.wheels = wheels;
  return group;
}

export function makeCar(scene, model, color, x, z, heading, opts = {}) {
  const mesh = createCarMesh(model, color, opts);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh,
    model,
    speed: 0,
    heading,
    radius: 2.25,
    parked: !!opts.parked,
    isPolice: !!opts.police,
    driver: null,        // null | 'ai' | 'player'
    cruiseSpeed: 0,
    // traffic rail state
    axis: 'z', dir: 1, street: 0, along: 0, mode: 'straight', turn: null,
    honkAt: 0,
  };
}

const forward = new THREE.Vector3();

/**
 * Advance one car by dt. input: {throttle -1..1, steer -1..1, brake bool, handbrake bool}.
 * Returns the impact speed (m/s of forward speed lost to a wall) for crash handling.
 */
export function stepCar(car, input, dt, colliders) {
  const m = car.model;
  if (input.throttle > 0) car.speed += m.accel * input.throttle * dt;
  else if (input.throttle < 0) {
    if (car.speed > 0.5 && !input.brake) car.speed -= m.accel * 1.4 * dt; // braking
    else car.speed += m.accel * 0.55 * input.throttle * dt;               // reverse
  }
  const drag = input.handbrake ? 2.6 : 0.55;
  car.speed -= car.speed * drag * dt * 0.35;
  if (!input.throttle && Math.abs(car.speed) < 0.25) car.speed = 0;
  car.speed = Math.max(-13, Math.min(m.topSpeed, car.speed));

  const steerAuthority = Math.max(-1, Math.min(1, car.speed / 9));
  car.heading -= input.steer * m.grip * 0.62 * steerAuthority * dt * (input.handbrake ? 1.5 : 1);

  forward.set(Math.sin(car.heading), 0, Math.cos(car.heading));
  const beforeX = car.mesh.position.x, beforeZ = car.mesh.position.z;
  car.mesh.position.addScaledVector(forward, car.speed * dt);
  const speedBefore = car.speed;
  const hit = resolveCollisions(car.mesh.position, car.radius, colliders);
  let impact = 0;
  if (hit) {
    const moved = Math.hypot(car.mesh.position.x - beforeX, car.mesh.position.z - beforeZ);
    const wanted = Math.abs(car.speed * dt);
    if (wanted - moved > 0.12) {
      impact = Math.abs(speedBefore);
      car.speed = speedBefore > 0 ? -speedBefore * 0.22 : -speedBefore * 0.2;
    }
  }
  car.mesh.position.y = 0;
  car.mesh.rotation.y = car.heading;
  // a touch of body roll and pitch sells the speed
  car.mesh.rotation.z = -input.steer * Math.min(0.05, Math.abs(car.speed) * 0.0016) * Math.sign(car.speed || 1);
  car.mesh.rotation.x = Math.max(-0.03, Math.min(0.03, (speedBefore - car.speed) * 0.002));
  const spin = (car.speed * dt) / 0.37;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  const [fl, fr] = car.mesh.userData.wheels;
  fl.rotation.y = fr.rotation.y = -input.steer * 0.42;
  return impact;
}

/** Circle-vs-circle push-apart between two cars; returns closing speed on contact. */
export function collideCars(a, b) {
  const dx = b.mesh.position.x - a.mesh.position.x;
  const dz = b.mesh.position.z - a.mesh.position.z;
  const dist = Math.hypot(dx, dz);
  const min = a.radius + b.radius - 0.35;
  if (dist === 0 || dist >= min) return 0;
  const push = (min - dist) / 2;
  const nx = dx / dist, nz = dz / dist;
  const closing = Math.abs(a.speed - b.speed) + Math.min(Math.abs(a.speed), Math.abs(b.speed)) * 0.4;
  if (!a.parked && a.driver !== 'player-static') a.mesh.position.addScaledVector(new THREE.Vector3(nx, 0, nz), -push * (b.parked ? 1.6 : 1));
  if (!b.parked) b.mesh.position.addScaledVector(new THREE.Vector3(nx, 0, nz), push * (a.parked ? 1.6 : 1));
  if (a.parked) b.speed *= 0.55;
  if (b.parked) a.speed *= 0.55;
  if (!a.parked && !b.parked) {
    const avg = (a.speed + b.speed) / 2;
    a.speed = avg * 0.8; b.speed = avg * 0.8;
  }
  return closing;
}
