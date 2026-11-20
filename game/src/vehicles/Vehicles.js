import * as THREE from 'three';

export const CAR_KINDS = {
  komodo: { name: 'Komodo GT', topSpeed: 59, accel: 23, grip: 2.9, length: 4.5, width: 1.95, height: 1.22 },
  palma: { name: 'Palma Cruiser', topSpeed: 43, accel: 15, grip: 2.25, length: 4.8, width: 1.92, height: 1.28 },
  mule: { name: 'Mule Cargo Van', topSpeed: 34, accel: 10, grip: 1.8, length: 5.1, width: 2.05, height: 1.76 },
  cabrio: { name: 'Cabrio Taxi', topSpeed: 46, accel: 17, grip: 2.35, length: 4.55, width: 1.9, height: 1.25 },
  strand: { name: 'Strand Buggy', topSpeed: 41, accel: 16, grip: 1.6, length: 3.7, width: 1.8, height: 1.18 },
};

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.23, 10);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x202329, roughness: 0.92 });
const hubMat = new THREE.MeshStandardMaterial({ color: 0xc4c1b5, metalness: 0.5, roughness: 0.42 });
const windowMat = new THREE.MeshStandardMaterial({ color: 0x55707b, roughness: 0.24, metalness: 0.24 });
const headMat = new THREE.MeshBasicMaterial({ color: 0xffedb7 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xf06857 });
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

export function createCar(scene, kind, colorHex = 0x728a9d) {
  const spec = CAR_KINDS[kind] || CAR_KINDS.palma;
  const mesh = new THREE.Group();
  mesh.name = spec.name;
  const paint = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.48, metalness: 0.25 });
  const body = new THREE.Mesh(boxGeo, paint);
  body.scale.set(spec.width, spec.height * 0.55, spec.length);
  body.position.y = 0.77;
  body.castShadow = body.receiveShadow = true;
  mesh.add(body);
  const cabin = new THREE.Mesh(boxGeo, kind === 'strand' ? paint : windowMat);
  cabin.scale.set(spec.width * (kind === 'mule' ? 0.91 : 0.82), spec.height * (kind === 'mule' ? 0.72 : 0.66), spec.length * (kind === 'mule' ? 0.49 : 0.46));
  cabin.position.set(0, 0.77 + spec.height * 0.54, -0.18);
  cabin.castShadow = cabin.receiveShadow = true;
  mesh.add(cabin);
  if (kind === 'komodo') {
    const spoiler = new THREE.Mesh(boxGeo, paint);
    spoiler.scale.set(spec.width * 0.95, 0.09, 0.24);
    spoiler.position.set(0, 1.45, -spec.length * 0.47);
    mesh.add(spoiler);
  }
  if (kind === 'strand') {
    const roll = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x292e30, metalness: 0.45, roughness: 0.4 }));
    roll.scale.set(spec.width * 0.72, 0.08, 0.08);
    roll.position.set(0, 1.76, -0.25);
    mesh.add(roll);
    for (const side of [-1, 1]) for (const z of [-0.25, 0.36]) {
      const bar = new THREE.Mesh(boxGeo, roll.material);
      bar.scale.set(0.07, 0.75, 0.07);
      bar.position.set(side * spec.width * 0.34, 1.42, z);
      mesh.add(bar);
    }
  }
  if (kind === 'mule') {
    const cargo = new THREE.Mesh(boxGeo, paint);
    cargo.scale.set(spec.width * 0.87, 0.48, 1.35);
    cargo.position.set(0, 1.86, -0.6);
    cargo.castShadow = true;
    mesh.add(cargo);
  }
  if (kind === 'cabrio') {
    const checker = new THREE.Mesh(boxGeo,
      new THREE.MeshStandardMaterial({ color: 0xf0d35c, roughness: 0.6 }));
    checker.scale.set(spec.width * 0.6, 0.09, 0.4);
    checker.position.set(0, 1.45, 0.45);
    mesh.add(checker);
  }
  for (const side of [-1, 1]) for (const z of [-spec.length * 0.34, spec.length * 0.34]) {
    const lamp = new THREE.Mesh(boxGeo, z > 0 ? headMat : tailMat);
    lamp.scale.set(0.26, 0.14, 0.08);
    lamp.position.set(side * spec.width * 0.38, 0.76, z);
    mesh.add(lamp);
  }
  const wheels = [];
  const steering = [];
  const wheelPositions = [
    [-spec.width * 0.49, 0.37, spec.length * 0.33],
    [spec.width * 0.49, 0.37, spec.length * 0.33],
    [-spec.width * 0.49, 0.37, -spec.length * 0.33],
    [spec.width * 0.49, 0.37, -spec.length * 0.33],
  ];
  for (let i = 0; i < wheelPositions.length; i++) {
    const [x, y, z] = wheelPositions[i];
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    pivot.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.235, 8), hubMat);
    hub.rotation.z = Math.PI / 2;
    pivot.add(hub);
    mesh.add(pivot);
    wheels.push(pivot);
    if (i < 2) steering.push(pivot);
  }
  mesh.position.y = 0;
  mesh.userData.wheels = wheels;
  mesh.userData.steeringWheels = steering;
  mesh.userData.wheelRadius = 0.36;
  mesh.userData.spec = spec;
  mesh.userData.collider = { hw: spec.width * 0.5, hd: spec.length * 0.5 };
  const car = { mesh, kind, speed: 0, heading: 0, health: 100, ...spec };
  scene.add(mesh);
  return car;
}

function resolveCollisions(car, colliders) {
  const p = car.mesh.position;
  const c = car.mesh.userData.collider;
  const cs = Math.abs(Math.cos(car.heading));
  const sn = Math.abs(Math.sin(car.heading));
  const hw = cs * c.hw + sn * c.hd;
  const hd = sn * c.hw + cs * c.hd;
  for (const obstacle of colliders) {
    const dx = p.x - obstacle.x;
    const dz = p.z - obstacle.z;
    const ox = hw + obstacle.hw - Math.abs(dx);
    const oz = hd + obstacle.hd - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      const impactSpeed = Math.abs(car.speed);
      if (ox < oz) p.x += Math.sign(dx || 1) * ox;
      else p.z += Math.sign(dz || 1) * oz;
      car.speed *= -0.18;
      if (impactSpeed > 2) {
        car.health = Math.max(0, car.health - (impactSpeed - 2) * 0.14);
        car._collisionFrames = 12;
      }
    }
  }
}

export function driveStep(car, dt, ctl, colliders = []) {
  const step = Math.min(dt, 0.05);
  const throttle = THREE.MathUtils.clamp(ctl.throttle || 0, -1, 1);
  const steer = THREE.MathUtils.clamp(ctl.steer || 0, -1, 1);
  const drag = 0.22 + Math.abs(car.speed) * 0.012;
  if (Math.abs(throttle) > 0.01) car.speed += throttle * car.accel * step;
  else car.speed *= Math.max(0, 1 - drag * step);
  if (ctl.brake) car.speed *= Math.max(0, 1 - 4.8 * step);
  car.speed = THREE.MathUtils.clamp(car.speed, -car.topSpeed * 0.32, car.topSpeed);
  const grip = car.grip / (1 + Math.abs(car.speed) * 0.048);
  car.heading += steer * grip * step * (car.speed < 0 ? -1 : 1);
  const p = car.mesh.position;
  p.x += Math.sin(car.heading) * car.speed * step;
  p.z += Math.cos(car.heading) * car.speed * step;
  resolveCollisions(car, colliders);
  car.mesh.rotation.y = car.heading;
  const wheels = car.mesh.userData.wheels;
  const steeringWheels = car.mesh.userData.steeringWheels;
  const spin = car.speed * step / car.mesh.userData.wheelRadius;
  for (const wheel of wheels) {
    wheel.children[0].rotation.y += spin;
    wheel.children[1].rotation.y += spin;
  }
  for (const wheel of steeringWheels) wheel.rotation.y = steer * 0.46;
}

export function collideCars(a, b) {
  const ap = a.mesh.position;
  const bp = b.mesh.position;
  const extent = (car) => {
    const c = car.mesh.userData.collider;
    const x = Math.abs(Math.cos(car.heading));
    const z = Math.abs(Math.sin(car.heading));
    return { x: x * c.hw + z * c.hd, z: z * c.hw + x * c.hd };
  };
  const ea = extent(a);
  const eb = extent(b);
  const dx = bp.x - ap.x;
  const dz = bp.z - ap.z;
  const overlapX = ea.x + eb.x - Math.abs(dx);
  const overlapZ = ea.z + eb.z - Math.abs(dz);
  if (overlapX <= 0 || overlapZ <= 0) return false;
  const closing = a.speed - b.speed;
  const impact = Math.abs(closing) * 0.55 + Math.min(overlapX, overlapZ) * 0.7;
  if (overlapX < overlapZ) {
    const sign = Math.sign(dx || 1);
    ap.x -= sign * overlapX * 0.51;
    bp.x += sign * overlapX * 0.51;
  } else {
    const sign = Math.sign(dz || 1);
    ap.z -= sign * overlapZ * 0.51;
    bp.z += sign * overlapZ * 0.51;
  }
  a.speed -= closing * 0.48;
  b.speed += closing * 0.48;
  a._collisionFrames = b._collisionFrames = 12;
  a.health = Math.max(0, a.health - impact);
  b.health = Math.max(0, b.health - impact);
  return true;
}

export function spawnParkedCars(scene, rng, city) {
  const kinds = Object.keys(CAR_KINDS);
  const colors = [0x4c8590, 0xd46c5f, 0xd1b75f, 0x52617b, 0xe7e0d0, 0x814f72];
  const parked = [];
  for (let z = -308; z <= 308; z += 56) for (let x = -308; x <= 308; x += 56) {
    if (!rng.chance(0.28)) continue;
    const axis = rng.chance(0.5);
    const car = createCar(scene, rng.pick(kinds), rng.pick(colors));
    car.heading = axis ? Math.PI / 2 : 0;
    car.mesh.rotation.y = car.heading;
    car.mesh.position.set(x + (axis ? 3 : -3), 0, z + (axis ? -3 : 3));
    if (city.colliders.some(c => Math.abs(c.x - car.mesh.position.x) < c.hw + 3 &&
      Math.abs(c.z - car.mesh.position.z) < c.hd + 3)) {
      scene.remove(car.mesh);
      continue;
    }
    parked.push(car);
  }
  return parked;
}
