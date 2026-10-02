import { clampLat, nearestTarget, normalizeLon, rhumbBearing, type GeoPoint } from "./geo";
import {
  maxPins,
  roundScore,
  scorePin,
  type MapScoring,
  type PinScore,
  type RoundGeometry,
} from "./scoring";

// The map engine's rules, as pure functions: a round asks where something is, the player drops
// up to maxPins pins, each scored against the nearest target; a pin inside the perfect radius
// solves the round at once. Nothing here knows what the targets are (records, word origins):
// games supply rounds and scoring.

export interface MapRound extends RoundGeometry {
  /** Stable ID, e.g. a question ID. Saved with answers and used for crowd data. */
  id: string;
  /** Where the answer is: one place, or every serious contender (pins score against the nearest). */
  targets: readonly GeoPoint[];
}

export interface MapPin<Band extends string = string> extends PinScore<Band> {
  point: GeoPoint;
  /** Great-circle distance to the nearest target, km. */
  km: number;
  /** Index of the nearest target in `round.targets`. */
  targetIndex: number;
  /** Map direction from the pin to that target: compass degrees along a rhumb line (geo.ts). */
  bearing: number;
  /** 0-based: the first pin is attempt 0. */
  attempt: number;
}

export interface MapAnswer<Band extends string = string> {
  roundId: string;
  pins: readonly MapPin<Band>[];
  /** A pin landed inside the perfect radius. */
  solved: boolean;
  /** The best pin's points. */
  score: number;
}

/** What is needed to replay a round: its pins as [lat, lon]; the rest is recomputed. */
export interface SavedMapAnswer {
  roundId: string;
  pins: readonly (readonly [number, number])[];
}

export interface MapConfig<R extends MapRound, Band extends string = string> {
  rounds: readonly R[];
  scoring: MapScoring<Band>;
}

/**
 * aiming: the current round waits for pins.
 * revealed: the round is over (solved, or out of pins) and the answer is shown; nextRound() moves on.
 * finished: every round is played.
 */
export type MapPhase = "aiming" | "revealed" | "finished";

export interface MapState<R extends MapRound, Band extends string = string> {
  phase: MapPhase;
  /** The round on screen; the last one once finished. Null only when there are no rounds. */
  round: R | null;
  /** 0-based index of `round`. */
  index: number;
  total: number;
  /** The current round's pins, in order. */
  pins: readonly MapPin<Band>[];
  /** Every finished round, including the current one once revealed. */
  answers: readonly MapAnswer<Band>[];
  /** The current round's answer, once revealed. */
  answer: MapAnswer<Band> | null;
  pinsLeft: number;
  /** The current round is the last one. */
  isLast: boolean;
}

export function isValidPoint(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    Math.abs(point.lon) <= 540
  );
}

/** Scores a pin at `point` as attempt `attempt` of `round`. */
export function placePin<R extends MapRound, Band extends string>(
  round: R,
  attempt: number,
  point: GeoPoint,
  scoring: MapScoring<Band>,
): MapPin<Band> {
  const at = { lat: clampLat(point.lat), lon: normalizeLon(point.lon) };
  const nearest = nearestTarget(at, round.targets);
  return {
    ...scorePin(nearest.km, attempt, round, scoring),
    point: at,
    km: nearest.km,
    targetIndex: nearest.index,
    bearing: rhumbBearing(at, round.targets[nearest.index]!),
    attempt,
  };
}

function aimingAt<R extends MapRound, Band extends string>(
  config: MapConfig<R, Band>,
  index: number,
  answers: readonly MapAnswer<Band>[],
): MapState<R, Band> {
  const total = config.rounds.length;
  const round = config.rounds[index];
  if (!round) {
    return {
      phase: "finished",
      round: config.rounds[index - 1] ?? null,
      index: Math.max(0, index - 1),
      total,
      pins: answers.at(-1)?.pins ?? [],
      answers,
      answer: answers.at(-1) ?? null,
      pinsLeft: 0,
      isLast: true,
    };
  }
  return {
    phase: "aiming",
    round,
    index,
    total,
    pins: [],
    answers,
    answer: null,
    pinsLeft: maxPins(config.scoring),
    isLast: index === total - 1,
  };
}

/** The player drops a pin. Ignored unless a round is waiting for one. */
export function dropPin<R extends MapRound, Band extends string>(
  state: MapState<R, Band>,
  config: MapConfig<R, Band>,
  point: GeoPoint,
): MapState<R, Band> {
  const { round } = state;
  if (state.phase !== "aiming" || !round || !isValidPoint(point)) return state;
  const pin = placePin(round, state.pins.length, point, config.scoring);
  const pins = [...state.pins, pin];
  const pinsLeft = Math.max(0, maxPins(config.scoring) - pins.length);
  if (!pin.perfect && pinsLeft > 0) return { ...state, pins, pinsLeft };
  const answer: MapAnswer<Band> = {
    roundId: round.id,
    pins,
    solved: pin.perfect,
    score: roundScore(pins),
  };
  return {
    ...state,
    phase: "revealed",
    pins,
    pinsLeft: 0,
    answer,
    answers: [...state.answers, answer],
  };
}

/** Moves on after a reveal: the next round, or finished after the last. */
export function nextRound<R extends MapRound, Band extends string>(
  state: MapState<R, Band>,
  config: MapConfig<R, Band>,
): MapState<R, Band> {
  if (state.phase !== "revealed") return state;
  return aimingAt(config, state.index + 1, state.answers);
}

/**
 * Starts a game. `restore` replays saved pins (a daily resumed after a reload): finished rounds
 * are skipped past, and a round with pins but no reveal carries on where it was. Replay stops at
 * the first round or pin that no longer fits.
 */
export function startMap<R extends MapRound, Band extends string>(
  config: MapConfig<R, Band>,
  restore: readonly SavedMapAnswer[] = [],
): MapState<R, Band> {
  let state = aimingAt(config, 0, []);
  for (const saved of restore) {
    if (state.phase !== "aiming" || state.round?.id !== saved.roundId) break;
    for (const [lat, lon] of saved.pins) {
      const point = { lat, lon };
      if (state.phase !== "aiming" || !isValidPoint(point)) break;
      state = dropPin(state, config, point);
    }
    if (state.phase !== "revealed") break;
    state = nextRound(state, config);
  }
  return state;
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Everything needed to resume: finished rounds and the current round's pins (about 1 m precise). */
export function saveMap<R extends MapRound, Band extends string>(
  state: MapState<R, Band>,
): SavedMapAnswer[] {
  const saved: SavedMapAnswer[] = state.answers.map((answer) => ({
    roundId: answer.roundId,
    pins: answer.pins.map((pin) => [round5(pin.point.lat), round5(pin.point.lon)] as const),
  }));
  if (state.phase === "aiming" && state.round && state.pins.length > 0) {
    saved.push({
      roundId: state.round.id,
      pins: state.pins.map((pin) => [round5(pin.point.lat), round5(pin.point.lon)] as const),
    });
  }
  return saved;
}

export interface MapSummary {
  /** Sum of the rounds' scores. */
  score: number;
  /** The most the rounds could have scored. */
  max: number;
  /** Rounds solved with a perfect pin. */
  solved: number;
  /** Pins used in all. */
  pins: number;
}

export function summarizeMap(
  answers: readonly MapAnswer[],
  scoring: Pick<MapScoring, "maxPoints">,
  rounds = answers.length,
): MapSummary {
  return {
    score: answers.reduce((sum, a) => sum + a.score, 0),
    max: rounds * scoring.maxPoints,
    solved: answers.filter((a) => a.solved).length,
    pins: answers.reduce((sum, a) => sum + a.pins.length, 0),
  };
}
