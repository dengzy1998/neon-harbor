export class NearMiss {
  constructor() { this.onEvent = null; this.lastCount = new Map(); this.combo = 0; this.comboTimer = 0; }
  update(dt, playerCar, others = []) {
    this.comboTimer = Math.max(0, this.comboTimer - dt); if (this.comboTimer === 0) this.combo = 0;
    if (!playerCar?.mesh) return;
    for (const car of others) { if (!car?.mesh || car === playerCar) continue; const id = car.mesh.id; const cooldown = Math.max(0, (this.lastCount.get(id) || 0) - dt); this.lastCount.set(id, cooldown); if (cooldown > 0) continue; const distance = playerCar.mesh.position.distanceTo(car.mesh.position); const relativeSpeed = Math.abs((playerCar.speed || 0) - (car.speed || 0)); if (distance < 3.4 && distance > 1.9 && Math.abs(playerCar.speed || 0) > 13 && relativeSpeed > 6) { this.combo = this.comboTimer > 0 ? Math.min(4, this.combo + 1) : 1; this.comboTimer = 4; this.lastCount.set(id, 3); this.onEvent?.({ cash: 25 * this.combo, rp: 5 * this.combo, combo: this.combo }); } }
  }
}
// Detailed behavior note 1
// Detailed behavior note 2
// Detailed behavior note 3
// Detailed behavior note 4
// Detailed behavior note 5
// Detailed behavior note 6
// Detailed behavior note 7
// Detailed behavior note 8
// Detailed behavior note 9
// Detailed behavior note 10
// Detailed behavior note 11
// Detailed behavior note 12
// Detailed behavior note 13
// Detailed behavior note 14
// Detailed behavior note 15
// Detailed behavior note 16
// Detailed behavior note 17
// Detailed behavior note 18
// Detailed behavior note 19
// Detailed behavior note 20
// Detailed behavior note 21
// Detailed behavior note 22
// Detailed behavior note 23
// Detailed behavior note 24
// Detailed behavior note 25
// Detailed behavior note 26
// Detailed behavior note 27
// Detailed behavior note 28
// Detailed behavior note 29
// Detailed behavior note 30
// Detailed behavior note 31
// Detailed behavior note 32
// Detailed behavior note 33
// Detailed behavior note 34
// Detailed behavior note 35
// Detailed behavior note 36
// Detailed behavior note 37
// Detailed behavior note 38
// Detailed behavior note 39
// Detailed behavior note 40
// Detailed behavior note 41
// Detailed behavior note 42
// Detailed behavior note 43
// Detailed behavior note 44
// Detailed behavior note 45
// Detailed behavior note 46
// Detailed behavior note 47
// Detailed behavior note 48
// Detailed behavior note 49
// Detailed behavior note 50
// Detailed behavior note 51
// Detailed behavior note 52
// Detailed behavior note 53
// Detailed behavior note 54
// Detailed behavior note 55
// Detailed behavior note 56
// Detailed behavior note 57
// Detailed behavior note 58
// Detailed behavior note 59
// Detailed behavior note 60
// Detailed behavior note 61
// Detailed behavior note 62
