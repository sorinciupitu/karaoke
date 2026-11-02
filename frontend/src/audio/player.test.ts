import { describe, expect, it } from "vitest";
import { crossfadeTiming } from "./player";

describe("crossfadeTiming", () => {
  it("starts the fade fadeSeconds before the end", () => {
    expect(crossfadeTiming(180, 5)).toEqual({
      fadeOutAt: 175,
      startNextAt: 175,
    });
  });
});
