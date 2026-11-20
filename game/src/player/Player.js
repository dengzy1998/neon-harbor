import * as THREE from 'three';

// Mara Venn is the harbor's nimble on-foot lead.
export class Player {
  constructor(scene) {
    this.mesh = new THREE.Group();
    this.mesh.name = 'Mara Venn';
    const shirt = new THREE.MeshStandardMaterial({ color: 0xd45e6b, roughness: 0.78 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x25303a, roughness: 0.86 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc88f70, roughness: 0.9 });
    const cap = new THREE.MeshStandardMaterial({ color: 0x302b42, roughness: 0.76 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.72, 3, 7), shirt);
    torso.position.y = 1.14;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 9, 7), skin);
    head.position.y = 1.88;
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.15, 9), cap);
    hat.position.y = 2.1;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.045, 0.3), cap);
    brim.position.set(0, 2.03, 0.21);
    this.mesh.add(torso, head, hat, brim);
    this.legs = [-1, 1].map(side => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.16, 0.82, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), dark);
      leg.position.y = -0.3;
      pivot.add(leg);
      this.mesh.add(pivot);
      return pivot;
    });
    this.arms = [-1, 1].map(side => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.37, 1.42, 0);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.43, 2, 5), shirt);
      arm.position.y = -0.24;
      pivot.add(arm);
      this.mesh.add(pivot);
      return pivot;
    });
    this.mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(this.mesh);
    this.onFoot = true;
    this.health = 100;
    this.armour = 0;
    this.heading = 0;
    this.walkPhase = 0;
    this.car = null;
  }

  update(dt, input, colliders = []) {
    if (!this.onFoot) return;
    const step = Math.min(dt, 0.05);
    const forward = (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0) -
      (input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0);
    const lateral = (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0) -
      (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0);
    const length = Math.hypot(forward, lateral);
    const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    if (length > 0) {
      const f = forward / length;
      const s = lateral / length;
      const speed = run ? 8.2 : 4.4;
      const dx = Math.sin(this.heading) * f + Math.cos(this.heading) * s;
      const dz = Math.cos(this.heading) * f - Math.sin(this.heading) * s;
      const pos = this.mesh.position;
      let x = pos.x + dx * speed * step;
      let z = pos.z + dz * speed * step;
      const radius = 0.48;
      for (const c of colliders) {
        if (Math.abs(z - c.z) < c.hd + radius && Math.abs(x - c.x) < c.hw + radius) x = pos.x;
      }
      for (const c of colliders) {
        if (Math.abs(x - c.x) < c.hw + radius && Math.abs(z - c.z) < c.hd + radius) z = pos.z;
      }
      pos.set(x, 0, z);
      this.faceHeading(Math.atan2(dx, dz));
      this.walkPhase += step * speed * 1.9;
    } else {
      this.walkPhase += step * 2;
    }
    const amp = length ? Math.sin(this.walkPhase) * (run ? 0.82 : 0.55) : 0;
    this.legs[0].rotation.x = amp;
    this.legs[1].rotation.x = -amp;
    this.arms[0].rotation.x = -amp * 0.7;
    this.arms[1].rotation.x = amp * 0.7;
  }

  enterCar(car) {
    this.car = car;
    this.mesh.position.copy(car.mesh.position);
    this.onFoot = false;
    this.mesh.visible = false;
  }

  exitCar() {
    if (this.car) {
      const side = this.car.heading + Math.PI / 2;
      this.mesh.position.set(
        this.car.mesh.position.x + Math.sin(side) * 1.7,
        0,
        this.car.mesh.position.z + Math.cos(side) * 1.7,
      );
      this.faceHeading(this.car.heading);
    }
    this.onFoot = true;
    this.car = null;
    this.mesh.visible = true;
    return this.mesh.position;
  }

  faceHeading(h) {
    this.heading = h;
    this.mesh.rotation.y = h;
  }
}
