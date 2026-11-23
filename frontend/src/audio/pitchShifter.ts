/**
 * WSOLA (Waveform Similarity Overlap-Add) pitch shifter.
 *
 * Time is preserved: the analysis frames advance one hop at a time (1:1 with
 * output), while the samples inside each frame are read with a step of
 * `2^(semitones/12)`. Reading a frame with a step keeps the frame's duration in
 * output samples but changes its fundamental frequency, so the pitch moves
 * while the song keeps its tempo.
 *
 * Every frame after the first is shifted within +/- `searchRadius` samples to
 * the position whose waveform best matches the natural continuation of the
 * previous frame. That alignment is what keeps successive frames phase-coherent
 * and avoids the "phaser / warble" artifact of naive granular shifting.
 *
 * The core is deliberately free of any Web Audio API dependency so it can be
 * unit tested in Node and reused inside an AudioWorklet.
 */

export interface WsolaPitchShifterOptions {
  channels: number;
  sampleRate: number;
  /** Analysis frame length in samples (even). Default 2048 (~46 ms @ 44.1 kHz). */
  frameSize?: number;
  /** WSOLA search radius in samples. Default 256 (~6 ms @ 44.1 kHz). */
  searchRadius?: number;
}

export const MIN_SEMITONES = -6;
export const MAX_SEMITONES = 6;

/** Power-of-two ring buffer, ~1.5 s at 44.1 kHz. */
const RING_SIZE = 1 << 16;
const RING_MASK = RING_SIZE - 1;
const FIFO_SIZE = 1 << 13;
const FIFO_MASK = FIFO_SIZE - 1;

const TEMPLATE_LEN = 96;
const TEMPLATE_STEP = 2;
const SEARCH_STEP = 2;

export class WsolaPitchShifter {
  readonly channels: number;
  readonly sampleRate: number;
  readonly frameSize: number;
  readonly hop: number;
  readonly searchRadius: number;

  private ratio = 1;

  private readonly ring: Float32Array[];
  private readonly mono: Float32Array;
  private readonly tail: Float32Array[];
  private readonly fifo: Float32Array[];
  private readonly window: Float32Array;
  private readonly frame: Float32Array[];

  private writePos = 0;
  private frameCount = 0;
  private prevStart = 0;
  private fifoRead = 0;
  private fifoWrite = 0;

  constructor(opts: WsolaPitchShifterOptions) {
    this.channels = Math.max(1, Math.round(opts.channels));
    this.sampleRate = opts.sampleRate;
    this.frameSize = Math.max(256, (opts.frameSize ?? 2048) & ~1);
    this.hop = this.frameSize >> 1;
    this.searchRadius = Math.max(0, Math.round(opts.searchRadius ?? 256));

    const n = this.frameSize;
    this.window = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // Periodic Hann: w[i] + w[i + hop] === 1, a constant-sum (COLA) pair.
      this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
    }

    this.ring = [];
    this.tail = [];
    this.fifo = [];
    this.frame = [];
    for (let c = 0; c < this.channels; c++) {
      this.ring.push(new Float32Array(RING_SIZE));
      this.tail.push(new Float32Array(this.hop));
      this.fifo.push(new Float32Array(FIFO_SIZE));
      this.frame.push(new Float32Array(n));
    }
    this.mono = new Float32Array(RING_SIZE);
  }

  /** Set the shift in semitones (-6..+6). Applies from the next frame on. */
  setPitch(semitones: number) {
    const clamped = Math.max(
      MIN_SEMITONES,
      Math.min(MAX_SEMITONES, Math.round(semitones)),
    );
    this.ratio = Math.pow(2, clamped / 12);
  }

  get pitchRatio() {
    return this.ratio;
  }

  /** Approximate added latency, in samples, of the shifter itself. */
  get latencySamples() {
    return Math.ceil((this.frameSize - 1) * this.ratio) + this.hop;
  }

  /** Drop everything buffered (used after a seek / track change). */
  reset() {
    for (const t of this.tail) t.fill(0);
    this.fifoRead = 0;
    this.fifoWrite = 0;
    this.writePos = 0;
    this.frameCount = 0;
    this.prevStart = 0;
  }

  /**
   * Feed `frames` input samples and write the same number of shifted samples
   * into `output`. `output` may hold fewer channels than the shifter; extra
   * shifter channels are ignored, extra output channels are silenced.
   */
  process(
    input: ArrayLike<Float32Array> | null | undefined,
    output: Float32Array[],
    frames: number,
  ) {
    if (frames <= 0) return;
    if (input && input.length > 0) this.writeInput(input, frames);
    while (this.fifoWrite - this.fifoRead < frames) {
      if (!this.synthesize()) break;
    }
    this.drain(output, frames);
  }

  private writeInput(input: ArrayLike<Float32Array>, frames: number) {
    const chs = this.channels;
    const mono = this.mono;
    const start = this.writePos;
    for (let i = 0; i < frames; i++) {
      const pos = (start + i) & RING_MASK;
      let sum = 0;
      for (let c = 0; c < chs; c++) {
        const src = input[c] ?? input[0];
        const v = src && i < src.length ? src[i] : 0;
        this.ring[c][pos] = v;
        sum += v;
      }
      mono[pos] = sum / chs;
    }
    this.writePos = start + frames;
  }

  private drain(output: Float32Array[], frames: number) {
    const available = this.fifoWrite - this.fifoRead;
    const n = Math.min(available, frames);
    for (let c = 0; c < output.length; c++) {
      const out = output[c];
      if (!out) continue;
      if (c < this.channels) {
        const f = this.fifo[c];
        for (let i = 0; i < n; i++) out[i] = f[(this.fifoRead + i) & FIFO_MASK];
      }
      for (let i = Math.min(n, out.length); i < frames; i++) out[i] = 0;
    }
    this.fifoRead += n;
  }

  /** Build the next output frame; returns false when more input is needed. */
  private synthesize(): boolean {
    const n = this.frameSize;
    const hop = this.hop;
    const ratio = this.ratio;
    const span = Math.ceil((n - 1) * ratio) + 2;

    const base = this.frameCount === 0 ? 0 : this.prevStart + hop;
    if (base + span > this.writePos) return false;

    let start = base;
    if (this.frameCount > 0) {
      const template = this.prevStart + hop;
      if (template + TEMPLATE_LEN <= this.writePos) {
        start = this.bestStart(base, template, span);
      }
    }

    const mask = RING_MASK;
    for (let c = 0; c < this.channels; c++) {
      const ring = this.ring[c];
      const buf = this.frame[c];
      for (let i = 0; i < n; i++) {
        const p = start + i * ratio;
        const i0 = Math.floor(p);
        const frac = p - i0;
        const a = ring[i0 & mask];
        const b = ring[(i0 + 1) & mask];
        buf[i] = a + (b - a) * frac;
      }
    }

    const w = this.window;
    const writeAt = this.fifoWrite;
    for (let c = 0; c < this.channels; c++) {
      const t = this.tail[c];
      const buf = this.frame[c];
      const fifo = this.fifo[c];
      for (let i = 0; i < hop; i++) {
        fifo[(writeAt + i) & FIFO_MASK] = t[i] + buf[i] * w[i];
        t[i] = buf[hop + i] * w[hop + i];
      }
    }
    this.fifoWrite = writeAt + hop;

    this.prevStart = start;
    this.frameCount += 1;
    return true;
  }

  /** Pick the search offset whose waveform continues the previous frame best. */
  private bestStart(base: number, template: number, span: number): number {
    const mono = this.mono;
    const radius = this.searchRadius;
    const maxStart = this.writePos - span;
    const lo = Math.max(0, base - radius);
    const hi = Math.min(base + radius, maxStart);
    if (hi <= lo) return base;

    let best = base;
    let bestScore = -Infinity;
    for (let candidate = lo; candidate <= hi; candidate += SEARCH_STEP) {
      let num = 0;
      let den = 0;
      for (let k = 0; k < TEMPLATE_LEN; k += TEMPLATE_STEP) {
        const tv = mono[(template + k) & RING_MASK];
        const cv = mono[(candidate + k) & RING_MASK];
        num += tv * cv;
        den += cv * cv;
      }
      if (den <= 1e-9) continue;
      // Normalised correlation, with a tiny bias for the expected position so
      // silent / noisy passages don't drift away from the read pointer.
      const score = num / Math.sqrt(den) - Math.abs(candidate - base) * 1e-7;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }
}
