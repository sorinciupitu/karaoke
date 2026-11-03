import { describe, expect, it } from "vitest";
import { transposeKey } from "./musicKey";

describe("transposeKey", () => {
  it("returns the key unchanged at 0 semitones", () => {
    expect(transposeKey("Do Major", 0)).toBe("Do Major");
  });

  it("returns null for a missing key", () => {
    expect(transposeKey(null, 2)).toBeNull();
    expect(transposeKey(undefined, 2)).toBeNull();
  });

  it("transposes up by whole steps", () => {
    expect(transposeKey("Do Major", 2)).toBe("Re Major");
    expect(transposeKey("Do Major", 4)).toBe("Mi Major");
  });

  it("transposes down and wraps past the octave", () => {
    expect(transposeKey("Do Major", -1)).toBe("Si Major");
    expect(transposeKey("Re Major", -1)).toBe("Do diez Major");
    expect(transposeKey("Do Major", -6)).toBe("Fa diez Major");
  });

  it("transposes sharps correctly and keeps the mode", () => {
    expect(transposeKey("Sol diez Minor", 1)).toBe("La Minor");
    expect(transposeKey("La diez Major", 1)).toBe("Si Major");
    expect(transposeKey("Si Major", 1)).toBe("Do Major");
  });

  it("treats a full octave as no change", () => {
    expect(transposeKey("Do Major", 12)).toBe("Do Major");
    expect(transposeKey("Re Minor", -12)).toBe("Re Minor");
  });

  it("leaves an unrecognised key untouched", () => {
    expect(transposeKey("Ceva Necunoscut", 3)).toBe("Ceva Necunoscut");
  });
});
