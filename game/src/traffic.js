// Traffic: the everyday cars of Neon Harbor. Moving cars ride a rail network of
// right-hand lanes over the street grid, slow for the car ahead and turn at
// intersections; parked cars line the kerbs waiting to be borrowed.

import { CITY, TUNING, CAR_MODELS } from './config.js';
import { streetCentres } from './city.js';
import { makeCar, stepCar, collideCars } from './vehicles.js';

const LANE = 3.4;      // lane offset from the street centreline (right-hand traffic)
const TURN_R = 5.2;    // how far before the corner a turn begins

function laneLateral(dir, axis) {
  // Facing +z, your right is -x; facing +x, your right is +z; and the mirrors.
  if (axis === 'z') return dir > 0 ? -LANE : LANE;
  return dir > 0 ? LANE : -LANE;
}

export class TrafficSystem {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.cars = [];    // moving traffic
    this.parked = [];  // kerbside cars anyone may take
  }

  spawnTraffic(count) {
    for (let i = 0; i < count; i++) {
      const model = this.rng.pick(CAR_MODELS);
      const car = makeCar(this.scene, model, this.rng.pick(model.colors), 0, 0, 0);
      car.driver = 'ai';
      car.cruiseSpeed = this.rng.range(9, 14.5);
      car.axis = this.rng.chance(0.5) ? 'x' : 'z';
      car.dir = this.rng.chance(0.5) ? 1 : -1;
      car.street = this.rng.pick(streetCentres);
      car.along = this.rng.range(-CITY.half, CITY.half);
      this.placeOnRail(car);
      this.cars.push(car);
    }
  }

  spawnParked(count) {
    for (let i = 0; i < count; i++) {
      const model = this.rng.pick(CAR_MODELS);
      const vertical = this.rng.chance(0.5);
      const street = this.rng.pick(streetCentres);
      const side = this.rng.chance(0.5) ? 1 : -1;
      const along = this.rng.range(-CITY.half + 16, CITY.half - 16);
      const off = side * (CITY.roadWidth / 2 - 1.4);
      const x = vertical ? street + off : along;
      const z = vertical ? along : street + off;
      const heading = vertical ? (side > 0 ? Math.PI : 0) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
      const car = makeCar(this.scene, model, this.rng.pick(model.colors), x, z, heading, { parked: true });
      car.driver = null;
      this.parked.push(car);
    }
  }

  /** Add one special parked car (the gold Komodo of the third mission). */
  addSpecialParked(model, color, x, z, heading) {
    const car = makeCar(this.scene, model, color, x, z, heading, { parked: true });
    car.special = true;
    this.parked.push(car);
    return car;
  }

  placeOnRail(car) {
    const lat = car.street + laneLateral(car.dir, car.axis);
    if (car.axis === 'z') car.mesh.position.set(lat, 0, car.along);
    else car.mesh.position.set(car.along, 0, lat);
    car.heading = car.axis === 'z' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    car.mesh.rotation.y = car.heading;
  }

  nextIntersection(car) {
    // The next street centreline strictly ahead on the car's axis.
    const pos = car.along;
    let best = Infinity;
    for (const s of streetCentres) {
      const d = (s - pos) * car.dir;
      if (d > 0.5 && d < best) best = d;
    }
    return best === Infinity ? null : pos + best * car.dir;
  }

  beginTurn(car, crossing) {
    const turnLeft = this.rng.chance(0.5);
    const from = { x: car.mesh.position.x, z: car.mesh.position.z };
    const oldAxis = car.axis;
    const oldDir = car.dir;
    const newAxis = oldAxis === 'z' ? 'x' : 'z';
    const newDir = turnLeft ? -oldDir : oldDir;
    // Corner: the point where the two lanes cross.
    const corner = { x: from.x, z: from.z };
    if (oldAxis === 'z') corner.x = crossing + laneLateral(newDir, newAxis);
    else corner.z = crossing + laneLateral(newDir, newAxis);
    const to = { x: corner.x, z: corner.z };
    if (newAxis === 'z') to.z += newDir * TURN_R;
    else to.x += newDir * TURN_R;
    car.turn = { from, corner, to, t: 0, newAxis, newDir, crossing };
    car.mode = 'turn';
  }

  finishTurn(car) {
    const t = car.turn;
    car.axis = t.newAxis;
    car.dir = t.newDir;
    car.street = t.crossing;
    car.along = car.axis === 'z' ? car.mesh.position.z : car.mesh.position.x;
    car.mode = 'straight';
    car.turn = null;
    this.placeOnRail(car);
  }

  speedAhead(car, playerCar) {
    // Slow down when something is close in front in the same lane.
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    let limit = car.cruiseSpeed;
    const check = (other) => {
      if (other === car) return;
      const dx = other.mesh.position.x - car.mesh.position.x;
      const dz = other.mesh.position.z - car.mesh.position.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 11 && side < 2.6) {
        limit = Math.min(limit, Math.max(0, (other.speed ?? 0)) * 0.9 - (ahead < 6 ? 2.5 : 0));
      }
    };
    for (const o of this.cars) check(o);
    for (const o of this.parked) if (o.driver === 'player') check(o);
    if (playerCar) check(playerCar);
    return Math.max(0, limit);
  }

  update(dt, playerCar) {
    for (const car of this.cars) {
      if (car.driver !== 'ai') continue;
      const limit = this.speedAhead(car, playerCar);
      let throttle = 0;
      if (car.speed < limit) throttle = 0.75;
      else if (car.speed > limit + 1.5) throttle = -0.7;
      let steer = 0;
      if (car.mode === 'straight') {
        const crossing = this.nextIntersection(car);
        const dist = crossing === null ? Infinity : Math.abs(crossing - car.along);
        if (dist < TURN_R && this.rng.chance(0.4)) this.beginTurn(car, crossing);
        stepCar(car, { throttle, steer: 0, brake: throttle < 0, handbrake: false }, dt, this.colliders);
        car.along = car.axis === 'z' ? car.mesh.position.z : car.mesh.position.x;
        // Keep the car centred on its lane while it runs straight.
        const lat = car.street + laneLateral(car.dir, car.axis);
        if (car.axis === 'z') car.mesh.position.x += (lat - car.mesh.position.x) * Math.min(1, dt * 3);
        else car.mesh.position.z += (lat - car.mesh.position.z) * Math.min(1, dt * 3);
        // Wrap around the edge of the world instead of leaving it.
        if (Math.abs(car.along) > CITY.half + 40) {
          car.along = -car.along * 0.98;
          this.placeOnRail(car);
        }
      } else {
        const t = car.turn;
        const speedNow = Math.max(4.5, Math.abs(car.speed));
        t.t += (dt * speedNow) / (TURN_R * 1.7);
        const k = Math.min(1, t.t);
        const a = t.from, c = t.corner, b = t.to;
        const x = (1 - k) * (1 - k) * a.x + 2 * (1 - k) * k * c.x + k * k * b.x;
        const z = (1 - k) * (1 - k) * a.z + 2 * (1 - k) * k * c.z + k * k * b.z;
        const dx = 2 * (1 - k) * (c.x - a.x) + 2 * k * (b.x - c.x);
        const dz = 2 * (1 - k) * (c.z - a.z) + 2 * k * (b.z - c.z);
        car.mesh.position.set(x, 0, z);
        car.heading = Math.atan2(dx, dz);
        car.mesh.rotation.y = car.heading;
        car.speed = speedNow * 0.75;
        if (k >= 1) this.finishTurn(car);
      }
    }
    // Gentle car-to-car separation for the whole fleet.
    const all = [...this.cars, ...this.parked];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (a.driver === 'player' || b.driver === 'player') continue;
        if (Math.abs(a.mesh.position.x - b.mesh.position.x) > 6 || Math.abs(a.mesh.position.z - b.mesh.position.z) > 6) continue;
        collideCars(a, b);
      }
    }
  }

  /** Every car the player could take or hit, moving or parked. */
  allCars() {
    return [...this.cars, ...this.parked];
  }
}

export { TUNING };
