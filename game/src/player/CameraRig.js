import * as THREE from 'three';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'foot';
    this.position = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.shake = 0;
    this.shakeTime = 0;
    this._shakeOffset = new THREE.Vector3();
  }

  setFollowTarget(targetPos, heading) {
    const car = this.mode === 'car';
    const distance = car ? 9 : 5.5;
    const height = car ? 3.4 : 2.1;
    const ahead = car ? 6 : 0;
    const forwardX = Math.sin(heading);
    const forwardZ = Math.cos(heading);
    this.desired.set(
      targetPos.x - forwardX * distance,
      targetPos.y + height,
      targetPos.z - forwardZ * distance,
    );
    this.look.set(
      targetPos.x + forwardX * ahead,
      targetPos.y + (car ? 1.2 : 1.4),
      targetPos.z + forwardZ * ahead,
    );
  }

  snap(targetPos, heading, mode = this.mode) {
    this.mode = mode;
    this.setFollowTarget(targetPos, heading);
    this.position.copy(this.desired);
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.look);
  }

  follow(dt, targetPos, heading) {
    this.setFollowTarget(targetPos, heading);
    const blend = 1 - Math.exp(-Math.min(dt, 0.1) * (this.mode === 'car' ? 4.2 : 6.2));
    if (this.position.lengthSq() === 0) {
      this.position.copy(this.desired);
    } else {
      this.position.lerp(this.desired, blend);
    }
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.look);
  }

  addShake(amount) {
    this.shake = Math.min(2.5, this.shake + Math.max(0, amount));
  }

  update(dt) {
    const step = Math.min(dt, 0.1);
    this.shake = Math.max(0, this.shake - step * 2.8);
    this.shakeTime += step * 31;
    if (this.shake > 0.001) {
      const amplitude = this.shake * 0.045;
      this._shakeOffset.set(
        Math.sin(this.shakeTime * 1.1) * amplitude,
        Math.cos(this.shakeTime * 1.7) * amplitude * 0.6,
        Math.sin(this.shakeTime * 0.8) * amplitude * 0.35,
      );
      this.camera.position.add(this._shakeOffset);
    }
  }
}
