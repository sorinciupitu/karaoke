export function reorderIds<T>(ids: T[], from: number, to: number): T[] {
  const out = [...ids];
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}
