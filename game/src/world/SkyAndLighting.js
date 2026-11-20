import * as THREE from 'three';

export function applySky(scene, renderer) {
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  scene.background = new THREE.Color(0xf3bfab);
  scene.fog = new THREE.FogExp2(0xf0c4aa, 0.0031);
  scene.add(new THREE.HemisphereLight(0xffe9d8, 0x9a91b4, 2.0));
  const sun = new THREE.DirectionalLight(0xffcf91, 2.4);
  sun.position.set(-64, 45, 38);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -65, right: 65, top: 65, bottom: -65, near: 1, far: 165 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.16;
  sun.shadow.bias = -0.0002;
  scene.add(sun, sun.target);
  const amber = new THREE.Color(0xffc187);
  const peach = new THREE.Color(0xffdfa6);
  let elapsed = 0;
  return {
    sun,
    update(dt) {
      elapsed += dt;
      sun.color.copy(amber).lerp(peach, 0.5 + 0.34 * Math.sin(elapsed * 0.045));
    },
  };
}
