// The work: Sable's three-job story chain, then an endless board of delivery jobs.
// A mission is a glowing gold beacon somewhere in the city and a line of text on
// the HUD; reach the beacon and the story moves. The beacon, the checkpoints and
// the gold Komodo all live here.

import * as THREE from 'three';
import { STORY, PLACES, CAR_MODELS } from './config.js';

const CHECKPOINT_SPOTS = [
  { x: 58, z: -174 }, { x: 174, z: -58 }, { x: 116, z: 116 },
  { x: -58, z: 174 }, { x: -174, z: 58 }, { x: -116, z: -116 },
];
const JOB_SPOTS = [
  PLACES.marina, PLACES.docks, PLACES.club,
  { x: 174, z: 174, name: 'Sunset Heights' },
  { x: -174, z: -58, name: 'Old Town Row' },
  { x: 58, z: -232, name: 'Northgate' },
  { x: -58, z: 232, name: 'South Pier Flats' },
  { x: 232, z: 0, name: 'The Boardwalk' },
  { x: 0, z: 0, name: 'Harbor Center' },
];

export class MissionSystem {
  /**
   * game: { player, police, traffic, hud, sound, addCash(n), toast(t),
   *         showStory(name, text, cb), crime(kind) }
   */
  constructor(scene, game, rng) {
    this.scene = scene;
    this.game = game;
    this.rng = rng;
    this.missionIndex = 0;      // next story mission; >= STORY.missions.length means jobs
    this.jobsDone = 0;
    this.active = null;         // { kind, phase, target:{x,z,name}, ... }
    this.goldCar = null;
    this.jobTimer = 0;

    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffc44d, transparent: true, opacity: 0.3, depthWrite: false });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 30, 18, 1, true), beamMat);
    this.beam.visible = false;
    scene.add(this.beam);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc44d, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(2.5, 3.1, 28), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);
    this.gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.85), new THREE.MeshBasicMaterial({ color: 0xffc44d }));
    this.gem.visible = false;
    scene.add(this.gem);
  }

  get target() {
    if (!this.active) return null;
    if (this.active.kind === 'hot-property' && this.active.phase === 'steal' && this.goldCar) {
      return { x: this.goldCar.mesh.position.x, z: this.goldCar.mesh.position.z };
    }
    return this.active.target;
  }

  setMarker(x, z) {
    for (const m of [this.beam, this.ring, this.gem]) m.visible = true;
    this.beam.position.set(x, 15, z);
    this.ring.position.set(x, 0.25, z);
    this.gem.position.set(x, 3.4, z);
  }

  hideMarker() {
    for (const m of [this.beam, this.ring, this.gem]) m.visible = false;
  }

  startStoryMission(index) {
    this.missionIndex = index;
    const def = STORY.missions[index];
    if (!def) { this.startJob(); return; }
    if (def.id === 'first-run') {
      this.active = {
        kind: 'first-run', phase: 'pickup',
        target: { ...PLACES.docks },
        title: def.title,
        text: 'Pick up the package at Ferris Freight Docks',
      };
    } else if (def.id === 'neon-circuit') {
      this.active = {
        kind: 'neon-circuit', phase: 'race',
        checkpoints: [...CHECKPOINT_SPOTS], cpIndex: 0, timeLeft: 110,
        target: { ...CHECKPOINT_SPOTS[0], name: 'Checkpoint 1' },
        title: def.title,
        text: 'Hit every checkpoint before the clock dies',
      };
    } else if (def.id === 'hot-property') {
      if (!this.goldCar || this.goldCar.driver === 'player') {
        const model = CAR_MODELS[0];
        this.goldCar = this.game.traffic.addSpecialParked(model, 0xf2b13d, PLACES.goldCarSpot.x + 6, PLACES.goldCarSpot.z, Math.PI / 2);
      }
      this.active = {
        kind: 'hot-property', phase: 'steal',
        target: { ...PLACES.goldCarSpot },
        title: def.title,
        text: 'Steal the gold Komodo GT at Palm Court',
      };
    }
    this.game.toast(`${def.title} — ${def.giver} pays $${def.reward}`);
  }

  startJob() {
    this.active = null;
    const giver = this.rng.pick(STORY.jobGivers);
    let pickup = this.rng.pick(JOB_SPOTS);
    let drop = this.rng.pick(JOB_SPOTS);
    if (drop === pickup) drop = JOB_SPOTS[(JOB_SPOTS.indexOf(pickup) + 3) % JOB_SPOTS.length];
    const dist = Math.hypot(drop.x - pickup.x, drop.z - pickup.z);
    const reward = Math.round((70 + dist * 1.15) / 5) * 5;
    this.active = {
      kind: 'job', phase: 'pickup', giver, reward,
      target: { ...pickup },
      drop: { ...drop },
      title: 'DELIVERY BOARD',
      text: `${giver}: collect the parcel at ${pickup.name}`,
    };
    this.game.toast(`New job from ${giver} — $${reward}`);
  }

  completeStoryMission() {
    const def = STORY.missions[this.missionIndex];
    const finished = this.active;
    this.active = null;
    this.hideMarker();
    this.game.addCash(def.reward);
    this.game.sound.cash();
    this.game.toast(`${def.title} complete — +$${def.reward}`);
    this.missionIndex += 1;
    const next = STORY.missions[this.missionIndex];
    if (next) {
      this.game.showStory(next.giver + ' — THE NEXT JOB', next.brief, () => this.startStoryMission(this.missionIndex));
    } else {
      this.game.showStory(STORY.outro.name, STORY.outro.text, () => this.startJob());
    }
    return finished;
  }

  completeJob() {
    const job = this.active;
    this.active = null;
    this.hideMarker();
    this.jobsDone += 1;
    this.game.addCash(job.reward);
    this.game.sound.cash();
    this.game.toast(`Delivered — +$${job.reward}`);
    this.jobTimer = 2.5; // a breath before the next job appears
  }

  failCircuit() {
    this.game.toast('Out of time — Ivo shrugs. The circuit resets.');
    const a = this.active;
    a.cpIndex = 0;
    a.timeLeft = 110;
    a.target = { ...a.checkpoints[0], name: 'Checkpoint 1' };
  }

  reachRadius() {
    return this.game.player.inCar ? 8 : 5.5;
  }

  update(dt, t) {
    // The beacon breathes and the gem spins, busy or not.
    this.gem.rotation.y += dt * 2.2;
    this.gem.position.y = 3.4 + Math.sin(t * 2.4) * 0.35;
    this.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06);

    if (!this.active) {
      if (this.missionIndex >= STORY.missions.length) {
        this.jobTimer -= dt;
        if (this.jobTimer <= 0) this.startJob();
      }
      return;
    }
    const a = this.active;
    const player = this.game.player;
    const target = this.target;
    if (!target) return;
    this.setMarker(target.x, target.z);
    const dist = Math.hypot(player.pos.x - target.x, player.pos.z - target.z);
    let distText = `${Math.round(dist)} m`;
    if (a.kind === 'neon-circuit' && a.phase === 'race') {
      a.timeLeft -= dt;
      distText = `Checkpoint ${a.cpIndex + 1}/${a.checkpoints.length} · ${Math.round(dist)} m · ${Math.max(0, Math.ceil(a.timeLeft))}s`;
      if (a.timeLeft <= 0) this.failCircuit();
    }
    this.game.hud.setObjective(a.title, a.text, distText);

    if (a.kind === 'hot-property' && a.phase === 'steal' && this.goldCar && player.inCar === this.goldCar) {
      this.game.police.setWanted(3);
      a.phase = 'deliver';
      a.target = { ...PLACES.hideout };
      a.text = 'Get the Komodo to the Breakwater Garage — lose them or outrun them';
      this.game.toast('The owner called it in — three stars!');
      return;
    }
    if (dist > this.reachRadius()) return;

    // Arrived.
    if (a.kind === 'first-run') {
      if (a.phase === 'pickup') {
        a.phase = 'deliver';
        a.target = { ...PLACES.club };
        a.text = 'Deliver the package to Club Sable';
        this.game.crime('package');
        this.game.sound.chime();
        this.game.toast('Package on board — the dock crew looks nervous');
      } else {
        this.completeStoryMission();
      }
    } else if (a.kind === 'neon-circuit') {
      this.game.sound.chime();
      a.cpIndex += 1;
      a.timeLeft += 14;
      if (a.cpIndex >= a.checkpoints.length) {
        this.completeStoryMission();
      } else {
        a.target = { ...a.checkpoints[a.cpIndex], name: `Checkpoint ${a.cpIndex + 1}` };
        this.game.toast(`Checkpoint ${a.cpIndex}/${a.checkpoints.length} — +14s`);
      }
    } else if (a.kind === 'hot-property') {
      if (a.phase === 'deliver' && player.inCar === this.goldCar) {
        this.completeStoryMission();
      }
    } else if (a.kind === 'job') {
      if (a.phase === 'pickup') {
        a.phase = 'deliver';
        a.target = { ...a.drop };
        a.text = `${a.giver}: take it to ${a.drop.name}`;
        this.game.sound.chime();
        this.game.toast('Parcel on board');
      } else {
        this.completeJob();
      }
    }
  }
}
