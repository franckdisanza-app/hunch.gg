// The logic behind `pnpm sticker-shock:accuracy`: the share of players who got each daily pair
// right, with flags for pairs that look too easy or wrong.

export interface AccuracyRow {
  puzzle: number;
  pair_id: string;
  n: number;
  share_correct: number;
}

export interface AccuracyOptions {
  /** Only flag pairs with at least this many answers. */
  minAnswers: number;
  /** Above this share, the pair is too easy. */
  tooEasy: number;
  /** Below this share, the data is probably wrong (or the pair is a trick). */
  suspicious: number;
}

export const DEFAULT_ACCURACY: AccuracyOptions = {
  minAnswers: 30,
  tooEasy: 0.85,
  suspicious: 0.15,
};

export type AccuracyFlag = "too easy" | "check the data" | null;

export function flagFor(row: AccuracyRow, options = DEFAULT_ACCURACY): AccuracyFlag {
  if (row.n < options.minAnswers) return null;
  if (row.share_correct > options.tooEasy) return "too easy";
  if (row.share_correct < options.suspicious) return "check the data";
  return null;
}

/** A text table, flagged pairs first, then the rest by puzzle and pair. */
export function accuracyReport(
  rows: readonly AccuracyRow[],
  labels: ReadonlyMap<string, string>,
  options = DEFAULT_ACCURACY,
): string {
  const flagged = rows.filter((r) => flagFor(r, options));
  const sorted = [...rows].sort((a, b) =>
    a.puzzle !== b.puzzle ? a.puzzle - b.puzzle : a.pair_id.localeCompare(b.pair_id),
  );
  const line = (r: AccuracyRow) => {
    const pct = `${Math.round(r.share_correct * 100)}%`.padStart(5);
    const flag = flagFor(r, options);
    return `${r.pair_id.padEnd(10)} ${String(r.n).padStart(6)} ${pct}  ${flag ? `[${flag}] ` : ""}${labels.get(r.pair_id) ?? ""}`;
  };
  const answers = rows.reduce((sum, r) => sum + r.n, 0);
  return [
    `${rows.length} pairs, ${answers} answers. Flags need at least ${options.minAnswers} answers: ` +
      `above ${Math.round(options.tooEasy * 100)}% is too easy, below ${Math.round(options.suspicious * 100)}% needs a data check.`,
    "",
    flagged.length ? `Flagged (${flagged.length}):` : "No pair is flagged.",
    ...flagged.map(line),
    "",
    "pair            n  right  label",
    ...sorted.map(line),
  ].join("\n");
}
