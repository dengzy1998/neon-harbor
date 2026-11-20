import * as THREE from 'three';
import { createCar, CAR_KINDS } from './Vehicles.js';

const COLORS = [0x687d8c, 0xcf735f, 0x5c998c, 0xd1b75f, 0xc7bdd1, 0x53647e];

export class Traffic {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.cars = [];
    this._traffic = [];
    for (let i = 0; i < 14; i++) {
      const car = createCar(scene, rng.pick(Object.keys(CAR_KINDS)), rng.pick(COLORS));
      const vertical = rng.chance(0.5);
      const road = rng.int(-5, 5) * 56;
      const lane = rng.pick([-2.8, 2.8]);
      const dir = rng.pick([-1, 1]);
      car.speed = rng.range(10, 21);
      car.heading = vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      car.mesh.rotation.y = car.heading;
      car.mesh.position.set(vertical ? road + lane : rng.range(-325, 325), 0,
        vertical ? rng.range(-325, 325) : road + lane);
      this.cars.push(car);
      this._traffic.push({ car, vertical, road, lane, dir, wait: 0 });
    }
    this._player = null;
    this._nearCallback = null;
    this._passes = new Set();
    this._trackedPlayerHealth = null;
    this._playerCollisionFrames = 0;
  }

  update(dt) {
    const step = Math.min(dt, 0.05);
    for (const item of this._traffic) {
      const { car } = item;
      const p = car.mesh.position;
      car._collisionFrames = Math.max(0, (car._collisionFrames || 0) - 1);
      const coordinate = item.vertical ? p.z : p.x;
      item.wait = Math.max(0, item.wait - step);
      if (item.wait === 0) {
        car.speed += (item.dir * this.rng.range(10, 17) - car.speed) * step * 0.45;
      } else {
        car.speed *= Math.max(0, 1 - step * 3);
      }
      if (this._player && this._player !== car) {
        const d = car.mesh.position.distanceTo(this._player.mesh.position);
        if (d < 8) item.wait = Math.max(item.wait, 0.7);
        this._checkNear(item);
      }
      if (this.city.colliders) {
        const lookX = p.x + Math.sin(car.heading) * 5;
        const lookZ = p.z + Math.cos(car.heading) * 5;
        if (this.city.colliders.some(c => Math.abs(lookX - c.x) < c.hw + 1.3 &&
          Math.abs(lookZ - c.z) < c.hd + 1.3)) item.wait = Math.max(item.wait, 0.45);
      }
      if (item.vertical) p.z += item.dir * Math.abs(car.speed) * step;
      else p.x += item.dir * Math.abs(car.speed) * step;
      car.mesh.rotation.y = car.heading;
      const spin = car.speed * step / car.mesh.userData.wheelRadius;
      for (const wheel of car.mesh.userData.wheels) {
        wheel.children[0].rotation.y += spin;
        wheel.children[1].rotation.y += spin;
      }
      if (Math.abs(coordinate) > 340) {
        const road = item.road;
        const lane = item.lane;
        const dir = item.dir;
        const vertical = item.vertical;
        const at = dir > 0 ? -336 : 336;
        p.set(vertical ? road + lane : at, 0, vertical ? at : road + lane);
        item.wait = 0;
      }
    }
  }

  _checkNear(item) {
    if (!this._player || !this._nearCallback) return;
    const id = item.car.mesh.id;
    const distance = item.car.mesh.position.distanceTo(this._player.mesh.position);
    if (distance < 2.2 && Math.abs(item.car.speed) > 14 && !this._passes.has(id)) {
      this._passes.add(id);
      if (this._playerCollisionFrames <= 0 && (item.car._collisionFrames || 0) <= 0) {
        this._nearCallback(item.car);
      }
    } else if (distance > 5) {
      this._passes.delete(id);
    }
  }

  nearMiss(playerCar, cb) {
    if (this._trackedPlayerHealth !== null && playerCar.health !== this._trackedPlayerHealth) {
      this._playerCollisionFrames = 12;
    } else {
      this._playerCollisionFrames = Math.max(0, this._playerCollisionFrames - 1);
    }
    this._trackedPlayerHealth = playerCar.health;
    this._player = playerCar;
    this._nearCallback = cb;
  }
}
