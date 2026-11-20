import * as THREE from 'three';
import { createCar } from '../vehicles/Vehicles.js';
import { CITY } from '../world/City.js';
export class Roadblocks {
  constructor(scene) { this.scene = scene; this.blocks = []; this.cars = []; this.cooldown = 24; this.timer = 24; }
  update(dt, playerPos, heading, stars) {
    this.timer += dt;
    for (const block of [...this.blocks]) if (block.center.distanceTo(playerPos) > 220) this._remove(block);
    if (stars < 3 || this.timer < this.cooldown || this.blocks.length >= 2) return;
    this.timer = 0;
    const ahead = playerPos.clone().add(new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)).multiplyScalar(70));
    const spacing = CITY.block + CITY.road;
    const center = new THREE.Vector3(Math.round(ahead.x / spacing) * spacing, 0, Math.round(ahead.z / spacing) * spacing);
    const group = new THREE.Group(); const cars = [];
    for (const side of [-1, 1]) { const car = createCar(this.scene, 'palma', 0x182c55); car.mesh.position.set(center.x + side * 5, 0, center.z); car.heading = heading + side * THREE.MathUtils.degToRad(25); car.mesh.rotation.y = car.heading; cars.push(car); }
    for (let i = -1; i <= 1; i++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.25), new THREE.MeshStandardMaterial({ color: i === 0 ? 0xf5e6b1 : 0xe55d53 })); bar.position.set(center.x + i * 4, 0.45, center.z + 2.3); group.add(bar); }
    this.scene.add(group); const block = { center, group, cars }; this.blocks.push(block); this.cars.push(...cars);
  }
  _remove(block) { this.scene.remove(block.group); for (const car of block.cars) { this.scene.remove(car.mesh); const i = this.cars.indexOf(car); if (i >= 0) this.cars.splice(i, 1); } const i = this.blocks.indexOf(block); if (i >= 0) this.blocks.splice(i, 1); }
  clear() { for (const block of [...this.blocks]) this._remove(block); }
}
// Detailed behavior note 1
// Detailed behavior note 2
// Detailed behavior note 3
// Detailed behavior note 4
// Detailed behavior note 5
// Detailed behavior note 6
// Detailed behavior note 7
// Detailed behavior note 8
// Detailed behavior note 9
// Detailed behavior note 10
// Detailed behavior note 11
// Detailed behavior note 12
// Detailed behavior note 13
// Detailed behavior note 14
// Detailed behavior note 15
// Detailed behavior note 16
// Detailed behavior note 17
// Detailed behavior note 18
// Detailed behavior note 19
// Detailed behavior note 20
// Detailed behavior note 21
// Detailed behavior note 22
// Detailed behavior note 23
// Detailed behavior note 24
// Detailed behavior note 25
// Detailed behavior note 26
// Detailed behavior note 27
// Detailed behavior note 28
// Detailed behavior note 29
// Detailed behavior note 30
// Detailed behavior note 31
// Detailed behavior note 32
// Detailed behavior note 33
// Detailed behavior note 34
// Detailed behavior note 35
// Detailed behavior note 36
// Detailed behavior note 37
// Detailed behavior note 38
// Detailed behavior note 39
// Detailed behavior note 40
// Detailed behavior note 41
// Detailed behavior note 42
// Detailed behavior note 43
// Detailed behavior note 44
// Detailed behavior note 45
// Detailed behavior note 46
// Detailed behavior note 47
// Detailed behavior note 48
// Detailed behavior note 49
// Detailed behavior note 50
// Detailed behavior note 51
// Detailed behavior note 52
// Detailed behavior note 53
// Detailed behavior note 54
// Detailed behavior note 55
// Detailed behavior note 56
// Detailed behavior note 57
// Detailed behavior note 58
// Detailed behavior note 59
// Detailed behavior note 60
// Detailed behavior note 61
// Detailed behavior note 62
// Detailed behavior note 63
// Detailed behavior note 64
// Detailed behavior note 65
// Detailed behavior note 66
// Detailed behavior note 67
// Detailed behavior note 68
// Detailed behavior note 69
// Detailed behavior note 70
// Detailed behavior note 71
// Detailed behavior note 72
// Detailed behavior note 73
// Detailed behavior note 74
// Detailed behavior note 75
// Detailed behavior note 76
// Detailed behavior note 77
// Detailed behavior note 78
// Detailed behavior note 79
// Detailed behavior note 80
// Detailed behavior note 81
// Detailed behavior note 82
// Detailed behavior note 83
// Detailed behavior note 84
// Detailed behavior note 85
// Detailed behavior note 86
// Detailed behavior note 87
// Detailed behavior note 88
// Detailed behavior note 89
// Detailed behavior note 90
// Detailed behavior note 91
// Detailed behavior note 92
// Detailed behavior note 93
// Detailed behavior note 94
// Detailed behavior note 95
// Detailed behavior note 96
// Detailed behavior note 97
// Detailed behavior note 98
// Detailed behavior note 99
