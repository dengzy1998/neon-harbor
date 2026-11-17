// audio.js — every sound in Neon Harbor is synthesised with WebAudio; there
// are no audio files. A two-oscillator engine hum follows the player's car,
// a two-tone siren swells as the nearest police unit closes in, and short
// envelopes cover pickups, punches, crashes, cash and the busted sting.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineNodes = null;
    this.sirenNodes = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.55;
    return muted;
  }

  tone(freq, dur, { type = 'sine', gain = 0.2, slide = 0, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  noise(dur, gain = 0.3) {
    if (!this.ctx || this.muted) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 900;
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start();
  }

  click() { this.tone(660, 0.06, { type: 'triangle', gain: 0.15 }); }
  pickup() { this.tone(880, 0.09, { gain: 0.2 }); this.tone(1318, 0.14, { gain: 0.2, delay: 0.07 }); }
  cash() { this.tone(988, 0.08, { type: 'square', gain: 0.08 }); this.tone(1319, 0.1, { type: 'square', gain: 0.08, delay: 0.06 }); this.tone(1568, 0.16, { type: 'square', gain: 0.08, delay: 0.12 }); }
  punch() { this.tone(160, 0.09, { type: 'square', gain: 0.22, slide: -70 }); this.noise(0.05, 0.12); }
  crash(hard) { this.noise(hard ? 0.4 : 0.18, hard ? 0.5 : 0.25); this.tone(70, 0.25, { type: 'sawtooth', gain: 0.2, slide: -30 }); }
  success() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, { type: 'triangle', gain: 0.16, delay: i * 0.09 })); }
  fail() { this.tone(220, 0.3, { type: 'sawtooth', gain: 0.16, slide: -110 }); }
  sting() { this.tone(392, 0.22, { type: 'square', gain: 0.14 }); this.tone(311, 0.4, { type: 'square', gain: 0.14, delay: 0.18 }); }

  // Continuous engine hum while driving; ratio is 0..1 of top speed.
  setEngine(ratio, active) {
    if (!this.ctx) return;
    if (active && !this.engineNodes) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'square';
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 500;
      const g = this.ctx.createGain();
      g.gain.value = 0.0;
      osc.connect(filter); osc2.connect(filter); filter.connect(g); g.connect(this.master);
      osc.start(); osc2.start();
      this.engineNodes = { osc, osc2, filter, g };
    }
    if (!this.engineNodes) return;
    const n = this.engineNodes;
    const target = active ? 0.05 + ratio * 0.06 : 0;
    n.g.gain.setTargetAtTime(this.muted ? 0 : target, this.ctx.currentTime, 0.09);
    n.osc.frequency.setTargetAtTime(55 + ratio * 165, this.ctx.currentTime, 0.06);
    n.osc2.frequency.setTargetAtTime(28 + ratio * 84, this.ctx.currentTime, 0.06);
    n.filter.frequency.setTargetAtTime(320 + ratio * 900, this.ctx.currentTime, 0.1);
  }

  // Two-tone siren; level 0..1 by the nearest unit's distance.
  setSiren(level) {
    if (!this.ctx) return;
    if (level > 0.02 && !this.sirenNodes) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      const lfo = this.ctx.createOscillator();
      lfo.type = 'square'; lfo.frequency.value = 0.55;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 210;
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
      osc.frequency.value = 940;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      osc.connect(g); g.connect(this.master);
      osc.start(); lfo.start();
      this.sirenNodes = { osc, lfo, g };
    }
    if (!this.sirenNodes) return;
    this.sirenNodes.g.gain.setTargetAtTime(
      this.muted ? 0 : level * 0.075, this.ctx.currentTime, 0.15);
  }
}
