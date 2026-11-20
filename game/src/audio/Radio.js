const STATIONS = [
  { name: 'Harborlight FM', freq: '104.7', style: 'synthwave' },
  { name: 'Lowtide Radio', freq: '98.3', style: 'marimba' },
];
const HARBOR_LEAD = [0, 7, 12, 7, 3, 10, 14, 10, 0, 7, 12, 15, 10, 7, 3, 7];
const HARBOR_BASS = [0, 0, 5, 5, 7, 7, 3, 3];
const LOWTIDE = [0, 4, 7, 11, 7, 4, 2, 7, 9, 7, 4, 2, 0, 4, 7, 4];

export class Radio {
  constructor(audioEngine) {
    this.audio = audioEngine;
    this.stations = STATIONS.map(({ name, freq }) => ({ name, freq }));
    this.index = -1;
    this._timer = null;
    this._tick = 0;
    this._generation = 0;
  }

  play(index) {
    const next = Math.trunc(index);
    if (next < 0 || next >= this.stations.length) {
      this.stop();
      return;
    }
    this.stop();
    this.index = next;
    this._tick = 0;
    const generation = this._generation;
    this.audio.resume().then(() => {
      if (this.index === next && this._generation === generation) this._step(generation);
    });
  }

  stop() {
    this._generation++;
    if (this._timer !== null) clearTimeout(this._timer);
    this._timer = null;
    this.index = -1;
  }

  next() {
    this.play((this.index + 1) % (this.stations.length + 1));
    return this.current();
  }

  current() {
    return this.index < 0 ? null : this.stations[this.index];
  }

  _step(generation) {
    if (generation !== this._generation || this.index < 0) return;
    const station = this.index;
    const t = this._tick++;
    if (station === 0) {
      const lead = HARBOR_LEAD[t % HARBOR_LEAD.length];
      const bass = HARBOR_BASS[t % HARBOR_BASS.length];
      const root = 146.83 * Math.pow(2, bass / 12);
      this.audio.tone(root, 0.34, 0.055, 'triangle');
      this.audio.tone(root * 2, 0.26, 0.025, 'sine', 0.01);
      if (t % 2 === 0) {
        const note = 440 * Math.pow(2, lead / 12);
        this.audio.tone(note, 0.22, 0.038, 'sawtooth');
        this.audio.tone(note * 2, 0.2, 0.013, 'sine');
      }
      if (t % 8 === 0) {
        const chord = [0, 4, 7].map(semitone => 146.83 * Math.pow(2, (bass + semitone) / 12));
        for (const note of chord) this.audio.tone(note, 1.45, 0.014, 'sine');
      }
    } else {
      const semitone = LOWTIDE[t % LOWTIDE.length];
      const note = 392 * Math.pow(2, semitone / 12);
      this.audio.tone(note, 0.28, 0.085, 'sine');
      this.audio.tone(note * 2.76, 0.19, 0.022, 'triangle', 0.025);
      if (t % 4 === 0) this.audio.tone(130.81 * Math.pow(2, (t % 8) / 12), 0.52, 0.035, 'sine');
    }
    const beat = station === 0 ? 0.29 : 0.36;
    this._timer = setTimeout(() => this._step(generation), beat * 1000);
  }
}
