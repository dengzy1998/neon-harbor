// police.js — the Neon Harbor Police Department. A heat value (fed by every
// crime the game reports) becomes one to five wanted stars; the stars decide
// how many patrol cars hunt the player, how hard they drive, and whether
// they open fire. Units pursue, ram, and try to box the player in; stand
// still next to them and the busted meter fills. Lose their line of sight
// and the heat bleeds away.

import * as THREE from 'three';
import { HEAT, POLICE, ROAD_LINES } from './config.js';
import { createCar, collideCars } from './vehicles.js';

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.heat = 0;
    this.units = []; // {car, reverseTimer, shootCd}
    this.bust = 0; // 0..1
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95 });
    this.tracers = [];
    this.time = 0;
  }

  get stars() {
    return this.heat <= 0 ? 0 : Math.min(5, Math.ceil(this.heat / HEAT.perStar));
  }

  reportCrime(amount) {
    this.heat = Math.min(HEAT.max, this.heat + amount);
  }

  setHeat(value) { this.heat = Math.max(0, Math.min(HEAT.max, value)); }

  clear() {
    this.heat = 0;
    this.bust = 0;
  }

  anyUnitWithin(pos, r) {
    return this.units.some((u) => u.car.pos.distanceTo(pos) < r);
  }

  nearestDistance(pos) {
    let best = Infinity;
    for (const u of this.units) best = Math.min(best, u.car.pos.distanceTo(pos));
    return best;
  }

  playerSeen(playerPos) {
    return this.anyUnitWithin(playerPos, HEAT.sightRange);
  }

  spawnUnit(playerPos) {
    // Appear on a street 55–85 m away: pick the axis the player is closest
    // to travelling on and offset along it.
    const alongX = Math.random() < 0.5;
    const line = ROAD_LINES.reduce((a, b) =>
      Math.abs(b - (alongX ? playerPos.z : playerPos.x)) < Math.abs(a - (alongX ? playerPos.z : playerPos.x)) ? b : a);
    const off = (55 + Math.random() * 30) * (Math.random() < 0.5 ? -1 : 1);
    const x = alongX ? playerPos.x + off : line;
    const z = alongX ? line : playerPos.z + off;
    const car = createCar(this.scene, 'sedan', 0xf2f4f6,
      Math.max(-186, Math.min(186, x)), Math.max(-186, Math.min(186, z)), 0, { police: true });
    this.units.push({ car, reverseTimer: 0, shootCd: Math.random() });
  }

  removeUnit(unit) {
    this.scene.remove(unit.car.mesh);
    this.units.splice(this.units.indexOf(unit), 1);
  }

  fireTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, 1.1, from.z),
      new THREE.Vector3(to.x, 1.1, to.z),
    ]);
    const line = new THREE.Line(geo, this.tracerMat);
    this.scene.add(line);
    this.tracers.push({ line, ttl: 0.07 });
  }

  update(dt, ctx) {
    this.time += dt;
    const { playerPos, playerSpeed, colliders } = ctx;
    const stars = this.stars;

    // Heat decays only while no unit can see the player.
    if (stars > 0 && !this.playerSeen(playerPos)) {
      this.heat = Math.max(0, this.heat - HEAT.decayPerSecond * dt);
    }

    // Maintain the fleet size the stars demand.
    const wanted = stars === 0 ? 0 : Math.min(stars + 1, POLICE.maxUnits);
    if (this.units.length < wanted) this.spawnUnit(playerPos);
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (stars === 0 && u.car.pos.distanceTo(playerPos) > 110) this.removeUnit(u);
      else if (u.car.pos.distanceTo(playerPos) > 260) this.removeUnit(u);
    }

    let busting = false;
    for (const u of this.units) {
      const car = u.car;
      car.flashLights(this.time);
      if (stars === 0) { // stand down: cruise away slowly
        car.speed += Math.max(-10 * dt, Math.min(6 * dt, 7 - car.speed));
        car.move(dt, colliders);
        continue;
      }
      const dx = playerPos.x - car.pos.x, dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const desired = Math.atan2(dx, dz);
      let dh = desired - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;

      if (u.reverseTimer > 0) {
        u.reverseTimer -= dt;
        car.speed += Math.max(-20 * dt, Math.min(0, -8 - car.speed));
      } else {
        // Aim a little ahead of a moving player, and back off when close so
        // units surround rather than endlessly shove.
        const targetSpeed = dist > 26 ? POLICE.topSpeed : dist > 9 ? 17 : 6;
        car.speed += Math.max(-30 * dt, Math.min(POLICE.accel * dt, targetSpeed - car.speed));
        car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh * 3 * dt));
      }
      const impact = car.move(dt, colliders);
      if (impact > 9 && u.reverseTimer <= 0) u.reverseTimer = 0.55;

      // Trade paint with the player's car and the traffic.
      for (const other of ctx.cars) {
        if (other !== car) collideCars(car, other);
      }

      // Shooting at three stars and up.
      u.shootCd -= dt;
      if (stars >= POLICE.shootStars && dist < POLICE.shootRange && u.shootCd <= 0) {
        u.shootCd = POLICE.shootInterval * (0.8 + Math.random() * 0.5);
        this.fireTracer(car.pos, playerPos);
        ctx.onShoot(POLICE.shootDamage);
      }

      if (dist < POLICE.bustRange && playerSpeed < 1.2) busting = true;
    }

    // The busted meter: standing close and slow next to a unit fills it.
    if (busting) this.bust = Math.min(1, this.bust + dt / POLICE.bustFillSeconds);
    else this.bust = Math.max(0, this.bust - dt * 0.7);

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.ttl -= dt;
      if (tr.ttl <= 0) {
        this.scene.remove(tr.line);
        tr.line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }
}
