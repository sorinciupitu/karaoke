import { describe, expect, it } from "vitest";
import { DEMUCS_MODELS, demucsLabel } from "./demucs";

describe("DEMUCS_MODELS", () => {
  it("offers the three choices", () => {
    expect(DEMUCS_MODELS.map((m) => m.value)).toEqual([
      "htdemucs",
      "htdemucs_ft",
      "mdx_extra_q",
    ]);
  });

  it("maps known values to labels", () => {
    expect(demucsLabel("htdemucs")).toBe("Demucs (original)");
    expect(demucsLabel("htdemucs_ft")).toBe("Demucs FT (fine-tuned)");
  });

  it("falls back for unknown or missing values", () => {
    expect(demucsLabel(null)).toBe("implicit");
    expect(demucsLabel(undefined)).toBe("implicit");
    expect(demucsLabel("unknown")).toBe("unknown");
  });
});
