"use client";

/**
 * VYRON City audio engine.
 * Every sound here is synthesized at runtime with the Web Audio API — original
 * waveforms and noise, no sampled or copyrighted material.
 */

type Levels = { music: number; sfx: number; ambience: number };

export class VyronAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private musicTimer: number | null = null;
  private ambienceTimer: number | null = null;
  private levels: Levels = { music: 0.5, sfx: 0.8, ambience: 0.45 };
  private stepFlip = false;
  private enabled = false;

  init() {
    if (this.ctx || typeof window === "undefined") return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.ambientGain = this.ctx.createGain();
    this.musicGain.gain.value = this.levels.music;
    this.sfxGain.gain.value = this.levels.sfx * 0.6;
    this.ambientGain.gain.value = 0;
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.ambientGain.connect(this.master);
    this.enabled = true;
  }

  resume() {
    this.init();
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  setLevels(levels: Partial<Levels>) {
    this.levels = { ...this.levels, ...levels };
    if (this.ctx) {
      const now = this.ctx.currentTime;
      this.musicGain?.gain.setTargetAtTime(this.levels.music * 0.45, now, 0.2);
      this.sfxGain?.gain.setTargetAtTime(this.levels.sfx * 0.7, now, 0.1);
      this.ambientGain?.gain.setTargetAtTime(this.levels.ambience * 0.35, now, 0.4);
    }
  }

  private noiseBuffer(seconds = 2, brown = false) {
    if (!this.ctx) return null;
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      } else {
        data[i] = white * 0.5;
      }
    }
    return buffer;
  }

  /** Short synth voice used for every one-shot SFX. */
  private tone(opts: { freq: number; to?: number; dur: number; type?: OscillatorType; gain?: number; delay?: number; filter?: number }) {
    if (!this.enabled || !this.ctx || !this.sfxGain) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.to), t0 + opts.dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain ?? 0.32), t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    let node: AudioNode = gain;
    if (opts.filter) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = opts.filter;
      gain.connect(filter);
      node = filter;
    }
    osc.connect(gain);
    node.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.05);
  }

  private noiseBurst(dur = 0.12, gainValue = 0.25, highpass = 600) {
    if (!this.enabled || !this.ctx || !this.sfxGain) return;
    const buffer = this.noiseBuffer(0.4);
    if (!buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = highpass;
    const gain = this.ctx.createGain();
    const t0 = this.ctx.currentTime;
    gain.gain.setValueAtTime(gainValue, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  ui(kind: "tap" | "confirm" | "cancel" | "error" = "tap") {
    if (kind === "tap") this.tone({ freq: 520, to: 640, dur: 0.07, type: "triangle", gain: 0.18 });
    if (kind === "confirm") {
      this.tone({ freq: 660, to: 880, dur: 0.1, type: "triangle", gain: 0.2 });
      this.tone({ freq: 990, to: 1320, dur: 0.14, type: "sine", gain: 0.15, delay: 0.07 });
    }
    if (kind === "cancel") this.tone({ freq: 420, to: 220, dur: 0.14, type: "triangle", gain: 0.2 });
    if (kind === "error") this.tone({ freq: 190, to: 130, dur: 0.24, type: "sawtooth", gain: 0.16 });
  }

  pickup(chain = 0) {
    const base = 700 + Math.min(9, chain) * 90;
    this.tone({ freq: base, to: base * 1.6, dur: 0.11, type: "triangle", gain: 0.22 });
    this.tone({ freq: base * 2, to: base * 2.4, dur: 0.09, type: "sine", gain: 0.1, delay: 0.03 });
  }

  gem() {
    this.tone({ freq: 880, to: 1760, dur: 0.22, type: "triangle", gain: 0.22 });
    this.tone({ freq: 1320, to: 2200, dur: 0.3, type: "sine", gain: 0.14, delay: 0.06 });
  }

  jump() {
    this.tone({ freq: 320, to: 560, dur: 0.14, type: "square", gain: 0.1, filter: 1400 });
  }

  land() {
    this.noiseBurst(0.1, 0.16, 300);
  }

  footstep(running = false) {
    this.stepFlip = !this.stepFlip;
    this.tone({ freq: this.stepFlip ? 150 : 128, to: 90, dur: running ? 0.07 : 0.09, type: "triangle", gain: running ? 0.11 : 0.07, filter: 800 });
  }

  crash(intensity: number) {
    const i = Math.max(0.15, Math.min(1, intensity));
    this.noiseBurst(0.28 * i + 0.1, 0.3 * i, 180);
    this.tone({ freq: 120 * (1 + i), to: 60, dur: 0.3, type: "sawtooth", gain: 0.2 * i, filter: 500 });
  }

  nearMiss() {
    this.noiseBurst(0.22, 0.14, 2600);
    this.tone({ freq: 1400, to: 420, dur: 0.26, type: "sine", gain: 0.1, filter: 3000 });
  }

  splash() {
    this.noiseBurst(0.4, 0.24, 900);
    this.tone({ freq: 240, to: 120, dur: 0.3, type: "sine", gain: 0.14 });
  }

  notification() {
    this.tone({ freq: 1046, to: 1568, dur: 0.14, type: "sine", gain: 0.16 });
    this.tone({ freq: 1318, to: 1976, dur: 0.22, type: "sine", gain: 0.12, delay: 0.12 });
  }

  missionStart() {
    [440, 554, 659, 880].forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: "triangle", gain: 0.16, delay: i * 0.08 }));
  }

  missionComplete() {
    [659, 784, 988, 1318, 1568].forEach((f, i) => this.tone({ freq: f, to: f * 1.02, dur: 0.26, type: "triangle", gain: 0.18, delay: i * 0.1 }));
  }

  fail() {
    [300, 240, 180].forEach((f, i) => this.tone({ freq: f, to: f * 0.7, dur: 0.3, type: "sawtooth", gain: 0.14, delay: i * 0.14 }));
  }

  levelUp() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone({ freq: f, dur: 0.4, type: "sine", gain: 0.16, delay: i * 0.11 }));
  }

  startEngine() {
    if (!this.enabled || !this.ctx || !this.sfxGain) return;
    if (this.engineOsc) return;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 620;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0001;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineOsc.frequency.value = 60;
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = "square";
    this.engineOsc2.frequency.value = 90;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);
    this.engineOsc.start();
    this.engineOsc2.start();
  }

  updateEngine(rpm01: number, active: boolean) {
    if (!this.ctx || !this.engineGain || !this.engineOsc || !this.engineOsc2 || !this.engineFilter) return;
    const now = this.ctx.currentTime;
    const target = active ? 0.05 + rpm01 * 0.09 : 0.0001;
    this.engineGain.gain.setTargetAtTime(target, now, 0.12);
    this.engineOsc.frequency.setTargetAtTime(55 + rpm01 * 165, now, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(82 + rpm01 * 240, now, 0.1);
    this.engineFilter.frequency.setTargetAtTime(420 + rpm01 * 1500, now, 0.15);
  }

  stopEngine() {
    this.updateEngine(0, false);
    const osc = this.engineOsc;
    const osc2 = this.engineOsc2;
    setTimeout(() => {
      try {
        osc?.stop();
        osc2?.stop();
      } catch {
        /* already stopped */
      }
    }, 400);
    this.engineOsc = null;
    this.engineOsc2 = null;
  }

  startAmbience() {
    if (!this.ctx || !this.ambientGain || this.noiseSource) return;
    const buffer = this.noiseBuffer(4, true);
    if (!buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
    src.start();
    this.noiseSource = src;
    this.ambientGain.gain.setTargetAtTime(this.levels.ambience * 0.35, this.ctx.currentTime, 1);

    // Occasional distant city life: soft two-tone chime, wind gusts.
    this.ambienceTimer = window.setInterval(() => {
      if (!this.ctx) return;
      const roll = Math.random();
      if (roll < 0.4) {
        this.tone({ freq: 392, to: 494, dur: 1.6, type: "sine", gain: 0.03, filter: 900 });
      } else if (roll < 0.7) {
        this.noiseBurst(1.4, 0.02, 500);
      }
    }, 9000);
  }

  setRain(on: boolean) {
    if (!this.ctx || !this.ambientGain) return;
    if (on && !this.rainSource) {
      const buffer = this.noiseBuffer(3);
      if (!buffer) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 1200;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.18;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ambientGain);
      src.start();
      this.rainSource = src;
    } else if (!on && this.rainSource) {
      try {
        this.rainSource.stop();
      } catch {
        /* noop */
      }
      this.rainSource = null;
    }
  }

  /** Original ambient score: slow pentatonic pads with a gentle arpeggio. */
  startMusic() {
    if (!this.ctx || !this.musicGain || this.musicTimer) return;
    const progression = [
      [220, 277.18, 329.63],
      [196, 246.94, 293.66],
      [174.61, 220, 261.63],
      [164.81, 207.65, 246.94],
    ];
    let bar = 0;
    const playBar = () => {
      if (!this.ctx || !this.musicGain) return;
      const t0 = this.ctx.currentTime;
      const chord = progression[bar % progression.length];
      chord.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const filter = this.ctx!.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 1400;
        osc.type = idx === 0 ? "sine" : "triangle";
        osc.frequency.value = freq * (idx === 0 ? 0.5 : 1);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(0.09, t0 + 1.4);
        gain.gain.linearRampToValueAtTime(0.0001, t0 + 6.4);
        osc.connect(gain);
        gain.connect(filter);
        filter.connect(this.musicGain!);
        osc.start(t0);
        osc.stop(t0 + 6.6);
      });
      const scale = [523.25, 587.33, 659.25, 783.99, 880];
      for (let i = 0; i < 3; i++) {
        const freq = scale[(bar * 2 + i * 2) % scale.length];
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const at = t0 + 1 + i * 1.5;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.linearRampToValueAtTime(0.045, at + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(at);
        osc.stop(at + 1.2);
      }
      bar++;
    };
    playBar();
    this.musicTimer = window.setInterval(playBar, 6000);
  }

  stopMusic() {
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  dispose() {
    this.stopMusic();
    if (this.ambienceTimer) window.clearInterval(this.ambienceTimer);
    this.ambienceTimer = null;
    this.setRain(false);
    this.stopEngine();
    try {
      this.noiseSource?.stop();
    } catch {
      /* noop */
    }
    this.noiseSource = null;
    void this.ctx?.close();
    this.ctx = null;
    this.enabled = false;
  }
}

let shared: VyronAudio | null = null;
export function getAudio() {
  if (typeof window === "undefined") return null;
  if (!shared) shared = new VyronAudio();
  return shared;
}
