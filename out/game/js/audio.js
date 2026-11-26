/**
 * audio.js — Synthesized WebAudio Sound Effects and Engine Audio
 * ES Module for Stratos Courier Flight Game
 */

export class Sfx {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.muted = false;
    this.initialized = false;
    this.stallTimer = 0;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.4;
      this.masterGain.connect(this.ctx.destination);

      // Engine Hum Setup
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60; // idle freq

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);
      this.engineOsc.start();

      this.initialized = true;
    } catch (e) {
      console.warn('WebAudio init failed:', e);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.value = this.muted ? 0.0 : 0.4;
    }
    return this.muted;
  }

  update(throttle, isStalling, isCrashed) {
    if (!this.initialized || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (isCrashed) {
      if (this.engineGain) {
        this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
      return;
    }

    // Throttle 0-100 mapped to engine frequency 50Hz - 220Hz and gain
    const eff = throttle / 100;
    const freq = 50 + eff * 180;
    const gainVal = 0.05 + eff * 0.25;

    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
    this.engineGain.gain.setTargetAtTime(gainVal, this.ctx.currentTime, 0.1);

    // Stall warning beep
    if (isStalling) {
      this.stallTimer += 0.05;
      if (this.stallTimer >= 0.3) {
        this.stallTimer = 0;
        this.playTone(880, 0.1, 'sine', 0.2);
      }
    }
  }

  playTone(frequency, duration, type = 'sine', volume = 0.2) {
    if (!this.initialized || !this.ctx || this.muted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency;

      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  playRingChime() {
    if (!this.initialized || !this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.6);
    } catch (e) {}
  }

  playCrash() {
    if (!this.initialized || !this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 1.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(40, now + 1.5);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start(now);
    } catch (e) {}
  }

  playLandingThud() {
    if (!this.initialized || !this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {}
  }
}
