// The city of Neon Harbor: streets, towers, palms, the beach and the bay.
// buildCity fills a three.js scene and returns the collision boxes every mover uses,
// plus an update hook that animates the water and the boats.

import * as THREE from 'three';
import { CITY, COLORS } from './config.js';

export const streetCentres = [];
for (let i = 0; i <= CITY.blocks; i++) streetCentres.push(-CITY.half + i * CITY.pitch);

const BUILDING_TINTS = [0xf6d8b1, 0xf2a65a, 0xe8836b, 0x9fd8c9, 0x7fb3d5, 0xd5a6bd, 0xf7ead1, 0x8ecae6, 0xf4f1de];
const NEON_TRIMS = [0x2ee6c8, 0xff6b5e, 0xffc44d, 0xff5e8a, 0x57b6ff];

function makeWindowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#cfd4d8'; g.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 8; x++) {
      const lit = ((x * 7 + y * 13) % 5) < 2;
      g.fillStyle = lit ? '#ffe9a8' : '#5a6a76';
      g.fillRect(8 + x * 15, 10 + y * 15, 9, 9);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSignTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 96);
  g.fillStyle = fg;
  g.font = 'bold 44px "Avenir Next", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2e353d'; g.fillRect(0, 0, 64, 128);
  g.fillStyle = '#ffd94d';
  g.fillRect(28, 6, 8, 48);
  g.fillRect(28, 74, 8, 48);
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fillRect(2, 0, 3, 128); g.fillRect(59, 0, 3, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Push a circle at (pos.x, pos.z) out of every AABB collider; returns true if it hit anything. */
export function resolveCollisions(pos, radius, colliders) {
  let hit = false;
  for (const b of colliders) {
    const nx = Math.max(b.minX - radius, Math.min(pos.x, b.maxX + radius));
    const nz = Math.max(b.minZ - radius, Math.min(pos.z, b.maxZ + radius));
    // Only resolve when the circle centre is inside the expanded box.
    if (pos.x > b.minX - radius && pos.x < b.maxX + radius && pos.z > b.minZ - radius && pos.z < b.maxZ + radius) {
      const dxl = pos.x - (b.minX - radius), dxr = (b.maxX + radius) - pos.x;
      const dzl = pos.z - (b.minZ - radius), dzr = (b.maxZ + radius) - pos.z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) pos.x = b.minX - radius;
      else if (m === dxr) pos.x = b.maxX + radius;
      else if (m === dzl) pos.z = b.minZ - radius;
      else pos.z = b.maxZ + radius;
      hit = true;
    }
  }
  return hit;
}

export function isOnRoad(x, z) {
  const halfRoad = CITY.roadWidth / 2 + 1;
  for (const s of streetCentres) {
    if (Math.abs(x - s) < halfRoad || Math.abs(z - s) < halfRoad) return true;
  }
  return false;
}

function addSign(parent, text, bg, fg, w, h, pos, rotY) {
  const tex = makeSignTexture(text, bg, fg);
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.copy(pos);
  mesh.rotation.y = rotY;
  parent.add(mesh);
  return mesh;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const animated = { water: null, boats: [] };

  // --- light and air ---
  scene.background = new THREE.Color(COLORS.sky);
  scene.fog = new THREE.Fog(COLORS.fog, 190, 620);
  const hemi = new THREE.HemisphereLight(0xcfeaff, 0x8a7a5a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(COLORS.sun, 2.0);
  sun.position.set(-160, 240, -120);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  // --- ground, roads, beach, water ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1500, 1500),
    new THREE.MeshLambertMaterial({ color: 0xa9b39a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);

  const roadTex = makeRoadTexture();
  const span = CITY.half * 2 + CITY.pitch;
  roadTex.repeat.set(1, span / 26);
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const geoV = new THREE.PlaneGeometry(CITY.roadWidth, span);
  geoV.rotateX(-Math.PI / 2); // lies flat, length running along Z
  const geoH = new THREE.PlaneGeometry(CITY.roadWidth, span);
  geoH.rotateX(-Math.PI / 2);
  geoH.rotateY(Math.PI / 2); // lies flat, length running along X
  for (const s of streetCentres) {
    const v = new THREE.Mesh(geoV, roadMat);
    v.position.set(s, 0.02, 0);
    scene.add(v);
    const h = new THREE.Mesh(geoH, roadMat);
    h.position.set(0, 0.021, s);
    scene.add(h);
  }

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 1500),
    new THREE.MeshLambertMaterial({ color: COLORS.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CITY.beachX + 32, 0.0, 0);
  scene.add(sand);

  const boardwalk = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.35, 760),
    new THREE.MeshLambertMaterial({ color: 0xa97c50 }),
  );
  boardwalk.position.set(CITY.beachX - 2, 0.18, 0);
  scene.add(boardwalk);

  const waterGeo = new THREE.PlaneGeometry(760, 1500, 40, 60);
  const water = new THREE.Mesh(waterGeo, new THREE.MeshPhongMaterial({
    color: COLORS.water, shininess: 120, specular: 0xbfefff, transparent: true, opacity: 0.92,
  }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(CITY.waterX + 380, -0.5, 0);
  scene.add(water);
  animated.water = water;
  animated.waterBase = waterGeo.attributes.position.array.slice();

  // --- shared building kit ---
  const winTex = makeWindowTexture();
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  unitBox.translate(0, 0.5, 0);
  const tintMats = BUILDING_TINTS.map((tint) => new THREE.MeshLambertMaterial({
    color: tint, map: winTex, emissive: 0xffca7a, emissiveMap: winTex, emissiveIntensity: 0.38,
  }));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6b7178 });
  const trimMats = NEON_TRIMS.map((c) => new THREE.MeshBasicMaterial({ color: c }));
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: COLORS.sidewalk });
  const lotMat = new THREE.MeshLambertMaterial({ color: COLORS.pad });

  function addBuilding(cx, cz, w, d, h, mat) {
    const m = new THREE.Mesh(unitBox, mat);
    m.position.set(cx - w / 2, 0, cz - d / 2);
    m.scale.set(w, h, d);
    scene.add(m);
    const roof = new THREE.Mesh(unitBox, roofMat);
    roof.position.set(cx - w / 2 + 1.5, h, cz - d / 2 + 1.5);
    roof.scale.set(Math.max(2, w - 6), 1.6, Math.max(2, d - 6));
    scene.add(roof);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    return m;
  }

  // Landmark pads are placed by hand; the generic filler skips them.
  const landmarks = [
    { cx: -87, cz: -203, w: 34, d: 30, h: 34, tint: 0xf4f6f8, sign: ['HARBOR GENERAL', '#f4f6f8', '#d43a2e'], signPos: 'south' },
    { cx: 87, cz: 203, w: 34, d: 30, h: 26, tint: 0x33507a, sign: ['NH POLICE — CENTRAL', '#1c2f4a', '#fdf6e9'], signPos: 'north' },
    { cx: -203, cz: 29, w: 30, d: 26, h: 20, tint: 0x2b2140, sign: ['CLUB SABLE', '#ff5e8a', '#ffe9f4'], signPos: 'east' },
    { cx: -203, cz: -203, w: 36, d: 30, h: 11, tint: 0x707880, sign: ['BREAKWATER GARAGE', '#37414c', '#ffc44d'], signPos: 'west' },
  ];
  const landmarkPads = new Set(landmarks.map((l) => `${l.cx},${l.cz}`));
  for (const l of landmarks) {
    const mat = new THREE.MeshLambertMaterial({
      color: l.tint, map: winTex, emissive: 0xffca7a, emissiveMap: winTex, emissiveIntensity: 0.3,
    });
    addBuilding(l.cx, l.cz, l.w, l.d, l.h, mat);
    const holder = new THREE.Group();
    scene.add(holder);
    if (l.signPos === 'south') addSign(holder, ...l.sign, 22, 4.2, new THREE.Vector3(l.cx, l.h * 0.62, l.cz + l.d / 2 + 0.15), 0);
    if (l.signPos === 'north') addSign(holder, ...l.sign, 22, 4.2, new THREE.Vector3(l.cx, l.h * 0.62, l.cz - l.d / 2 - 0.15), Math.PI);
    if (l.signPos === 'east') addSign(holder, ...l.sign, 20, 4, new THREE.Vector3(l.cx + l.w / 2 + 0.15, l.h * 0.6, l.cz), Math.PI / 2);
    if (l.signPos === 'west') addSign(holder, ...l.sign, 22, 3.6, new THREE.Vector3(l.cx - l.w / 2 - 0.15, l.h * 0.55, l.cz), -Math.PI / 2);
  }
  // The garage gets a dark roller door the size of a car.
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.4, 9), new THREE.MeshLambertMaterial({ color: 0x232a31 }));
  door.position.set(-203 - 18 - 0.2, 2.7, -203);
  scene.add(door);

  // --- generic blocks ---
  const padCentres = [];
  for (let i = 0; i < CITY.blocks; i++) padCentres.push(-CITY.half + CITY.pitch / 2 + i * CITY.pitch);
  for (const cx of padCentres) {
    for (const cz of padCentres) {
      if (landmarkPads.has(`${cx},${cz}`)) continue;
      const walk = new THREE.Mesh(unitBox, sidewalkMat);
      walk.position.set(cx - 23, 0, cz - 23);
      walk.scale.set(46, 0.3, 46);
      scene.add(walk);
      const lot = new THREE.Mesh(unitBox, lotMat);
      lot.position.set(cx - 20, 0.3, cz - 20);
      lot.scale.set(40, 0.22, 40);
      scene.add(lot);
      const style = rng.next();
      if (cx === 145 && cz === 145) {
        // Palm Court park: lawn, palms and a fountain, no towers.
        continue;
      }
      if (style < 0.42) {
        const w = rng.range(22, 32), d = rng.range(22, 32), h = rng.range(26, 68);
        const b = addBuilding(cx, cz, w, d, h, rng.pick(tintMats));
        if (rng.chance(0.55)) {
          const trim = new THREE.Mesh(unitBox, rng.pick(trimMats));
          trim.position.set(cx - w / 2 - 0.4, h + 1.4, cz - d / 2 - 0.4);
          trim.scale.set(w + 0.8, 0.7, d + 0.8);
          scene.add(trim);
        }
      } else {
        const spots = [[-10, -10], [10, -10], [-10, 10], [10, 10]];
        const n = rng.int(2, 4);
        for (let k = 0; k < n; k++) {
          const [ox, oz] = spots[k];
          addBuilding(cx + ox, cz + oz, rng.range(13, 18), rng.range(13, 18), rng.range(8, 30), rng.pick(tintMats));
        }
      }
    }
  }

  // --- palms and streetlights ---
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 5, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: COLORS.palmTrunk });
  const frondGeo = new THREE.PlaneGeometry(3.4, 0.85);
  frondGeo.translate(1.55, 0, 0);
  const frondMat = new THREE.MeshLambertMaterial({ color: COLORS.palmLeaf, side: THREE.DoubleSide });
  function addPalm(x, z, s) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2.5;
    trunk.rotation.z = rng.range(-0.09, 0.09);
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(frondGeo, frondMat);
      f.position.y = 5;
      f.rotation.y = (i / 6) * Math.PI * 2 + rng.range(-0.2, 0.2);
      f.rotation.z = -0.55;
      g.add(f);
    }
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    scene.add(g);
  }
  for (let z = -340; z <= 340; z += 24) addPalm(CITY.beachX - 8 + rng.range(-2, 2), z + rng.range(-5, 5), rng.range(0.9, 1.3));
  for (const cx of padCentres) for (const cz of padCentres) {
    if (rng.chance(0.5)) addPalm(cx + rng.range(-19, 19), cz + (rng.chance(0.5) ? -21 : 21), rng.range(0.75, 1.05));
  }
  for (let a = 0; a < 10; a++) addPalm(145 + rng.range(-17, 17), 145 + rng.range(-17, 17), rng.range(0.9, 1.25));

  const poleGeo = new THREE.CylinderGeometry(0.09, 0.09, 6.4, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x4a5058 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  for (const s of streetCentres) {
    for (let t = -CITY.half + 20; t < CITY.half; t += 58) {
      for (const off of [-9.5, 9.5]) {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(s + off, 3.2, t + (off > 0 ? 14 : -14));
        scene.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), lampMat);
        lamp.position.set(s + off, 6.5, t + (off > 0 ? 14 : -14));
        scene.add(lamp);
      }
    }
  }

  // --- the marina: pier, boats, boardwalk life ---
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6844 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(95, 1, 10), pierMat);
  pier.position.set(315, 0.7, 150);
  scene.add(pier);
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xf2f4f6 });
  const sailMat = new THREE.MeshLambertMaterial({ color: 0xff8c42 });
  for (let i = 0; i < 6; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, 2.6), i % 2 ? hullMat : sailMat);
    hull.position.y = 0.4;
    boat.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 6, 5), poleMat);
    mast.position.y = 3.6;
    boat.add(mast);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 4.2), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    sail.position.set(1.2, 3.4, 0);
    boat.add(sail);
    boat.position.set(330 + (i % 3) * 26, 0, 128 + Math.floor(i / 3) * 44);
    boat.rotation.y = rng.range(-0.4, 0.4);
    scene.add(boat);
    animated.boats.push({ group: boat, phase: rng.range(0, 6) });
  }

  // --- the freight docks: warehouse, crates, a crane ---
  const warehouse = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: 0xb5533c, map: winTex }));
  warehouse.position.set(238, 0, -186);
  warehouse.scale.set(34, 13, 26);
  scene.add(warehouse);
  colliders.push({ minX: 238, maxX: 272, minZ: -186, maxZ: -160 });
  const crateMats = [0xc96f2e, 0x2e7fc9, 0x53a05a, 0x8e6fc8].map((c) => new THREE.MeshLambertMaterial({ color: c }));
  for (let i = 0; i < 14; i++) {
    const s = rng.range(2.2, 3.6);
    const crate = new THREE.Mesh(unitBox, rng.pick(crateMats));
    const cx = rng.range(232, 262), cz = rng.range(-198, -154);
    crate.position.set(cx, 0, cz);
    crate.scale.set(s, s, s);
    crate.rotation.y = rng.range(0, 3);
    scene.add(crate);
    colliders.push({ minX: cx - s / 2, maxX: cx + s / 2, minZ: cz - s / 2, maxZ: cz + s / 2 });
  }
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xf2b13d });
  const legA = new THREE.Mesh(new THREE.BoxGeometry(1.2, 22, 1.2), craneMat);
  legA.position.set(246, 11, -138);
  scene.add(legA);
  const legB = legA.clone();
  legB.position.z = -158;
  scene.add(legB);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 24), craneMat);
  beam.position.set(246, 22, -148);
  scene.add(beam);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(30, 1.2, 1.2), craneMat);
  jib.position.set(258, 22.6, -148);
  scene.add(jib);

  // Fountain in Palm Court.
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6, 1, 20), sidewalkMat);
  basin.position.set(145, 0.5, 145);
  scene.add(basin);
  const fountainWater = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.5, 20),
    new THREE.MeshPhongMaterial({ color: COLORS.water, shininess: 140 }));
  fountainWater.position.set(145, 0.95, 145);
  scene.add(fountainWater);
  colliders.push({ minX: 139, maxX: 151, minZ: 139, maxZ: 151 });

  function update(dt, t) {
    if (animated.water) {
      const pos = animated.water.geometry.attributes.position;
      const base = animated.waterBase;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        pos.array[i * 3 + 2] = Math.sin(x * 0.05 + t * 1.3) * 0.32 + Math.cos(y * 0.045 + t * 0.9) * 0.28;
      }
      pos.needsUpdate = true;
    }
    for (const b of animated.boats) {
      b.group.position.y = Math.sin(t * 1.1 + b.phase) * 0.22 - 0.1;
      b.group.rotation.z = Math.sin(t * 0.9 + b.phase) * 0.03;
    }
  }

  return { colliders, update };
}
