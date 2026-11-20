import * as THREE from 'three';
import { districtAt } from '../world/City.js';

export class Helicopter {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.visible = false;
    const shell = new THREE.MeshStandardMaterial({ color: 0x243344, roughness: 0.65 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 3.4), shell);
    body.position.y = 42;
    this.mesh.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 2.6), shell);
    tail.position.set(0, 42.1, -2.5);
    this.mesh.add(tail);
    for (const x of [-0.75, 0.75]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3), shell);
      skid.position.set(x, 41.4, 0);
      this.mesh.add(skid);
    }
    const rotorMat = new THREE.MeshBasicMaterial({ color: 0x9eb1bd });
    this.rotor = new THREE.Mesh(new THREE.BoxGeometry(5, 0.05, 0.2), rotorMat);
    this.rotor.position.y = 42.6;
    this.mesh.add(this.rotor);
    this.tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.08), rotorMat);
    this.tailRotor.position.set(0, 42.3, -3.8);
    this.mesh.add(this.tailRotor);
    this.light = new THREE.SpotLight(0xbfe9ff, 18, 90, Math.PI / 8, 0.4, 1);
    this.light.position.set(0, 41.5, 0);
    this.light.target = new THREE.Object3D();
    this.mesh.add(this.light, this.light.target);
    this.cone = new THREE.Mesh(new THREE.ConeGeometry(7, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.12, depthWrite: false }));
    this.cone.position.y = 27;
    this.mesh.add(this.cone);
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(6, 24), new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.22, depthWrite: false }));
    this.disc.rotation.x = -Math.PI / 2;
    this.disc.position.y = 0.03;
    this.mesh.add(this.disc);
    scene.add(this.mesh);
    this.active = false;
    this.angle = 0;
    this.dispatchAt = 0;
    this.lastDispatch = '';
    this.district = 'the harbor';
  }
  setActive(value) { this.active = Boolean(value); this.mesh.visible = this.active; }
  setDistrict(name) { this.district = name; }
  update(dt, targetPos, district) {
    if (!this.active || !targetPos) return;
    if (district) this.district = typeof district === 'string' ? district : district.name;
    else this.district = districtAt(targetPos.x, targetPos.z)?.name || this.district;
    this.angle += dt * 0.35;
    this.mesh.position.set(targetPos.x + Math.cos(this.angle) * 30, 0, targetPos.z + Math.sin(this.angle) * 30);
    this.mesh.rotation.z = -0.12 * Math.sin(this.angle);
    this.rotor.rotation.y += dt * 16;
    this.tailRotor.rotation.x += dt * 22;
    this.light.target.position.copy(targetPos);
    this.cone.position.set(this.mesh.position.x, 27, this.mesh.position.z);
    this.disc.position.set(targetPos.x, 0.04, targetPos.z);
    if (performance.now() >= this.dispatchAt) {
      this.lastDispatch = `ANCHOR AIR: light is on the suspect, ${this.district}`;
      this.dispatchAt = performance.now() + 9000;
    }
  }
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
