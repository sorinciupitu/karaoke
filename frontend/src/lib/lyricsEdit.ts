import type { Line } from "../api/tracks";

export function parseLyricsText(text: string, existing: Line[] = []): Line[] {
  const texts = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const preserve = texts.length === existing.length && existing.length > 0;
  return texts.map((t, i) => ({
    text: t,
    start: preserve ? existing[i].start : 0,
    end: preserve ? existing[i].end : 0,
  }));
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
