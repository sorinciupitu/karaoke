export interface CrossfadeTiming {
  fadeOutAt: number;
  startNextAt: number;
}

export function crossfadeTiming(
  duration: number,
  fadeSeconds: number,
): CrossfadeTiming {
  const t = Math.max(0, duration - fadeSeconds);
  return { fadeOutAt: t, startNextAt: t };
}

export class PlayerEngine {
  private elA = new Audio();
  private elB = new Audio();
  private active: "a" | "b" = "a";
  private ctx: AudioContext | null = null;
  private ga: GainNode | null = null;
  private gb: GainNode | null = null;
  private fadeSeconds = 0;
  private crossfadeFired = false;
  private _currentTime = 0;
  private _duration = 0;

  onTime: ((t: number) => void) | null = null;
  onEnded: (() => void) | null = null;
  onCrossfade: (() => void) | null = null;

  constructor() {
    for (const el of [this.elA, this.elB]) {
      el.preload = "auto";
      el.addEventListener("timeupdate", () => this.tick());
      el.addEventListener("ended", () => {
        if (el === this.current()) this.onEnded?.();
      });
      el.addEventListener("loadedmetadata", () => {
        if (el === this.current()) this._duration = el.duration || 0;
      });
    }
  }

  private current(): HTMLAudioElement {
    return this.active === "a" ? this.elA : this.elB;
  }

  private ensureCtx() {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
      this.ga = this.ctx.createGain();
      this.gb = this.ctx.createGain();
      const sa = this.ctx.createMediaElementSource(this.elA);
      const sb = this.ctx.createMediaElementSource(this.elB);
      sa.connect(this.ga).connect(this.ctx.destination);
      sb.connect(this.gb).connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setFade(seconds: number) {
    this.fadeSeconds = seconds;
  }

  private tick() {
    const el = this.current();
    this._currentTime = el.currentTime;
    if (el.duration) this._duration = el.duration;
    this.onTime?.(this._currentTime);
    if (
      this.fadeSeconds > 0 &&
      !this.crossfadeFired &&
      el.duration > 0 &&
      el.currentTime >= el.duration - this.fadeSeconds
    ) {
      this.crossfadeFired = true;
      this.onCrossfade?.();
    }
  }

  async play(src: string) {
    this.ensureCtx();
    this.crossfadeFired = false;
    const el = this.current();
    el.src = src;
    el.currentTime = 0;
    this._duration = 0;
    const g = this.active === "a" ? this.ga! : this.gb!;
    g.gain.value = 1;
    await el.play();
  }

  async crossfadeTo(src: string, fadeSeconds: number) {
    this.ensureCtx();
    const oldEl = this.current();
    const oldG = this.active === "a" ? this.ga! : this.gb!;

    this.active = this.active === "a" ? "b" : "a";
    const newEl = this.current();
    const newG = this.active === "a" ? this.ga! : this.gb!;
    newEl.src = src;
    newEl.currentTime = 0;
    this.crossfadeFired = false;

    const t = this.ctx!.currentTime;
    newG.gain.cancelScheduledValues(t);
    oldG.gain.cancelScheduledValues(t);
    newG.gain.setValueAtTime(0, t);
    newG.gain.linearRampToValueAtTime(1, t + fadeSeconds);
    oldG.gain.setValueAtTime(1, t);
    oldG.gain.linearRampToValueAtTime(0, t + fadeSeconds);

    await newEl.play();
    window.setTimeout(() => {
      oldEl.pause();
      oldEl.currentTime = 0;
    }, fadeSeconds * 1000);
  }

  pause() {
    this.current().pause();
  }

  async resume() {
    this.ensureCtx();
    await this.current().play();
  }

  seek(t: number) {
    const el = this.current();
    if (isFinite(el.duration)) el.currentTime = t;
    this._currentTime = t;
  }

  get currentTime() {
    return this._currentTime;
  }

  get duration() {
    return this._duration;
  }
}
