/**
 * AudioWorklet host for the WSOLA pitch shifter.
 *
 * Runs on the audio rendering thread, so pitch changes never touch the media
 * element, never reload the stream and never move the playback clock: the
 * lyrics timeline stays exactly where it was.
 */
import { WsolaPitchShifter } from "./pitchShifter";

export const PITCH_PROCESSOR_NAME = "karaoke-pitch-shifter";

type ShifterMessage =
  | { type: "pitch"; semitones: number }
  | { type: "reset" };

declare const sampleRate: number;

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
}

declare function registerProcessor(
  name: string,
  processor: unknown,
): void;

class KaraokePitchProcessor extends AudioWorkletProcessor {
  private readonly shifter: WsolaPitchShifter;
  private left = new Float32Array(128);
  private right = new Float32Array(128);
  private pendingReset = false;

  constructor() {
    super();
    this.shifter = new WsolaPitchShifter({ channels: 2, sampleRate });
    this.port.onmessage = (event: MessageEvent<ShifterMessage>) => {
      const data = event.data;
      if (!data) return;
      if (data.type === "pitch") this.shifter.setPitch(data.semitones);
      else if (data.type === "reset") this.pendingReset = true;
    };
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
  ): boolean {
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    const frames = output[0].length;

    if (this.pendingReset) {
      this.shifter.reset();
      this.pendingReset = false;
    }

    const input = inputs[0];
    if (!input || input.length === 0 || !input[0]) {
      for (const channel of output) channel.fill(0);
      return true;
    }

    if (this.left.length !== frames) {
      this.left = new Float32Array(frames);
      this.right = new Float32Array(frames);
    }

    const l = input[0];
    const r = input.length > 1 && input[1] ? input[1] : input[0];
    this.shifter.process([l, r], [this.left, this.right], frames);

    if (output.length === 1) {
      const mono = output[0];
      for (let i = 0; i < frames; i++) {
        mono[i] = (this.left[i] + this.right[i]) * 0.5;
      }
    } else {
      output[0].set(this.left);
      output[1].set(this.right);
      for (let c = 2; c < output.length; c++) output[c].fill(0);
    }
    return true;
  }
}

if (typeof registerProcessor === "function") {
  registerProcessor(PITCH_PROCESSOR_NAME, KaraokePitchProcessor);
}
