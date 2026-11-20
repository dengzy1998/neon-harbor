import * as THREE from 'three';

export const CITY = { half: 340, block: 56, road: 16 };
const district = (name, palette, minX, maxX, minZ, maxZ) =>
  ({ name, palette, bounds: { minX, maxX, minZ, maxZ } });

// Bounds are half-open, with the edge district continuing outside the playable map.
export const DISTRICTS = [
  district('Old Town', [0xe7a393, 0xedd6ae, 0x8fbdb6, 0xcbabc9], -340, 224, -112, 112),
  district('Palm Strand', [0xf3c0a0, 0xf5e3c5, 0x7cc6b6], 224, 340, -340, 340),
  district('Freight Docks', [0x597f83, 0xa96653, 0xc2a279], -340, 0, 112, 340),
  district('Lantern Quarter', [0x784f69, 0x516980, 0xab7573], 0, 224, 112, 340),
  district('North Heights', [0xede1cb, 0xded0b6, 0xe8d9df], -340, 224, -340, -112),
];

export function districtAt(x, z) {
  x = THREE.MathUtils.clamp(x, -340, 339.999);
  z = THREE.MathUtils.clamp(z, -340, 339.999);
  return DISTRICTS.find(({ bounds: b }) =>
    x >= b.minX && x < b.maxX && z >= b.minZ && z < b.maxZ);
}

function windows(rng) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e2d6cc';
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 4; y++) {
    ctx.fillStyle = '#b8a7a1';
    ctx.fillRect(0, y * 32 + 28, 128, 3);
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = '#746966';
      ctx.fillRect(x * 32 + 6, y * 32 + 4, 20, 20);
      ctx.fillStyle = rng.pick(['#394b58', '#526572', '#ffe2a5', '#ffbd80']);
      ctx.fillRect(x * 32 + 8, y * 32 + 5, 16, 16);
      ctx.fillStyle = '#9e918a';
      ctx.fillRect(x * 32 + 15, y * 32 + 5, 2, 16);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  group.name = 'Neon Harbor';
  const colliders = [];
  const places = {
    docks: { x: -168, z: 203 }, club: { x: 112, z: 151 },
    garage: { x: -56, z: 31 }, raceStart: { x: 224, z: -35 },
    strand: { x: 280, z: 23 },
  };
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const trunk = new THREE.CylinderGeometry(0.63, 1, 1, 7);
  const leaf = new THREE.SphereGeometry(1, 7, 4);
  const mats = new Map();
  const batches = new Map();
  const pose = new THREE.Object3D();
  const win = windows(rng);
  const facades = new Map();
  function mat(color, glow = false) {
    const key = `${color}:${glow}`;
    if (!mats.has(key)) mats.set(key, glow
      ? new THREE.MeshBasicMaterial({ color })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.88 }));
    return mats.get(key);
  }
  function piece(g, m, x, y, z, w, h, d, shadow = true, rx = 0, ry = 0, rz = 0) {
    const key = `${g.id}:${Array.isArray(m) ? m.map(v => v.id).join(',') : m.id}:${shadow}`;
    if (!batches.has(key)) batches.set(key, { g, m, shadow, poses: [] });
    pose.position.set(x, y, z);
    pose.scale.set(w, h, d);
    pose.rotation.set(rx, ry, rz);
    pose.updateMatrix();
    batches.get(key).poses.push(pose.matrix.clone());
  }
  function box(color, x, y, z, w, h, d, shadow = true, ry = 0) {
    piece(cube, mat(color), x, y, z, w, h, d, shadow, 0, ry);
  }
  function building(x, z, w, h, d, color, levels) {
    const key = `${color}:${levels}`;
    if (!facades.has(key)) {
      const tex = win.clone();
      tex.repeat.set(1, levels);
      tex.needsUpdate = true;
      const wall = new THREE.MeshStandardMaterial({ color, map: tex, roughness: 0.84 });
      const slab = mat(color);
      facades.set(key, [wall, wall, slab, slab, wall, wall]);
    }
    piece(cube, facades.get(key), x, 0.24 + h / 2, z, w, h, d);
    box(color, x, h + 0.48, z, w + 0.65, 0.48, d + 0.65);
    box(0x797477, x + w * 0.2, h + 0.97, z - d * 0.18, w * 0.25, 0.5, d * 0.22);
    colliders.push({ x, z, hw: w / 2, hd: d / 2 });
  }
  function palm(x, z) {
    const h = rng.range(4.5, 6.6);
    piece(trunk, mat(0x9a7354), x, h / 2, z, 0.23, h, 0.23);
    const turn = rng.range(0, Math.PI * 2);
    for (let i = 0; i < 6; i++) {
      const a = turn + i * Math.PI / 3;
      piece(leaf, mat(i % 2 ? 0x517949 : 0x71954e),
        x + Math.sin(a) * 1.12, h, z + Math.cos(a) * 1.12,
        0.43, 0.16, 1.62, true, 0.25, a);
    }
  }
  function lamp(x, z) {
    box(0x4c5560, x, 2.25, z, 0.12, 4.5, 0.12);
    box(0x4c5560, x - 0.3, 4.49, z, 0.7, 0.14, 0.25);
    piece(cube, mat(0xffdf9f, true), x - 0.53, 4.39, z, 0.27, 0.06, 0.22, false);
  }
  function sign(label, x, y, z, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#292236';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = ctx.fillStyle = color;
    ctx.strokeRect(4, 4, 248, 56);
    ctx.font = 'bold 25px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillText(label, 128, 33, 235);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 2),
      new THREE.MeshBasicMaterial({ map, toneMapped: false }));
    mesh.position.set(x, y, z);
    group.add(mesh);
  }

  box(0xe6c696, -3, -0.35, 0, 680, 0.5, 680, false);
  box(0x4e505c, -28, -0.1, 0, 624, 0.2, 680, false);
  // A shallow offshore shelf catches the sun along the coast.
  for (const [x, width, color] of [[365, 50, 0x58b7b1], [590, 400, 0x40999f], [1590, 1600, 0x377f93]]) {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(width, 1850),
      new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.12 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, -0.15, 0);
    group.add(water);
  }
  for (let i = 0; i < 52; i++) {
    box(0xc8e1ce, rng.range(337.5, 348), -0.13, rng.range(-340, 340),
      rng.range(0.2, 1), 0.025, rng.range(2, 16), false);
  }
  // Palm Strand's eastern lane reaches the boardwalk at x=294.
  box(0x4e505c, 288, -0.08, 0, 12, 0.2, 672, false);
  box(0x997858, 297, 0.12, 0, 7, 0.32, 672);
  for (let z = -332; z <= 332; z += 1.25) box(0xbc9672, 297, 0.29, z, 7, 0.025, 1.19, false);
  for (let z = -322; z <= 322; z += 19) {
    palm(306 + rng.range(-1, 3), z);
    box(0x92684e, 294.5, 0.67, z, 0.65, 0.17, 2.5);
    for (const dz of [-0.89, 0.89]) box(0x4f555b, 294.5, 0.46, z + dz, 0.45, 0.35, 0.16);
  }

  for (let i = -6; i <= 6; i++) {
    for (let j = -6; j < 6; j++) {
      for (const k of [13, 23, 33, 43]) {
        if (i <= 5) box(0xe3bf79, i * 56, 0.012, j * 56 + k, 0.13, 0.024, 3, false);
        if (j < 5) box(0xe3bf79, j * 56 + k, 0.012, i * 56, 3, 0.024, 0.13, false);
      }
      if (i > -6 && i < 6 && j > -6 && j < 5) {
        for (let k = -3; k <= 3; k++) {
          box(0xddd5c5, j * 56 + k * 1.7, 0.015, i * 56 + 6.4, 0.75, 0.026, 2, false);
          box(0xddd5c5, j * 56 + 6.4, 0.015, i * 56 + k * 1.7, 2, 0.026, 0.75, false);
        }
      }
    }
  }

  for (let ix = -6; ix < 5; ix++) for (let iz = -6; iz < 6; iz++) {
    const x = (ix + 0.5) * 56;
    const z = (iz + 0.5) * 56;
    const area = districtAt(x, z);
    const north = area === DISTRICTS[4];
    const curb = north ? 18 : 20;
    box(0xc9b7a7, x, 0.1, z, curb * 2, 0.28, curb * 2, false);
    lamp(x + curb - 1.3, z - curb + 1.3);
    if (area === DISTRICTS[2]) {
      building(x - 4, z - 5, 27, rng.range(5, 9), 21, rng.pick(area.palette), 1);
      for (let n = 0; n < 3; n++) {
        const cx = x - 11 + n * 9;
        const color = rng.pick([0xac5748, 0x417c88, 0xd29752]);
        box(color, cx, 1.42, z + 11, 7.6, 2.35, 4.1);
        colliders.push({ x: cx, z: z + 11, hw: 3.8, hd: 2.05 });
        for (let rib = -3; rib <= 3; rib++) box(0x655c5a, cx + rib, 1.42, z + 13.08, 0.07, 2.28, 0.08, false);
      }
      if (rng.chance(0.58)) {
        for (let n = 0; n < 2; n++) {
          const cx = x + 12.5 + n * 1.35;
          const cz = z + 7;
          box(0xa77a49, cx, 0.58, cz, 1.2, 1.16, 1.2);
          box(0x654c3c, cx, 0.58, cz + 0.62, 1.24, 1.18, 0.08, false);
          box(0x654c3c, cx + 0.32, 0.58, cz, 0.08, 1.18, 1.22, false);
          colliders.push({ x: cx, z: cz, hw: 0.6, hd: 0.6 });
        }
      }
      if ((ix + iz) % 3 === 0) {
        box(0xd5a449, x + 14, 9, z + 8, 1.2, 18, 1.2);
        box(0xd5a449, x + 6, 17.5, z + 8, 18, 0.85, 0.85);
        box(0x555861, x - 2, 14, z + 8, 0.06, 6.4, 0.06);
        colliders.push({ x: x + 14, z: z + 8, hw: 0.6, hd: 0.6 });
      }
    } else {
      for (const dx of [-9.4, 9.4]) for (const dz of [-9.4, 9.4]) {
        const old = area === DISTRICTS[0];
        const h = old ? rng.range(13, 44) : north ? rng.range(3.5, 7) : rng.range(5, 15);
        const w = rng.range(11.4, 15.8);
        const d = rng.range(11.4, 15.8);
        building(x + dx, z + dz, w, h, d, rng.pick(area.palette), old ? Math.round(h / 10) : 1);
        if (dz > 0 && area === DISTRICTS[3] && (rng.chance(0.32) || (ix === 2 && iz === 2 && dx < 0))) {
          const isClub = ix === 2 && iz === 2 && dx < 0;
          sign(isClub ? 'GLOW ROOM' : rng.pick(['NIGHT TEA', 'VELVET', 'LANTERN CUTS']),
            x + dx, 3.55, z + dz + d / 2 + 0.04, rng.pick(['#ff74b7', '#75f7ea', '#ffbd72']));
        }
      }
      if (area === DISTRICTS[1] || north) palm(x - 18.5, z + 17.2);
    }
  }
  for (const { g, m, shadow, poses } of batches.values()) {
    const mesh = new THREE.InstancedMesh(g, m, poses.length);
    poses.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  scene.add(group);
  return { group, places, colliders };
}
