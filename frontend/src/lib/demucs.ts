export const DEMUCS_MODELS = [
  { value: "htdemucs", label: "Demucs (original)" },
  { value: "htdemucs_ft", label: "Demucs FT (fine-tuned)" },
  { value: "mdx_extra_q", label: "MDX Extra (alternativ)" },
] as const;

export type DemucsModel = (typeof DEMUCS_MODELS)[number]["value"];

export function demucsLabel(value: string | null | undefined): string {
  const found = DEMUCS_MODELS.find((m) => m.value === value);
  return found ? found.label : value || "implicit";
}
