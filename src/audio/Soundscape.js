/**
 * A fully synthesized soundscape (WebAudio, no samples): a slowly wandering
 * organ with a soft choir, long cathedral reverb inside, wind, birds and
 * crickets outside, water near fountains and falls, footsteps, bells, candles.
 */

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// MIDI note numbers: a slow progression in D with suspensions
const CHORDS = [
  { bass: 38, notes: [50, 57, 62, 66, 69], mel: [74, 76, 78] }, // D
  { bass: 35, notes: [47, 54, 59, 62, 66], mel: [74, 71] }, // Bm
  { bass: 43, notes: [50, 55, 59, 62, 67], mel: [71, 74, 79] }, // G
  { bass: 45, notes: [52, 57, 62, 64, 69], mel: [76, 74, 73] }, // Asus4 -> A
  { bass: 42, notes: [49, 54, 57, 61, 66], mel: [73, 69] }, // F#m
  { bass: 43, notes: [50, 54, 59, 62, 66], mel: [74, 78, 76] }, // Gmaj7
  { bass: 40, notes: [47, 50, 55, 59, 62], mel: [71, 74] }, // Em7
  { bass: 45, notes: [52, 55, 61, 64, 69], mel: [76, 73, 69] }, // A7
];

export class Soundscape {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.level = 0.85;
    this.chord = 0;
    this.nextChord = 0;
    this.nextBird = 0;
    this.sources = [];
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  start() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    this.ctx = ac;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.4;
    comp.connect(ac.destination);
    this.master = this.gain(0, comp);
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.level, ac.currentTime, 1.2);

    // Reverb send: a long cathedral tail inside, a short open-air one outside.
    this.revIn = this.gain(1);
    const revA = ac.createConvolver();
    revA.buffer = this.impulse(7.5, 0.82);
    const revB = ac.createConvolver();
    revB.buffer = this.impulse(1.4, 0.55);
    this.revAGain = this.gain(1, this.master);
    this.revBGain = this.gain(0, this.master);
    this.revIn.connect(revA).connect(this.revAGain);
    this.revIn.connect(revB).connect(this.revBGain);
    this.dry = this.gain(1, this.master);

    // Music bus, muffled by the walls when heard from outside.
    this.musicLP = ac.createBiquadFilter();
    this.musicLP.type = 'lowpass';
    this.musicLP.frequency.value = 16000;
    this.musicGain = this.gain(0.0);
    this.musicGain.connect(this.musicLP);
    this.musicLP.connect(this.dry);
    this.gain(0.9, this.revIn, this.musicLP);

    this.noise = this.noiseBuffer(4);
    // Wind: two bands of noise breathing slowly
    this.wind = this.gain(0, this.dry);
    for (const [f, q, rate] of [[380, 0.8, 0.07], [900, 1.4, 0.11]]) {
      const src = this.loop(this.noise);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const g = this.gain(0.5);
      const lfo = ac.createOscillator();
      lfo.frequency.value = rate;
      const lg = this.gain(f * 0.35);
      lfo.connect(lg).connect(bp.frequency);
      lfo.start();
      src.connect(bp).connect(g).connect(this.wind);
    }
    // Water: broadband hiss shaped like splashing, panned toward the nearest source
    this.water = this.gain(0);
    this.waterPan = ac.createStereoPanner();
    const ws = this.loop(this.noise, 0.73);
    const wb = ac.createBiquadFilter();
    wb.type = 'bandpass';
    wb.frequency.value = 1100;
    wb.Q.value = 0.5;
    const wh = ac.createBiquadFilter();
    wh.type = 'highshelf';
    wh.frequency.value = 3000;
    wh.gain.value = 4;
    ws.connect(wb).connect(wh).connect(this.water).connect(this.waterPan).connect(this.dry);
    this.gain(0.25, this.revIn, this.water);
    // Crickets for the night
    this.crickets = this.gain(0, this.dry);
    for (const [f, rate] of [[4400, 22], [4950, 17], [4100, 26]]) {
      const o = ac.createOscillator();
      o.frequency.value = f;
      // pulse gate (0..1) inside a slower phrase gate (0..1)
      const gate = this.gain(0.5);
      const lfo = ac.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = rate;
      lfo.connect(this.gain(0.5, gate.gain));
      const phrase = this.gain(0.5);
      const slow = ac.createOscillator();
      slow.frequency.value = 0.3 + Math.random() * 0.4;
      slow.connect(this.gain(0.5, phrase.gain));
      o.connect(gate).connect(phrase).connect(this.gain(0.012, this.crickets));
      o.start();
      lfo.start();
      slow.start();
    }
    this.nextChord = ac.currentTime + 0.3;
  }

  gain(v, to = null, from = null) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    if (to) g.connect(to);
    if (from) from.connect(g);
    return g;
  }

  loop(buffer, rate = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.playbackRate.value = rate;
    s.start(0, Math.random() * buffer.duration);
    return s;
  }

  noiseBuffer(seconds) {
    const ac = this.ctx;
    const b = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
    const d = b.getChannelData(0);
    // gently pinked noise
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099;
      b1 = 0.963 * b1 + w * 0.2965;
      b2 = 0.57 * b2 + w * 1.0526;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
    return b;
  }

  /** Stereo impulse response: early reflections plus a darkening exponential tail. */
  impulse(seconds, bright) {
    const ac = this.ctx;
    const n = Math.floor(ac.sampleRate * seconds);
    const b = ac.createBuffer(2, n, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let y = 0;
      for (let i = 0; i < n; i++) {
        const t = i / ac.sampleRate;
        const env = Math.exp((-6.9 * t) / seconds) * Math.min(1, t / 0.02);
        const a = bright * Math.exp(-t * 1.6) + 0.04;
        y += a * ((Math.random() * 2 - 1) - y);
        d[i] = y * env * 1.6;
      }
      for (let k = 0; k < 14; k++) {
        const i = Math.floor(ac.sampleRate * (0.012 + Math.random() * 0.09));
        d[i] += (Math.random() - 0.5) * 0.9 * (1 - k / 14);
      }
    }
    return b;
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.level, this.ctx.currentTime, 0.3);
  }

  // ---------------------------------------------------------------- music
  organNote(freq, t0, dur, level, ranks = [1, 0.4, 0.14, 0.1]) {
    const ac = this.ctx;
    const env = this.gain(0, this.musicGain);
    const atk = 0.35 + Math.random() * 0.25;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(level, t0 + atk);
    env.gain.setValueAtTime(level, t0 + dur);
    env.gain.linearRampToValueAtTime(0, t0 + dur + 2.2);
    const trem = ac.createOscillator();
    trem.frequency.value = 5.2;
    const tg = this.gain(level * 0.05, env.gain);
    trem.connect(tg);
    trem.start(t0);
    trem.stop(t0 + dur + 2.4);
    ranks.forEach((amp, k) => {
      if (amp <= 0) return;
      const o = ac.createOscillator();
      o.type = k === 0 ? 'triangle' : 'sine';
      o.frequency.value = freq * (k + 1);
      o.detune.value = (Math.random() - 0.5) * 6;
      const g = this.gain(amp * (k === 0 ? 0.6 : 1));
      o.connect(g).connect(env);
      o.start(t0);
      o.stop(t0 + dur + 2.4);
    });
  }

  choirNote(freq, t0, dur, level) {
    const ac = this.ctx;
    const env = this.gain(0, this.musicGain);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(level, t0 + 1.4);
    env.gain.setValueAtTime(level, t0 + dur);
    env.gain.linearRampToValueAtTime(0, t0 + dur + 2.5);
    const formants = [[750, 7, 1], [1150, 9, 0.6], [2700, 12, 0.18]];
    const sum = this.gain(1, env);
    const bank = formants.map(([f, q, a]) => {
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      bp.connect(this.gain(a, sum));
      return bp;
    });
    const vib = ac.createOscillator();
    vib.frequency.value = 4.8 + Math.random() * 0.6;
    const vg = this.gain(freq * 0.006);
    vib.connect(vg);
    vib.start(t0);
    vib.stop(t0 + dur + 2.7);
    for (const det of [-7, 0, 6]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      vg.connect(o.frequency);
      for (const bp of bank) o.connect(bp);
      o.start(t0);
      o.stop(t0 + dur + 2.7);
    }
  }

  scheduleMusic() {
    const ac = this.ctx;
    while (this.nextChord < ac.currentTime + 1.0) {
      const c = CHORDS[this.chord % CHORDS.length];
      const t0 = this.nextChord;
      const dur = 7.2;
      this.organNote(NOTE(c.bass - 12), t0, dur, 0.1, [1, 0.5, 0, 0.12]);
      this.organNote(NOTE(c.bass), t0, dur, 0.07);
      c.notes.forEach((n, i) => this.organNote(NOTE(n), t0 + i * 0.05, dur, 0.045 - i * 0.004));
      for (const n of c.notes.slice(-3)) this.choirNote(NOTE(n + 12), t0 + 0.2, dur, 0.018);
      // a slow flute line over every other chord
      if (this.chord % 2 === 0) {
        const step = dur / c.mel.length;
        c.mel.forEach((n, i) => this.organNote(NOTE(n), t0 + 0.6 + i * step, step * 0.8, 0.03, [1, 0.08, 0, 0]));
      }
      this.nextChord += dur + 0.4;
      this.chord++;
    }
  }

  // ---------------------------------------------------------------- one-shots
  burst({ dur = 0.1, type = 'bandpass', f = 1800, q = 1, level = 0.1, send = 0.5, rate = 1, pan = 0, when = 0 }) {
    const ac = this.ctx;
    const t0 = ac.currentTime + when;
    const s = ac.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = rate;
    const bf = ac.createBiquadFilter();
    bf.type = type;
    bf.frequency.value = f;
    bf.Q.value = q;
    const g = this.gain(0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(level, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const p = ac.createStereoPanner();
    p.pan.value = pan;
    s.connect(bf).connect(g).connect(p);
    p.connect(this.dry);
    p.connect(this.gain(send, this.revIn));
    s.start(t0, Math.random() * 3);
    s.stop(t0 + dur + 0.05);
  }

  step(surface, speed, inside) {
    if (!this.running) return;
    const k = Math.min(1.3, 0.55 + speed / 7);
    if (surface === 'grass') {
      this.burst({ dur: 0.16, type: 'highpass', f: 1800, q: 0.4, level: 0.05 * k, send: 0.05, rate: 0.7 });
      return;
    }
    const pan = (Math.random() - 0.5) * 0.2;
    this.burst({ dur: 0.05, f: 2400 + Math.random() * 600, q: 1.4, level: 0.16 * k, send: 0.3 + inside * 0.5, pan });
    this.burst({ dur: 0.11, type: 'lowpass', f: 700, q: 0.7, level: 0.1 * k, send: 0.3 + inside * 0.4, pan, when: 0.012 });
  }

  bell(distance, pan = 0) {
    if (!this.running) return;
    const ac = this.ctx;
    const t0 = ac.currentTime + 0.02;
    const vol = 0.5 / (1 + distance / 14);
    const out = this.gain(1);
    const p = ac.createStereoPanner();
    p.pan.value = pan;
    out.connect(p);
    p.connect(this.dry);
    p.connect(this.gain(0.7, this.revIn));
    const f0 = 196;
    const partials = [[0.5, 0.45, 11], [1, 0.6, 8], [1.19, 0.4, 6], [1.5, 0.26, 4], [2, 0.55, 5], [2.52, 0.2, 3], [2.66, 0.22, 3], [3.01, 0.16, 2.4], [4.07, 0.11, 1.8], [5.33, 0.07, 1.2]];
    for (const [ratio, amp, decay] of partials) {
      const o = ac.createOscillator();
      o.frequency.value = f0 * ratio;
      o.detune.value = (Math.random() - 0.5) * 4;
      const g = this.gain(0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(amp * vol, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(t0 + decay + 0.1);
    }
    this.burst({ dur: 0.05, f: 3200, q: 2, level: 0.3 * vol, send: 0.5, pan });
  }

  candle() {
    if (!this.running) return;
    const ac = this.ctx;
    this.burst({ dur: 0.35, f: 600, q: 0.8, level: 0.05, send: 0.4 });
    const t0 = ac.currentTime + 0.12;
    for (const [f, d] of [[1318.5, 1.6], [1975.5, 1.2], [2637, 0.9]]) {
      const o = ac.createOscillator();
      o.frequency.value = f;
      const g = this.gain(0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.018, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g);
      g.connect(this.dry);
      g.connect(this.gain(0.8, this.revIn));
      o.start(t0);
      o.stop(t0 + d + 0.1);
    }
  }

  bird(pan) {
    const ac = this.ctx;
    let t = ac.currentTime + 0.05;
    const base = 2600 + Math.random() * 1800;
    const n = 2 + Math.floor(Math.random() * 5);
    const p = ac.createStereoPanner();
    p.pan.value = pan;
    p.connect(this.dry);
    p.connect(this.gain(0.3, this.revIn));
    for (let i = 0; i < n; i++) {
      const o = ac.createOscillator();
      const d = 0.05 + Math.random() * 0.09;
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.2), t);
      o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.4), t + d);
      const g = this.gain(0);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.022, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(p);
      o.start(t);
      o.stop(t + d + 0.02);
      t += d + 0.03 + Math.random() * 0.08;
    }
  }

  // ---------------------------------------------------------------- per frame
  /**
   * inside: 0..1, night: 0..1, pos/fwd: listener, waters: [{x, z, r, amp}].
   */
  update(dt, { inside, night, pos, yaw, waters, altitude }) {
    if (!this.ctx) return;
    const ac = this.ctx;
    const now = ac.currentTime;
    this.scheduleMusic();
    const set = (param, v, tc = 0.4) => param.setTargetAtTime(v, now, tc);
    const out = 1 - inside;
    set(this.musicGain.gain, (0.12 + inside * 0.88) * (1 - night * 0.3));
    set(this.musicLP.frequency, 650 + Math.pow(inside, 2) * 15000);
    set(this.revAGain.gain, 0.15 + inside * 0.85);
    set(this.revBGain.gain, out * 0.3);
    set(this.wind.gain, out * (0.1 + Math.min(0.3, Math.max(0, altitude - 20) * 0.012)) + inside * 0.006, 1.2);
    set(this.crickets.gain, out * night * 1.0, 1.5);
    // water: sum of nearby sources, panned toward the loudest
    let total = 0, best = 0, bestPan = 0;
    for (const w of waters) {
      const d = Math.hypot(w.x - pos.x, w.z - pos.z);
      const a = w.amp / (1 + (d / w.r) * (d / w.r));
      total += a;
      if (a > best) {
        best = a;
        const ang = Math.atan2(-(w.x - pos.x), -(w.z - pos.z)) - yaw;
        bestPan = -Math.sin(ang);
      }
    }
    set(this.water.gain, Math.min(0.5, total) * (1 - inside * 0.9), 0.5);
    set(this.waterPan.pan, bestPan * 0.7, 0.3);
    // dusk birdsong outside
    if (out > 0.5 && night < 0.5 && now > this.nextBird) {
      this.bird((Math.random() - 0.5) * 1.6);
      this.nextBird = now + 1.5 + Math.random() * 6;
    }
  }
}
