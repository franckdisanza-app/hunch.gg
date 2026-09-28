import type { ChoiceAnswer } from "./state";

// What a finished (or ongoing) choice game adds up to: the score for stats, the streak for
// unlimited runs and the emoji grid for the share text.

export interface ChoiceSummary {
  /** Right answers. */
  score: number;
  /** Rounds answered. */
  played: number;
  /** Right answers in a row, counting back from the latest answer. */
  streak: number;
  /** Longest run of right answers. */
  bestStreak: number;
  /** One emoji per answer, in order, e.g. "🟩🟩🟥🟩". */
  grid: string;
}

export interface GridSymbols {
  right: string;
  wrong: string;
}

export const DEFAULT_GRID: GridSymbols = { right: "🟩", wrong: "🟥" };

export function summarize(
  answers: readonly Pick<ChoiceAnswer, "correct">[],
  symbols: GridSymbols = DEFAULT_GRID,
): ChoiceSummary {
  let score = 0;
  let run = 0;
  let bestStreak = 0;
  for (const answer of answers) {
    if (answer.correct) {
      score++;
      run++;
      bestStreak = Math.max(bestStreak, run);
    } else {
      run = 0;
    }
  }
  return {
    score,
    played: answers.length,
    streak: run,
    bestStreak,
    grid: answers.map((a) => (a.correct ? symbols.right : symbols.wrong)).join(""),
  };
}
