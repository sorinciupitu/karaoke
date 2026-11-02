export interface TimedLine {
  start: number;
  end: number;
}

export function findActiveLineIndex(
  lines: TimedLine[],
  time: number,
): number {
  for (let i = 0; i < lines.length; i++) {
    if (time >= lines[i].start && time < lines[i].end) return i;
  }
  return -1;
}
