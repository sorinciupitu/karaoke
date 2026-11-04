import type { Line } from "../api/tracks";

export function parseLyricsText(text: string): Line[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((t) => ({ text: t, start: 0, end: 0 }));
}

export function applyLineEdit(
  lines: Line[],
  index: number,
  patch: Partial<Line>,
): Line[] {
  return lines.map((l, i) => (i === index ? { ...l, ...patch } : l));
}

export function removeLine(lines: Line[], index: number): Line[] {
  return lines.filter((_, i) => i !== index);
}

export function nudgeLine(lines: Line[], index: number, delta: number): Line[] {
  return lines.map((l, i) =>
    i === index ? { ...l, start: l.start + delta, end: l.end + delta } : l,
  );
}
