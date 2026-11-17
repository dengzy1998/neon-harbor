// Sound, all of it synthesised with WebAudio: a sawtooth engine that follows the
// throttle, a two-tone siren that swells as the law gets close, and little bursts
// and chimes for everything else. Nothing is loaded; everything is made.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenPhase = 0;
    this.noiseBuffer = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.5;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  /** Continuous engine hum; call every frame. ratio is 0..1 of top speed. */
  engine(ratio, running) {
    if (!this.ctx) return;
    if (running && !this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filter).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
      this.engineFilter = filter;
    }
    if (!this.engineOsc) return;
    const t = this.ctx.currentTime;
    const target = running ? 0.055 + ratio * 0.05 : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.09);
    this.engineOsc.frequency.setTargetAtTime(52 + ratio * 175, t, 0.08);
    if (this.engineFilter) this.engineFilter.frequency.setTargetAtTime(380 + ratio * 900, t, 0.1);
  }

  /** Continuous siren; call every frame with the nearest unit's distance. */
  siren(nearest, stars, dt) {
    if (!this.ctx) return;
    if (stars > 0 && nearest < 90 && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
    }
    if (!this.sirenOsc) return;
    this.sirenPhase += dt * 2.6;
    const tone = Math.sin(this.sirenPhase * Math.PI) > 0 ? 880 : 660;
    const vol = stars > 0 ? Math.max(0, 0.05 * (1 - nearest / 95)) : 0;
    const t = this.ctx.currentTime;
    this.sirenOsc.frequency.setTargetAtTime(tone, t, 0.03);
    this.sirenGain.gain.setTargetAtTime(vol, t, 0.12);
  }

  blip(freq, dur, type = 'sine', vol = 0.16, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur, filterFreq, vol, type = 'lowpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  ui() { this.blip(660, 0.07, 'sine', 0.1); }
  chime() { this.blip(880, 0.14, 'sine', 0.16); this.blip(1318, 0.22, 'sine', 0.14, 0.09); }
  cash() { this.blip(988, 0.1, 'triangle', 0.16); this.blip(1318, 0.12, 'triangle', 0.16, 0.08); this.blip(1760, 0.24, 'triangle', 0.15, 0.16); }
  thud(strength = 1) { this.noise(0.16 + strength * 0.1, 300, Math.min(0.5, 0.2 + strength * 0.2)); }
  punch() { this.noise(0.09, 900, 0.25, 'bandpass'); }
  shot() { this.noise(0.05, 3200, 0.1, 'highpass'); }
  busted() { this.blip(392, 0.3, 'square', 0.1); this.blip(311, 0.45, 'square', 0.1, 0.22); }
}
