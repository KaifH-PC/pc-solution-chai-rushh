/**
 * 100% Procedural Offline Web Audio Engine for "PC Solution The Chai Rush!"
 * Layers:
 *  1. Upbeat Indian street-chase background music (dhol/tabla percussion + raga melody)
 *  2. Busy Indian road ambience (continuous traffic rumble, auto-rickshaw putter,
 *     multi-tone car/scooter/bus horns, cycle bells, bazaar murmur)
 *  3. Dynamic Needy-Customer proximity mix (swells vocal-formant needy clamoring & footsteps
 *     louder while smoothly ducking background road horns as customers close in!)
 *  4. Tech-Market Obstacle Comedy SFX & Formant Voice Chatter (electric UPS/CAT6 zap,
 *     stray dog bark, scooter double-horn, single chai drip "plip!", stomach rumble, cup clink!)
 */

import { GamePhase } from './types';

export interface AmbientMixState {
  phase: GamePhase;
  speedRatio: number; // 0..1
  customerProximity: number; // 0 (far) .. 1 (right behind runner!)
  customersPacified?: boolean;
}

export class GameAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private trafficGain: GainNode | null = null;
  private customerGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private roadRumbleSource: AudioBufferSourceNode | null = null;
  private rickshawOsc: OscillatorNode | null = null;
  private rickshawLfo: OscillatorNode | null = null;

  private muted = false;
  private started = false;
  private mixState: AmbientMixState = {
    phase: 'title',
    speedRatio: 0.2,
    customerProximity: 0.15,
    customersPacified: false,
  };

  private musicTimer = 0;
  private musicStep = 0;
  private hornCooldown = 1.2;
  private customerChatterCooldown = 0.7;

  constructor(muted = false) {
    this.muted = muted;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.78;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.24;
      this.musicGain.connect(this.masterGain);

      this.trafficGain = this.ctx.createGain();
      this.trafficGain.gain.value = 0.22;
      this.trafficGain.connect(this.masterGain);

      this.customerGain = this.ctx.createGain();
      this.customerGain.gain.value = 0.08;
      this.customerGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.75;
      this.sfxGain.connect(this.masterGain);

      this.buildNoiseBuffer();
      this.startContinuousRoadBed();
      this.started = true;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.78, this.ctx.currentTime, 0.04);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public dispose(): void {
    try {
      this.roadRumbleSource?.stop();
      this.rickshawOsc?.stop();
      this.rickshawLfo?.stop();
    } catch {
      // ignore
    }
    this.roadRumbleSource = null;
    this.rickshawOsc = null;
    this.rickshawLfo = null;
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.started = false;
  }

  private buildNoiseBuffer(): void {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.04 * white) / 1.04;
      data[i] = last * 3.2;
    }
    this.noiseBuffer = buf;
  }

  private startContinuousRoadBed(): void {
    if (!this.ctx || !this.trafficGain || !this.noiseBuffer) return;

    const rumble = this.ctx.createBufferSource();
    rumble.buffer = this.noiseBuffer;
    rumble.loop = true;

    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 185;
    band.Q.value = 0.75;

    const rumbleGain = this.ctx.createGain();
    rumbleGain.gain.value = 0.52;

    rumble.connect(band);
    band.connect(rumbleGain);
    rumbleGain.connect(this.trafficGain);
    rumble.start();
    this.roadRumbleSource = rumble;

    const rick = this.ctx.createOscillator();
    rick.type = 'sawtooth';
    rick.frequency.value = 64;

    const rickFilter = this.ctx.createBiquadFilter();
    rickFilter.type = 'lowpass';
    rickFilter.frequency.value = 210;

    const rickGain = this.ctx.createGain();
    rickGain.gain.value = 0.06;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 14.5;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain);
    lfoGain.connect(rickGain.gain);

    rick.connect(rickFilter);
    rickFilter.connect(rickGain);
    rickGain.connect(this.trafficGain);
    rick.start();
    lfo.start();
    this.rickshawOsc = rick;
    this.rickshawLfo = lfo;
  }

  public tick(dt: number, state: AmbientMixState): void {
    this.mixState = state;
    if (!this.started || !this.ctx || this.ctx.state !== 'running' || this.muted) return;

    const now = this.ctx.currentTime;
    const isActiveRun = state.phase === 'playing' || state.phase === 'intro';
    const isTeaShop = state.phase === 'teashop';
    const isPaused = state.phase === 'paused';
    const pacified = Boolean(state.customersPacified);
    const prox = pacified ? 0.14 : Math.max(0, Math.min(1, state.customerProximity));

    let targetTraffic = 0.16;
    let targetMusic = 0.14;
    let targetCustomer = 0.04;

    if (isPaused) {
      targetTraffic = 0.04;
      targetMusic = 0.06;
      targetCustomer = 0.0;
    } else if (isActiveRun) {
      targetTraffic = 0.42 * (1 - prox * 0.72);
      targetMusic = 0.28 * (1 - prox * 0.26);
      targetCustomer = pacified ? 0.14 : 0.12 + prox * 0.82;
    } else if (isTeaShop) {
      targetTraffic = 0.24;
      targetMusic = 0.14;
      targetCustomer = 0.44;
    } else if (state.phase === 'title') {
      targetTraffic = 0.22;
      targetMusic = 0.16;
      targetCustomer = 0.03;
    } else {
      targetTraffic = 0.12;
      targetMusic = 0.09;
      targetCustomer = state.phase === 'caught' ? 0.32 : 0.06;
    }

    this.trafficGain?.gain.setTargetAtTime(targetTraffic, now, 0.12);
    this.musicGain?.gain.setTargetAtTime(targetMusic, now, 0.15);
    this.customerGain?.gain.setTargetAtTime(targetCustomer, now, 0.09);

    if (this.rickshawOsc) {
      const targetFreq = isActiveRun ? 62 + state.speedRatio * 34 : 54;
      this.rickshawOsc.frequency.setTargetAtTime(targetFreq, now, 0.15);
    }

    // 1. Upbeat Indian street-chase music sequencer
    if (!isPaused && state.phase !== 'caught') {
      const stepDur = isActiveRun ? 0.145 - state.speedRatio * 0.025 : 0.185;
      this.musicTimer += dt;
      if (this.musicTimer >= stepDur) {
        this.musicTimer -= stepDur;
        this.playMusicStep(this.musicStep, isActiveRun);
        this.musicStep = (this.musicStep + 1) % 16;
      }
    }

    // 2. Busy Indian road horns & bells chorus
    if (!isPaused && (isActiveRun || state.phase === 'title' || isTeaShop)) {
      this.hornCooldown -= dt;
      if (this.hornCooldown <= 0) {
        this.playIndianRoadHorn();
        const busyFactor = isActiveRun ? 1.0 : 1.8;
        this.hornCooldown = (0.75 + Math.random() * 1.45) * busyFactor;
      }
    }

    // 3. Needy Customer clamoring
    if (!isPaused && (isActiveRun || isTeaShop)) {
      this.customerChatterCooldown -= dt;
      if (this.customerChatterCooldown <= 0) {
        if (isTeaShop) {
          this.playNeedyCustomerBurst(0.55, true);
          this.customerChatterCooldown = 1.2 + Math.random() * 0.7;
        } else if (!pacified && prox > 0.18) {
          this.playNeedyCustomerBurst(prox, false);
          this.customerChatterCooldown = Math.max(0.26, 1.35 - prox * 0.98) + Math.random() * 0.25;
        } else {
          this.customerChatterCooldown = 0.85;
        }
      }
    }
  }

  private playMusicStep(step: number, energetic: boolean): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;

    const boomSteps = [0, 3, 6, 8, 11, 14];
    if (boomSteps.includes(step)) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const accent = step === 0 || step === 8;
      osc.frequency.setValueAtTime(accent ? 148 : 126, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.11);
      gain.gain.setValueAtTime(accent ? 0.34 : 0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.13);
    }

    if (step % 2 === 1 || step === 4 || step === 12) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(step === 4 || step === 12 ? 430 : 340, now);
      osc.frequency.exponentialRampToValueAtTime(190, now + 0.055);
      gain.gain.setValueAtTime(energetic ? 0.15 : 0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.065);
    }

    const melody: (number | null)[] = [
      587.3, null, 659.3, 740.0,
      880.0, null, 740.0, 659.3,
      587.3, 659.3, 880.0, null,
      987.8, 880.0, 740.0, 659.3,
    ];
    const freq = melody[step];
    if (freq && (energetic || step % 4 === 0)) {
      const lead = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      lead.type = 'sawtooth';
      lead.frequency.setValueAtTime(freq, now);
      if (step === 4 || step === 12) {
        lead.frequency.exponentialRampToValueAtTime(freq * 1.015, now + 0.04);
        lead.frequency.exponentialRampToValueAtTime(freq, now + 0.12);
      }
      filter.type = 'bandpass';
      filter.frequency.value = 1650;
      filter.Q.value = 1.4;

      gain.gain.setValueAtTime(energetic ? 0.12 : 0.065, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      lead.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      lead.start(now);
      lead.stop(now + 0.15);
    }
  }

  public playIndianRoadHorn(): void {
    if (!this.ctx || !this.trafficGain || this.muted) return;
    const now = this.ctx.currentTime;
    const roll = Math.random();

    if (roll < 0.36) {
      const count = Math.random() < 0.6 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const t = now + i * 0.19;
        for (const f of [415, 520]) {
          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f + (Math.random() - 0.5) * 14, t);
          filter.type = 'bandpass';
          filter.frequency.value = 950;
          filter.Q.value = 1.8;
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.11, t + 0.015);
          gain.gain.setValueAtTime(0.095, t + 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.trafficGain);
          osc.start(t);
          osc.stop(t + 0.16);
        }
      }
    } else if (roll < 0.68) {
      for (let i = 0; i < 2; i++) {
        const t = now + i * 0.125;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(740 + Math.random() * 90, t);
        filter.type = 'bandpass';
        filter.frequency.value = 1500;
        filter.Q.value = 2.5;
        gain.gain.setValueAtTime(0.09, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.trafficGain);
        osc.start(t);
        osc.stop(t + 0.105);
      }
    } else if (roll < 0.85) {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(196, now);
      osc2.frequency.setValueAtTime(246, now);
      filter.type = 'lowpass';
      filter.frequency.value = 650;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.13, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.trafficGain);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.44);
      osc2.stop(now + 0.44);
    } else {
      for (let i = 0; i < 2; i++) {
        const t = now + i * 0.11;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2420, t);
        gain.gain.setValueAtTime(0.09, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain);
        gain.connect(this.trafficGain);
        osc.start(t);
        osc.stop(t + 0.19);
      }
    }
  }

  public playNeedyCustomerBurst(proximity: number, confused = false): void {
    if (!this.ctx || !this.customerGain || this.muted) return;
    const now = this.ctx.currentTime;
    const syllables = confused ? 2 : 2 + Math.floor(Math.random() * 2);
    const baseVoice = 205 + Math.random() * 95 + proximity * 45;

    for (let i = 0; i < syllables; i++) {
      const t = now + i * (confused ? 0.19 : 0.12);
      const osc = this.ctx.createOscillator();
      const formant1 = this.ctx.createBiquadFilter();
      const formant2 = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      const pitchStart = confused ? baseVoice * (i === 0 ? 0.95 : 1.18) : baseVoice * (1 + i * 0.1);
      const pitchEnd = confused ? pitchStart * 1.24 : pitchStart * (0.85 + Math.random() * 0.32);
      osc.frequency.setValueAtTime(pitchStart, t);
      osc.frequency.exponentialRampToValueAtTime(pitchEnd, t + 0.1);

      formant1.type = 'bandpass';
      formant1.frequency.setValueAtTime(confused ? 680 : 820 + Math.random() * 240, t);
      formant1.Q.value = 3.8;

      formant2.type = 'peaking';
      formant2.frequency.value = 1850;
      formant2.gain.value = 8;

      const vol = (0.2 + proximity * 0.34) * (i === 0 ? 1 : 0.85);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.115);

      osc.connect(formant1);
      formant1.connect(formant2);
      formant2.connect(gain);
      gain.connect(this.customerGain);

      osc.start(t);
      osc.stop(t + 0.13);
    }

    if (!confused && proximity > 0.35) {
      for (let f = 0; f < 2; f++) {
        const t = now + f * 0.11;
        const thud = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        thud.type = 'triangle';
        thud.frequency.setValueAtTime(115, t);
        thud.frequency.exponentialRampToValueAtTime(48, t + 0.06);
        g.gain.setValueAtTime(0.16 * proximity, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
        thud.connect(g);
        g.connect(this.customerGain);
        thud.start(t);
        thud.stop(t + 0.07);
      }
    }
  }

  /**
   * Procedural voice-like formant chatter burst synced to Hinglish street callouts!
   * Respects Mute and proximity ducking (ducks slightly if Needy Customers are right behind).
   */
  public playVoiceChatter(basePitch = 230, syllables = 3): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const duck = 1 - Math.min(0.45, this.mixState.customerProximity * 0.42);

    for (let i = 0; i < syllables; i++) {
      const t = now + i * 0.095;
      const osc = this.ctx.createOscillator();
      const f1 = this.ctx.createBiquadFilter();
      const f2 = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      const p0 = basePitch * (0.94 + (i % 3) * 0.09);
      const p1 = p0 * (i === syllables - 1 ? 1.18 : 0.9);
      osc.frequency.setValueAtTime(p0, t);
      osc.frequency.exponentialRampToValueAtTime(p1, t + 0.08);

      f1.type = 'bandpass';
      f1.frequency.setValueAtTime(720 + (i % 2) * 320, t);
      f1.Q.value = 3.5;

      f2.type = 'peaking';
      f2.frequency.value = 1950;
      f2.gain.value = 7;

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.22 * duck, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      osc.connect(f1);
      f1.connect(f2);
      f2.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.1);
    }
  }

  /** Electric zap crackle for CAT6 cable bundles & smoking SMPS/UPS hazards */
  public playElectricZap(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.055;
      this.playTone(1250 + i * 240, 260, 0.05, 'sawtooth', 0.18, i * 0.055);
      this.playTone(120, 620, 0.045, 'square', 0.12, i * 0.055 + 0.015);
      void t;
    }
  }

  /** Startled stray street dog bark! */
  public playStrayDogBark(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.14;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(420 + i * 50, t);
      osc.frequency.exponentialRampToValueAtTime(195, t + 0.1);
      filter.type = 'bandpass';
      filter.frequency.value = 920;
      filter.Q.value = 2.4;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.26, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.12);
    }
  }

  /** Sharp double-horn "Peep-peep!" for oncoming auto-rickshaw / CPU delivery scooter */
  public playScooterDoubleHorn(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const duck = 1 - Math.min(0.5, this.mixState.customerProximity * 0.45);
    this.playTone(820, 815, 0.09, 'square', 0.17 * duck, 0);
    this.playTone(845, 840, 0.095, 'square', 0.18 * duck, 0.13);
  }

  /** Bright celebratory chime when player hits 15 Coins ("CHAI MONEY READY!") */
  public playChaiMoneyReady(): void {
    this.playTone(659.25, 660, 0.11, 'triangle', 0.22, 0);
    this.playTone(880, 882, 0.12, 'triangle', 0.22, 0.09);
    this.playTone(1318.5, 1322, 0.26, 'sine', 0.24, 0.18);
  }

  /** Crisp single resonant "plip!" drop sound for Boss's upside-down empty cup deadpan stare */
  public playSingleDrip(): void {
    this.playTone(540, 1420, 0.11, 'sine', 0.28, 0.35);
    this.playTone(1420, 880, 0.06, 'sine', 0.16, 0.45);
  }

  /** Comedic low gurgling stomach-rumble SFX for Boss-Only Sacrifice sad hungry runner */
  public playStomachRumble(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime + 0.35;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(92, now);
    osc.frequency.linearRampToValueAtTime(68, now + 0.35);
    osc.frequency.linearRampToValueAtTime(104, now + 0.62);
    osc.frequency.linearRampToValueAtTime(58, now + 0.95);

    lfo.frequency.value = 18;
    lfoGain.gain.value = 16;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    filter.type = 'lowpass';
    filter.frequency.value = 260;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.26, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.98);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + 1.0);
    lfo.stop(now + 1.0);
  }

  /** Warm ceramic clink for Double Chai Win & VIP Tea Party! */
  public playCupClink(): void {
    this.playTone(2180, 2320, 0.11, 'sine', 0.22, 0.12);
    this.playTone(2950, 2860, 0.14, 'triangle', 0.16, 0.14);
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'triangle',
    volume = 0.2,
    delay = 0
  ): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playLaneSwitch(): void {
    this.playTone(300, 510, 0.085, 'sine', 0.14);
  }

  public playJump(): void {
    this.playTone(230, 610, 0.16, 'triangle', 0.22);
  }

  public playSlide(): void {
    this.playTone(360, 120, 0.17, 'sawtooth', 0.13);
  }

  public playFastDrop(): void {
    this.playTone(480, 95, 0.14, 'triangle', 0.22);
  }

  public playCoin(combo = 0): void {
    const pitch = Math.min(1.55, 1 + combo * 0.04);
    this.playTone(900 * pitch, 1340 * pitch, 0.09, 'sine', 0.18);
    this.playTone(1340 * pitch, 1660 * pitch, 0.1, 'triangle', 0.13, 0.045);
  }

  public playTeaCup(): void {
    this.playTone(1680, 2120, 0.08, 'sine', 0.16, 0);
    this.playTone(460, 740, 0.14, 'triangle', 0.2, 0.04);
    this.playTone(690, 1080, 0.18, 'triangle', 0.2, 0.11);
    this.playTone(920, 1460, 0.24, 'sine', 0.22, 0.19);
  }

  public playNearMiss(): void {
    this.playTone(620, 940, 0.1, 'sine', 0.12);
  }

  public playAbility(): void {
    this.playTone(320, 880, 0.24, 'sawtooth', 0.16);
    this.playTone(640, 1280, 0.24, 'triangle', 0.18, 0.08);
  }

  public playShieldSmash(): void {
    this.playTone(220, 78, 0.22, 'sawtooth', 0.24);
    this.playTone(540, 260, 0.16, 'triangle', 0.18, 0.04);
  }

  public playTeaSpillHit(): void {
    this.playTone(340, 125, 0.19, 'sawtooth', 0.25);
    this.playTone(1200, 420, 0.14, 'sine', 0.16, 0.04);
    this.playNeedyCustomerBurst(0.95, false);
  }

  public playFunnyUTurn(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.playTone(980, 180, 0.18, 'sawtooth', 0.28, 0);
    this.playTone(180, 620, 0.14, 'sawtooth', 0.24, 0.15);
    this.playTone(1420, 1680, 0.28, 'sawtooth', 0.16, 0.22);
    this.playTone(1490, 1220, 0.26, 'square', 0.11, 0.34);
    this.playTone(360, 1380, 0.26, 'sine', 0.24, 0.52);
    this.playTone(1380, 460, 0.22, 'sine', 0.22, 0.78);
    this.playTone(460, 920, 0.22, 'triangle', 0.24, 1.0);
  }

  public playTeaShopArrive(): void {
    this.playTone(523, 659, 0.14, 'triangle', 0.2, 0);
    this.playTone(659, 784, 0.16, 'triangle', 0.2, 0.11);
    this.playTone(784, 1046, 0.22, 'sine', 0.22, 0.22);
  }

  public playBossPraise(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((n, idx) => {
      this.playTone(n, n * 1.01, 0.24, 'triangle', 0.22, idx * 0.09);
    });
  }

  public playBossScold(): void {
    this.playTone(311, 293, 0.22, 'sawtooth', 0.2, 0);
    this.playTone(293, 277, 0.22, 'sawtooth', 0.2, 0.24);
    this.playTone(277, 240, 0.55, 'sawtooth', 0.22, 0.48);
  }

  public playCaughtCrying(): void {
    this.playTone(260, 130, 0.28, 'sawtooth', 0.28, 0);
    this.playTone(185, 82, 0.36, 'sawtooth', 0.26, 0.16);
    const sobs = [
      [540, 390, 0.48],
      [480, 340, 0.72],
      [440, 290, 0.96],
      [410, 250, 1.24],
    ];
    for (const [s, e, d] of sobs) {
      this.playTone(s, e, 0.18, 'sine', 0.2, d);
    }
  }

  public playPurchase(): void {
    this.playTone(540, 810, 0.11, 'triangle', 0.18);
    this.playTone(810, 1140, 0.16, 'sine', 0.2, 0.08);
  }
}
