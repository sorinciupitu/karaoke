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
    expect(transposeKey("Re Major", -1)).toBe("Re bemol Major");
    expect(transposeKey("Do Major", -6)).toBe("Sol bemol Major");
  });

  it("transposes flats correctly and keeps the mode", () => {
    expect(transposeKey("Si bemol Minor", 1)).toBe("Si Minor");
    expect(transposeKey("Mi bemol Major", 1)).toBe("Mi Major");
  });

  it("normalises sharp spellings to flats", () => {
    expect(transposeKey("La diez Major", 0)).toBe("Si bemol Major");
    expect(transposeKey("Re diez Major", 0)).toBe("Mi bemol Major");
    expect(transposeKey("Sol diez Major", 0)).toBe("La bemol Major");
    expect(transposeKey("Do diez Major", 0)).toBe("Re bemol Major");
    expect(transposeKey("Fa diez Major", 0)).toBe("Sol bemol Major");
  });

  it("accepts abbreviated flat spellings", () => {
    expect(transposeKey("Sib Minor", 0)).toBe("Si bemol Minor");
    expect(transposeKey("Mib Major", 0)).toBe("Mi bemol Major");
  });

  it("treats a full octave as no change", () => {
    expect(transposeKey("Do Major", 12)).toBe("Do Major");
    expect(transposeKey("Re Minor", -12)).toBe("Re Minor");
  });

  it("leaves an unrecognised key untouched", () => {
    expect(transposeKey("Ceva Necunoscut", 3)).toBe("Ceva Necunoscut");
  });
});
