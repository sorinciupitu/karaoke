export const DEMUCS_MODELS = [
  { value: "htdemucs", label: "Demucs (original)" },
  { value: "htdemucs_ft", label: "Demucs FT (fine-tuned)" },
  { value: "mdx23c", label: "MDX23C-InstVoc-HQ" },
  { value: "ensemble", label: "Ensemble (MDX23C + Demucs FT)" },
] as const;

export type DemucsModel = (typeof DEMUCS_MODELS)[number]["value"];

export function demucsLabel(value: string | null | undefined): string {
  const found = DEMUCS_MODELS.find((m) => m.value === value);
  return found ? found.label : value || "implicit";
}
