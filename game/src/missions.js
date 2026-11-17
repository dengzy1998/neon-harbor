// missions.js — the story director. Three linked jobs make the campaign
// (a dockside package run, the Neon Circuit time trial, and a very hot
// Komodo GT), and when the story is done it keeps dealing repeatable
// delivery work. A glowing beacon marks the current target; this module
// owns the stage machine, the beacon, the checkpoint timer and the words
// on the objective banner, and reports completions back through its hooks.

import * as THREE from 'three';
import { MISSIONS, PLACES } from './config.js';

const CIRCUIT_POINTS = [
  { x: -120, z: -120 }, { x: 120, z: -120 }, { x: 160, z: 40 },
  { x: 40, z: 160 }, { x: -80, z: 120 }, { x: -160, z: -40 },
];
const JOB_SPOTS = [
  { x: -160, z: 40 }, { x: 0, z: -160 }, { x: 160, z: -80 }, { x: 80, z: 80 },
  { x: -80, z: -80 }, { x: 40, z: 0 }, { x: -40, z: 160 }, { x: 120, z: 160 },
  { x: -160, z: -160 }, { x: 160, z: 160 }, { x: 0, z: 40 }, { x: -120, z: 0 },
];

export class Missions {
  constructor(scene, hooks) {
    this.scene = scene;
    this.hooks = hooks;
    this.missionIndex = 0;
    this.storyDone = false;
    this.stage = 'none'; // pickup | deliver | circuit | steal | job-pickup | job-deliver
    this.target = null;
    this.timer = 0;
    this.cpIndex = 0;
    this.hotCar = null;
    this.job = null;
    this.beacon = this.makeBeacon(0xfbbf24);
    this.scene.add(this.beacon);
    this.beacon.visible = false;
    this.time = 0;
  }

  makeBeacon(color) {
    const group = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.3, 34, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    beam.position.y = 17;
    group.add(beam);
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.85),
      new THREE.MeshBasicMaterial({ color }),
    );
    gem.position.y = 2.4;
    gem.name = 'gem';
    group.add(gem);
    return group;
  }

  setBeacon(target, color) {
    this.target = target;
    if (!target) { this.beacon.visible = false; return; }
    this.beacon.position.set(target.x, 0, target.z);
    this.beacon.children[0].material.color.setHex(color);
    this.beacon.children[1].material.color.setHex(color);
    this.beacon.visible = true;
  }

  // Begin the mission at `index` (0..2 story, 3+ endless jobs).
  start(index) {
    this.missionIndex = index;
    if (index === 0) {
      this.stage = 'pickup';
      this.setBeacon({ ...PLACES.docks }, 0xfbbf24);
    } else if (index === 1) {
      this.stage = 'circuit';
      this.cpIndex = 0;
      this.timer = MISSIONS[1].timeLimit;
      this.setBeacon({ ...CIRCUIT_POINTS[0] }, 0x22d3ee);
    } else if (index === 2) {
      this.stage = 'steal';
      this.hotCar = this.hooks.spawnHotCar();
      this.setBeacon({ x: this.hotCar.pos.x, z: this.hotCar.pos.z }, 0xf471b5);
    } else {
      this.makeJob();
    }
  }

  makeJob() {
    const a = JOB_SPOTS[Math.floor(Math.random() * JOB_SPOTS.length)];
    let b = JOB_SPOTS[Math.floor(Math.random() * JOB_SPOTS.length)];
    if (b === a) b = JOB_SPOTS[(JOB_SPOTS.indexOf(a) + 3) % JOB_SPOTS.length];
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    this.job = { from: a, to: b, reward: Math.round(140 + dist * 0.9) };
    this.stage = 'job-pickup';
    this.setBeacon({ ...a }, 0x34d399);
    this.hooks.onToast('New delivery on the board');
  }

  currentTitle() {
    if (this.missionIndex < 3) return MISSIONS[this.missionIndex].title;
    return 'Harbor Deliveries';
  }

  objectiveText() {
    const d = this.target && this.playerPos
      ? Math.round(Math.hypot(this.target.x - this.playerPos.x, this.target.z - this.playerPos.z))
      : 0;
    const dist = this.target ? ` <span class="dist">${d}m</span>` : '';
    const t = `<b>${this.currentTitle()}</b> — `;
    switch (this.stage) {
      case 'pickup': return t + 'Pick up the package at the freight docks' + dist;
      case 'deliver': return t + (this.missionIndex === 2
        ? 'Get the Komodo to Otto\u2019s back lot'
        : 'Deliver the package to Club Velvetine') + dist;
      case 'circuit': return t + `Hit the circuit lights (${this.cpIndex + 1}/6) — <b>${Math.max(0, this.timer).toFixed(0)}s</b>` + dist;
      case 'steal': return t + 'Steal the gold Komodo GT at the docks' + dist;
      case 'job-pickup': return t + 'Collect the parcel' + dist;
      case 'job-deliver': return t + `Drop it off — $${this.job.reward} on delivery` + dist;
      default: return '';
    }
  }

  completeStoryMission() {
    const m = MISSIONS[this.missionIndex];
    this.hooks.onCash(m.reward, m.title);
    this.hooks.onAudio('success');
    this.stage = 'none';
    this.setBeacon(null);
    const next = this.missionIndex + 1;
    if (next === 1) this.hooks.onStory('afterFirst', () => this.start(1));
    else if (next === 2) this.hooks.onStory('afterSecond', () => this.start(2));
    else {
      this.storyDone = true;
      this.missionIndex = 3;
      this.hooks.onStory('afterThird', () => this.start(3));
    }
    this.hooks.onSave();
  }

  notifyEnteredCar(car) {
    if (this.stage === 'steal' && car === this.hotCar) {
      this.hooks.onSetHeat(300); // the owner reported it: three stars, now
      this.hooks.onToast('That is the one. Get it to Otto\u2019s back lot!');
      this.stage = 'deliver';
      this.setBeacon({ ...PLACES.hideout }, 0xf471b5);
    }
  }

  update(dt, ctx) {
    this.time += dt;
    this.playerPos = ctx.playerPos;
    if (this.beacon.visible) {
      const gem = this.beacon.children[1];
      gem.rotation.y += dt * 2.4;
      gem.position.y = 2.4 + Math.sin(this.time * 3) * 0.35;
      this.beacon.children[0].material.opacity = 0.18 + Math.sin(this.time * 2.2) * 0.06;
    }
    if (this.stage === 'none' || !this.target) return;
    const dist = Math.hypot(this.target.x - ctx.playerPos.x, this.target.z - ctx.playerPos.z);

    if (this.stage === 'circuit') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.hooks.onToast('Out of time — the circuit resets. Run it again!');
        this.hooks.onAudio('fail');
        this.cpIndex = 0;
        this.timer = MISSIONS[1].timeLimit;
        this.setBeacon({ ...CIRCUIT_POINTS[0] }, 0x22d3ee);
        return;
      }
      if (ctx.driving && dist < 8) {
        this.hooks.onAudio('pickup');
        this.cpIndex++;
        if (this.cpIndex >= CIRCUIT_POINTS.length) { this.completeStoryMission(); return; }
        this.setBeacon({ ...CIRCUIT_POINTS[this.cpIndex] }, 0x22d3ee);
      }
      return;
    }

    if (dist > (this.stage === 'deliver' && this.missionIndex === 2 ? 7 : 4.6)) return;

    if (this.stage === 'pickup') {
      if (ctx.driving) return; // step out and grab it
      this.hooks.onAudio('pickup');
      this.hooks.onToast('Package in hand. Club Velvetine, across town.');
      this.stage = 'deliver';
      this.setBeacon({ x: PLACES.club.x + 16, z: PLACES.club.z - 4 }, 0xfbbf24);
    } else if (this.stage === 'deliver' && this.missionIndex === 0) {
      this.completeStoryMission();
    } else if (this.stage === 'deliver' && this.missionIndex === 2) {
      if (ctx.playerCar !== this.hotCar) return;
      this.hooks.onCrimeFree();
      this.completeStoryMission();
    } else if (this.stage === 'job-pickup') {
      this.hooks.onAudio('pickup');
      this.stage = 'job-deliver';
      this.setBeacon({ ...this.job.to }, 0x34d399);
    } else if (this.stage === 'job-deliver') {
      this.hooks.onCash(this.job.reward, 'Delivery');
      this.hooks.onAudio('success');
      this.hooks.onSave();
      this.makeJob();
    }
  }
}
