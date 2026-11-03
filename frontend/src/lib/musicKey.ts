// Romanian note names, in chromatic (sharp) order, matching the backend's
// key detection (backend/app/pipeline/key_detect.py).
const NOTE_NAMES = [
  "Do", "Do diez", "Re", "Re diez", "Mi", "Fa",
  "Fa diez", "Sol", "Sol diez", "La", "La diez", "Si",
];

/**
 * Transpose a detected musical key (e.g. "Do Major") by `semitones`,
 * keeping the mode. Returns null for a missing key, and leaves an
 * unrecognised string untouched.
 */
export function transposeKey(
  key: string | null | undefined,
  semitones: number,
): string | null {
  if (!key) return null;
  const tokens = key.trim().split(/\s+/);
  if (tokens.length < 2) return key;
  const mode = tokens[tokens.length - 1];
  const note = tokens.slice(0, -1).join(" ");
  const idx = NOTE_NAMES.indexOf(note);
  if (idx === -1) return key;
  const newIdx = (((idx + semitones) % 12) + 12) % 12;
  return `${NOTE_NAMES[newIdx]} ${mode}`;
}
