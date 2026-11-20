const WEIGHTS = {
  carTheft: 1, hitCar: 0.5, hitPed: 1.2, shotFired: 0.7,
  guardDown: 1.5, raceIllegal: 0.4,
};

export class WantedSystem {
  constructor() {
    this.heat = 0;
    this.unseenTimer = 0;
    this.onStarChange = null;
    this._stars = 0;
  }
  get stars() { return this.heat < 0.05 ? 0 : Math.ceil(this.heat); }
  addCrime(kind) { this.heat = Math.min(5, this.heat + (WEIGHTS[kind] || 0)); this.markSeen(); this._sync(); }
  markSeen() { this.unseenTimer = 0; }
  update(dt) {
    this.unseenTimer += Math.max(0, dt);
    if (this.unseenTimer > 6) {
      this.heat = Math.max(0, this.heat - (this.heat < 1 ? 0.09 : 0.05) * dt);
      this._sync();
    }
  }
  _sync() { const stars = this.stars; if (stars !== this._stars) { const old = this._stars; this._stars = stars; this.onStarChange?.(stars, old); } }
  reset() { this.heat = 0; this.unseenTimer = 0; this._sync(); }
}
