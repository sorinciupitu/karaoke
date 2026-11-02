import { describe, expect, it } from "vitest";
import { statusLabel } from "./library";

describe("statusLabel", () => {
  it("maps queued", () => {
    expect(statusLabel("queued", "pending")).toBe("în așteptare");
  });
  it("maps downloading", () => {
    expect(statusLabel("downloading", "pending")).toBe("se descarcă");
  });
  it("maps separating", () => {
    expect(statusLabel("separating", "pending")).toBe("se separă vocea");
  });
  it("maps transcribing", () => {
    expect(statusLabel("separating", "syncing")).toBe("se transcriu versurile");
  });
  it("maps ready", () => {
    expect(statusLabel("ready", "ready")).toBe("gata");
  });
  it("maps failed", () => {
    expect(statusLabel("failed", "failed")).toBe("eroare");
  });
});
