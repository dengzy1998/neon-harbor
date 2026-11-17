// traffic.js — the ambient traffic of Neon Harbor. Each traffic car follows
// the street grid: it cruises along one road in its right-hand lane, and at
// every junction it may turn onto the crossing street along a smooth arc. It
// brakes for whatever is ahead of it, and cars that drift too far from the
// player quietly respawn on a distant street so the city always feels alive.

import { ROAD_LINES } from './config.js';
import { createCar, CAR_TYPES, CAR_COLORS } from './vehicles.js';
import { collideCircle } from './city.js';

const LANE = 3.4;
const CRUISE = 9.5;

class TrafficCar {
  constructor(scene, rng) {
    this.car = createCar(scene, rng.pick(Object.keys(CAR_TYPES)), rng.pick(CAR_COLORS), 0, 0, 0);
    this.rng = rng;
    this.turn = null;
    this.placeAtRandomJunction(null);
  }

  // Put the car on a random road, optionally at least `minDist` from a point.
  placeAtRandomJunction(fromPos) {
    const rng = this.rng;
    for (let tries = 0; tries < 12; tries++) {
      this.axis = rng.chance(0.5) ? 'x' : 'z';
      this.fixed = rng.pick(ROAD_LINES);
      this.dir = rng.chance(0.5) ? 1 : -1;
      this.along = rng.range(-170, 170);
      this.applyPosition();
      if (!fromPos || this.car.pos.distanceTo(fromPos) > 90) break;
    }
    this.car.speed = CRUISE * this.rng.range(0.8, 1.05);
  }

  laneCoord() {
    return this.axis === 'x' ? this.fixed + LANE * this.dir : this.fixed - LANE * this.dir;
  }

  applyPosition() {
    if (this.axis === 'x') {
      this.car.pos.x = this.along;
      this.car.pos.z = this.laneCoord();
      this.car.heading = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      this.car.pos.x = this.laneCoord();
      this.car.pos.z = this.along;
      this.car.heading = this.dir > 0 ? 0 : Math.PI;
    }
    this.car.syncMesh();
  }

  startTurn(crossLine) {
    const rng = this.rng;
    const right = rng.chance(0.5);
    const fromHeading = this.car.heading;
    // Turning swaps the axis; the new fixed line is the street we crossed,
    // and the new direction follows from left vs right.
    let newDir;
    if (this.axis === 'x') newDir = right ? this.dir : -this.dir;
    else newDir = right ? -this.dir : this.dir;
    const toHeading = this.axis === 'x'
      ? (newDir > 0 ? 0 : Math.PI)
      : (newDir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const start = { x: this.car.pos.x, z: this.car.pos.z };
    // The bezier corner is where the old lane line meets the new lane line;
    // the end point sits 9 units along the new road, in its correct lane.
    const corner = { x: 0, z: 0 };
    const end = { x: 0, z: 0 };
    if (this.axis === 'x') {
      corner.x = crossLine - LANE * newDir;
      corner.z = this.fixed + LANE * this.dir;
      end.x = crossLine - LANE * newDir;
      end.z = this.fixed + 9 * newDir;
    } else {
      corner.x = this.fixed - LANE * this.dir;
      corner.z = crossLine + LANE * newDir;
      end.x = this.fixed + 9 * newDir;
      end.z = crossLine + LANE * newDir;
    }
    this.turn = {
      t: 0, dur: 0.62, fromHeading, toHeading,
      start, corner, end,
      newAxis: this.axis === 'x' ? 'z' : 'x',
      newFixed: crossLine, newDir,
    };
  }

  update(dt, ctx) {
    const car = this.car;
    if (this.turn) {
      const tn = this.turn;
      tn.t += dt / tn.dur;
      const k = Math.min(1, tn.t);
      const e = k * k * (3 - 2 * k);
      // Quadratic bezier through the corner for a believable arc.
      const a = { x: (1 - e) * tn.start.x + e * tn.corner.x, z: (1 - e) * tn.start.z + e * tn.corner.z };
      const b = { x: (1 - e) * tn.corner.x + e * tn.end.x, z: (1 - e) * tn.corner.z + e * tn.end.z };
      car.pos.x = (1 - e) * a.x + e * b.x;
      car.pos.z = (1 - e) * a.z + e * b.z;
      let dh = tn.toHeading - tn.fromHeading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading = tn.fromHeading + dh * e;
      car.syncMesh();
      if (k >= 1) {
        this.axis = tn.newAxis; this.fixed = tn.newFixed; this.dir = tn.newDir;
        this.along = this.axis === 'x' ? car.pos.x : car.pos.z;
        this.turn = null;
      }
      return;
    }

    // Brake for anything ahead in the same lane.
    let target = CRUISE;
    const f = car.forward();
    for (const other of ctx.obstacles) {
      if (other === car) continue;
      const dx = other.pos.x - car.pos.x, dz = other.pos.z - car.pos.z;
      const ahead = dx * f.x + dz * f.z;
      const side = Math.abs(dx * f.z - dz * f.x);
      if (ahead > 0 && ahead < 8.5 && side < 2.1) { target = 0; break; }
    }
    car.speed += Math.max(-26 * dt, Math.min(11 * dt, target - car.speed));
    const prevAlong = this.along;
    this.along += this.dir * car.speed * dt;

    // Junction reached? The along coordinate crossing a road line.
    for (const line of ROAD_LINES) {
      const crossed = this.dir > 0
        ? prevAlong < line && this.along >= line
        : prevAlong > line && this.along <= line;
      if (crossed) {
        if (this.rng.chance(0.42)) { this.startTurn(line); return; }
        break;
      }
    }
    if (Math.abs(this.along) > 178) { this.dir *= -1; }
    this.applyPosition();
    collideCircle(ctx.colliders, car.pos, car.radius); // never inside a building
    car.syncMesh();
  }
}

export class Traffic {
  constructor(scene, rng) {
    this.cars = [];
    for (let i = 0; i < 11; i++) this.cars.push(new TrafficCar(scene, rng));
    this.rng = rng;
  }

  get vehicles() { return this.cars.map((t) => t.car); }

  update(dt, ctx) {
    const obstacles = [...this.vehicles, ...ctx.extraObstacles];
    for (const t of this.cars) {
      if (t.car === ctx.playerCar) continue; // the player stole this one
      if (t.car.pos.distanceTo(ctx.playerPos) > 235) t.placeAtRandomJunction(ctx.playerPos);
      t.update(dt, { ...ctx, obstacles });
    }
  }

  // When the player steals a traffic car it leaves the traffic system; a
  // fresh car is spawned far away to keep the streets populated.
  release(car, scene) {
    const idx = this.cars.findIndex((t) => t.car === car);
    if (idx >= 0) {
      this.cars.splice(idx, 1);
      this.cars.push(new TrafficCar(scene, this.rng));
    }
  }
}
