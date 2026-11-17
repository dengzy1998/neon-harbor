// game.js — the orchestrator. It owns the renderer, the camera, the input,
// the main loop and the rules that connect the systems: entering and
// stealing cars, crimes and their witnesses, crashes, knockdowns, the
// garage that clears heat, getting busted or wasted, saving, pausing, and
// the staged scenes the screenshots are taken from.

import * as THREE from 'three';
import {
  COLORS, PLACES, PLAYER, CAR, HEAT, STORY,
} from './config.js';
import { makeRng } from './random.js';
import { buildCity, districtAt } from './city.js';
import { createCar, driveStep, collideCars, spawnParkedCars } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { AudioEngine } from './audio.js';
import { loadSave, writeSave, clearSave } from './savegame.js';
import { WORLD_SEED } from './config.js';

const RESPAWN = {
  police: { x: -60, z: -124 },
  hospital: { x: 60, z: -124 },
};

export class Game {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.sky);
    this.scene.fog = new THREE.Fog(COLORS.fog, 130, 430);
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900);

    const hemi = new THREE.HemisphereLight(0xcfeeff, 0xe8c9a0, 0.95);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(COLORS.sun, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -100; this.sun.shadow.camera.right = 100;
    this.sun.shadow.camera.top = 100; this.sun.shadow.camera.bottom = -100;
    this.sun.shadow.camera.near = 10; this.sun.shadow.camera.far = 300;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    const rng = makeRng(WORLD_SEED);
    this.city = buildCity(this.scene, rng);
    this.colliders = this.city.colliders;
    this.player = new Player(this.scene);
    this.player.setPosition(PLACES.spawn.x, PLACES.spawn.z);
    this.parked = spawnParkedCars(this.scene, rng);
    this.traffic = new Traffic(this.scene, rng);
    this.peds = new Pedestrians(this.scene, rng);
    this.police = new Police(this.scene);
    this.audio = new AudioEngine();
    this.hud = new Hud();
    this.missions = new Missions(this.scene, {
      onCash: (n, label) => { this.cash += n; this.earnings += n; this.hud.toast(`+$${n} — ${label}`); },
      onStory: (key, done) => this.showStory(key, done),
      onSetHeat: (v) => this.police.setHeat(v),
      onCrimeFree: () => this.police.clear(),
      onToast: (m) => this.hud.toast(m),
      onAudio: (name) => { if (this.audio[name]) this.audio[name](); },
      onSave: () => this.save(),
      spawnHotCar: () => {
        const car = createCar(this.scene, 'sport', 0xd4af37, -72, 190, Math.PI / 2, { parked: true });
        this.parked.push(car);
        return car;
      },
    });

    this.mode = 'menu'; // menu | playing | paused | story | ended | staging
    this.driving = null;
    this.cash = 150;
    this.earnings = 0;
    this.busts = 0;
    this.health = PLAYER.maxHealth;
    this.lastDamageAt = -99;
    this.time = 0;
    this.keys = new Set();
    this.camYaw = 0;
    this.camPitch = 0.34;
    this.scares = [];
    this.crimeTimers = { hitCar: 0, scrape: 0 };
    this.punchCd = 0;
    this.lastMoveSpeed = 0;
    this.storyDoneCallback = null;
    this.hudTick = 0;

    this.bindInput();
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // --- input ---------------------------------------------------------------
  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (this.mode === 'story' && (e.code === 'Enter' || e.code === 'Space')) this.dismissStory();
      else if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.mode === 'playing') this.pause();
        else if (this.mode === 'paused') this.resume();
      } else if (e.code === 'KeyM') this.toggleMute();
      else if (e.code === 'KeyE' && this.mode === 'playing') this.toggleCar();
      else if (e.code === 'KeyF' && this.mode === 'playing' && !this.driving) this.tryPunch();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('mousedown', () => {
      if (this.mode === 'story') this.dismissStory();
      else if (this.mode === 'playing' && !this.driving && document.pointerLockElement) this.tryPunch();
    });
    this.renderer.domElement.addEventListener('click', () => {
      if (this.mode === 'playing' && !document.pointerLockElement) {
        this.renderer.domElement.requestPointerLock();
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (!document.pointerLockElement || this.mode !== 'playing') return;
      this.camYaw -= e.movementX * 0.0042;
      this.camPitch = Math.max(0.06, Math.min(1.05, this.camPitch + e.movementY * 0.0032));
    });
    const b = this.hud.buttons;
    b.newGame.addEventListener('click', () => { this.audio.ensure(); this.audio.click(); this.startGame(false); });
    b.continueGame.addEventListener('click', () => { this.audio.ensure(); this.audio.click(); this.startGame(true); });
    b.resume.addEventListener('click', () => { this.audio.click(); this.resume(); });
    b.restart.addEventListener('click', () => { this.audio.click(); clearSave(); this.startGame(false); });
    b.respawn.addEventListener('click', () => { this.audio.click(); this.respawn(); });
    this.hud.muteBtn.addEventListener('click', () => this.toggleMute());
    this.refreshContinue();
  }

  refreshContinue() {
    this.hud.buttons.continueGame.disabled = !loadSave();
  }

  toggleMute() {
    this.audio.ensure();
    this.hud.setMutedLabel(this.audio.setMuted(!this.audio.muted));
  }

  // --- game flow -------------------------------------------------------------
  startGame(fromSave) {
    const save = fromSave ? loadSave() : null;
    this.hud.menuEl.classList.remove('on');
    this.hud.pauseEl.classList.remove('on');
    this.hud.hideEnd();
    this.hud.showGameHud(true);
    this.mode = 'playing';
    this.health = PLAYER.maxHealth;
    this.police.clear();
    if (save) {
      this.cash = save.cash;
      this.earnings = save.earnings || 0;
      this.busts = save.busts || 0;
      this.player.setPosition(save.x, save.z);
      this.missions.storyDone = !!save.storyDone;
      this.missions.start(save.storyDone ? 3 : save.missionIndex);
      this.hud.toast('Welcome back to Neon Harbor');
    } else {
      this.cash = 150;
      this.earnings = 0;
      this.busts = 0;
      this.player.setPosition(PLACES.spawn.x, PLACES.spawn.z);
      this.showStory('intro', () => this.missions.start(0));
    }
  }

  showStory(key, done) {
    this.mode = 'story';
    const card = STORY[key];
    this.hud.showStory(card.who, card.text);
    this.storyDoneCallback = done;
  }

  dismissStory() {
    if (this.mode !== 'story') return;
    this.hud.hideStory();
    this.mode = 'playing';
    const done = this.storyDoneCallback;
    this.storyDoneCallback = null;
    if (done) done();
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.hud.pauseEl.classList.add('on');
    this.save();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  resume() {
    this.hud.pauseEl.classList.remove('on');
    if (this.mode === 'paused') this.mode = 'playing';
  }

  save() {
    writeSave({
      cash: this.cash,
      missionIndex: this.missions.missionIndex,
      storyDone: this.missions.storyDone,
      playerPos: this.focusPos(),
      earnings: this.earnings,
      busts: this.busts,
    });
    this.refreshContinue();
  }

  endRun(kind) {
    this.mode = 'ended';
    this.audio.setEngine(0, false);
    this.audio.setSiren(0);
    if (document.pointerLockElement) document.exitPointerLock();
    const fine = Math.min(this.cash, kind === 'busted' ? 60 + Math.floor(this.cash * 0.1) : 40 + Math.floor(this.cash * 0.08));
    this.cash -= fine;
    if (kind === 'busted') {
      this.busts++;
      this.audio.sting();
      this.hud.showEnd('BUSTED', `The NHPD finally boxed you in. Fine: $${fine}. You walk out of the Sunspire Heights station with your satchel and your pride dented.`);
    } else {
      this.audio.fail();
      this.hud.showEnd('WASTED', `You wake up at St. Coral General with a $${fine} bill and a story nobody believes. The harbour is still out there.`);
    }
    this.endKind = kind;
  }

  respawn() {
    this.hud.hideEnd();
    this.police.clear();
    this.health = PLAYER.maxHealth;
    if (this.driving) { this.driving = null; this.player.group.visible = true; }
    const at = this.endKind === 'busted' ? RESPAWN.police : RESPAWN.hospital;
    this.player.setPosition(at.x, at.z);
    this.mode = 'playing';
    this.save();
  }

  // --- interactions ------------------------------------------------------------
  focusPos() { return this.driving ? this.driving.pos : this.player.pos; }

  focusSpeed() {
    return this.driving ? Math.abs(this.driving.speed) : this.lastMoveSpeed;
  }

  witnessed(pos, pedRange = 24) {
    if (this.police.anyUnitWithin(pos, 52)) return true;
    return this.peds.peds.some((p) => p.state !== 'down' && p.pos.distanceTo(pos) < pedRange);
  }

  scare(x, z) {
    this.scares.push({ x, z, until: this.time + 2.5 });
  }

  nearestCar(pos, range) {
    let best = null, bestD = range;
    for (const car of [...this.parked, ...this.traffic.vehicles]) {
      const d = car.pos.distanceTo(pos);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  toggleCar() {
    if (this.driving) {
      const car = this.driving;
      if (Math.abs(car.speed) > 10) { this.hud.toast('Slow down to get out'); return; }
      car.speed = 0;
      const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
      this.player.setPosition(car.pos.x + side.x * 2.4, car.pos.z + side.z * 2.4);
      this.player.group.visible = true;
      this.driving = null;
      this.audio.setEngine(0, false);
      return;
    }
    const car = this.nearestCar(this.player.pos, PLAYER.enterRange);
    if (!car) {
      if (this.garagePrompt()) this.clearHeatAtGarage();
      return;
    }
    this.driving = car;
    this.player.group.visible = false;
    this.traffic.release(car, this.scene);
    this.audio.ensure();
    if (!car.stolen) {
      car.stolen = true;
      const wasTraffic = !car.parked;
      if (wasTraffic || this.witnessed(car.pos)) {
        this.police.reportCrime(HEAT.stealCar + (wasTraffic ? HEAT.stealWitnessedBonus : 0));
        this.hud.toast(wasTraffic ? 'The driver reported you — heat rising' : 'Someone saw that — heat rising');
      }
    }
    this.missions.notifyEnteredCar(car);
  }

  tryPunch() {
    if (this.punchCd > 0) return;
    this.punchCd = 0.38;
    this.player.punch();
    this.audio.punch();
    const f = { x: Math.sin(this.player.heading), z: Math.cos(this.player.heading) };
    const reach = { x: this.player.pos.x + f.x * 1.1, z: this.player.pos.z + f.z * 1.1 };
    const ped = this.peds.nearestStanding(new THREE.Vector3(reach.x, 0, reach.z), PLAYER.punchRange);
    if (ped) {
      ped.knockDown();
      this.scare(ped.pos.x, ped.pos.z);
      if (this.witnessed(ped.pos)) {
        this.police.reportCrime(HEAT.punchPed);
        this.hud.toast('That was seen — heat rising');
      }
    }
  }

  damage(amount) {
    this.health -= amount;
    this.lastDamageAt = this.time;
    if (this.health <= 0 && this.mode === 'playing') this.endRun('wasted');
  }

  // --- staging for screenshots ---------------------------------------------------
  stage(name) {
    this.hud.menuEl.classList.remove('on');
    this.hud.showGameHud(true);
    this.mode = 'staging';
    this.cash = 1240;
    const put = (car, x, z, heading) => { car.pos.set(x, 0, z); car.heading = heading; car.speed = 0; car.syncMesh(); };
    if (name === 'cover') {
      this.player.setPosition(-64, 176);
      this.player.heading = Math.PI / 2;
      this.player.group.rotation.y = Math.PI / 2;
      this.camYaw = -Math.PI / 2; this.camPitch = 0.3;
      put(this.traffic.vehicles[0], -30, 156.6, Math.PI / 2);
      put(this.traffic.vehicles[1], -6, 163.4, -Math.PI / 2);
      const spots = [[-52, 182], [-76, 186], [-44, 171]];
      this.peds.peds.forEach((p, i) => { if (spots[i]) p.group.position.set(spots[i][0], 0, spots[i][1]); });
    } else if (name === 'drive') {
      const car = createCar(this.scene, 'sedan', 0xef6461, 36.6, 14, 0);
      car.speed = 9; // speedo dressing for the still
      this.parked.push(car);
      this.driving = car;
      this.player.group.visible = false;
      this.camYaw = Math.PI; this.camPitch = 0.3;
      put(this.traffic.vehicles[0], 36.6, 44, 0);
      put(this.traffic.vehicles[1], 43.4, 62, Math.PI);
      put(this.traffic.vehicles[2], 36.6, -26, 0);
      const spots = [[31, 26], [49, 34], [30, 2]];
      this.peds.peds.forEach((p, i) => { if (spots[i]) p.group.position.set(spots[i][0], 0, spots[i][1]); });
    } else if (name === 'chase') {
      this.missions.missionIndex = 2;
      const gold = createCar(this.scene, 'sport', 0xd4af37, -3.4, -6, 0);
      this.parked.push(gold);
      this.missions.hotCar = gold;
      this.missions.stage = 'deliver';
      this.missions.setBeacon({ ...PLACES.hideout }, 0xf471b5);
      this.driving = gold;
      this.player.group.visible = false;
      this.police.setHeat(300);
      this.police.spawnUnit(gold.pos);
      this.police.spawnUnit(gold.pos);
      this.police.spawnUnit(gold.pos);
      const spots = [[-4.8, -11.8, 0.12], [3.4, -12.6, -0.08], [5.6, -3.5, -0.15]];
      gold.speed = 13; // speedo dressing: the shot should read as a pursuit
      this.police.units.forEach((u, i) => {
        if (spots[i]) { u.car.pos.set(spots[i][0], 0, spots[i][1]); u.car.heading = spots[i][2]; u.car.syncMesh(); }
      });
      this.camYaw = Math.PI; this.camPitch = 0.3;
    } else if (name === 'mission') {
      this.missions.start(0);
      this.player.setPosition(-118, 174);
      this.player.heading = Math.atan2(-128 + 118, 182 - 174);
      this.player.group.rotation.y = this.player.heading;
      this.camYaw = Math.atan2(0.8, -0.6);
      this.camPitch = 0.3;
    }
    this.updateHud();
  }

  // --- main loop -------------------------------------------------------------------
  start() {
    let last = performance.now();
    this.renderer.setAnimationLoop((now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.time += dt;
      this.tick(dt);
      this.renderer.render(this.scene, this.camera);
    });
  }

  tick(dt) {
    const focus = this.focusPos();
    this.city.update(this.time);
    // Sun shadow box follows the action.
    this.sun.position.set(focus.x + 55, 95, focus.z + 28);
    this.sun.target.position.set(focus.x, 0, focus.z);

    if (this.mode === 'menu') {
      const a = this.time * 0.045;
      this.camera.position.set(Math.sin(a) * 120, 52, 40 + Math.cos(a) * 120);
      this.camera.lookAt(0, 0, 30);
      this.traffic.update(dt, this.worldCtx());
      this.peds.update(dt, this.time, this.pedCtx());
      return;
    }
    if (this.mode === 'paused' || this.mode === 'ended') return;
    if (this.mode === 'staging') {
      this.updateCamera(dt);
      for (const u of this.police.units) u.car.flashLights(this.time);
      this.missions.update(dt, { playerPos: focus, driving: !!this.driving, playerCar: this.driving });
      this.updateHud();
      return;
    }
    if (this.mode === 'story') {
      this.updateCamera(dt);
      return;
    }
    this.playTick(dt);
  }

  worldCtx() {
    return {
      playerPos: this.focusPos(),
      playerCar: this.driving,
      extraObstacles: [...this.police.units.map((u) => u.car), ...(this.driving ? [this.driving] : [])],
      colliders: this.colliders,
    };
  }

  pedCtx() {
    this.scares = this.scares.filter((s) => s.until > this.time);
    return {
      cars: [...this.traffic.vehicles, ...this.police.units.map((u) => u.car),
        ...(this.driving ? [this.driving] : [])],
      scares: this.scares,
      playerPos: this.focusPos(),
      colliders: this.colliders,
    };
  }

  playTick(dt) {
    this.punchCd = Math.max(0, this.punchCd - dt);
    this.crimeTimers.hitCar = Math.max(0, this.crimeTimers.hitCar - dt);
    this.crimeTimers.scrape = Math.max(0, this.crimeTimers.scrape - dt);
    const k = (code) => this.keys.has(code);

    if (this.driving) this.driveTick(dt, k);
    else this.walkTick(dt, k);

    const focus = this.focusPos();
    this.traffic.update(dt, this.worldCtx());
    this.peds.update(dt, this.time, this.pedCtx());
    this.hitPedsWithCars();
    this.police.update(dt, {
      playerPos: focus,
      playerSpeed: this.focusSpeed(),
      colliders: this.colliders,
      cars: [...this.traffic.vehicles, ...(this.driving ? [this.driving] : [])],
      onShoot: (dmg) => this.damage(dmg),
    });
    if (this.police.bust >= 1 && this.mode === 'playing') { this.endRun('busted'); return; }
    this.missions.update(dt, { playerPos: focus, driving: !!this.driving, playerCar: this.driving });
    if (this.health < PLAYER.maxHealth && this.time - this.lastDamageAt > 5) {
      this.health = Math.min(PLAYER.maxHealth, this.health + dt * 4);
    }
    // Audio beds.
    const nearest = this.police.nearestDistance(focus);
    this.audio.setSiren(this.police.stars > 0 ? Math.max(0, 1 - (nearest - 8) / 70) : 0);
    this.updateCamera(dt);
    this.updateHud();
  }

  walkTick(dt, k) {
    const input = {
      x: (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0),
      z: (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0),
      run: k('ShiftLeft') || k('ShiftRight'),
      camYaw: this.camYaw,
    };
    const before = this.player.pos.clone();
    this.player.update(dt, input, this.colliders);
    this.lastMoveSpeed = input.x || input.z ? this.player.pos.distanceTo(before) / Math.max(dt, 0.001) : 0;
    // Context prompt: a car to take, or the garage to clear heat.
    const car = this.nearestCar(this.player.pos, PLAYER.enterRange);
    if (car) this.hud.showPrompt(`<kbd>E</kbd> Drive the ${car.name}`);
    else if (this.garagePrompt()) this.hud.showPrompt(`<kbd>E</kbd> Respray &amp; clear heat — $${this.police.stars * 50}`);
    else this.hud.showPrompt(null);
  }

  driveTick(dt, k) {
    const car = this.driving;
    const input = {
      throttle: (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0),
      steer: (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0),
      handbrake: k('Space'),
      boost: k('ShiftLeft') || k('ShiftRight'),
    };
    driveStep(car, dt, input);
    const impact = car.move(dt, this.colliders);
    if (impact > 6) {
      this.audio.crash(impact > CAR.crashSpeed);
      this.scare(car.pos.x, car.pos.z);
      if (impact > CAR.crashSpeed) this.damage((impact - CAR.crashSpeed) * 1.6 + 6);
      if (this.crimeTimers.scrape <= 0 && this.witnessed(car.pos)) {
        this.police.reportCrime(HEAT.scrapeBuilding);
        this.crimeTimers.scrape = 1.2;
      }
    }
    for (const other of [...this.parked, ...this.traffic.vehicles]) {
      if (other === car) continue;
      const hit = collideCars(car, other);
      if (hit > 7) {
        this.audio.crash(false);
        this.scare(car.pos.x, car.pos.z);
        if (this.crimeTimers.hitCar <= 0 && this.witnessed(car.pos)) {
          this.police.reportCrime(HEAT.hitCar);
          this.crimeTimers.hitCar = 0.9;
        }
      }
    }
    this.player.setPosition(car.pos.x, car.pos.z);
    this.audio.setEngine(Math.abs(car.speed) / car.topSpeed, true);
    this.hud.showPrompt(Math.abs(car.speed) > 10 ? null : '<kbd>E</kbd> Get out');
  }

  hitPedsWithCars() {
    const cars = [...this.traffic.vehicles, ...this.police.units.map((u) => u.car),
      ...(this.driving ? [this.driving] : [])];
    for (const ped of this.peds.peds) {
      if (ped.state === 'down') continue;
      for (const car of cars) {
        if (Math.abs(car.speed) < 3.5) continue;
        if (ped.pos.distanceTo(car.pos) < 2.1) {
          ped.knockDown();
          this.scare(ped.pos.x, ped.pos.z);
          this.audio.crash(false);
          if (car === this.driving) {
            car.speed *= 0.8;
            if (this.witnessed(ped.pos)) {
              this.police.reportCrime(HEAT.hitPed);
              this.hud.toast('You hit a pedestrian — heat rising');
            }
          }
          break;
        }
      }
    }
  }

  garagePrompt() {
    if (this.police.stars === 0 || this.driving) return false;
    const d = Math.hypot(this.player.pos.x - PLACES.garage.x, this.player.pos.z - PLACES.garage.z);
    return d < 8;
  }

  clearHeatAtGarage() {
    const cost = this.police.stars * 50;
    if (this.cash < cost) {
      this.hud.toast(`Otto needs $${cost} for a respray — you are short`);
      this.audio.fail();
      return;
    }
    this.cash -= cost;
    this.police.clear();
    this.audio.cash();
    this.hud.toast('Fresh paint, clean plates. The NHPD loses your trail.');
    this.save();
  }

  updateCamera(dt) {
    const focus = this.focusPos();
    if (this.mode === 'staging' || this.mode === 'playing' || this.mode === 'story') {
      if (this.driving && this.mode === 'playing' && (this.keys.has('KeyW') || this.keys.has('KeyS'))) {
        let dh = (this.driving.heading + Math.PI) - this.camYaw;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        this.camYaw += dh * Math.min(1, dt * 2.1);
      }
      const dist = this.driving ? 10.5 : 7.6;
      const off = {
        x: Math.sin(this.camYaw) * Math.cos(this.camPitch),
        z: Math.cos(this.camYaw) * Math.cos(this.camPitch),
        y: Math.sin(this.camPitch),
      };
      const target = new THREE.Vector3(
        focus.x + off.x * dist,
        (this.driving ? 1.2 : 1.6) + off.y * dist,
        focus.z + off.z * dist,
      );
      const blend = this.mode === 'staging' ? 1 : 1 - Math.exp(-dt * 7);
      this.camera.position.lerp(target, blend);
      this.camera.position.y = Math.max(1.1, this.camera.position.y);
      this.camera.lookAt(focus.x, (this.driving ? 1.1 : 1.5), focus.z);
    }
  }

  updateHud() {
    this.hud.setStars(this.police.stars);
    this.hud.setCash(this.cash);
    this.hud.setHealth(this.health / PLAYER.maxHealth);
    this.hud.setSpeed(this.driving ? Math.abs(this.driving.speed) * 3.6 : null);
    this.hud.setBust(this.police.bust);
    const focus = this.focusPos();
    this.hud.setDistrict(districtAt(focus.x, focus.z));
    this.hudTick += 1;
    if (this.hudTick % 6 === 0) this.hud.setObjective(this.missions.objectiveText());
    this.hud.drawMinimap({
      playerPos: focus,
      playerHeading: this.driving ? this.driving.heading : this.player.heading,
      police: this.police.units.map((u) => u.car.pos),
      target: this.missions.target,
      time: this.time,
    });
  }
}
