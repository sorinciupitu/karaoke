import { describe, expect, it } from "vitest";
import { findActiveLineIndex } from "./lyricsSync";

const lines = [
  { start: 0, end: 5 },
  { start: 5, end: 10 },
];

describe("findActiveLineIndex", () => {
  it("returns the line whose window contains the time", () => {
    expect(findActiveLineIndex(lines, 2)).toBe(0);
    expect(findActiveLineIndex(lines, 7)).toBe(1);
  });
  it("returns -1 before the first line", () => {
    expect(findActiveLineIndex(lines, -1)).toBe(-1);
  });
  it("returns -1 after the last line", () => {
    expect(findActiveLineIndex(lines, 20)).toBe(-1);
  });
});
