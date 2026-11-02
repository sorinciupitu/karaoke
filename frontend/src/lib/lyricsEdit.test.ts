import { describe, expect, it } from "vitest";
import type { Line } from "../api/tracks";
import { applyLineEdit, nudgeLine, removeLine } from "./lyricsEdit";

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
