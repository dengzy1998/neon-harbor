import * as THREE from 'three';

const SHIRTS = [0xe47865, 0x55a7a1, 0x6c79b8, 0xd7a74e, 0xd77fa9, 0x6d9b65, 0xddd4c7];

export class Pedestrians {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.walkers = [];
    this.group = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.34, 1.05, 7);
    const headGeo = new THREE.SphereGeometry(0.22, 8, 6);
    const legGeo = new THREE.BoxGeometry(0.18, 0.67, 0.2);
    const armGeo = new THREE.BoxGeometry(0.14, 0.62, 0.16);
    const skin = new THREE.MeshStandardMaterial({ color: 0xc88e6b, roughness: 0.88 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x343946, roughness: 0.92 });
    this.shirts = SHIRTS.map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    for (let i = 0; i < 40; i++) {
      const actor = new THREE.Group();
      const shirt = this.shirts[i % this.shirts.length];
      const torso = new THREE.Mesh(bodyGeo, shirt);
      torso.position.y = 1.1;
      const head = new THREE.Mesh(headGeo, skin);
      head.position.y = 1.79;
      const legs = [-1, 1].map(side => {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.13, 0.77, 0);
        const mesh = new THREE.Mesh(legGeo, dark);
        mesh.position.y = -0.28;
        pivot.add(mesh);
        actor.add(pivot);
        return pivot;
      });
      const arms = [-1, 1].map(side => {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.32, 1.42, 0);
        const mesh = new THREE.Mesh(armGeo, shirt);
        mesh.position.y = -0.25;
        pivot.add(mesh);
        actor.add(pivot);
        return pivot;
      });
      actor.add(torso, head);
      actor.traverse(object => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      const state = {
        mesh: actor, legs, arms, phase: rng.range(0, Math.PI * 2),
        speed: rng.range(0.75, 1.35), panic: 0,
      };
      const p = this._sidewalkPoint();
      actor.position.set(p.x, 0, p.z);
      state.axis = p.axis;
      state.lane = p.lane;
      state.direction = p.direction;
      actor.rotation.y = this._routeHeading(state);
      this.walkers.push(state);
      this.group.add(actor);
    }
    scene.add(this.group);
    this.count = this.walkers.length;
  }

  _sidewalkPoint(origin = null) {
    const axis = this.rng.pick(['x', 'z']);
    const across = axis === 'x' ? origin?.z : origin?.x;
    const alongAt = axis === 'x' ? origin?.x : origin?.z;
    const road = origin
      ? THREE.MathUtils.clamp(Math.round(across / 56) * 56, -336, 336)
      : this.rng.int(-5, 5) * 56;
    const along = origin ? alongAt + this.rng.range(-85, 85) : this.rng.range(-310, 310);
    const side = this.rng.pick([-1, 1]) * this.rng.range(9.5, 14);
    return axis === 'x'
      ? { x: along, z: road + side, axis, lane: road + side, direction: this.rng.pick([-1, 1]) }
      : { x: road + side, z: along, axis, lane: road + side, direction: this.rng.pick([-1, 1]) };
  }

  _routeHeading(walker) {
    if (walker.axis === 'x') return walker.direction * Math.PI / 2;
    return walker.direction > 0 ? 0 : Math.PI;
  }

  panic(pos, radius) {
    for (const walker of this.walkers) {
      if (walker.mesh.position.distanceToSquared(pos) <= radius * radius) {
        walker.panic = 3.5;
        const away = walker.mesh.position.clone().sub(pos);
        if (away.lengthSq() < 0.01) away.set(this.rng.range(-1, 1), 0, this.rng.range(-1, 1));
        away.y = 0;
        away.normalize();
        walker.mesh.rotation.y = Math.atan2(away.x, away.z);
      }
    }
  }

  update(dt, focusPos) {
    const f = focusPos || new THREE.Vector3();
    const step = Math.min(dt, 0.05);
    for (const walker of this.walkers) {
      const pos = walker.mesh.position;
      if (pos.distanceToSquared(f) > 185 * 185) {
        const p = this._sidewalkPoint(f);
        pos.set(THREE.MathUtils.clamp(p.x, -325, 325), 0,
          THREE.MathUtils.clamp(p.z, -325, 325));
        walker.axis = p.axis;
        walker.lane = p.lane;
        walker.direction = p.direction;
        walker.mesh.rotation.y = this._routeHeading(walker);
      }
      walker.panic = Math.max(0, walker.panic - step);
      const pace = walker.speed * (walker.panic > 0 ? 2.5 : 1);
      const angle = walker.mesh.rotation.y;
      if (walker.panic > 0) {
        pos.x += Math.sin(angle) * pace * step;
        pos.z += Math.cos(angle) * pace * step;
      } else {
        walker.mesh.rotation.y = this._routeHeading(walker);
        if (walker.axis === 'x') {
          pos.x += walker.direction * pace * step;
          pos.z = walker.lane;
        } else {
          pos.z += walker.direction * pace * step;
          pos.x = walker.lane;
        }
      }
      walker.phase += step * pace * 5.5;
      const swing = Math.sin(walker.phase) * (walker.panic > 0 ? 0.9 : 0.58);
      walker.legs[0].rotation.x = swing;
      walker.legs[1].rotation.x = -swing;
      walker.arms[0].rotation.x = -swing * 0.65;
      walker.arms[1].rotation.x = swing * 0.65;
      if (Math.abs(pos.x) > 334 || Math.abs(pos.z) > 334) {
        const p = this._sidewalkPoint();
        pos.set(p.x, 0, p.z);
        walker.axis = p.axis;
        walker.lane = p.lane;
        walker.direction = p.direction;
        walker.mesh.rotation.y = this._routeHeading(walker);
      }
    }
  }
}
