// player.js — Reyes Solano, the courier you play. A small articulated figure
// (cap, teal shirt, satchel) who walks and runs around Neon Harbor relative
// to the camera, swings a punch, and otherwise stays out of the way when a
// car takes over. Movement, facing and the walk cycle live here; the camera
// itself lives in game.js.

import * as THREE from 'three';
import { PLAYER } from './config.js';
import { collideCircle } from './city.js';

export class Player {
  constructor(scene) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: 0x0e9594 });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2b2d42 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc68642 });
    const mk = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
    };
    const legGeo = new THREE.BoxGeometry(0.17, 0.8, 0.19);
    legGeo.translate(0, -0.32, 0);
    this.legL = mk(legGeo, pants, -0.12, 0.74, 0);
    this.legR = mk(legGeo, pants, 0.12, 0.74, 0);
    mk(new THREE.BoxGeometry(0.46, 0.64, 0.25), shirt, 0, 1.08, 0);
    const satchel = mk(new THREE.BoxGeometry(0.3, 0.36, 0.14),
      new THREE.MeshLambertMaterial({ color: 0xf4a259 }), 0.3, 1.02, -0.05);
    satchel.rotation.z = 0.15;
    const armGeo = new THREE.BoxGeometry(0.12, 0.62, 0.14);
    armGeo.translate(0, -0.24, 0);
    this.armL = mk(armGeo, shirt, -0.3, 1.32, 0);
    this.armR = mk(armGeo, shirt, 0.3, 1.32, 0);
    mk(new THREE.SphereGeometry(0.17, 10, 8), skin, 0, 1.6, 0);
    const cap = mk(new THREE.CylinderGeometry(0.18, 0.19, 0.1, 10),
      new THREE.MeshLambertMaterial({ color: 0xef6461 }), 0, 1.74, 0);
    cap.scale.z = 1.15;
    this.group = g;
    this.heading = Math.PI; // face the city (north) at spawn
    this.walkCycle = 0;
    this.punchTimer = 0;
    this.moving = 0;
    scene.add(g);
  }

  get pos() { return this.group.position; }

  setPosition(x, z) {
    this.pos.x = x; this.pos.z = z; this.pos.y = 0;
  }

  punch() { this.punchTimer = 0.28; }

  // input: {x: strafe -1..1, z: forward -1..1, run: bool, camYaw: radians}
  update(dt, input, colliders) {
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const sin = Math.sin(input.camYaw), cos = Math.cos(input.camYaw);
    // Camera forward on the ground is (-sin, -cos) for our orbit convention;
    // combine it with the strafe axis to get the wish direction.
    const wx = (-sin * input.z) + (cos * input.x);
    const wz = (-cos * input.z) + (-sin * input.x);
    const len = Math.hypot(wx, wz);
    this.moving = len > 0.05 ? 1 : 0;
    if (len > 0.05) {
      const nx = wx / len, nz = wz / len;
      this.pos.x += nx * speed * dt;
      this.pos.z += nz * speed * dt;
      const target = Math.atan2(nx, nz);
      let dh = target - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += dh * Math.min(1, dt * 12);
      this.walkCycle += dt * (input.run ? 11 : 8);
    }
    collideCircle(colliders, this.pos, PLAYER.radius);
    this.pos.x = Math.max(-196, Math.min(196, this.pos.x));
    this.pos.z = Math.max(-196, Math.min(204, this.pos.z));
    this.group.rotation.y = this.heading;
    const swing = this.moving ? Math.sin(this.walkCycle) * 0.55 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.75;
    if (this.punchTimer > 0) {
      this.punchTimer -= dt;
      const k = 1 - this.punchTimer / 0.28;
      this.armR.rotation.x = -Math.sin(k * Math.PI) * 1.7;
    } else {
      this.armR.rotation.x = swing * 0.75;
    }
  }
}
