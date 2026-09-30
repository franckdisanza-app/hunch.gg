// The logic behind `pnpm ping:difficulty`: the median first-pin distance per question, from the
// crowd guesses (each daily question posts the first pin's distance in km).

export interface GuessRow {
  puzzle: number;
  item_id: string;
  value: number;
}

export interface Difficulty {
  itemId: string;
  puzzles: number[];
  n: number;
  medianKm: number;
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** One row per question, hardest (largest median) first. Questions under `minGuesses` are left out. */
export function difficulty(rows: readonly GuessRow[], minGuesses = 1): Difficulty[] {
  const byItem = new Map<string, { puzzles: Set<number>; values: number[] }>();
  for (const row of rows) {
    const entry = byItem.get(row.item_id) ?? { puzzles: new Set(), values: [] };
    entry.puzzles.add(row.puzzle);
    entry.values.push(row.value);
    byItem.set(row.item_id, entry);
  }
  return [...byItem]
    .filter(([, e]) => e.values.length >= minGuesses)
    .map(([itemId, e]) => ({
      itemId,
      puzzles: [...e.puzzles].sort((a, b) => a - b),
      n: e.values.length,
      medianKm: median(e.values),
    }))
    .sort((a, b) => b.medianKm - a.medianKm);
}

export function formatDifficulty(
  rows: readonly Difficulty[],
  labels: ReadonlyMap<string, string>,
): string {
  if (rows.length === 0) return "No guesses yet.";
  const lines = ["Median first pin   Guesses  Question"];
  for (const row of rows) {
    const km = `${Math.round(row.medianKm).toLocaleString("en-GB")} km`.padStart(16);
    const label = labels.get(row.itemId) ?? row.itemId;
    lines.push(`${km}   ${String(row.n).padStart(7)}  ${label} (#${row.puzzles.join(", #")})`);
  }
  return lines.join("\n");
}
