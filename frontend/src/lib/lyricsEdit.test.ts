import { describe, expect, it } from "vitest";
import type { Line } from "../api/tracks";
import { applyLineEdit, nudgeLine, parseLyricsText, removeLine } from "./lyricsEdit";

const lines: Line[] = [
  { text: "a", start: 0, end: 2 },
  { text: "b", start: 2, end: 4 },
];

describe("lyricsEdit helpers", () => {
  it("applyLineEdit updates one line without mutating others", () => {
    const out = applyLineEdit(lines, 1, { text: "B" });
    expect(out[1].text).toBe("B");
    expect(out[0]).toBe(lines[0]);
    expect(out[1]).not.toBe(lines[1]);
  });

  it("removeLine removes the line", () => {
    expect(removeLine(lines, 0)).toEqual([lines[1]]);
  });

  it("nudgeLine shifts both start and end", () => {
    const out = nudgeLine(lines, 0, 0.5);
    expect(out[0]).toEqual({ text: "a", start: 0.5, end: 2.5 });
    expect(out[1]).toBe(lines[1]);
  });
});

describe("parseLyricsText", () => {
  it("splits lines, trims and drops blanks", () => {
    expect(parseLyricsText("primul vers\n\nal doilea vers\n   \n")).toEqual([
      { text: "primul vers", start: 0, end: 0 },
      { text: "al doilea vers", start: 0, end: 0 },
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseLyricsText("a\r\nb\r\nc")).toEqual([
      { text: "a", start: 0, end: 0 },
      { text: "b", start: 0, end: 0 },
      { text: "c", start: 0, end: 0 },
    ]);
  });

  it("returns an empty array for empty or blank text", () => {
    expect(parseLyricsText("")).toEqual([]);
    expect(parseLyricsText("   \n  \n")).toEqual([]);
  });
});
