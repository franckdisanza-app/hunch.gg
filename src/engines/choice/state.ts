// The choice engine's rules, as pure functions: a round offers 2 or 3 options, the player picks
// one, the game says which one was right. Daily mode plays a fixed list of rounds; unlimited mode
// asks a generator for the next round and can end on the first miss. Nothing here knows what the
// options are (prices, words, emissions): games supply the rounds and `correctIndex`.

export interface ChoiceRound<Option = unknown> {
  /** Stable ID, e.g. a pair ID. Saved with answers and used for crowd data. */
  id: string;
  /** 2 or 3 options, in display order. */
  options: readonly Option[];
}

export interface ChoiceAnswer {
  roundId: string;
  /** Index of the option the player picked. */
  picked: number;
  /** Index of the right option. */
  right: number;
  correct: boolean;
}

/** What is needed to replay an answer: the rest is recomputed from the rounds. */
export type SavedChoiceAnswer = Pick<ChoiceAnswer, "roundId" | "picked">;

export type ChoiceSource<R extends ChoiceRound> =
  | { kind: "list"; rounds: readonly R[] }
  | {
      kind: "generator";
      /** The next round, or null when there is nothing left to play. */
      next(played: readonly ChoiceAnswer[]): R | null;
      /** End the run at the first wrong answer (an "until you miss" mode). */
      endOnMiss: boolean;
    };

export interface ChoiceConfig<R extends ChoiceRound> {
  source: ChoiceSource<R>;
  /** Index of the right option in `round.options`. */
  correctIndex(round: R): number;
}

/**
 * choosing: the current round waits for a pick.
 * revealed: the pick is in and the answer is shown; `next()` moves on.
 * finished: no more rounds (list done, generator empty, or a miss with endOnMiss).
 */
export type ChoicePhase = "choosing" | "revealed" | "finished";

export interface ChoiceState<R extends ChoiceRound> {
  phase: ChoicePhase;
  /** The round on screen; the last one played once finished. Null only if there was none. */
  round: R | null;
  /** 0-based index of `round`. */
  index: number;
  /** Number of rounds in a list; null for a generator. */
  total: number | null;
  answers: readonly ChoiceAnswer[];
  /** Answer to the current round, once revealed. */
  answer: ChoiceAnswer | null;
  /** True when the revealed round is the last one (next() finishes). */
  isLast: boolean;
}

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 3;

function checkRound<R extends ChoiceRound>(round: R, config: ChoiceConfig<R>): R {
  const n = round.options.length;
  if (n < MIN_OPTIONS || n > MAX_OPTIONS) {
    throw new Error(`Round ${round.id} has ${n} options; the choice engine takes 2 or 3.`);
  }
  const correct = config.correctIndex(round);
  if (!Number.isInteger(correct) || correct < 0 || correct >= n) {
    throw new Error(`Round ${round.id}: correctIndex ${correct} is out of range.`);
  }
  return round;
}

function roundAt<R extends ChoiceRound>(
  config: ChoiceConfig<R>,
  index: number,
  answers: readonly ChoiceAnswer[],
): R | null {
  const { source } = config;
  const round = source.kind === "list" ? (source.rounds[index] ?? null) : source.next(answers);
  return round ? checkRound(round, config) : null;
}

function finished<R extends ChoiceRound>(
  round: R | null,
  index: number,
  total: number | null,
  answers: readonly ChoiceAnswer[],
): ChoiceState<R> {
  return {
    phase: "finished",
    round,
    index,
    total,
    answers,
    answer: answers[answers.length - 1] ?? null,
    isLast: true,
  };
}

/**
 * Starts a game. `restore` replays saved answers (a daily puzzle resumed after a reload); answers
 * that no longer match the rounds are dropped from the first mismatch on.
 */
export function startChoice<R extends ChoiceRound>(
  config: ChoiceConfig<R>,
  restore: readonly SavedChoiceAnswer[] = [],
): ChoiceState<R> {
  const total = config.source.kind === "list" ? config.source.rounds.length : null;
  const answers: ChoiceAnswer[] = [];

  // Only a list can be replayed: a generator's rounds are not reproducible.
  if (config.source.kind === "list") {
    for (const saved of restore) {
      const round = roundAt(config, answers.length, answers);
      if (!round || round.id !== saved.roundId) break;
      if (!Number.isInteger(saved.picked) || saved.picked < 0) break;
      if (saved.picked >= round.options.length) break;
      const right = config.correctIndex(round);
      answers.push({
        roundId: round.id,
        picked: saved.picked,
        right,
        correct: saved.picked === right,
      });
    }
  }

  const index = answers.length;
  const round = roundAt(config, index, answers);
  if (!round) {
    const last = config.source.kind === "list" ? (config.source.rounds[index - 1] ?? null) : null;
    return finished(last ? checkRound(last, config) : null, Math.max(0, index - 1), total, answers);
  }
  return { phase: "choosing", round, index, total, answers, answer: null, isLast: false };
}

/** The player picks option `picked`. Ignored unless a round is waiting for a pick. */
export function pickOption<R extends ChoiceRound>(
  state: ChoiceState<R>,
  config: ChoiceConfig<R>,
  picked: number,
): ChoiceState<R> {
  const { round } = state;
  if (state.phase !== "choosing" || !round) return state;
  if (!Number.isInteger(picked) || picked < 0 || picked >= round.options.length) return state;

  const right = config.correctIndex(round);
  const answer: ChoiceAnswer = { roundId: round.id, picked, right, correct: picked === right };
  const answers = [...state.answers, answer];
  const { source } = config;
  const isLast =
    source.kind === "list"
      ? answers.length >= source.rounds.length
      : source.endOnMiss && !answer.correct;
  return { ...state, phase: "revealed", answers, answer, isLast };
}

/** Moves on from a revealed round: the next round, or finished. */
export function nextRound<R extends ChoiceRound>(
  state: ChoiceState<R>,
  config: ChoiceConfig<R>,
): ChoiceState<R> {
  if (state.phase !== "revealed") return state;
  if (state.isLast) return finished(state.round, state.index, state.total, state.answers);
  const index = state.index + 1;
  const round = roundAt(config, index, state.answers);
  if (!round) return finished(state.round, state.index, state.total, state.answers);
  return { ...state, phase: "choosing", round, index, answer: null, isLast: false };
}
