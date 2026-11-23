import { describe, expect, it } from "vitest";
import { WsolaPitchShifter } from "./pitchShifter";

const SR = 44100;
const BLOCK = 128;

function render(
  semitones: number,
  {
    seconds = 1.8,
    leftFreq = 440,
    rightFreq = 440,
    rightGain = 0.25,
  }: {
    seconds?: number;
    leftFreq?: number;
    rightFreq?: number;
    rightGain?: number;
  } = {},
) {
  const shifter = new WsolaPitchShifter({ channels: 2, sampleRate: SR });
  shifter.setPitch(semitones);

  const total = Math.round(seconds * SR);
  const outL = new Float32Array(total);
  const outR = new Float32Array(total);

  for (let offset = 0; offset < total; offset += BLOCK) {
    const n = Math.min(BLOCK, total - offset);
    const inL = new Float32Array(n);
    const inR = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = (offset + i) / SR;
      inL[i] = 0.5 * Math.sin(2 * Math.PI * leftFreq * t);
      inR[i] = rightGain * Math.sin(2 * Math.PI * rightFreq * t);
    }
    const oL = new Float32Array(n);
    const oR = new Float32Array(n);
    shifter.process([inL, inR], [oL, oR], n);
    outL.set(oL, offset);
    outR.set(oR, offset);
  }

  return { outL, outR, shifter };
}

/** Frequency estimate from upward zero crossings over a window. */
function estimateFreq(samples: Float32Array, from: number, to: number) {
  const a = Math.round(from * SR);
  const b = Math.round(to * SR);
  let crossings = 0;
  let first = -1;
  let last = -1;
  for (let i = a + 1; i < b; i++) {
    if (samples[i - 1] < 0 && samples[i] >= 0) {
      if (first < 0) first = i;
      last = i;
      crossings++;
    }
  }
  if (crossings < 2) return 0;
  return ((crossings - 1) * SR) / (last - first);
}

function rms(samples: Float32Array, from: number, to: number) {
  const a = Math.round(from * SR);
  const b = Math.round(to * SR);
  let sum = 0;
  for (let i = a; i < b; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, b - a));
}

describe("WsolaPitchShifter", () => {
  it("leaves the pitch untouched at 0 semitones", () => {
    const { outL } = render(0);
    expect(estimateFreq(outL, 0.4, 1.4)).toBeCloseTo(440, -1);
  });

  it("shifts up by semitones without changing the tempo", () => {
    const { outL } = render(2);
    // 440 * 2^(2/12) = 493.88 Hz
    expect(estimateFreq(outL, 0.4, 1.4)).toBeGreaterThan(480);
    expect(estimateFreq(outL, 0.4, 1.4)).toBeLessThan(508);
  });

  it("shifts down across the full -6 range", () => {
    const { outL } = render(-6);
    // 440 * 2^(-6/12) = 311.13 Hz
    expect(estimateFreq(outL, 0.4, 1.4)).toBeGreaterThan(303);
    expect(estimateFreq(outL, 0.4, 1.4)).toBeLessThan(319);
  });

  it("keeps audio flowing at the same length as the input (tempo preserved)", () => {
    const { outL } = render(4, { seconds: 1.8 });
    // Still producing sound up to the last part of the source: no speed change
    // and no truncation.
    expect(rms(outL, 1.4, 1.75)).toBeGreaterThan(0.1);
  });

  it("keeps the amplitude in the same ballpark (no clipping, no collapse)", () => {
    const { outL } = render(3);
    const level = rms(outL, 0.5, 1.4);
    expect(level).toBeGreaterThan(0.2);
    expect(level).toBeLessThan(0.5);
    for (let i = 0; i < outL.length; i++) {
      expect(Number.isFinite(outL[i])).toBe(true);
      expect(Math.abs(outL[i])).toBeLessThan(1);
    }
  });

  it("keeps stereo channels separate", () => {
    const { outR } = render(2, { leftFreq: 440, rightFreq: 660, rightGain: 0 });
    expect(rms(outR, 0.4, 1.4)).toBeLessThan(0.01);
  });

  it("drops buffered audio on reset (seek) and restarts cleanly", () => {
    const shifter = new WsolaPitchShifter({ channels: 2, sampleRate: SR });
    shifter.setPitch(5);
    const block = (freq: number) => {
      const l = new Float32Array(BLOCK);
      const r = new Float32Array(BLOCK);
      for (let i = 0; i < BLOCK; i++) {
        l[i] = 0.4 * Math.sin((2 * Math.PI * freq * i) / SR);
        r[i] = l[i];
      }
      const ol = new Float32Array(BLOCK);
      const or = new Float32Array(BLOCK);
      shifter.process([l, r], [ol, or], BLOCK);
    };
    for (let i = 0; i < 200; i++) block(440);
    shifter.reset();
    const ol = new Float32Array(BLOCK);
    const or = new Float32Array(BLOCK);
    shifter.process([new Float32Array(BLOCK), new Float32Array(BLOCK)], [ol, or], BLOCK);
    // Right after a reset nothing from before the seek may leak out.
    expect(rms(ol, 0, BLOCK / SR)).toBeLessThan(1e-4);
  });
});
