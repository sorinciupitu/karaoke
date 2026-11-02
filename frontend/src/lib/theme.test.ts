import { describe, expect, it } from "vitest";
import { formatDuration } from "./theme";

describe("formatDuration", () => {
  it("formats minutes and seconds", () => {
    expect(formatDuration(95)).toBe("1:35");
  });

  it("formats hours, minutes and seconds", () => {
    expect(formatDuration(3605)).toBe("1:00:05");
  });
});
