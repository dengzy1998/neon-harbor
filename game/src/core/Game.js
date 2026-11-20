import * as THREE from 'three';
import { Input } from './Input.js';
import { makeRng } from './Random.js';
import { loadSave, writeSave } from './SaveGame.js';
import { applySky } from '../world/SkyAndLighting.js';
import { buildCity, districtAt } from '../world/City.js';
import { Player } from '../player/Player.js';
import { CameraRig } from '../player/CameraRig.js';
import { Pedestrians } from '../characters/Pedestrians.js';
import { Traffic } from '../vehicles/Traffic.js';
import { createCar, driveStep, collideCars, spawnParkedCars } from '../vehicles/Vehicles.js';
import { WantedSystem } from '../police/WantedSystem.js';
import { Police } from '../police/Police.js';
import { Helicopter } from '../police/Helicopter.js';
import { Roadblocks } from '../police/Roadblocks.js';
import { Combat, WEAPONS } from '../combat/Combat.js';
import { Contacts } from '../progression/Contacts.js';
import { Dialogue, CAST } from '../missions/Dialogue.js';
import { Missions, STORY } from '../missions/Missions.js';
import { StreetRace, RACES } from '../activities/StreetRace.js';
import { NearMiss } from '../activities/NearMiss.js';
import { RankSystem } from '../progression/RankSystem.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { Radio } from '../audio/Radio.js';
import { Hud } from '../ui/Hud.js';
import { Minimap } from '../ui/Minimap.js';
import { MapScreen } from '../ui/MapScreen.js';
import { Menus } from '../ui/Menus.js';
import { stageScene } from '../shots/StagedScenes.js';

function freshState() {
  return {
    cash: 250,
    rp: 0,
    storyDone: 0,
    stats: {
      carsStolen: 0,
      nearMisses: 0,
      racesWon: 0,
      deliveries: 0,
      busts: 0,
    },
    unlocked: [],
  };
}

function restoredState(saved) {
  const state = freshState();
  if (!saved) {
    return state;
  }
  for (const key of ['cash', 'rp', 'storyDone']) {
    if (Number.isFinite(saved[key])) {
      state[key] = Math.max(0, saved[key]);
    }
  }
  state.storyDone = Math.min(STORY.length, Math.floor(state.storyDone));
  for (const key of Object.keys(state.stats)) {
    const value = saved.stats?.[key];
    if (Number.isFinite(value)) {
      state.stats[key] = Math.max(0, Math.floor(value));
    }
  }
  return state;
}

/** Owns system ordering, presentation, and the boundaries of a play session. */
export class Game {
  constructor(canvas) {
    if (!canvas) {
      throw new Error('Game requires #game-canvas');
    }
    this.canvas = canvas;
    this.doc = canvas.ownerDocument;
    this.win = this.doc.defaultView;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(this.win.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
    this.cameraRig = new CameraRig(this.camera);
    this.input = new Input(canvas);
    this.rng = makeRng(20261121);
    this.sky = applySky(this.scene, this.renderer);
    this.city = buildCity(this.scene, this.rng);
    this.places = this.city.places;
    this.player = new Player(this.scene);
    this.player.mesh.position.set(-53, 0, 56);
    this.pedestrians = new Pedestrians(this.scene, this.rng, this.city);
    this.traffic = new Traffic(this.scene, this.rng, this.city);
    this.parked = spawnParkedCars(this.scene, this.rng, this.city);
    this.garageCar = createCar(this.scene, 'komodo', 0xdcb45d);
    this.garageCar.mesh.position.set(-56, 0, 56);
    this.parked.push(this.garageCar);
    this.wanted = new WantedSystem();
    this.police = new Police(this.scene, this.rng, this.city);
    this.helicopter = new Helicopter(this.scene);
    this.roadblocks = new Roadblocks(this.scene);
    this.audio = new AudioEngine();
    this.radio = new Radio(this.audio);
    this.radioSelection = -1;
    this.combat = new Combat(this.scene, this.audio);
    this.contacts = new Contacts();
    this.hud = new Hud(this.doc);
    this.minimap = new Minimap(this.doc.getElementById('minimap'));
    this.map = new MapScreen(
      this.doc.getElementById('map-screen'),
      this.doc.getElementById('map-canvas'),
    );
    this.menus = new Menus(this.doc);
    this.dialogue = new Dialogue(this.hud.dialogueElements());
    this.loadedSave = loadSave();
    this.state = restoredState(this.loadedSave);
    this.rank = new RankSystem(this.state);
    this.combat.unlocked = this.rank.unlocks().weapons;
    this.missions = new Missions({
      dialogue: this.dialogue,
      playerPos: () => this.position,
      wantedStars: () => this.wanted.stars,
      guardsAlive: () => this.combat.guardsAlive(),
      spawnGuards: count => this.spawnMissionGuards(count),
      setMarker: (x, z, text, stage) => this.setMarker(x, z, text, stage),
      clearMarker: () => this.clearMarker(),
      onReward: reward => this.reward(reward),
    });
    this.missions.done = this.state.storyDone;
    this.race = new StreetRace(this.scene, this.rng);
    this.nearMiss = new NearMiss();
    this.nearMiss.onEvent = event => this.onNearMiss(event);
    this.marker = null;
    this.objectiveMesh = this.makeObjectiveMarker();
    this.cars = [];
    this.refreshCars();
    this.started = false;
    this.staged = null;
    this.photoPose = false;
    this.running = false;
    this.lastTime = null;
    this.elapsed = 0;
    this.impactCooldown = 0;
    this.pedCooldown = 0;
    this.garageToastCooldown = 0;
    this.theftCount = 0;
    this.raceWon = false;
    this.lastMissionResult = null;
    this.lastDispatchAt = -1;
    this.lastDistrict = null;
    this.lastContactsState = '';
    this.lastWeaponsState = '';
    this.aimPitch = 0;
    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.win.addEventListener('resize', this.resize);
    this.win.addEventListener('keydown', event => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault();
      }
    });
    this.resize();
    this.updateCamera(1);
    this.refreshHud();
  }

  get position() {
    return this.player.onFoot ? this.player.mesh.position : this.player.car.mesh.position;
  }

  get heading() {
    return this.player.onFoot ? this.player.heading : this.player.car.heading;
  }

  get speed() {
    return this.player.onFoot ? 0 : this.player.car.speed;
  }

  makeObjectiveMarker() {
    const group = new THREE.Group();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 15, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffce70,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    pillar.position.y = 7.5;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4, 0.2, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd480 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.18;
    group.add(pillar, ring);
    group.visible = false;
    this.scene.add(group);
    return group;
  }

  setMarker(x, z, text, stage) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      this.clearMarker();
      return;
    }
    this.marker = { x, z, text };
    this.objectiveMesh.position.set(x, 0, z);
    this.objectiveMesh.visible = true;
    if (stage?.heat) {
      this.wanted.heat = Math.max(2.2, this.wanted.heat);
      this.wanted.markSeen();
    }
  }

  clearMarker() {
    this.marker = null;
    if (this.objectiveMesh) {
      this.objectiveMesh.visible = false;
    }
  }

  spawnMissionGuards(count) {
    this.combat.clearGuards();
    const origin = this.position;
    const points = [];
    for (let index = 0; index < count; index++) {
      const angle = index * Math.PI * 2 / count;
      points.push({
        x: origin.x + Math.sin(angle) * 10,
        z: origin.z + Math.cos(angle) * 10,
      });
    }
    this.combat.spawnGuards(points);
  }

  start() {
    if (this.staged) {
      this.beginLoop();
      return this;
    }
    this.menus.showTitle({
      hasSave: Boolean(this.loadedSave),
      onStart: () => this.beginSession(false),
      onContinue: () => this.beginSession(true),
    });
    this.beginLoop();
    return this;
  }

  stage(name) {
    this.staged = name;
    this.started = true;
    this.menus.hideAll();
    this.beginLoop();
    // Let the renderer initialize before composing a reproducible scene.
    this.win.requestAnimationFrame(() => {
      stageScene(this, name);
      this.refreshCars();
      this.cameraRig.snap(
        this.position,
        this.heading,
        this.player.onFoot ? 'foot' : 'car',
      );
      this.refreshHud();
      if (this.map.open) {
        this.renderMap();
      }
    });
    return this;
  }

  beginLoop() {
    if (this.running) {
      return;
    }
    this.running = true;
    this.lastTime = null;
    this.win.requestAnimationFrame(this.frame);
  }

  beginSession(continuing) {
    this.menus.hideAll();
    this.map.setOpen(false);
    this.resetWorld();
    this.state = continuing ? restoredState(this.loadedSave) : freshState();
    this.rank = new RankSystem(this.state);
    this.combat.unlocked = this.rank.unlocks().weapons;
    this.refreshHud();
    this.missions.done = this.state.storyDone;
    this.started = true;
    this.staged = null;
    this.photoPose = false;
    this.lastMissionResult = null;
    this.hud.showHud(true);
    this.audio.resume();
    this.input.lockPointer();
    this.startNextJob();
    this.save();
  }

  resetWorld() {
    this.photoPose = false;
    this.photoSpeed = null;
    this.player.exitCar();
    this.player.mesh.position.set(-53, 0, 56);
    this.player.faceHeading(0);
    this.garageCar.mesh.position.set(-56, 0, 56);
    this.garageCar.heading = 0;
    this.garageCar.mesh.rotation.y = 0;
    this.garageCar.speed = 0;
    this.garageCar.health = 100;
    this.player.health = 100;
    this.player.armour = 0;
    this.wanted.reset();
    this.contacts.reset();
    this.lastContactsState = '';
    this.lastWeaponsState = '';
    this.police.clear();
    this.roadblocks.clear();
    this.helicopter.setActive(false);
    this.combat.clearGuards();
    this.dialogue.clear();
    this.race.abort();
    this.missions.fail();
    this.missions.result = null;
    this.clearMarker();
    this.suspendAudio();
    this.nearMiss.combo = 0;
    this.nearMiss.comboTimer = 0;
    this.nearMiss.lastCount.clear();
    this.stagedMission = null;
    this.cameraRig.position.set(0, 0, 0);
    this.raceWon = false;
  }

  startNextJob() {
    this.combat.clearGuards();
    if (this.missions.done < STORY.length) {
      this.missions.startNext();
    } else {
      this.missions.startJob();
    }
  }

  frame(timestamp) {
    if (!this.running) {
      return;
    }
    const dt = this.lastTime === null ? 0 : Math.min(0.05, Math.max(0, (timestamp - this.lastTime) / 1000));
    this.lastTime = timestamp;
    this.handleEdges();
    const paused = !this.started || this.map.open || this.menus.anyOpen;
    if (!paused) {
      this.update(dt);
    } else if (this.map.open) {
      this.renderMap();
    }
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
    this.win.requestAnimationFrame(this.frame);
  }

  handleEdges() {
    const input = this.input;
    if (!this.started) {
      return;
    }
    if (input.pressed('Escape') || input.pressed('KeyP')) {
      if (this.map.open) {
        this.map.setOpen(false);
        this.resumeAudio();
      } else if (this.menus.isPause) {
        this.resume();
      } else if (!this.menus.anyOpen) {
        this.pause();
      }
      return;
    }
    if (this.menus.anyOpen) {
      return;
    }
    if (input.pressed('KeyM')) {
      this.map.toggle();
      if (this.map.open) {
        this.suspendAudio();
        this.doc.exitPointerLock?.();
        this.renderMap();
      } else {
        this.resumeAudio();
      }
    }
    if (this.map.open) {
      return;
    }
    if (input.pressed('KeyR')) {
      this.changeRadio();
    }
    if (input.pressed('KeyQ')) {
      if (this.contacts.usePlates(this.wanted)) {
        this.hud.toast('SWAP PLATES — heat dropped');
      } else if (!this.contacts.ready('plates')) {
        this.hud.toast(`SWAP PLATES READY IN ${Math.ceil(this.contacts.remaining('plates'))}s`);
      } else {
        this.hud.toast('SWAP PLATES — no heat to drop');
      }
    }
    if (input.pressed('KeyT')) {
      if (this.contacts.useFix(this.player.car)) {
        this.hud.toast('QUICK FIX — car repaired');
      } else if (!this.contacts.ready('fix')) {
        this.hud.toast(`QUICK FIX READY IN ${Math.ceil(this.contacts.remaining('fix'))}s`);
      } else {
        this.hud.toast('QUICK FIX — get in a car');
      }
    }
    const weapons = ['fists', 'pistol', 'smg', 'shotgun'];
    for (let index = 0; index < weapons.length; index++) {
      if (input.pressed(`Digit${index + 1}`)) {
        if (!this.combat.selectWeapon(weapons[index])) {
          this.hud.toast('Build your reputation to unlock this weapon');
        }
      }
    }
    if (input.pressed('KeyE') || input.pressed('KeyF')) {
      this.enterOrExit();
    }
  }

  update(dt) {
    this.elapsed += dt;
    this.contacts.update(dt);
    // A posed chase is a still frame for the screenshot harness; keep its
    // deliberately staged 34-second contact readout legible while the rest
    // of the scene continues animating.
    if (this.photoPose && this.staged === 'chase') {
      this.contacts.cooldowns.fix = 34;
    }
    if (this.photoPose) {
      this.updatePhotoPose(dt);
      return;
    }
    this.impactCooldown = Math.max(0, this.impactCooldown - dt);
    this.pedCooldown = Math.max(0, this.pedCooldown - dt);
    this.garageToastCooldown = Math.max(0, this.garageToastCooldown - dt);
    this.refreshCars();
    if (this.player.onFoot) {
      const mouse = this.input.mouseDelta();
      this.player.faceHeading(this.player.heading - mouse.dx * 0.003);
      this.aimPitch = THREE.MathUtils.clamp(this.aimPitch - mouse.dy * 0.002, -0.65, 0.7);
      this.player.update(dt, this.input, this.city.colliders);
    } else {
      this.updateDriving(dt);
    }
    this.traffic.update(dt);
    this.pedestrians.update(dt, this.position);
    const seen = this.police.units.some(unit => unit.car.mesh.position.distanceTo(this.position) < 55);
    if (seen) {
      this.wanted.markSeen();
    }
    this.wanted.update(dt);
    this.police.update(dt, {
      pos: this.position,
      speed: Math.abs(this.speed),
      onFoot: this.player.onFoot,
      heading: this.heading,
    }, this.wanted);
    this.helicopter.setActive(this.wanted.stars >= 4);
    this.helicopter.update(dt, this.position, districtAt(this.position.x, this.position.z));
    if (this.helicopter.active && this.helicopter.dispatchAt !== this.lastDispatchAt) {
      this.lastDispatchAt = this.helicopter.dispatchAt;
      if (this.helicopter.lastDispatch) {
        this.dialogue.show('dispatch', this.helicopter.lastDispatch);
      }
    }
    this.roadblocks.update(dt, this.position, this.heading, this.wanted.stars);
    this.refreshCars();
    this.updateCamera(dt);
    this.combat.update(dt, {
      player: this.player,
      input: this.input,
      camera: this.camera,
      cars: this.cars,
      onCrime: crime => this.wanted.addCrime(crime),
      onPlayerHit: damage => this.damagePlayer(damage),
    });
    this.missions.update(dt, {
      playerPos: this.position,
      wanted: this.wanted,
      wantedStars: this.wanted.stars,
      raceWon: this.raceWon,
    });
    this.handleMissionResult();
    const nearbyCars = [...this.traffic.cars, ...this.police.units.map(unit => unit.car)];
    this.nearMiss.update(dt, this.player.car, nearbyCars.filter(car => !(car._collisionFrames > 0)));
    if (this.race.active) {
      this.race.update(dt, this.player.car);
    } else {
      this.offerRace();
    }
    this.updateGarage(dt);
    this.updateDistrict();
    this.dialogue.update(dt);
    const cast = CAST[this.dialogue.currentLine?.[0]];
    this.hud.el('dlg-role').textContent = cast?.role || '';
    this.sky.update(dt);
    if (this.menus.anyOpen) {
      this.suspendAudio();
    } else {
      this.updateAudio();
    }
    if (this.police.bustMeter >= 1) {
      this.end('BUSTED');
    } else if (this.player.health <= 0) {
      this.end('WASTED');
    }
    this.refreshHud();
  }

  updatePhotoPose(dt) {
    if (this.player.car) this.player.car.speed = 0;
    this.traffic.update(dt);
    this.pedestrians.update(dt, this.position);
    // Keep avenue foot traffic on the boardwalk, clear of the posed cars.
    if (this.staged === 'chase' || this.staged === 'race') {
      for (const walker of this.pedestrians.walkers) {
        if (walker.mesh.position.x > 282 && walker.mesh.position.x < 294) {
          walker.mesh.position.x = 298;
          walker.axis = 'z';
          walker.lane = 298;
        }
      }
    }
    this.police.animateLightbars(dt);
    // Keep the posed aircraft and beam fixed while its rotors remain alive.
    if (this.helicopter.active) {
      this.helicopter.rotor.rotation.y += dt * 16;
      this.helicopter.tailRotor.rotation.x += dt * 22;
    }
    this.updateCamera(dt);
    this.dialogue.update(dt);
    const cast = CAST[this.dialogue.currentLine?.[0]];
    this.hud.el('dlg-role').textContent = cast?.role || '';
    this.sky.update(dt);
    this.refreshHud();
  }

  updateDriving(dt) {
    const down = code => this.input.isDown(code);
    const throttle = Number(down('KeyW') || down('ArrowUp')) - Number(down('KeyS') || down('ArrowDown'));
    const steer = Number(down('KeyA') || down('ArrowLeft')) - Number(down('KeyD') || down('ArrowRight'));
    const car = this.player.car;
    const healthBefore = car.health;
    driveStep(car, dt, { throttle, steer, brake: down('Space') }, this.city.colliders);
    let hardImpact = car.health < healthBefore;
    for (const other of this.cars) {
      if (other === car) {
        continue;
      }
      const relative = Math.abs(car.speed - other.speed);
      if (collideCars(car, other) && relative > 7) {
        hardImpact = true;
      }
    }
    if (hardImpact && this.impactCooldown <= 0) {
      this.impactCooldown = 1.2;
      this.audio.crash();
      this.cameraRig.addShake(1.2);
      this.wanted.addCrime('hitCar');
    }
    if (Math.abs(car.speed) > 8 && this.pedCooldown <= 0) {
      const hit = this.pedestrians.walkers.some(ped => ped.mesh.position.distanceTo(car.mesh.position) < 1.6);
      if (hit) {
        this.pedCooldown = 2;
        this.pedestrians.panic(car.mesh.position, 18);
        this.wanted.addCrime('hitPed');
        this.audio.hit();
      }
    }
    // Traffic relinquishes stolen vehicles instead of moving them a second time.
    car._collisionFrames = Math.max(0, (car._collisionFrames || 0) - 1);
    this.player.mesh.position.copy(car.mesh.position);
    this.audio.skid(Math.abs(steer) > 0.7 && Math.abs(car.speed) > 19);
  }

  refreshCars() {
    this.cars = [...new Set([
      ...this.parked,
      ...this.traffic.cars,
      ...this.police.units.map(unit => unit.car),
      ...this.roadblocks.cars,
      ...(this.race?.rival ? [this.race.rival] : []),
      ...(this.player.car ? [this.player.car] : []),
    ])];
  }

  enterOrExit() {
    if (!this.player.onFoot) {
      const car = this.player.car;
      if (Math.abs(car.speed) > 9) {
        this.hud.toast('Slow down before getting out');
        return;
      }
      car.speed = 0;
      this.player.exitCar();
      this.aimPitch = 0;
      this.stopDrivingAudio();
      return;
    }
    let nearest = null;
    let nearestDistance = 3.2;
    for (const car of this.cars) {
      if (Math.abs(car.speed) > 8 || car.health <= 0) {
        continue;
      }
      for (const side of [-1, 1]) {
        const doorX = car.mesh.position.x + Math.cos(car.heading) * side * 1.2;
        const doorZ = car.mesh.position.z - Math.sin(car.heading) * side * 1.2;
        const distance = Math.hypot(this.position.x - doorX, this.position.z - doorZ);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = car;
        }
      }
    }
    if (!nearest) {
      this.hud.toast('Move closer to a car door');
      return;
    }
    this.takeCar(nearest);
    if (nearest !== this.garageCar) {
      this.wanted.addCrime('carTheft');
      this.rank.inc('carsStolen');
      if (this.theftCount++ % 3 === 0) {
        this.dialogue.show('dispatch', 'Vehicle theft reported. Units, watch the harbor approaches.');
      }
      this.save();
    }
  }

  takeCar(car) {
    this.traffic.cars = this.traffic.cars.filter(other => other !== car);
    this.traffic._traffic = this.traffic._traffic.filter(item => item.car !== car);
    const unit = this.police.units.find(item => item.car === car);
    if (unit) {
      this.police.units.splice(this.police.units.indexOf(unit), 1);
    }
    if (!this.parked.includes(car)) {
      this.parked.push(car);
    }
    this.player.enterCar(car);
    this.audio.resume();
    if (this.radioSelection >= 0) {
      this.radio.play(this.radioSelection);
    }
    const station = this.radio.current();
    this.hud.setRadio(station ? `${station.name} · ${station.freq}` : '');
    this.input.lockPointer();
  }

  damagePlayer(damage) {
    const absorbed = Math.min(this.player.armour, Math.max(0, damage) * 0.6);
    this.player.armour -= absorbed;
    this.player.health = Math.max(0, this.player.health - Math.max(0, damage - absorbed));
    this.audio.hit();
    this.cameraRig.addShake(0.2);
  }

  reward({ cash = 0, rp = 0 }) {
    this.state.cash += cash;
    const previous = new Set(this.combat.unlocked);
    const events = this.rank.addRP(rp);
    this.combat.unlocked = this.rank.unlocks().weapons;
    for (const event of events) {
      this.hud.banner('RANK UP', event.name);
    }
    if (events.length) {
      const unlocked = [...this.combat.unlocked].filter(id => !previous.has(id));
      const text = unlocked.length ? `Unlocked: ${unlocked.join(', ')}` : 'Street races available';
      this.hud.toast(text);
    }
    this.save();
  }

  onNearMiss(event) {
    if (this.player.car?._collisionFrames > 0) {
      return;
    }
    this.rank.inc('nearMisses');
    this.reward(event);
    this.hud.popup(`NEAR MISS +$${event.cash}`, event.combo > 1 ? `COMBO x${event.combo}` : '');
  }

  handleMissionResult() {
    const result = this.missions.result;
    if (!result || result === this.lastMissionResult) {
      return;
    }
    this.lastMissionResult = result;
    if (!result.success) {
      return;
    }
    this.rank.inc('deliveries');
    this.state.storyDone = this.missions.done;
    this.save();
    this.audio.success();
    this.suspendAudio();
    if (this.missions.done >= STORY.length && result.title === STORY[STORY.length - 1].title) {
      this.hud.banner('NEON HARBOR — STORY COMPLETE', 'The harbor still has work for you');
    }
    this.menus.showResults(result, {
      onClose: () => {
        this.startNextJob();
        this.resumeAudio();
      },
    });
  }

  startRace(id) {
    if (!this.player.car || this.race.active) {
      return false;
    }
    this.raceWon = false;
    const started = this.race.start(id, {
      onCheckpoint: (index, count) => this.hud.toast(`CHECKPOINT ${index} / ${count}`),
      onFinish: won => {
        this.raceWon = won;
        if (won) {
          this.rank.inc('racesWon');
          this.reward({ cash: 500, rp: 100 });
          this.hud.banner('RACE WON', '+$500 · +100 RP');
          this.audio.success();
        }
      },
    });
    if (started) {
      this.wanted.addCrime('raceIllegal');
      this.dialogue.show('tomas', 'Keep up, Mara. The coast road belongs to nobody.');
    }
    return started;
  }

  offerRace() {
    if (!this.player.car || !this.rank.unlocks().races) {
      return;
    }
    const race = RACES.find(item => Math.hypot(
      item.checkpoints[0].x - this.position.x,
      item.checkpoints[0].z - this.position.z,
    ) < 11);
    if (!race) {
      return;
    }
    if (this.input.pressed('Enter')) {
      this.startRace(race.id);
    } else if (this.garageToastCooldown <= 0) {
      this.hud.toast(`${race.name} · Enter to race`);
      this.garageToastCooldown = 4;
    }
  }

  updateGarage(dt) {
    const garage = this.places.garage;
    const inside = Math.hypot(this.position.x - garage.x, this.position.z - garage.z) < 14;
    const policeClose = this.police.units.some(unit => unit.car.mesh.position.distanceTo(this.position) < 40);
    if (inside && !policeClose && this.wanted.heat > 0) {
      this.wanted.heat = Math.max(0, this.wanted.heat - dt * 0.25);
      if (this.garageToastCooldown <= 0) {
        this.hud.toast("LAYING LOW AT OTTO'S");
        this.garageToastCooldown = 6;
      }
    }
  }

  updateDistrict() {
    const district = districtAt(this.position.x, this.position.z);
    if (!district || district.name === this.lastDistrict) {
      return;
    }
    this.lastDistrict = district.name;
    const taglines = {
      'Old Town': 'Every corner has a memory',
      'Palm Strand': 'Gold coast, fast company',
      'Freight Docks': 'Nothing arrives without a story',
      'Lantern Quarter': 'The night starts early here',
      'North Heights': 'Quiet streets, expensive secrets',
    };
    this.hud.banner(district.name, taglines[district.name]);
  }

  updateCamera(dt) {
    this.cameraRig.mode = this.player.onFoot ? 'foot' : 'car';
    this.cameraRig.follow(dt, this.position, this.heading, this.speed);
    if (this.player.onFoot) {
      this.cameraRig.look.y += this.aimPitch * 12;
      this.camera.lookAt(this.cameraRig.look);
    }
    this.cameraRig.update(dt);
  }

  refreshHud() {
    this.hud.setCash(this.state.cash);
    this.hud.setRank(this.rank.rankName, this.rank.progressToNext());
    this.hud.setStars(this.wanted.stars);
    this.hud.setHeat(this.wanted.heat / 5);
    let heat = 'OFF THE RADAR';
    if (this.wanted.stars > 0) {
      heat = this.wanted.unseenTimer > 4 ? 'SEARCHING · STAY OUT OF SIGHT' : 'NHPD · IN PURSUIT';
      if (this.police.bustMeter > 0) {
        heat = `BUST RISK ${Math.round(this.police.bustMeter * 100)}%`;
      }
    }
    this.hud.setHeatLabel(heat);
    this.hud.setSpeed(this.photoPose ? (this.photoSpeed || 0) : this.speed * 3.6);
    this.hud.setVitals(this.player.health, this.player.armour);
    this.hud.setWeapon(this.player.onFoot ? this.combat.current.name : this.player.car.name);
    const contactState = this.contacts.state();
    const contactSignature = JSON.stringify(contactState.map(contact => [
      contact.id,
      contact.ready,
      Math.ceil(contact.remaining),
      contact.ready || !contact.cooldown
        ? 0
        : Math.round((contact.remaining / contact.cooldown) * 1000) / 10,
    ]));
    if (contactSignature !== this.lastContactsState) {
      this.hud.setContacts(contactState);
      this.lastContactsState = contactSignature;
    }
    const weaponSignature = `${this.combat.weaponId}|${[...this.combat.unlocked].sort().join(',')}`;
    if (weaponSignature !== this.lastWeaponsState) {
      this.hud.setWeapons(WEAPONS, this.combat.weaponId, this.combat.unlocked);
      this.lastWeaponsState = weaponSignature;
    }
    this.hud.setMission(this.stagedMission || this.missions.current);
    this.hud.setResponse(this.wanted.stars > 0 ? this.police.list() : null);
    this.minimap.draw({
      playerPos: this.position,
      heading: this.heading,
      marker: this.marker,
      police: this.police.units,
      heli: this.helicopter,
      raceNext: this.race.active ? this.race.checkpoints[this.race.playerProgress] : null,
      districtName: districtAt(this.position.x, this.position.z)?.name,
      onDistrict: name => this.hud.setDistrict(name),
    });
  }

  renderMap() {
    this.map.render({
      playerPos: { x: this.position.x, z: this.position.z, heading: this.heading },
      marker: this.marker,
      places: this.places,
      card: {
        rankName: this.rank.rankName,
        rp: this.state.rp,
        cash: this.state.cash,
        storyDone: this.missions.done,
        storyTotal: STORY.length,
        stats: this.state.stats,
      },
    });
  }

  changeRadio() {
    // Radio.stop clears index, so preserve the selection separately on foot.
    let station;
    if (this.player.onFoot) {
      this.radioSelection = (this.radioSelection + 2) % (this.radio.stations.length + 1) - 1;
      station = this.radio.stations[this.radioSelection] || null;
    } else {
      this.radio.index = this.radioSelection;
      station = this.radio.next();
      this.radioSelection = this.radio.index;
    }
    this.hud.setRadio(station ? `${station.name} · ${station.freq}` : '');
    this.hud.toast(station ? `${station.freq} · ${station.name}` : 'RADIO OFF');
  }

  updateAudio() {
    const driving = !this.player.onFoot;
    const rpm = driving ? Math.abs(this.speed) / this.player.car.topSpeed : 0;
    this.audio.setEngine(driving ? 0.35 + rpm * 0.65 : 0, rpm);
    this.audio.siren(this.wanted.stars > 0);
    if (!driving) {
      this.audio.skid(false);
    }
  }

  stopDrivingAudio() {
    this.radio.stop();
    this.hud.setRadio('');
    this.audio.setEngine(0, 0);
    this.audio.skid(false);
  }

  suspendAudio() {
    this.stopDrivingAudio();
    this.audio.siren(false);
  }

  resumeAudio() {
    this.audio.resume();
    if (!this.player.onFoot && this.radioSelection >= 0) {
      this.radio.play(this.radioSelection);
    }
    const station = this.radio.current();
    this.hud.setRadio(station ? `${station.name} · ${station.freq}` : '');
    this.input.lockPointer();
  }

  pause() {
    this.suspendAudio();
    this.menus.showPause({
      onResume: () => this.resume(),
      onRestart: () => this.beginSession(false),
    });
  }

  resume() {
    this.menus.hideAll();
    this.resumeAudio();
  }

  end(kind) {
    const stars = this.wanted.stars;
    let detail = 'The harbor gives second chances. Get back on your feet.';
    if (kind === 'BUSTED') {
      const fine = 150 + 100 * stars;
      this.state.cash = Math.max(0, this.state.cash - fine);
      this.rank.inc('busts');
      detail = `NHPD fine: $${fine.toLocaleString('en-US')}. Otto can get you back on the street.`;
      this.audio.busted();
    }
    this.missions.fail();
    this.wanted.reset();
    this.police.clear();
    this.roadblocks.clear();
    this.helicopter.setActive(false);
    this.race.abort();
    this.suspendAudio();
    this.save();
    this.menus.showEnd(kind, detail, {
      onRetry: () => {
        this.resetWorld();
        this.startNextJob();
        this.resumeAudio();
      },
    });
  }

  save() {
    this.state.storyDone = this.missions.done;
    if (!this.staged) {
      writeSave(this.state);
      this.loadedSave = structuredClone(this.state);
    }
  }

  resize() {
    const width = Math.max(1, this.win.innerWidth);
    const height = Math.max(1, this.win.innerHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
