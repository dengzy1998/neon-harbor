// city.js — builds the whole of Neon Harbor into the scene: the street grid
// with sidewalks and lane markings, pastel tower blocks with neon roof trim,
// signed landmark buildings, palms and streetlights, a park, the marina with
// bobbing boats, the freight docks, the beach and the animated sea. It also
// hands back the building colliders every other system collides against, and
// small helpers that answer "is this point on a road" and "which district".

import * as THREE from 'three';
import {
  ROAD_LINES, ROAD_HALF, SIDEWALK, CITY_EDGE, PROMENADE_Z, BEACH_Z, WATER_Z,
  COLORS, PLACES,
} from './config.js';

const SPAN = CITY_EDGE + 14; // streets run a little past the last junction

export function isRoad(x, z) {
  if (z > ROAD_LINES[ROAD_LINES.length - 1] + ROAD_HALF) return false;
  for (const line of ROAD_LINES) {
    if (Math.abs(x - line) <= ROAD_HALF || Math.abs(z - line) <= ROAD_HALF) return true;
  }
  return false;
}

export function districtAt(x, z) {
  if (z >= PROMENADE_Z) return x < -60 ? 'Harbor Freight Docks' : x > 55 ? 'Marina District' : 'Coral Bay Boardwalk';
  if (z < -118) return 'Sunspire Heights';
  if (x > 118) return 'Velvetine Row';
  if (x < -118) return 'The Flats';
  if (Math.abs(x) < 46 && Math.abs(z) < 46) return 'Old Town';
  return 'Neon Harbor';
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function facadeTexture(base, rng) {
  return canvasTexture(128, 256, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 128, 256);
    for (let row = 0; row < 11; row++) {
      for (let col = 0; col < 5; col++) {
        const lit = rng.chance(0.42);
        g.fillStyle = lit ? (rng.chance(0.6) ? '#ffe9a8' : '#bfe9ff') : '#2c3e50';
        g.fillRect(10 + col * 23, 12 + row * 22, 14, 13);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 244, 128, 12);
  });
}

function signTexture(text, color) {
  return canvasTexture(512, 112, (g) => {
    g.fillStyle = '#10161f'; g.fillRect(0, 0, 512, 112);
    g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(7, 7, 498, 98);
    g.fillStyle = color; g.font = 'bold 52px "Segoe UI", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 60);
  });
}

function roadTexture() {
  const tex = canvasTexture(64, 256, (g) => {
    g.fillStyle = '#35393f'; g.fillRect(0, 0, 64, 256);
    g.fillStyle = '#f5d76e';
    for (let y = 8; y < 256; y += 42) g.fillRect(29, y, 6, 24);
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(2, 0, 3, 256); g.fillRect(59, 0, 3, 256);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const LANDMARKS = [
  { place: PLACES.hospital, label: 'ST. CORAL GENERAL', color: '#7bf1a8', height: 22, body: 0xf2f0eb },
  { place: PLACES.policeStation, label: 'NHPD — POLICE', color: '#7cc4ff', height: 15, body: 0xdfe7ee },
  { place: PLACES.club, label: 'CLUB VELVETINE', color: '#f471b5', height: 13, body: 0x2b2135 },
  { place: PLACES.garage, label: "OTTO'S GARAGE", color: '#fbbf24', height: 8, body: 0xe8dcc8 },
];

function blockIndex(coord) {
  for (let i = 0; i < ROAD_LINES.length - 1; i++) {
    if (coord > ROAD_LINES[i] && coord < ROAD_LINES[i + 1]) return i;
  }
  return -1;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const boats = [];
  const group = new THREE.Group();
  scene.add(group);
  const add = (mesh) => { group.add(mesh); return mesh; };
  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

  const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

  // --- ground, sidewalks, asphalt -------------------------------------------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(460, 470), lambert(0xa9a294));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 8);
  ground.receiveShadow = true; add(ground);

  const walkMat = lambert(COLORS.sidewalk);
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const line of ROAD_LINES) {
    for (const alongX of [true, false]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(SPAN * 2, (ROAD_HALF + SIDEWALK) * 2), walkMat);
      walk.rotation.x = -Math.PI / 2; walk.rotation.z = alongX ? 0 : Math.PI / 2;
      walk.position.set(alongX ? 0 : line, 0.02, alongX ? line : 0);
      walk.receiveShadow = true; add(walk);
      const tex = roadTex.clone();
      tex.needsUpdate = true; tex.repeat.set(1, 26);
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(ROAD_HALF * 2, SPAN * 2),
        new THREE.MeshLambertMaterial({ map: tex }),
      );
      road.rotation.x = -Math.PI / 2; road.rotation.z = alongX ? Math.PI / 2 : 0;
      road.position.set(alongX ? 0 : line, 0.045, alongX ? line : 0);
      road.receiveShadow = true; add(road);
    }
  }

  // --- waterfront: boardwalk, beach, sea, marina, docks ----------------------
  const boardwalk = new THREE.Mesh(new THREE.PlaneGeometry(400, BEACH_Z - PROMENADE_Z), lambert(COLORS.boardwalk));
  boardwalk.rotation.x = -Math.PI / 2; boardwalk.position.set(8, 0.03, (PROMENADE_Z + BEACH_Z) / 2);
  boardwalk.receiveShadow = true; add(boardwalk);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(460, 26), lambert(COLORS.sand));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.02, BEACH_Z + 9);
  sand.receiveShadow = true; add(sand);
  const seaMat = new THREE.MeshPhongMaterial({ color: COLORS.sea, shininess: 140, specular: 0xbfefff });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 320), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.35, WATER_Z + 150);
  add(sea);

  const pierMat = lambert(0x8a5f43);
  for (let i = 0; i < 4; i++) {
    const px = 84 + i * 30;
    const pier = box(4, 1, 44, pierMat);
    pier.position.set(px, 0.4, WATER_Z + 16); pier.castShadow = true; add(pier);
    for (let b = 0; b < 2; b++) {
      const boat = new THREE.Group();
      const hull = box(3.2, 1.1, 8, lambert(rng.pick([0xffffff, 0xef6461, 0x4cc9f0, 0xffd166])));
      hull.position.y = 0.4; boat.add(hull);
      const cabin = box(2, 1, 2.6, lambert(0xf4fbff)); cabin.position.set(0, 1.3, -0.6); boat.add(cabin);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6), lambert(0xcccccc));
      mast.position.set(0, 3.6, 1.4); boat.add(mast);
      boat.position.set(px + (b === 0 ? -3.4 : 3.4), 0, WATER_Z + 8 + b * 17 + rng.range(-2, 2));
      boat.rotation.y = rng.range(-0.1, 0.1);
      add(boat); boats.push({ group: boat, phase: rng.range(0, 6) });
    }
  }

  // Freight docks: apron, warehouses, crates, containers, a crane.
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(122, 36), lambert(0x8f8b82));
  apron.rotation.x = -Math.PI / 2; apron.position.set(-128, 0.035, 184);
  apron.receiveShadow = true; add(apron);
  const warehouseMat = lambert(0x7d8ca3);
  for (const wx of [-162, -100]) {
    const wh = box(38, 11, 20, warehouseMat);
    wh.position.set(wx, 5.5, 172); wh.castShadow = true; wh.receiveShadow = true; add(wh);
    colliders.push({ minX: wx - 19, maxX: wx + 19, minZ: 162, maxZ: 182 });
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 5),
      new THREE.MeshBasicMaterial({ map: signTexture('HARBOR FREIGHT', '#22d3ee') }),
    );
    sign.position.set(wx, 8, 182.2); add(sign);
  }
  const crateMats = [lambert(0xc96f2e), lambert(0x2e86ab), lambert(0x62b04c), lambert(0xb04c62)];
  for (let i = 0; i < 16; i++) {
    const cx = rng.range(-178, -80), cz = rng.range(186, 200);
    const s = rng.range(2.2, 3.6);
    const crate = box(s, s, s, rng.pick(crateMats));
    crate.position.set(cx, s / 2, cz); crate.rotation.y = rng.range(0, 3);
    crate.castShadow = true; add(crate);
    colliders.push({ minX: cx - s / 2, maxX: cx + s / 2, minZ: cz - s / 2, maxZ: cz + s / 2 });
  }
  const craneMat = lambert(0xf4a259);
  const crane = new THREE.Group();
  const legA = box(1.2, 17, 1.2, craneMat); legA.position.set(-7, 8.5, 0); crane.add(legA);
  const legB = box(1.2, 17, 1.2, craneMat); legB.position.set(7, 8.5, 0); crane.add(legB);
  const boom = box(24, 1.4, 1.4, craneMat); boom.position.set(0, 17, 0); crane.add(boom);
  crane.position.set(-128, 0, 190); add(crane);
  colliders.push({ minX: -136, maxX: -120, minZ: 188, maxZ: 192 });

  // --- blocks: towers, landmarks, the park -----------------------------------
  const facades = COLORS.facade.map((c) => facadeTexture('#' + c.toString(16).padStart(6, '0'), rng));
  const trimMats = COLORS.roofTrim.map((c) => new THREE.MeshLambertMaterial({ color: 0x222222, emissive: c }));
  const roofMat = lambert(0x5b5348);
  const landmarkBlocks = new Map();
  for (const lm of LANDMARKS) {
    landmarkBlocks.set(blockIndex(lm.place.x) + ':' + blockIndex(lm.place.z), lm);
  }
  const PARK = '4:5';

  const buildTower = (cx, cz, w, d, h) => {
    const mat = new THREE.MeshLambertMaterial({ map: rng.pick(facades) });
    const tower = box(w, h, d, mat);
    tower.position.set(cx, h / 2, cz);
    tower.castShadow = true; tower.receiveShadow = true; add(tower);
    const roof = box(w + 0.5, 0.7, d + 0.5, roofMat);
    roof.position.set(cx, h + 0.35, cz); add(roof);
    const trim = box(w + 0.9, 0.32, d + 0.9, rng.pick(trimMats));
    trim.position.set(cx, h - 0.4, cz); add(trim);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  };

  for (let bx = 0; bx < ROAD_LINES.length - 1; bx++) {
    for (let bz = 0; bz < ROAD_LINES.length - 1; bz++) {
      const x0 = ROAD_LINES[bx] + ROAD_HALF + SIDEWALK, x1 = ROAD_LINES[bx + 1] - ROAD_HALF - SIDEWALK;
      const z0 = ROAD_LINES[bz] + ROAD_HALF + SIDEWALK, z1 = ROAD_LINES[bz + 1] - ROAD_HALF - SIDEWALK;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, key = bx + ':' + bz;
      const lm = landmarkBlocks.get(key);
      if (lm) {
        const body = box(17, lm.height, 15, lambert(lm.body));
        body.position.set(cx, lm.height / 2, cz);
        body.castShadow = true; body.receiveShadow = true; add(body);
        colliders.push({ minX: cx - 8.5, maxX: cx + 8.5, minZ: cz - 7.5, maxZ: cz + 7.5 });
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(15, 3.3),
          new THREE.MeshBasicMaterial({ map: signTexture(lm.label, lm.color) }),
        );
        sign.position.set(cx, lm.height - 2.2, cz + 7.6); add(sign);
        continue;
      }
      if (key === PARK) {
        const lawn = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), lambert(COLORS.grass));
        lawn.rotation.x = -Math.PI / 2; lawn.position.set(cx, 0.03, cz);
        lawn.receiveShadow = true; add(lawn);
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 1, 18), lambert(0xd8cfc0));
        basin.position.set(cx, 0.5, cz); basin.castShadow = true; add(basin);
        const pool = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.3, 18),
          new THREE.MeshPhongMaterial({ color: COLORS.sea, shininess: 120 }));
        pool.position.set(cx, 0.95, cz); add(pool);
        boats.push({ group: pool, phase: 0, fountain: true });
        colliders.push({ minX: cx - 3.8, maxX: cx + 3.8, minZ: cz - 3.8, maxZ: cz + 3.8 });
        continue;
      }
      if (rng.chance(0.55)) {
        buildTower(cx + rng.range(-1, 1), cz + rng.range(-1, 1), rng.range(12, 16), rng.range(12, 16), rng.range(14, 44));
      } else {
        buildTower(cx - 4.6, cz - 4.6, rng.range(7, 8.6), rng.range(7, 8.6), rng.range(7, 20));
        buildTower(cx + 4.6, cz + 4.6, rng.range(7, 8.6), rng.range(7, 8.6), rng.range(7, 24));
        if (rng.chance(0.5)) buildTower(cx + 4.6, cz - 4.6, rng.range(6, 8), rng.range(6, 8), rng.range(6, 16));
      }
    }
  }

  // --- palms and streetlights --------------------------------------------------
  const trunkMat = lambert(0x8a5f43);
  const frondMat = lambert(0x3e9b4f);
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 5.4, 6);
  const frondGeo = new THREE.ConeGeometry(0.5, 3.4, 5);
  const addPalm = (x, z, s) => {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2.7; trunk.rotation.z = 0.08; trunk.castShadow = true; palm.add(trunk);
    for (let f = 0; f < 6; f++) {
      const frond = new THREE.Mesh(frondGeo, frondMat);
      const a = (f / 6) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.1, 5.6, Math.sin(a) * 1.1);
      frond.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
      frond.scale.set(0.35, 1, 1);
      palm.add(frond);
    }
    palm.position.set(x, 0, z); palm.scale.setScalar(s);
    add(palm);
  };
  for (let x = -184; x <= 184; x += 16) addPalm(x + rng.range(-2, 2), PROMENADE_Z + 3.4, rng.range(0.9, 1.25));
  for (let i = 0; i < 42; i++) {
    const bx = rng.int(0, 7), bz = rng.int(0, 7);
    addPalm(
      ROAD_LINES[bx] + ROAD_HALF + 2 + rng.range(0, 14),
      ROAD_LINES[bz] + ROAD_HALF + 2 + rng.range(0, 14),
      rng.range(0.8, 1.15),
    );
  }
  const poleMat = lambert(0x3c4653);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x444444, emissive: 0xffca7a });
  for (const lx of ROAD_LINES) {
    for (const lz of ROAD_LINES) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5.6, 5), poleMat);
      pole.position.set(lx + ROAD_HALF + 1, 2.8, lz + ROAD_HALF + 1);
      add(pole);
      const lamp = box(0.5, 0.18, 0.5, lampMat);
      lamp.position.set(lx + ROAD_HALF + 1, 5.65, lz + ROAD_HALF + 1);
      add(lamp);
    }
  }

  return {
    colliders,
    update(t) {
      sea.position.y = -0.35 + Math.sin(t * 0.5) * 0.08;
      seaMat.color.setHSL(0.52, 0.75, 0.32 + Math.sin(t * 0.23) * 0.03);
      for (const b of boats) {
        if (b.fountain) { b.group.scale.y = 1 + Math.sin(t * 3) * 0.25; continue; }
        b.group.position.y = Math.sin(t * 0.9 + b.phase) * 0.16;
        b.group.rotation.z = Math.sin(t * 0.7 + b.phase) * 0.03;
      }
    },
  };
}

// Resolve a circle (x, z, radius) against the building colliders: pushes the
// point out along the smallest penetration axis. Returns true when it hit.
export function collideCircle(colliders, pos, radius) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * radius;
      pos.z = nz + (dz / d) * radius;
    } else {
      const left = pos.x - c.minX, right = c.maxX - pos.x;
      const top = pos.z - c.minZ, bottom = c.maxZ - pos.z;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = c.minX - radius;
      else if (m === right) pos.x = c.maxX + radius;
      else if (m === top) pos.z = c.minZ - radius;
      else pos.z = c.maxZ + radius;
    }
  }
  return hit;
}
