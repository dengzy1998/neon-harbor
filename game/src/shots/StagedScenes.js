import * as THREE from 'three';
import { createCar } from '../vehicles/Vehicles.js';
import { RACES } from '../activities/StreetRace.js';
import { RankSystem } from '../progression/RankSystem.js';
import { WEAPONS } from '../combat/Combat.js';

function placeCar(car, x, z, heading, speed) {
  car.mesh.position.set(x, 0, z);
  car.heading = heading;
  car.mesh.rotation.y = heading;
  car.speed = speed;
  car.health = 100;
}

function goldKomodo(game, x, z, speed) {
  const car = game.garageCar || createCar(game.scene, 'komodo', 0xdcb45d);
  // The simulation uses +Z as heading zero, including staged traffic.
  placeCar(car, x, z, 0, speed);
  if (!game.parked.includes(car)) {
    game.parked.push(car);
  }
  game.takeCar(car);
  return car;
}

function prepare(game) {
  game.menus.hideAll();
  game.hud.el('popups').style.removeProperty('top');
  game.photoPose = false;
  game.photoSpeed = null;
  if (game.photoProps) {
    game.scene.remove(game.photoProps);
    game.photoProps.traverse(object => {
      if (object.isMesh) {
        object.geometry.dispose();
        object.material.dispose();
      }
    });
    game.photoProps = null;
  }
  for (const node of [...game.hud.el('popups').children]) {
    game.hud.removePopup(node);
  }
  game.map.setOpen(false);
  game.missions.fail();
  game.missions.result = null;
  game.dialogue.clear();
  game.combat.clearGuards();
  game.police.clear();
  game.roadblocks.clear();
  game.wanted.reset();
  game.contacts.reset();
  game.helicopter.setActive(false);
  game.race.abort();
  game.clearMarker();
  game.stagedMission = null;
  game.hud.setRadio('');
  game.player.health = 100;
  game.player.armour = 0;
}

function stageChase(game) {
  game.photoPose = true;
  game.photoSpeed = 82;
  game.hud.el('popups').style.top = '53%';
  const car = goldKomodo(game, 288, 30, 0);
  const target = {
    pos: car.mesh.position,
    speed: 0,
    heading: car.heading,
    onFoot: false,
  };
  // Populate the real police system, then retain five posed units.
  game.police.update(0, target, { stars: 5, unseenTimer: 0 });
  const extra = game.police.units.pop();
  game.scene.remove(extra.car.mesh);
  game.wanted.heat = 3.6;
  game.wanted.markSeen();
  // Show the chase favor in motion: Bea is ready while Otto is on cooldown.
  game.contacts.cooldowns.fix = 34;
  const lanes = [-2.8, 2.4, -1.8];
  for (let index = 0; index < 3; index++) {
    const unit = game.police.units[index];
    placeCar(unit.car, 288 + lanes[index], 30 - (12 + index * 8), 0, 0);
    unit.state = 'pursue';
    unit.flash = index * 0.15;
  }
  for (let index = 0; index < 2; index++) {
    const unit = game.police.units[index + 3];
    placeCar(unit.car, 284.8 + index * 6.2, 85, Math.PI / 2 + (index ? -0.2 : 0.2), 0);
    unit.state = 'roadblock';
  }
  game.police.units[0].state = 'ram';
  game.police.units[2].state = 'flank';
  game.helicopter.setActive(true);
  game.helicopter.setDistrict('Palm Strand');
  // The fuselage is modeled at local Y=42; pose it at 26m, ahead-left.
  const helicopter = game.helicopter;
  helicopter.mesh.position.set(car.mesh.position.x + 20, -16, car.mesh.position.z + 85);
  const landing = new THREE.Vector3(-18, 16.04, -82);
  const beam = helicopter.light.position.clone().sub(landing);
  helicopter.light.target.position.copy(landing);
  helicopter.light.distance = 120;
  helicopter.cone.position.copy(landing).addScaledVector(beam, 0.5);
  helicopter.cone.scale.y = beam.length() / 30;
  helicopter.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beam.normalize());
  helicopter.disc.position.copy(landing);
  game.stagedMission = {
    title: 'Neon Harbor',
    stageText: 'Deliver to the marina under pressure',
    index: 4,
    count: 4,
  };
  game.hud.setMission(game.stagedMission);
  game.hud.setRadio('Harborlight FM · 104.7');
  game.dialogue.showInstant(
    'dispatch',
    'All units: gold Komodo GT on Palm Strand. ANCHOR-1, you are primary.',
  );
  game.hud.setSpeed(82);
  game.hud.popup('NEAR MISS +$40', 'COMBO x2');
  game.lastDistrict = 'Palm Strand';
  game.hud.setDistrict('Palm Strand');
}

function stageHeist(game) {
  game.photoPose = true;
  game.player.exitCar();
  game.player.mesh.position.set(-168, 0, 216);
  game.player.faceHeading(0);
  game.player.health = 72;
  game.player.armour = 40;
  game.combat.unlocked = new Set(['fists', 'pistol']);
  game.combat.selectWeapon('pistol');
  game.contacts.reset();
  game.hud.setWeapons(WEAPONS, 'pistol', game.combat.unlocked);
  game.lastWeaponsState = `${game.combat.weaponId}|${[...game.combat.unlocked].sort().join(',')}`;
  game.combat.spawnGuards([
    { x: -173, z: 224 },
    { x: -170, z: 228 },
    { x: -165, z: 229 },
    { x: -162, z: 225 },
  ]);
  game.photoProps = new THREE.Group();
  for (const [x, color] of [[-178, 0x417c88], [-158, 0xac5748]]) {
    for (let level = 0; level < 2; level++) {
      const container = new THREE.Mesh(
        new THREE.BoxGeometry(4, 2.5, 9),
        new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
      );
      container.position.set(x, 1.25 + level * 2.55, 228);
      container.castShadow = true;
      container.receiveShadow = true;
      game.photoProps.add(container);
    }
  }
  game.scene.add(game.photoProps);
  for (const guard of game.combat.guards) {
    guard.mesh.lookAt(game.player.mesh.position);
  }
  game.stagedMission = {
    title: 'Harbor Lights',
    stageText: 'Clear the guards',
    index: 2,
    count: 3,
  };
  game.hud.setMission(game.stagedMission);
  game.hud.setVitals(72, 40);
  game.dialogue.showInstant(
    'ilya',
    'They were not invited, Mara. Clear the dock, quietly if you can.',
  );
  game.lastDistrict = 'Freight Docks';
  game.hud.setDistrict('Freight Docks');
}

function stageRace(game) {
  game.photoPose = true;
  game.photoSpeed = 87;
  const definition = RACES.find(race => race.id === 'strand-sprint');
  const checkpoint = definition.checkpoints[2];
  game.race.start(definition.id);
  const car = goldKomodo(game, checkpoint.x - 2.3, checkpoint.z - 25, 0);
  game.race.playerProgress = 2;
  game.race.rivalProgress = 2;
  game.race.elapsed = 9;
  placeCar(game.race.rival, checkpoint.x + 2.3, car.mesh.position.z + 1, 0, 0);
  for (let index = 0; index < game.race.rings.length; index++) {
    game.race.rings[index].visible = index === 2;
  }
  // Use the race's native ring, upright across the avenue for a readable marker.
  const ring = game.race.rings[2].children[0];
  ring.rotation.x = 0;
  ring.position.y = 6;
  game.dialogue.showInstant('tomas', 'Third marker is mine, Mara. Try to keep up.');
  game.hud.setSpeed(87);
  game.hud.setRadio('Lowtide Radio · 98.3');
  game.hud.toast('POSITION 2 / 2');
  game.hud.popup('NEAR MISS +$40', '');
  game.lastDistrict = 'Palm Strand';
  game.hud.setDistrict('Palm Strand');
}

function stageMap(game) {
  // These are in-memory demonstration values. Game.save skips staged sessions.
  game.state.cash = 4860;
  game.state.rp = 640;
  game.state.storyDone = 3;
  game.state.stats = {
    carsStolen: 14,
    nearMisses: 23,
    racesWon: 1,
    deliveries: 6,
    busts: 1,
  };
  game.rank = new RankSystem(game.state);
  game.combat.unlocked = game.rank.unlocks().weapons;
  game.missions.done = 3;
  game.player.exitCar();
  game.player.mesh.position.set(112, 0, 56);
  game.player.faceHeading(Math.PI / 4);
  game.setMarker(-168, 216, 'Freight Docks');
  game.map.setOpen(true);
  game.map.render({
    playerPos: {
      x: game.position.x,
      z: game.position.z,
      heading: game.heading,
    },
    marker: game.marker,
    places: game.places,
    card: {
      rankName: game.rank.rankName,
      rp: 640,
      cash: 4860,
      storyDone: 3,
      storyTotal: 6,
      stats: game.state.stats,
    },
  });
  game.suspendAudio();
}

/** Fail locally so an unknown screenshot request cannot stop the RAF loop. */
export function stageScene(game, name) {
  try {
    prepare(game);
    switch (name) {
      case 'chase':
        stageChase(game);
        break;
      case 'heist':
        stageHeist(game);
        break;
      case 'race':
        stageRace(game);
        break;
      case 'map':
        stageMap(game);
        break;
      default:
        game.hud.toast(`Unknown scene: ${name}`);
        break;
    }
  } catch (error) {
    // Keep the failure visible to development tooling and the player.
    console.error(`Unable to stage ${name}`, error);
    game.hud.toast(`Scene ${name} could not be fully staged`);
  } finally {
    // Common presentation invariants apply even if a system rejects a scene.
    if (game.photoPose) {
      // Hold the existing HUD overlays for the duration of the pose.
      for (const timers of game.hud.popupTimers.values()) {
        for (const timer of timers) game.hud.cancel(timer);
      }
      game.hud.cancel(game.hud.toastTimer);
    }
    // The caller performs the camera and HUD refresh after this function.
    // Keeping this cleanup centralized also supports unknown scene names.
    game.hud.showHud(true);
    game.menus.hideAll();
    game.started = true;
    game.staged = name;
  }
}
