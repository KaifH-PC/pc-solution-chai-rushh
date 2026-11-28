/**
 * 100% Offline Procedural Web Audio + Native Indian-Voice SpeechSynthesis Engine
 * for "PC Solution The Chai Rush!":
 *  1. Audible spoken Indian-English / Hindi (en-IN / hi-IN) voice callouts during gameplay
 *     via window.speechSynthesis with varied speaker pitch/rate and strict 4-6s cooldown.
 *  2. Subtle procedural Indian street background ambience during active runs:
 *     low traffic/engine hum, soft crowd murmur bed, and occasional distant street horns/bells.
 *  3. Crisp, clean arcade SFX (harmonic coin & power-up chimes, filtered-noise air whooshes,
 *     auto/scooter double-horns, electric UPS/CAT6 zap, dog bark, ceramic clink, single drip)
 *     with ZERO harsh sawtooth formant buzz.
 *  4. Clean audio handoff: immediately cancels speechSynthesis and silences street ambience/BGM
 *     whenever a cutscene video plays, when muted, when paused, or when a run ends.
 */

import { GamePhase } from './types';

export interface AmbientMixState {
  phase: GamePhase;
  speedRatio: number; // 0..1
  customerProximity: number; // 0 (far) .. 1 (right behind runner!)
  customersPacified?: boolean;
}

export type SpeakerStyle = 'customer_urgent' | 'customer_whiny' | 'boss' | 'shopkeeper' | 'happy_customer';

export const CHASE_VOICE_LINES: readonly { text: string; style: SpeakerStyle }[] = [
  { text: 'Arre ruk bhai!', style: 'customer_urgent' },
  { text: 'Mera laptop abhi chahiye!', style: 'customer_whiny' },
  { text: 'Printer hang ho gaya!', style: 'customer_urgent' },
  { text: 'Jaldi chai le aa!', style: 'boss' },
  { text: 'Bhaiya, Windows 7 dal do!', style: 'customer_whiny' },
  { text: 'Printer offline aa raha hai!', style: 'customer_urgent' },
];

export class GameAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private trafficGain: GainNode | null = null;
  private murmurGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private roadRumbleSource: AudioBufferSourceNode | null = null;
  private crowdMurmurSource: AudioBufferSourceNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineLfo: OscillatorNode | null = null;
  private murmurLfo: OscillatorNode | null = null;

  private muted = false;
  private externalVideoPlaying = false;
  private started = false;
  private mixState: AmbientMixState = {
    phase: 'title',
    speedRatio: 0.2,
    customerProximity: 0.15,
    customersPacified: false,
  };

  private musicTimer = 0;
  private musicStep = 0;
  private hornCooldown = 2.8;
  private chaseFootstepCooldown = 0.7;
  private voiceAmbientCooldown = 3.2;

  // SpeechSynthesis state
  private preferredVoices: SpeechSynthesisVoice[] = [];
  private lastSpokenAtMs = 0;
  private nextSpeechCooldownMs = 4500;
  private speechListenerAttached = false;
  private unlockListenersAttached = false;

  constructor(muted = false) {
    this.muted = muted;
    this.initSpeechVoices();
    this.attachGlobalUnlockListeners();
  }

  private attachGlobalUnlockListeners(): void {
    if (typeof window === 'undefined' || this.unlockListenersAttached) return;
    this.unlockListenersAttached = true;
    const onFirstGesture = () => {
      this.unlock();
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('touchstart', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
    };
    window.addEventListener('pointerdown', onFirstGesture, { passive: true });
    window.addEventListener('touchstart', onFirstGesture, { passive: true });
    window.addEventListener('keydown', onFirstGesture, { passive: true });
  }

  private initSpeechVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const refresh = () => {
      try {
        const all = window.speechSynthesis.getVoices();
        if (!all || all.length === 0) return;
        const ranked = [...all].sort((a, b) => {
          const score = (v: SpeechSynthesisVoice) => {
            const lang = v.lang.toLowerCase();
            if (lang === 'en-in') return 4;
            if (lang === 'hi-in') return 3;
            if (lang.startsWith('en-')) return 2;
            if (lang.startsWith('hi')) return 1;
            return 0;
          };
          return score(b) - score(a);
        });
        this.preferredVoices = ranked;
      } catch {
        // Ignore browser speech voice errors
      }
    };
    refresh();
    if (!this.speechListenerAttached) {
      this.speechListenerAttached = true;
      try {
        window.speechSynthesis.addEventListener('voiceschanged', refresh);
      } catch {
        // Safari fallback
      }
    }
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
      this.masterGain.gain.value = this.isSilenced() ? 0 : 0.78;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.0;
      this.musicGain.connect(this.masterGain);

      this.trafficGain = this.ctx.createGain();
      this.trafficGain.gain.value = 0.0;
      this.trafficGain.connect(this.masterGain);

      this.murmurGain = this.ctx.createGain();
      this.murmurGain.gain.value = 0.0;
      this.murmurGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.8;
      this.sfxGain.connect(this.masterGain);

      this.buildNoiseBuffer();
      this.startContinuousStreetBed();
      this.started = true;
    }

    if (this.ctx.state === 'suspended' && !this.externalVideoPlaying) {
      this.ctx.resume().catch(() => {});
    }
  }

  private isSilenced(): boolean {
    return this.muted || this.externalVideoPlaying;
  }

  private syncMasterVolume(): void {
    if (!this.masterGain || !this.ctx) return;
    this.masterGain.gain.setTargetAtTime(
      this.isSilenced() ? 0 : 0.78,
      this.ctx.currentTime,
      0.03
    );
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.cancelSpeech();
    }
    this.syncMasterVolume();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /** Cleanly mutes & suspends all Web Audio + speechSynthesis while MP4 cutscenes play */
  public setExternalVideoPlaying(active: boolean): void {
    this.externalVideoPlaying = active;
    if (active) {
      this.cancelSpeech();
      this.silenceAmbienceImmediately();
    }
    this.syncMasterVolume();
    if (this.ctx) {
      if (active && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      } else if (!active && !this.muted && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }
  }

  /** Immediately stops spoken voices and drops street ambience/BGM on Pause, Cutscene, or Run End */
  public stopAllGameplayAudio(): void {
    this.cancelSpeech();
    this.silenceAmbienceImmediately();
  }

  private silenceAmbienceImmediately(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.trafficGain?.gain.setTargetAtTime(0, now, 0.03);
    this.murmurGain?.gain.setTargetAtTime(0, now, 0.03);
    this.musicGain?.gain.setTargetAtTime(0, now, 0.03);
  }

  public cancelSpeech(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }

  /**
   * Speaks short energetic Indian-street Hinglish lines via window.speechSynthesis
   * with Indian voice preference (en-IN / hi-IN), per-speaker pitch/rate variation,
   * and a 4–6 second cooldown so voices never overlap or spam.
   */
  public speakLine(text: string, style: SpeakerStyle = 'customer_urgent', force = false): void {
    if (this.isSilenced()) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (this.mixState.phase !== 'playing' && !force) return;

    const nowMs = performance.now();
    if (!force && nowMs - this.lastSpokenAtMs < this.nextSpeechCooldownMs) {
      return;
    }

    try {
      const synth = window.speechSynthesis;
      if (synth.speaking && !force) return;
      if (force) synth.cancel();

      const utter = new SpeechSynthesisUtterance(text);
      const voices = this.preferredVoices.length > 0 ? this.preferredVoices : synth.getVoices();
      const indianVoices = voices.filter((v) => {
        const l = v.lang.toLowerCase();
        return l === 'en-in' || l === 'hi-in' || l.startsWith('hi');
      });

      if (indianVoices.length > 0) {
        utter.voice = indianVoices[Math.floor(Math.random() * indianVoices.length)];
        utter.lang = utter.voice.lang;
      } else if (voices.length > 0) {
        utter.voice = voices[0];
        utter.lang = 'en-IN';
      } else {
        utter.lang = 'en-IN';
      }

      switch (style) {
        case 'customer_urgent':
          utter.pitch = 1.08 + Math.random() * 0.14;
          utter.rate = 1.18 + Math.random() * 0.1;
          break;
        case 'customer_whiny':
          utter.pitch = 1.2 + Math.random() * 0.16;
          utter.rate = 1.14 + Math.random() * 0.1;
          break;
        case 'boss':
          utter.pitch = 0.84 + Math.random() * 0.1;
          utter.rate = 1.08;
          break;
        case 'shopkeeper':
          utter.pitch = 0.94 + Math.random() * 0.12;
          utter.rate = 1.12;
          break;
        case 'happy_customer':
          utter.pitch = 1.1 + Math.random() * 0.1;
          utter.rate = 1.06;
          break;
      }

      utter.volume = 0.85;
      this.lastSpokenAtMs = nowMs;
      this.nextSpeechCooldownMs = 4200 + Math.random() * 1800; // Strict 4.2s - 6.0s cooldown!
      synth.speak(utter);
    } catch {
      // Ignore browser speech errors gracefully
    }
  }

  public dispose(): void {
    this.cancelSpeech();
    try {
      this.roadRumbleSource?.stop();
      this.crowdMurmurSource?.stop();
      this.engineOsc?.stop();
      this.engineLfo?.stop();
      this.murmurLfo?.stop();
    } catch {
      // ignore
    }
    this.roadRumbleSource = null;
    this.crowdMurmurSource = null;
    this.engineOsc = null;
    this.engineLfo = null;
    this.murmurLfo = null;
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
      last = (last + 0.045 * white) / 1.045;
      data[i] = last * 3.0;
    }
    this.noiseBuffer = buf;
  }

  /** Subtle procedural street ambience bed: low traffic/engine hum + soft crowd murmur */
  private startContinuousStreetBed(): void {
    if (!this.ctx || !this.trafficGain || !this.murmurGain || !this.noiseBuffer) return;

    // 1. Low-frequency road & traffic hum
    const rumble = this.ctx.createBufferSource();
    rumble.buffer = this.noiseBuffer;
    rumble.loop = true;

    const roadFilter = this.ctx.createBiquadFilter();
    roadFilter.type = 'lowpass';
    roadFilter.frequency.value = 175;
    roadFilter.Q.value = 0.7;

    const rumbleGain = this.ctx.createGain();
    rumbleGain.gain.value = 0.36;

    rumble.connect(roadFilter);
    roadFilter.connect(rumbleGain);
    rumbleGain.connect(this.trafficGain);
    rumble.start();
    this.roadRumbleSource = rumble;

    // 2. Soft distant scooter/auto engine purr
    const eng = this.ctx.createOscillator();
    eng.type = 'triangle';
    eng.frequency.value = 58;

    const engFilter = this.ctx.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 165;

    const engGain = this.ctx.createGain();
    engGain.gain.value = 0.055;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 12.5;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.022;
    lfo.connect(lfoGain);
    lfoGain.connect(engGain.gain);

    eng.connect(engFilter);
    engFilter.connect(engGain);
    engGain.connect(this.trafficGain);
    eng.start();
    lfo.start();
    this.engineOsc = eng;
    this.engineLfo = lfo;

    // 3. Soft Indian market crowd murmur bed (warm bandpass-filtered noise with slow swell)
    const murmur = this.ctx.createBufferSource();
    murmur.buffer = this.noiseBuffer;
    murmur.loop = true;

    const murmurFilter = this.ctx.createBiquadFilter();
    murmurFilter.type = 'bandpass';
    murmurFilter.frequency.value = 520;
    murmurFilter.Q.value = 1.4;

    const murmurLevel = this.ctx.createGain();
    murmurLevel.gain.value = 0.22;

    const mLfo = this.ctx.createOscillator();
    mLfo.frequency.value = 0.38;
    const mLfoGain = this.ctx.createGain();
    mLfoGain.gain.value = 0.07;
    mLfo.connect(mLfoGain);
    mLfoGain.connect(murmurLevel.gain);

    murmur.connect(murmurFilter);
    murmurFilter.connect(murmurLevel);
    murmurLevel.connect(this.murmurGain);
    murmur.start();
    mLfo.start();
    this.crowdMurmurSource = murmur;
    this.murmurLfo = mLfo;
  }

  public tick(dt: number, state: AmbientMixState): void {
    this.mixState = state;
    if (!this.started || !this.ctx || this.ctx.state !== 'running' || this.isSilenced()) return;

    const now = this.ctx.currentTime;
    const isPlaying = state.phase === 'playing';
    const isTeaShop = state.phase === 'teashop';
    const pacified = Boolean(state.customersPacified);
    const prox = pacified ? 0.1 : Math.max(0, Math.min(1, state.customerProximity));

    // Only run street ambience & chase rhythm during active gameplay!
    // Quiet and clean during menus, pause, cutscenes, and results.
    let targetTraffic = 0.0;
    let targetMurmur = 0.0;
    let targetMusic = 0.0;

    if (isPlaying) {
      targetTraffic = 0.22;
      targetMurmur = 0.14 + prox * 0.08;
      targetMusic = 0.2;
    } else if (isTeaShop) {
      targetTraffic = 0.1;
      targetMurmur = 0.09;
      targetMusic = 0.07;
    } else if (state.phase === 'title') {
      targetTraffic = 0.06;
      targetMurmur = 0.04;
      targetMusic = 0.0;
    }

    this.trafficGain?.gain.setTargetAtTime(targetTraffic, now, 0.12);
    this.murmurGain?.gain.setTargetAtTime(targetMurmur, now, 0.14);
    this.musicGain?.gain.setTargetAtTime(targetMusic, now, 0.14);

    if (this.engineOsc) {
      const targetFreq = isPlaying ? 56 + state.speedRatio * 28 : 48;
      this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.18);
    }

    // 1. Crisp upbeat street rhythm (dhol/tabla groove during active runs)
    if (isPlaying) {
      const stepDur = 0.148 - state.speedRatio * 0.022;
      this.musicTimer += dt;
      if (this.musicTimer >= stepDur) {
        this.musicTimer -= stepDur;
        this.playMusicStep(this.musicStep);
        this.musicStep = (this.musicStep + 1) % 16;
      }
    }

    // 2. Occasional subtle distant Indian street horn / cycle bell accents underneath gameplay SFX
    if (isPlaying) {
      this.hornCooldown -= dt;
      if (this.hornCooldown <= 0) {
        this.playDistantStreetAccent();
        this.hornCooldown = 2.6 + Math.random() * 2.8;
      }
    }

    // 3. Subtle rhythmic chase footsteps + periodic spoken Hinglish customer lines (4-6s cooldown)
    if (isPlaying && !pacified) {
      if (prox > 0.45) {
        this.chaseFootstepCooldown -= dt;
        if (this.chaseFootstepCooldown <= 0) {
          this.playCustomerFootsteps(prox);
          this.chaseFootstepCooldown = Math.max(0.28, 0.65 - prox * 0.32);
        }
      }

      this.voiceAmbientCooldown -= dt;
      if (this.voiceAmbientCooldown <= 0) {
        const pick = CHASE_VOICE_LINES[Math.floor(Math.random() * CHASE_VOICE_LINES.length)];
        this.speakLine(pick.text, pick.style);
        this.voiceAmbientCooldown = 5.0 + Math.random() * 2.4;
      }
    }
  }

  private playMusicStep(step: number): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;

    const boomSteps = [0, 3, 6, 8, 11, 14];
    if (boomSteps.includes(step)) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const accent = step === 0 || step === 8;
      osc.frequency.setValueAtTime(accent ? 142 : 120, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.1);
      gain.gain.setValueAtTime(accent ? 0.28 : 0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.12);
    }

    if (step % 2 === 1 || step === 4 || step === 12) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(step === 4 || step === 12 ? 410 : 325, now);
      osc.frequency.exponentialRampToValueAtTime(185, now + 0.05);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.06);
    }

    // Clean plucked pentatonic bounce (sine + soft triangle, zero harsh sawtooth rasp)
    const melody: (number | null)[] = [
      587.3, null, 659.3, 740.0,
      880.0, null, 740.0, 659.3,
      587.3, 659.3, 880.0, null,
      987.8, 880.0, 740.0, 659.3,
    ];
    const freq = melody[step];
    if (freq) {
      const lead = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      lead.type = 'triangle';
      lead.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      lead.connect(gain);
      gain.connect(this.musicGain);
      lead.start(now);
      lead.stop(now + 0.13);
    }
  }

  /** Quiet distant Indian street horn / bicycle bell accent mixed softly underneath gameplay */
  private playDistantStreetAccent(): void {
    if (!this.ctx || !this.trafficGain || this.isSilenced()) return;
    const now = this.ctx.currentTime;
    const roll = Math.random();

    if (roll < 0.45) {
      // Soft distant auto-rickshaw beep-beep
      for (let i = 0; i < 2; i++) {
        const t = now + i * 0.17;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(480 + Math.random() * 50, t);
        filter.type = 'bandpass';
        filter.frequency.value = 900;
        filter.Q.value = 1.6;
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.11, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.trafficGain);
        osc.start(t);
        osc.stop(t + 0.13);
      }
    } else if (roll < 0.78) {
      // Distant bicycle bell "tring-tring"
      for (let i = 0; i < 2; i++) {
        const t = now + i * 0.11;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2360, t);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        osc.connect(gain);
        gain.connect(this.trafficGain);
        osc.start(t);
        osc.stop(t + 0.17);
      }
    } else {
      // Soft distant bus horn
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(215, now);
      filter.type = 'lowpass';
      filter.frequency.value = 480;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.trafficGain);
      osc.start(now);
      osc.stop(now + 0.36);
    }
  }

  private playCustomerFootsteps(proximity: number): void {
    if (!this.ctx || !this.sfxGain || this.isSilenced()) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.11;
      const thud = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime(118, t);
      thud.frequency.exponentialRampToValueAtTime(48, t + 0.055);
      g.gain.setValueAtTime(0.11 * proximity, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      thud.connect(g);
      g.connect(this.sfxGain);
      thud.start(t);
      thud.stop(t + 0.065);
    }
  }

  /** Clean filtered-noise whoosh for movement polish (lane switch, jump, slide, fast-drop roll) */
  private playAirWhoosh(centerFreq: number, endFreq: number, duration: number, volume: number): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.isSilenced()) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centerFreq, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, endFreq), now + duration);
    filter.Q.value = 1.6;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + duration * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now, Math.random() * 0.5, duration + 0.03);
  }

  /** Crisp comic pop cue (replaces old robotic sawtooth formant buzz!) */
  public playComicAlert(highPitch = false): void {
    if (!this.ctx || !this.sfxGain || this.isSilenced()) return;
    const base = highPitch ? 520 : 410;
    this.playTone(base, base * 1.45, 0.075, 'triangle', 0.13, 0);
  }

  /** Electric zap crackle for CAT6 cable bundles & smoking SMPS/UPS hazards */
  public playElectricZap(): void {
    if (!this.ctx || !this.sfxGain || this.isSilenced()) return;
    for (let i = 0; i < 3; i++) {
      this.playTone(1350 + i * 260, 290, 0.045, 'sawtooth', 0.15, i * 0.05);
      this.playTone(140, 660, 0.04, 'square', 0.09, i * 0.05 + 0.014);
    }
  }

  /** Snappy startled stray street dog bark */
  public playStrayDogBark(): void {
    if (!this.ctx || !this.sfxGain || this.isSilenced()) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.135;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(430 + i * 45, t);
      osc.frequency.exponentialRampToValueAtTime(195, t + 0.095);
      filter.type = 'bandpass';
      filter.frequency.value = 880;
      filter.Q.value = 2.2;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.105);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.115);
    }
  }

  /** Sharp double-horn "Peep-peep!" for oncoming auto-rickshaw / CPU delivery scooter */
  public playScooterDoubleHorn(): void {
    if (!this.ctx || !this.sfxGain || this.isSilenced()) return;
    this.playTone(810, 805, 0.085, 'square', 0.15, 0);
    this.playTone(845, 840, 0.09, 'square', 0.16, 0.125);
  }

  /** Bright celebratory chime when player hits 15 Coins ("CHAI MONEY READY!") */
  public playChaiMoneyReady(): void {
    this.playTone(659.25, 660, 0.11, 'triangle', 0.22, 0);
    this.playTone(880, 882, 0.12, 'triangle', 0.22, 0.085);
    this.playTone(1318.5, 1322, 0.26, 'sine', 0.24, 0.17);
  }

  /** Crisp harmonic chime when collecting a 3D lane power-up */
  public playPowerUpPickup(): void {
    this.playTone(587.33, 587.33, 0.09, 'triangle', 0.2, 0);
    this.playTone(880, 880, 0.11, 'triangle', 0.21, 0.065);
    this.playTone(1174.66, 1318.5, 0.2, 'sine', 0.23, 0.13);
  }

  /** Punchy chord when activating a stored lane power-up */
  public playPowerUpActivate(): void {
    this.playAirWhoosh(420, 1650, 0.22, 0.24);
    this.playTone(440, 880, 0.18, 'triangle', 0.22, 0);
    this.playTone(659.25, 1318.5, 0.22, 'sine', 0.2, 0.06);
  }

  /** Crisp single resonant "plip!" drop sound */
  public playSingleDrip(): void {
    this.playTone(540, 1420, 0.11, 'sine', 0.26, 0.25);
    this.playTone(1420, 880, 0.06, 'sine', 0.15, 0.35);
  }

  /** Comedic low stomach-rumble SFX */
  public playStomachRumble(): void {
    if (!this.ctx || !this.sfxGain || this.isSilenced()) return;
    const now = this.ctx.currentTime + 0.25;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(92, now);
    osc.frequency.linearRampToValueAtTime(68, now + 0.35);
    osc.frequency.linearRampToValueAtTime(102, now + 0.62);
    osc.frequency.linearRampToValueAtTime(58, now + 0.9);

    lfo.frequency.value = 16;
    lfoGain.gain.value = 14;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    filter.type = 'lowpass';
    filter.frequency.value = 240;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.92);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.95);
    lfo.stop(now + 0.95);
  }

  /** Warm ceramic clink for Double Chai Win & VIP Tea Party */
  public playCupClink(): void {
    this.playTone(2180, 2320, 0.11, 'sine', 0.22, 0.08);
    this.playTone(2950, 2860, 0.14, 'triangle', 0.16, 0.1);
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'triangle',
    volume = 0.2,
    delay = 0
  ): void {
    if (!this.ctx || !this.sfxGain || this.isSilenced()) return;
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
    this.playAirWhoosh(620, 1280, 0.09, 0.16);
    this.playTone(320, 520, 0.075, 'sine', 0.12);
  }

  public playJump(): void {
    this.playAirWhoosh(420, 1180, 0.14, 0.18);
    this.playTone(250, 620, 0.15, 'triangle', 0.2);
  }

  public playSlide(): void {
    this.playAirWhoosh(1100, 320, 0.17, 0.22);
    this.playTone(340, 130, 0.15, 'triangle', 0.12);
  }

  public playFastDrop(): void {
    this.playAirWhoosh(1480, 240, 0.16, 0.26);
    this.playTone(460, 95, 0.13, 'triangle', 0.21);
  }

  public playCoin(combo = 0): void {
    const pitch = Math.min(1.55, 1 + combo * 0.04);
    this.playTone(900 * pitch, 1340 * pitch, 0.085, 'sine', 0.17);
    this.playTone(1340 * pitch, 1680 * pitch, 0.095, 'triangle', 0.12, 0.042);
  }

  public playTeaCup(): void {
    this.playTone(1680, 2120, 0.08, 'sine', 0.16, 0);
    this.playTone(520, 780, 0.13, 'triangle', 0.19, 0.04);
    this.playTone(780, 1180, 0.17, 'triangle', 0.19, 0.11);
    this.playTone(1040, 1560, 0.22, 'sine', 0.21, 0.18);
  }

  public playNearMiss(): void {
    this.playAirWhoosh(850, 1520, 0.09, 0.14);
    this.playTone(640, 960, 0.09, 'sine', 0.11);
  }

  public playAbility(): void {
    this.playPowerUpActivate();
  }

  public playShieldSmash(): void {
    this.playAirWhoosh(920, 220, 0.18, 0.26);
    this.playTone(230, 78, 0.2, 'triangle', 0.24);
    this.playTone(540, 260, 0.14, 'sine', 0.16, 0.03);
  }

  public playTeaSpillHit(): void {
    this.playTone(320, 115, 0.18, 'triangle', 0.25);
    this.playTone(1160, 420, 0.13, 'sine', 0.16, 0.035);
    this.playCustomerFootsteps(0.95);
  }

  public playFunnyUTurn(): void {
    if (!this.ctx || !this.sfxGain || this.isSilenced()) return;
    this.playAirWhoosh(1500, 380, 0.32, 0.28);
    this.playTone(940, 190, 0.18, 'triangle', 0.26, 0);
    this.playTone(360, 1320, 0.24, 'sine', 0.22, 0.42);
    this.playTone(1320, 460, 0.2, 'sine', 0.2, 0.68);
    this.playTone(460, 920, 0.2, 'triangle', 0.22, 0.9);
  }

  public playTeaShopArrive(): void {
    this.playTone(523, 659, 0.14, 'triangle', 0.2, 0);
    this.playTone(659, 784, 0.15, 'triangle', 0.2, 0.1);
    this.playTone(784, 1046, 0.22, 'sine', 0.22, 0.2);
  }

  public playBossPraise(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((n, idx) => {
      this.playTone(n, n * 1.01, 0.22, 'triangle', 0.2, idx * 0.08);
    });
  }

  public playBossScold(): void {
    this.playTone(311, 293, 0.2, 'triangle', 0.2, 0);
    this.playTone(293, 277, 0.2, 'triangle', 0.2, 0.22);
    this.playTone(277, 235, 0.48, 'triangle', 0.22, 0.44);
  }

  public playPurchase(): void {
    this.playTone(540, 810, 0.1, 'triangle', 0.18);
    this.playTone(810, 1140, 0.15, 'sine', 0.2, 0.075);
  }
}
