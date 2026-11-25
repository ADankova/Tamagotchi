import { TUNES, type SoundName } from './tunes';

const VOLUME = 0.06;

/**
 * 8-битные звуки на квадратной волне через Web Audio.
 * Браузеры разрешают звук только после действия пользователя, поэтому AudioContext
 * создаётся по первому касанию или нажатию клавиши (unlock).
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private enabled = false;

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  /** Вызывать из обработчика жеста пользователя. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      this.ctx = null;
    }
  }

  play(name: SoundName): void {
    const ctx = this.ctx;
    if (!this.enabled || !ctx || ctx.state !== 'running') return;
    let at = ctx.currentTime + 0.01;
    for (const [freq, ms] of TUNES[name]) {
      const dur = ms / 1000;
      if (freq > 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, at);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(VOLUME, at + 0.005);
        gain.gain.setValueAtTime(VOLUME, at + dur - 0.01);
        gain.gain.linearRampToValueAtTime(0, at + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(at);
        osc.stop(at + dur);
      }
      at += dur;
    }
  }
}
