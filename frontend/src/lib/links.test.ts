import { describe, expect, it } from "vitest";
import { parseLinks } from "./links";

describe("parseLinks", () => {
  it("splits by newline, trims and drops blanks", () => {
    expect(parseLinks("https://a\n\nhttps://b\n   \nhttps://c")).toEqual([
      "https://a",
      "https://b",
      "https://c",
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseLinks("a\r\nb\r\nc")).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for blank text", () => {
    expect(parseLinks("  \n \n")).toEqual([]);
  });
});
