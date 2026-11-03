// Canonical Romanian note names in chromatic order, using flat spelling for the
// black keys (matching backend/app/pipeline/key_detect.py).
const NOTE_NAMES = [
  "Do", "Re bemol", "Re", "Mi bemol", "Mi", "Fa",
  "Sol bemol", "Sol", "La bemol", "La", "Si bemol", "Si",
];

// Maps every accepted spelling — full flat, abbreviated flat, and full sharp —
// to its chromatic index. Sharp spellings are kept so keys detected by older
// builds (which emitted sharps) still normalise correctly.
const NOTE_INDEX: Record<string, number> = {
  "Do": 0,
  "Do diez": 1,
  "Re bemol": 1,
  "Reb": 1,
  "Re": 2,
  "Re diez": 3,
  "Mi bemol": 3,
  "Mib": 3,
  "Mi": 4,
  "Fa": 5,
  "Fa diez": 6,
  "Sol bemol": 6,
  "Solb": 6,
  "Sol": 7,
  "Sol diez": 8,
  "La bemol": 8,
  "Lab": 8,
  "La": 9,
  "La diez": 10,
  "Si bemol": 10,
  "Sib": 10,
  "Si": 11,
};

/**
 * Transpose a detected musical key (e.g. "Do Major") by `semitones`, keeping
 * the mode. Returns the key in flat notation, normalising sharp/abbreviated
 * inputs. Returns null for a missing key, and leaves an unrecognised string
 * untouched.
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
  const idx = NOTE_INDEX[note];
  if (idx === undefined) return key;
  const newIdx = (((idx + semitones) % 12) + 12) % 12;
  return `${NOTE_NAMES[newIdx]} ${mode}`;
}
