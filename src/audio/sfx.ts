// Tiny WebAudio synth: no audio files. Must be unlocked by a user gesture (browser autoplay policy).
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private last: Record<string, number> = {};
  muted = false;

  constructor() {
    try {
      this.muted = (localStorage.getItem('swarmvanguard.muted') ?? localStorage.getItem('squadrush.muted')) === '1';
    } catch {
      /* storage unavailable */
    }
  }

  /** Call from a pointer/click handler. Safe to call repeatedly. */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as any).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.35;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.4;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* audio is optional */
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
    try {
      localStorage.setItem('swarmvanguard.muted', m ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  private ok(key: string, minGap: number): boolean {
    if (!this.ctx || this.muted) return false;
    const t = this.ctx.currentTime;
    if (t - (this.last[key] ?? -1) < minGap) return false;
    this.last[key] = t;
    return true;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number) {
    const c = this.ctx!;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master!);
    s.start(t);
    s.stop(t + dur);
  }

  shot() { if (this.ok('shot', 0.12)) this.tone(520, 0.07, 'square', 0.05, 180); }
  hit() { if (this.ok('hit', 0.05)) this.tone(300, 0.04, 'triangle', 0.04, 150); }
  kill() { if (this.ok('kill', 0.04)) this.noise(0.09, 0.07, 1800); }
  blockHit() { if (this.ok('bhit', 0.06)) this.noise(0.06, 0.08, 900); }
  blockBreak() { if (this.ok('bbreak', 0.1)) { this.noise(0.35, 0.25, 700); this.tone(220, 0.25, 'sawtooth', 0.12, 70); } }
  gate(good: boolean) {
    if (!this.ok('gate', 0.1)) return;
    if (good) { this.tone(520, 0.12, 'triangle', 0.18); this.tone(780, 0.18, 'triangle', 0.18, undefined, 0.09); }
    else this.tone(300, 0.3, 'sawtooth', 0.14, 110);
  }
  squadHit() { if (this.ok('squadhit', 0.08)) this.tone(160, 0.1, 'sawtooth', 0.08, 90); }
  win() {
    if (!this.ctx || this.muted) return;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.2, undefined, i * 0.12));
  }
  lose() {
    if (!this.ctx || this.muted) return;
    [330, 262, 196, 130].forEach((f, i) => this.tone(f, 0.35, 'sawtooth', 0.14, undefined, i * 0.16));
  }
}
