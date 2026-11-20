export class AudioEngine {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this._muted = false;
    this._engineGain = null;
    this._engineFilter = null;
    this._engineOsc = [];
    this._sirenOsc = [];
    this._sirenGain = null;
    this._sirenTimer = null;
    this._skidSource = null;
    this._skidGain = null;
  }

  get muted() { return this._muted; }
  set muted(value) {
    this._muted = Boolean(value);
    if (this.masterGain && this.context) {
      this.masterGain.gain.setTargetAtTime(this._muted ? 0 : 0.82, this.context.currentTime, 0.025);
    }
  }
  get mute() { return this.muted; }
  set mute(value) { this.muted = value; }

  _ensure() {
    if (this.context) return this.context;
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctx) return null;
    try {
      this.context = new Ctx();
      const ctx = this.context;
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this._muted ? 0 : 0.82;
      this.masterGain.connect(ctx.destination);
      this._engineFilter = ctx.createBiquadFilter();
      this._engineFilter.type = 'lowpass';
      this._engineFilter.frequency.value = 600;
      this._engineGain = ctx.createGain();
      this._engineGain.gain.value = 0;
      this._engineFilter.connect(this._engineGain);
      this._engineGain.connect(this.masterGain);
      for (const type of ['sawtooth', 'triangle']) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = 45;
        osc.connect(this._engineFilter);
        osc.start();
        this._engineOsc.push(osc);
      }
      return ctx;
    } catch {
      this.context = null;
      return null;
    }
  }

  resume() {
    const ctx = this._ensure();
    if (!ctx) return Promise.resolve(false);
    return ctx.resume().then(() => true).catch(() => false);
  }

  setEngine(level01, rpm01) {
    const ctx = this._ensure();
    if (!ctx) return;
    const level = Math.max(0, Math.min(1, level01));
    const rpm = Math.max(0, Math.min(1, rpm01));
    const now = ctx.currentTime;
    this._engineGain.gain.setTargetAtTime(level * 0.16, now, 0.08);
    this._engineFilter.frequency.setTargetAtTime(250 + rpm * 1150, now, 0.07);
    const base = 36 + rpm * 168;
    this._engineOsc[0].frequency.setTargetAtTime(base, now, 0.045);
    this._engineOsc[1].frequency.setTargetAtTime(base * 2.01, now, 0.045);
  }

  _noise(duration, cutoff, volume, connectTo = null) {
    const ctx = this._ensure();
    if (!ctx) return;
    const size = Math.max(1, Math.ceil(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(connectTo || this.masterGain);
    source.start();
    source.stop(ctx.currentTime + duration);
    return { source, gain, filter };
  }

  tone(frequency, duration, volume = 0.1, wave = 'sine', when = 0, destination = null) {
    const ctx = this._ensure();
    if (!ctx) return;
    const start = Math.max(ctx.currentTime, ctx.currentTime + when);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.018, duration * 0.18));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(0.04, duration));
    osc.connect(gain);
    gain.connect(destination || this.masterGain);
    osc.start(start);
    osc.stop(start + duration + 0.025);
    return osc;
  }

  skid(on) {
    const ctx = this._ensure();
    if (!ctx) return;
    if (!on) {
      if (this._skidGain) this._skidGain.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
      this._skidSource?.stop(ctx.currentTime + 0.25);
      this._skidSource = this._skidGain = null;
      return;
    }
    if (this._skidSource) return;
    const size = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1250;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
    gain.gain.setTargetAtTime(0.16, ctx.currentTime, 0.08);
    this._skidSource = source;
    this._skidGain = gain;
  }

  crash(strength = 1) {
    const amount = Math.max(0.2, Math.min(2, strength));
    this._noise(0.34, 480 + amount * 260, 0.35 * Math.min(1, amount));
    const ctx = this._ensure();
    if (ctx) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(105, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.29);
      gain.gain.setValueAtTime(0.28 * Math.min(1, amount), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.31);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(now + 0.33);
    }
  }

  siren(on) {
    const ctx = this._ensure();
    if (!ctx) return;
    if (!on) {
      if (this._sirenGain) this._sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.07);
      for (const osc of this._sirenOsc) {
        try { osc.stop(ctx.currentTime + 0.22); } catch { /* already stopped */ }
      }
      this._sirenOsc.length = 0;
      this._sirenGain = null;
      if (this._sirenTimer) clearInterval(this._sirenTimer);
      this._sirenTimer = null;
      return;
    }
    if (this._sirenOsc.length) return;
    this._sirenGain = ctx.createGain();
    this._sirenGain.gain.value = 0.075;
    this._sirenGain.connect(this.masterGain);
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = i ? 850 : 630;
      osc.connect(this._sirenGain);
      osc.start();
      this._sirenOsc.push(osc);
    }
    let high = false;
    this._sirenTimer = setInterval(() => {
      if (!this.context || !this._sirenOsc.length) return;
      high = !high;
      this._sirenOsc.forEach((osc, i) => {
        osc.frequency.setTargetAtTime(high ? (i ? 720 : 880) : (i ? 540 : 650),
          this.context.currentTime, 0.025);
      });
    }, 420);
  }

  shot() {
    this._noise(0.16, 1500, 0.3);
    this.tone(105, 0.13, 0.22, 'triangle');
  }
  hit() { this.tone(190, 0.11, 0.12, 'triangle'); }
  pickup() {
    this.tone(660, 0.11, 0.12, 'sine');
    this.tone(990, 0.16, 0.1, 'sine', 0.085);
  }
  ui() { this.tone(510, 0.07, 0.07, 'sine'); }
  busted() {
    this.tone(420, 0.22, 0.13, 'triangle');
    this.tone(300, 0.28, 0.12, 'triangle', 0.2);
    this.tone(180, 0.4, 0.11, 'triangle', 0.43);
  }
  success() {
    this.tone(523, 0.16, 0.12, 'sine');
    this.tone(659, 0.16, 0.12, 'sine', 0.14);
    this.tone(784, 0.28, 0.13, 'sine', 0.28);
  }
}
