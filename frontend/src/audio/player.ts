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

type Letter = "a" | "b";

const LETTERS: Letter[] = ["a", "b"];
const PITCH_PROCESSOR_NAME = "karaoke-pitch-shifter";
const clampSemitones = (n: number) =>
  Math.max(-6, Math.min(6, Math.round(n)));

/** The worklet is emitted as its own ES module asset by Vite. */
async function loadPitchWorkletUrl(): Promise<string> {
  const mod = await import("./pitchWorklet.ts?worker&url");
  return mod.default;
}

/**
 * Two-element karaoke engine.
 *
 * Chain: media element -> (WSOLA pitch worklet, only when shifting) -> swap
 * gain -> crossfade gain -> limiter -> destination.
 *
 * Pitch is applied inside the audio graph, so changing the key never reloads
 * the stream, never moves the playback clock and never touches the tempo.
 */
export class PlayerEngine {
  private elA = new Audio();
  private elB = new Audio();
  private active: Letter = "a";

  private ctx: AudioContext | null = null;
  private sources: Record<Letter, MediaElementAudioSourceNode> | null = null;
  private swapGains: Record<Letter, GainNode> | null = null;
  private gains: Record<Letter, GainNode> | null = null;
  private shifters: Record<Letter, AudioWorkletNode | null> = {
    a: null,
    b: null,
  };
  private workletReady: Promise<boolean> | null = null;
  private chainShifted = false;
  private chainToken = 0;
  private pitchValue = 0;

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
      const ctx = new Ctor();
      this.ctx = ctx;

      // Safety net: keeps the mix from hard-clipping when the shifter sums
      // overlapping frames. Transparent below the threshold.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -1.5;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      limiter.connect(ctx.destination);

      const sources = {} as Record<Letter, MediaElementAudioSourceNode>;
      const swapGains = {} as Record<Letter, GainNode>;
      const gains = {} as Record<Letter, GainNode>;

      for (const [letter, el] of [
        ["a", this.elA],
        ["b", this.elB],
      ] as [Letter, HTMLAudioElement][]) {
        const src = ctx.createMediaElementSource(el);
        const swap = ctx.createGain();
        const gain = ctx.createGain();
        swap.gain.value = 1;
        gain.gain.value = 1;
        src.connect(swap);
        swap.connect(gain);
        gain.connect(limiter);
        sources[letter] = src;
        swapGains[letter] = swap;
        gains[letter] = gain;
      }

      this.sources = sources;
      this.swapGains = swapGains;
      this.gains = gains;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (this.pitchValue !== 0) void this.enableShifters();
  }

  private async ensureWorklet(): Promise<boolean> {
    const ctx = this.ctx;
    if (!ctx || typeof ctx.audioWorklet === "undefined") return false;
    if (!this.workletReady) {
      this.workletReady = (async () => {
        try {
          const url = await loadPitchWorkletUrl();
          await ctx.audioWorklet.addModule(url);
          return true;
        } catch {
          return false;
        }
      })();
    }
    return this.workletReady;
  }

  private createShifter(): AudioWorkletNode {
    return new AudioWorkletNode(this.ctx!, PITCH_PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 2,
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
    });
  }

  private async enableShifters() {
    if (!this.ctx) return;
    const ok = await this.ensureWorklet();
    if (!ok || !this.ctx) return;

    const target = this.pitchValue;
    if (!this.shifters.a) this.shifters.a = this.createShifter();
    if (!this.shifters.b) this.shifters.b = this.createShifter();
    for (const letter of LETTERS) {
      this.shifters[letter]?.port.postMessage({
        type: "pitch",
        semitones: target,
      });
    }

    if (target === 0) {
      if (this.chainShifted) this.applyChain(false, true);
      return;
    }
    if (!this.chainShifted) this.applyChain(true, true);
  }

  private route(letter: Letter, shifted: boolean) {
    const src = this.sources?.[letter];
    const swap = this.swapGains?.[letter];
    if (!src || !swap) return;
    const shifter = this.shifters[letter];
    src.disconnect();
    shifter?.disconnect();
    if (shifted && shifter) {
      src.connect(shifter);
      shifter.connect(swap);
    } else {
      src.connect(swap);
    }
  }

  /**
   * Re-wire the graph. The swap gains fade out before the topology changes and
   * back in afterwards, so inserting/removing the worklet never clicks.
   */
  private applyChain(shifted: boolean, smooth: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.swapGains) return;
    this.chainShifted = shifted;

    if (!smooth) {
      for (const letter of LETTERS) this.route(letter, shifted);
      return;
    }

    const t = ctx.currentTime;
    for (const letter of LETTERS) {
      const g = this.swapGains[letter].gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + 0.03);
    }

    const token = ++this.chainToken;
    window.setTimeout(() => {
      if (token !== this.chainToken || !this.ctx || !this.swapGains) return;
      for (const letter of LETTERS) {
        this.route(letter, shifted);
        const g = this.swapGains[letter].gain;
        const now = this.ctx.currentTime;
        g.cancelScheduledValues(now);
        g.setValueAtTime(0, now);
        g.linearRampToValueAtTime(1, now + 0.1);
      }
    }, 40);
  }

  /** Drop buffered audio so a seek/track change can't replay the old position. */
  private resetShifters(letter: Letter = this.active) {
    this.shifters[letter]?.port.postMessage({ type: "reset" });
  }

  /** Fade the active chain in, masking worklet priming after a load/seek. */
  private fadeInActive() {
    if (!this.ctx || !this.swapGains || !this.chainShifted) return;
    const g = this.swapGains[this.active].gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(1, t + 0.15);
  }

  setFade(seconds: number) {
    this.fadeSeconds = seconds;
  }

  /** Real-time key change (-6..+6 semitones). Safe to call while playing. */
  setPitch(semitones: number) {
    const n = clampSemitones(semitones);
    this.pitchValue = n;
    if (!this.ctx) return;

    if (n === 0) {
      if (this.chainShifted) this.applyChain(false, true);
      return;
    }

    if (this.shifters.a && this.shifters.b) {
      for (const letter of LETTERS) {
        this.shifters[letter]?.port.postMessage({ type: "pitch", semitones: n });
      }
      if (!this.chainShifted) this.applyChain(true, true);
      return;
    }

    void this.enableShifters();
  }

  get pitch() {
    return this.pitchValue;
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
    const g = this.gains![this.active];
    g.gain.value = 1;
    this.resetShifters();
    this.fadeInActive();
    await el.play();
  }

  async crossfadeTo(src: string, fadeSeconds: number) {
    this.ensureCtx();
    const oldEl = this.current();
    const oldG = this.gains![this.active];

    this.active = this.active === "a" ? "b" : "a";
    const newEl = this.current();
    const newG = this.gains![this.active];
    newEl.src = src;
    newEl.currentTime = 0;
    this.crossfadeFired = false;
    // Only the incoming element is reset: the outgoing one must keep playing
    // while it fades.
    this.resetShifters(this.active);
    const swap = this.swapGains![this.active];
    swap.gain.cancelScheduledValues(this.ctx!.currentTime);
    swap.gain.setValueAtTime(this.chainShifted ? 0 : 1, this.ctx!.currentTime);
    if (this.chainShifted) this.fadeInActive();

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
    this.resetShifters();
  }

  get currentTime() {
    return this._currentTime;
  }

  get duration() {
    return this._duration;
  }
}
