// Neon Harbor — boot, the loop, the camera, and every wire between the systems.
// The city, traffic, walkers, police, missions, HUD and sound are their own files;
// this one owns the game state (menu, story, play, pause, the end of a chase) and
// the frame-by-frame conversation between them.

import * as THREE from 'three';
import { CITY, TUNING, PLACES, STORY } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { TrafficSystem } from './traffic.js';
import { PedestrianSystem } from './pedestrians.js';
import { PoliceSystem } from './police.js';
import { Player } from './player.js';
import { Hud } from './hud.js';
import { SoundBank } from './audio.js';
import { MissionSystem } from './missions.js';
import { loadSave, writeSave, clearSave } from './savegame.js';
import { stepCar, collideCars } from './vehicles.js';

const params = new URLSearchParams(window.location.search);
const sceneName = params.get('scene');
const staged = ['cover', 'drive', 'chase', 'mission'].includes(sceneName);

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const stage = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1600);
camera.position.set(-140, 60, -140);

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- build the world ---
const cityRng = createRandom(20261117);
const gameRng = createRandom(424243);
const city = buildCity(stage, cityRng);
const traffic = new TrafficSystem(stage, gameRng, city.colliders);
traffic.spawnTraffic(TUNING.trafficCount);
traffic.spawnParked(TUNING.parkedCount);

let cash = 60;
let state = 'menu';            // menu | story | play | pause | end
let time = 0;
let crimeCd = 0;
let saveT = 0;
let vignetteFlash = 0;
let punchThreats = [];

const hud = new Hud();
const sound = new SoundBank();
const police = new PoliceSystem(stage, gameRng, city.colliders, {
  onBusted: () => endRun('busted'),
  onPlayerShot: (dmg) => {
    player.damage(dmg);
    sound.shot();
    vignetteFlash = 0.55;
  },
});
const player = new Player(stage, city.colliders, {
  onPunch: (x, z) => {
    sound.punch();
    punchThreats.push({ kind: 'punch', x, z, ttl: 0.4 });
    for (const ped of peds.peds) {
      const d = Math.hypot(ped.mesh.position.x - x, ped.mesh.position.z - z);
      if (d < 1.6 && ped.mode !== 'down') {
        peds.knockDown(ped, 'punch');
        police.addCrime('pedPunch');
        break;
      }
    }
  },
});
const peds = new PedestrianSystem(stage, gameRng, city.colliders, (ped, cause) => {
  if (cause !== 'car' || state !== 'play') return;
  if (player.inCar && Math.hypot(player.pos.x - ped.mesh.position.x, player.pos.z - ped.mesh.position.z) < 7) {
    police.addCrime('pedCar');
    sound.thud(0.7);
    vignetteFlash = Math.max(vignetteFlash, 0.3);
  }
});
peds.spawn(TUNING.pedCount);

const facade = {
  player, police, traffic, hud, sound,
  addCash(n) { cash += n; hud.setCash(cash); persist(); },
  toast(t) { hud.toast(t); },
  showStory(name, text, cb) { showStoryCard(name, text, cb); },
  crime(kind) { police.addCrime(kind); },
};
const missions = new MissionSystem(stage, facade, gameRng);

// --- save / restore ---
function persist() {
  writeSave({
    cash,
    missionIndex: missions.missionIndex,
    jobsDone: missions.jobsDone,
    muted: sound.muted,
    pos: { x: Math.round(player.pos.x), z: Math.round(player.pos.z) },
  });
}

const existingSave = loadSave();
if (existingSave) {
  sound.setMuted(existingSave.muted);
  document.getElementById('chk-mute').checked = existingSave.muted;
  document.getElementById('chk-mute-2').checked = existingSave.muted;
} else {
  document.getElementById('btn-continue').disabled = true;
}

// --- input ---
const keys = {};
let interactQueued = false;
addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  if (!e.repeat) {
    if (e.code === 'KeyE') interactQueued = true;
    if (e.code === 'KeyM') toggleMute();
    if (e.code === 'KeyP') {
      if (state === 'play') pauseGame();
      else if (state === 'pause') resumeGame();
    }
  }
  keys[e.code] = true;
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

let cameraYaw = player.heading;
let cameraPitch = 0.32;
canvas.addEventListener('click', () => {
  sound.unlock();
  if (state === 'play' && !staged && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  cameraYaw -= e.movementX * 0.0026;
  cameraPitch = Math.max(-0.05, Math.min(1.0, cameraPitch + e.movementY * 0.0022));
});

function toggleMute() {
  sound.setMuted(!sound.muted);
  document.getElementById('chk-mute').checked = sound.muted;
  document.getElementById('chk-mute-2').checked = sound.muted;
  persist();
}

// --- menus and flow ---
const $ = (id) => document.getElementById(id);
function showStoryCard(name, text, cb) {
  state = 'story';
  $('story-name').textContent = name;
  $('story-text').textContent = text;
  $('story').classList.remove('hidden');
  $('btn-story').onclick = () => {
    sound.unlock();
    sound.ui();
    $('story').classList.add('hidden');
    state = 'play';
    if (cb) cb();
  };
}

function startNewGame() {
  clearSave();
  cash = 60;
  missions.missionIndex = 0;
  missions.jobsDone = 0;
  player.teleport(232, 116, -Math.PI / 2);
  player.healFull();
  police.clearWanted();
  cameraYaw = -Math.PI / 2;
  $('menu').classList.add('hidden');
  hud.show();
  hud.setCash(cash);
  showStoryCard(STORY.intro.name, STORY.intro.text, () => missions.startStoryMission(0));
  persist();
}

function continueGame() {
  const save = loadSave();
  if (!save) return;
  cash = save.cash;
  missions.missionIndex = save.missionIndex;
  missions.jobsDone = save.jobsDone;
  if (save.pos) player.teleport(save.pos.x, save.pos.z, -Math.PI / 2);
  player.healFull();
  police.clearWanted();
  cameraYaw = player.heading;
  $('menu').classList.add('hidden');
  hud.show();
  hud.setCash(cash);
  state = 'play';
  if (save.missionIndex < STORY.missions.length) {
    const def = STORY.missions[save.missionIndex];
    showStoryCard(def.giver + ' — THE JOB, AGAIN', def.brief, () => missions.startStoryMission(save.missionIndex));
  } else {
    missions.startJob();
  }
}

function pauseGame() {
  state = 'pause';
  $('pause').classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  persist();
}
function resumeGame() {
  $('pause').classList.add('hidden');
  state = 'play';
}

function endRun(kind) {
  if (state !== 'play') return;
  state = 'end';
  const fine = Math.max(40, Math.round(cash * (kind === 'busted' ? 0.12 : 0.1)));
  cash = Math.max(0, cash - fine);
  hud.setCash(cash);
  const word = $('end-word');
  word.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  word.className = 'big-word ' + kind;
  $('end-fine').textContent = kind === 'busted'
    ? `The Harbor PD fines you $${fine} and tows your ride.`
    : `Harbor General patches you up for $${fine}.`;
  $('end').classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  if (kind === 'busted') sound.busted();
  persist();
}

function respawn() {
  $('end').classList.add('hidden');
  if (player.inCar) {
    const car = player.inCar;
    car.driver = null;
    car.parked = true;
    car.speed = 0;
    player.inCar = null;
    player.mesh.visible = true;
  }
  const wasBusted = $('end-word').textContent === 'BUSTED';
  const spot = wasBusted ? PLACES.policeStation : PLACES.hospital;
  player.teleport(spot.x, spot.z + (wasBusted ? -14 : 14), wasBusted ? Math.PI : 0);
  player.healFull();
  police.clearWanted();
  cameraYaw = player.heading;
  state = 'play';
}

$('btn-new').onclick = () => { sound.unlock(); sound.ui(); startNewGame(); };
$('btn-continue').onclick = () => { sound.unlock(); sound.ui(); continueGame(); };
$('btn-resume').onclick = () => { sound.ui(); resumeGame(); };
$('btn-restart').onclick = () => {
  sound.ui();
  $('pause').classList.add('hidden');
  player.teleport(PLACES.hospital.x, PLACES.hospital.z + 14, 0);
  player.healFull();
  police.clearWanted();
  state = 'play';
};
$('btn-respawn').onclick = () => { sound.ui(); respawn(); };
$('chk-mute').onchange = (e) => { sound.unlock(); sound.setMuted(e.target.checked); $('chk-mute-2').checked = e.target.checked; persist(); };
$('chk-mute-2').onchange = (e) => { sound.setMuted(e.target.checked); $('chk-mute').checked = e.target.checked; persist(); };

// --- interaction: getting in and out of cars ---
function tryInteract() {
  if (player.inCar) {
    player.exitCar();
    sound.ui();
    return;
  }
  let best = null, bestD = 3.8;
  for (const car of traffic.allCars()) {
    if (car.driver === 'player') continue;
    if (car.driver === 'ai' && Math.abs(car.speed) > 3) continue;
    const d = Math.hypot(car.mesh.position.x - player.pos.x, car.mesh.position.z - player.pos.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (best) {
    player.enterCar(best);
    cameraYaw = best.heading;
    police.addCrime('steal');
    sound.ui();
    hud.toast(`Driving the ${best.model.name} — it isn't yours, so drive like it`);
  }
}

// --- camera ---
const camTarget = new THREE.Vector3();
const camLook = new THREE.Vector3();
function updateCamera(dt) {
  if (state === 'menu' && !staged) {
    const t = time * 0.05;
    camTarget.set(Math.sin(t) * 170, 52, Math.cos(t) * 170);
    camera.position.lerp(camTarget, Math.min(1, dt * 2));
    camera.lookAt(0, 8, 0);
    return;
  }
  const p = player.pos;
  if (player.inCar) {
    // The chase camera settles behind the car but lets the mouse argue a little.
    let diff = player.inCar.heading - cameraYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cameraYaw += diff * Math.min(1, dt * 2.6);
    const fx = Math.sin(cameraYaw), fz = Math.cos(cameraYaw);
    camTarget.set(p.x - fx * 10.5, 3.9, p.z - fz * 10.5);
    camera.position.lerp(camTarget, Math.min(1, dt * 7));
    camLook.set(p.x + fx * 7, 1.4, p.z + fz * 7);
    camera.lookAt(camLook);
  } else {
    const fx = Math.sin(cameraYaw), fz = Math.cos(cameraYaw);
    const dist = 7.2;
    camTarget.set(p.x - fx * dist, 2.2 + cameraPitch * 4.5, p.z - fz * dist);
    camera.position.lerp(camTarget, Math.min(1, dt * 10));
    camLook.set(p.x, 1.75, p.z);
    camera.lookAt(camLook);
  }
}

// --- per-frame world step ---
function buildThreats() {
  const threats = [];
  for (const car of traffic.allCars()) {
    if (Math.abs(car.speed) > 6) threats.push({ kind: 'car', x: car.mesh.position.x, z: car.mesh.position.z, speed: Math.abs(car.speed) });
  }
  for (const u of police.units) {
    if (Math.abs(u.speed) > 6) threats.push({ kind: 'car', x: u.mesh.position.x, z: u.mesh.position.z, speed: Math.abs(u.speed) });
  }
  for (const t of punchThreats) threats.push(t);
  return threats;
}

function stepPlay(dt) {
  crimeCd = Math.max(0, crimeCd - dt);
  vignetteFlash = Math.max(0, vignetteFlash - dt * 1.6);
  for (let i = punchThreats.length - 1; i >= 0; i--) {
    punchThreats[i].ttl -= dt;
    if (punchThreats[i].ttl <= 0) punchThreats.splice(i, 1);
  }

  const input = {
    f: !!keys.KeyW || !!keys.ArrowUp,
    b: !!keys.KeyS || !!keys.ArrowDown,
    l: !!keys.KeyA || !!keys.ArrowLeft,
    r: !!keys.KeyD || !!keys.ArrowRight,
    run: !!keys.ShiftLeft || !!keys.ShiftRight,
    punch: !!keys.KeyF,
  };
  if (staged) { input.f = input.b = input.l = input.r = input.punch = false; }

  if (interactQueued) {
    interactQueued = false;
    if (!staged) tryInteract();
  }
  player.update(dt, input, cameraYaw);

  // Driving.
  if (player.inCar) {
    const car = player.inCar;
    let drive;
    if (staged) {
      drive = { throttle: car.speed < 15 ? 0.55 : 0.05, steer: 0, brake: false, handbrake: false };
    } else {
      drive = {
        throttle: input.f ? 1 : (input.b ? -1 : 0),
        steer: (input.l ? -1 : 0) + (input.r ? 1 : 0),
        brake: !!keys.KeyS,
        handbrake: !!keys.Space,
      };
    }
    const impact = stepCar(car, drive, dt, city.colliders);
    if (impact > 15) {
      sound.thud(Math.min(1, impact / 30));
      vignetteFlash = Math.max(vignetteFlash, 0.35);
      if (impact > 19) player.damage((impact - 15) * 1.15);
    }
    // Car on car.
    for (const other of [...traffic.allCars(), ...police.units]) {
      if (other === car) continue;
      const dx = other.mesh.position.x - car.mesh.position.x;
      const dz = other.mesh.position.z - car.mesh.position.z;
      if (dx * dx + dz * dz > 64) continue;
      const closing = collideCars(car, other);
      if (closing > 7) {
        sound.thud(Math.min(1, closing / 22));
        if (crimeCd <= 0 && !other.isPolice) { police.addCrime('carHit'); crimeCd = 1.4; }
        if (closing > 16) player.damage((closing - 12) * 0.8);
      }
    }
    if (player.health <= 0) { endRun('wasted'); return; }
  }

  traffic.update(dt, player.inCar);
  // Police cars bump the world too.
  for (const u of police.units) {
    for (const other of traffic.allCars()) {
      const dx = other.mesh.position.x - u.mesh.position.x;
      const dz = other.mesh.position.z - u.mesh.position.z;
      if (dx * dx + dz * dz < 30) collideCars(u, other);
    }
  }

  const allCars = [...traffic.allCars(), ...police.units];
  peds.update(dt, buildThreats(), allCars);

  const { nearest } = police.update(dt, { pos: player.pos, speed: player.speed, inCar: !!player.inCar });
  sound.siren(nearest, police.stars, dt);
  sound.engine(player.inCar ? Math.abs(player.inCar.speed) / player.inCar.model.topSpeed : 0, !!player.inCar && state === 'play');

  // The garage washes a record clean.
  if (police.stars > 0) {
    const dHide = Math.hypot(player.pos.x - PLACES.hideout.x, player.pos.z - PLACES.hideout.z);
    if (dHide < TUNING.hideoutClearRadius && player.speed < 4) {
      police.clearWanted();
      hud.toast('The Breakwater crew makes the heat disappear');
      sound.chime();
    }
  }

  missions.update(dt, time);

  // HUD.
  hud.setStars(police.stars, police.lastSeen > 8 && police.stars > 0);
  hud.setHealth(player.health / 100);
  hud.setBust(police.bust > 0.02 ? police.bust : null);
  hud.setSpeed(player.inCar ? Math.abs(player.inCar.speed) * 2.24 : null);
  hud.setVignette(Math.max(vignetteFlash, (1 - player.health / 100) * 0.5));
  if (!staged) {
    if (player.inCar) {
      hud.prompt('<b>E</b> get out · <b>Space</b> handbrake');
    } else {
      let near = null, nd = 3.8;
      for (const car of traffic.allCars()) {
        if (car.driver === 'ai' && Math.abs(car.speed) > 3) continue;
        const d = Math.hypot(car.mesh.position.x - player.pos.x, car.mesh.position.z - player.pos.z);
        if (d < nd) { nd = d; near = car; }
      }
      hud.prompt(near ? `<b>E</b> drive the ${near.model.name}` : null);
    }
  }
  hud.drawMinimap({
    player: { x: player.pos.x, z: player.pos.z, heading: player.inCar ? player.inCar.heading : player.heading },
    units: police.units.map((u) => ({ x: u.mesh.position.x, z: u.mesh.position.z })),
    target: missions.target,
    hideout: PLACES.hideout,
  });
  hud.update(dt);

  if (player.health <= 0 && !player.inCar) { endRun('wasted'); return; }

  saveT += dt;
  if (saveT > 8) { saveT = 0; persist(); }
}

function stepAmbient(dt) {
  traffic.update(dt, null);
  peds.update(dt, [], traffic.allCars());
}

// --- staged screenshot scenes ---
function stageScene(name) {
  $('menu').classList.add('hidden');
  hud.show();
  hud.setCash(1240);
  state = 'play';
  if (name === 'cover') {
    player.teleport(247, 128, -Math.PI / 2);
    cameraYaw = -Math.PI / 2;
    camera.position.set(258, 3.4, 140);
    hud.setObjective('FIRST RUN', 'Pick up the package at Ferris Freight Docks', '386 m');
    hud.toast('Welcome to Neon Harbor');
  } else if (name === 'drive') {
    const car = traffic.parked[0];
    car.mesh.position.set(-140, 0, 58 + 3.4);
    car.heading = Math.PI / 2;
    car.mesh.rotation.y = car.heading;
    car.speed = 15;
    player.enterCar(car);
    cameraYaw = Math.PI / 2;
    hud.setObjective('NEON CIRCUIT', 'Hit every checkpoint before the clock dies', 'Checkpoint 3/6 · 128 m · 42s');
  } else if (name === 'chase') {
    const car = traffic.parked[1];
    car.mesh.position.set(-61.4, 0, -110);
    car.heading = 0;
    car.mesh.rotation.y = 0;
    car.speed = 19;
    player.enterCar(car);
    cameraYaw = 0;
    police.setWanted(3);
    const spots = [[-61.4, -126], [-53, -140], [-69, -148]];
    for (const [x, z] of spots) {
      police.spawnUnit(player.pos);
      const u = police.units[police.units.length - 1];
      if (u) { u.mesh.position.set(x, 0, z); u.heading = 0; u.speed = 17; }
    }
    hud.setObjective('HOT PROPERTY', 'Get the gold Komodo to the Breakwater Garage', '342 m');
  } else if (name === 'mission') {
    missions.startStoryMission(0);
    player.teleport(241, -150, Math.atan2(11, -18));
    cameraYaw = player.heading;
  }
}

if (staged) stageScene(sceneName);

// --- the loop ---
let last = performance.now();
let frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  city.update(dt, time);
  if (state === 'play') stepPlay(dt);
  else if (state === 'menu') stepAmbient(dt);
  updateCamera(dt);
  renderer.render(stage, camera);
  frames += 1;
  if (staged && frames > 45) window.__shotReady = true;
}
requestAnimationFrame(frame);
