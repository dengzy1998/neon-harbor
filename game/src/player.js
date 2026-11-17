// Jett Marlowe, the player: walking and running on foot with a swing in the stride,
// stepping in and out of cars, throwing a punch, and taking damage like anyone else.

import * as THREE from 'three';
import { TUNING, COLORS, CITY } from './config.js';
import { resolveCollisions } from './city.js';

const legGeo = new THREE.BoxGeometry(0.19, 0.82, 0.22);
legGeo.translate(0, -0.41, 0);
const torsoGeo = new THREE.BoxGeometry(0.56, 0.76, 0.32);
const armGeo = new THREE.BoxGeometry(0.14, 0.7, 0.17);
armGeo.translate(0, -0.32, 0);
const headGeo = new THREE.BoxGeometry(0.32, 0.36, 0.32);

export function makeFigureMesh(shirtColor, pantsColor, skinColor) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: pantsColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const legL = new THREE.Mesh(legGeo, pants); legL.position.set(-0.14, 0.82, 0);
  const legR = new THREE.Mesh(legGeo, pants); legR.position.set(0.14, 0.82, 0);
  const torso = new THREE.Mesh(torsoGeo, shirt); torso.position.y = 1.2;
  const armL = new THREE.Mesh(armGeo, shirt); armL.position.set(-0.36, 1.52, 0);
  const armR = new THREE.Mesh(armGeo, shirt); armR.position.set(0.36, 1.52, 0);
  const head = new THREE.Mesh(headGeo, skin); head.position.y = 1.82;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.36), new THREE.MeshLambertMaterial({ color: 0x1c2f4a }));
  cap.position.y = 2.02;
  g.add(legL, legR, torso, armL, armR, head, cap);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export class Player {
  /** events: { onPunch(x, z, heading) } — main wires the punch to the pedestrians. */
  constructor(scene, colliders, events) {
    this.colliders = colliders;
    this.events = events;
    this.mesh = makeFigureMesh(COLORS.playerShirt, 0x2c3e50, 0xc68863);
    this.mesh.position.set(232, 0, 116); // starts on the boardwalk by the marina
    scene.add(this.mesh);
    this.heading = -Math.PI / 2;         // facing the city
    this.speedNow = 0;
    this.inCar = null;
    this.health = 100;
    this.sinceDamage = 99;
    this.punchCd = 0;
    this.punchAnim = 0;
    this.stride = 0;
    this.alive = true;
  }

  get pos() { return this.inCar ? this.inCar.mesh.position : this.mesh.position; }
  get speed() { return this.inCar ? Math.abs(this.inCar.speed) : this.speedNow; }

  damage(amount) {
    if (!this.alive) return;
    this.health = Math.max(0, this.health - amount);
    this.sinceDamage = 0;
  }

  healFull() {
    this.health = 100;
    this.sinceDamage = 99;
  }

  enterCar(car) {
    this.inCar = car;
    car.driver = 'player';
    car.parked = false;
    this.mesh.visible = false;
  }

  exitCar() {
    const car = this.inCar;
    if (!car) return null;
    car.driver = null;
    car.parked = true;
    car.speed = 0;
    this.inCar = null;
    // Step out on the left side of the car.
    const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
    this.mesh.position.copy(car.mesh.position).addScaledVector(side, -2.6);
    this.mesh.position.y = 0;
    resolveCollisions(this.mesh.position, TUNING.playerRadius, this.colliders);
    this.mesh.visible = true;
    this.heading = car.heading;
    return car;
  }

  teleport(x, z, heading = 0) {
    if (this.inCar) this.exitCar();
    this.mesh.position.set(x, 0, z);
    this.heading = heading;
    this.mesh.rotation.set(0, heading, 0);
  }

  /** input: {f, b, l, r, run, punch} booleans; cameraYaw orients the movement. */
  update(dt, input, cameraYaw) {
    this.sinceDamage += dt;
    if (this.sinceDamage > 5 && this.health > 0) {
      this.health = Math.min(100, this.health + 6 * dt);
    }
    this.punchCd = Math.max(0, this.punchCd - dt);
    if (this.inCar) {
      this.mesh.position.copy(this.inCar.mesh.position);
      this.speedNow = Math.abs(this.inCar.speed);
      return;
    }
    const p = this.mesh.position;
    let mx = 0, mz = 0;
    const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
    if (input.f) { mx += sin; mz += cos; }
    if (input.b) { mx -= sin; mz -= cos; }
    if (input.l) { mx += cos; mz -= sin; }
    if (input.r) { mx -= cos; mz += sin; }
    const len = Math.hypot(mx, mz);
    const speed = input.run ? TUNING.runSpeed : TUNING.walkSpeed;
    if (len > 0.01) {
      mx /= len; mz /= len;
      const targetHeading = Math.atan2(mx, mz);
      let diff = targetHeading - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * Math.min(1, dt * 14);
      p.x += mx * speed * dt;
      p.z += mz * speed * dt;
      this.speedNow = speed;
      this.stride += dt * (input.run ? 13 : 9.5);
    } else {
      this.speedNow = 0;
    }
    resolveCollisions(p, TUNING.playerRadius, this.colliders);
    p.x = Math.max(-CITY.worldEdge, Math.min(CITY.worldEdge, p.x));
    p.z = Math.max(-CITY.worldEdge, Math.min(CITY.worldEdge, p.z));
    if (p.x > CITY.waterX - 2) p.x = CITY.waterX - 2; // the bay is for boats
    this.mesh.rotation.y = this.heading;
    // Stride and arm swing; a punch overrides the right arm.
    const swing = Math.sin(this.stride) * (this.speedNow > 0.1 ? 0.55 : 0);
    const u = this.mesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.75;
    if (this.punchAnim > 0) {
      this.punchAnim -= dt * 5;
      u.armR.rotation.x = -1.9 * Math.max(0, Math.sin(this.punchAnim * Math.PI));
    } else {
      u.armR.rotation.x = swing * 0.75;
    }
    if (input.punch && this.punchCd <= 0) {
      this.punchCd = 0.45;
      this.punchAnim = 1;
      this.events.onPunch(p.x + Math.sin(this.heading) * 1.1, p.z + Math.cos(this.heading) * 1.1, this.heading);
    }
  }
}
