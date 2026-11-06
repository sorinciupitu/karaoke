import type { Line } from "../api/tracks";

export function parseLyricsText(
  text: string,
  existing: Line[] = [],
  duration?: number | null,
): Line[] {
  const texts = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (texts.length === 0) return [];

  const preserve = texts.length === existing.length && existing.length > 0;
  if (preserve) {
    return texts.map((t, i) => ({
      text: t,
      start: existing[i].start,
      end: existing[i].end,
    }));
  }

  // No timings to preserve: spread the lines evenly across the track so they
  // are immediately playable (never all "0.0"). The Whisper re-sync refines
  // them when a vocals stem exists.
  const n = texts.length;
  const total = duration && duration > 0 ? duration : n * 4;
  const step = total / n;
  return texts.map((t, i) => {
    const start = i * step;
    const end = Math.max(start + 0.5, Math.min(total, (i + 1) * step));
    return { text: t, start: +start.toFixed(2), end: +end.toFixed(2) };
  });
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
