// Scoring for map games, relative to the size of the area a round is about (its scope): a miss
// of 100 km is excellent on a world question and poor in a small country. Every number here is
// configured by the game; nothing is specific to any one game.
//
//   perfect radius  max(minPerfectKm, perfect × scopeKm), or the round's own radius
//   base(d)         maxPoints inside the perfect radius, else maxPoints · e^(−d / (decay × scopeKm))
//   pin points      base × the attempt's weight; a perfect pin scores maxPoints on any attempt
//                   unless weightPerfect is set
//   round score     the best pin
//   band            the first band whose maxFraction exceeds d / scopeKm (hot/cold words, squares)

export interface DistanceBand<Id extends string = string> {
  id: Id;
  /** The band holds misses up to this fraction of the scope size (use Infinity for the last). */
  maxFraction: number;
}

export interface MapScoring<Band extends string = string> {
  /** A perfect pin's points: the most a round can score. */
  maxPoints: number;
  /** Distance over which the score falls to 1/e (≈37%), as a fraction of the scope size. */
  decay: number;
  /** Default perfect radius, as a fraction of the scope size. */
  perfect: number;
  /** The smallest default perfect radius in km, however small the scope. */
  minPerfectKm: number;
  /** Weight of each attempt, first pin first. Its length is the number of pins per round. */
  weights: readonly number[];
  /** Weigh a perfect pin like any other (true), or give it maxPoints on any attempt (false). */
  weightPerfect: boolean;
  /** Nearest first; the last one should reach Infinity. */
  bands: readonly DistanceBand<Band>[];
}

/** The sizes a round is scored against. */
export interface RoundGeometry {
  /** How big the round's area is (see scopeSizeKm in geo.ts). */
  scopeKm: number;
  perfectRadiusKm: number;
}

export interface PinScore<Band extends string = string> {
  /** Points before the attempt weight. */
  base: number;
  weight: number;
  /** What the pin is worth: base × weight, or maxPoints for a perfect pin. */
  points: number;
  perfect: boolean;
  band: Band;
  /** 1 on a perfect pin, falling towards 0 with distance: for heat colours and sounds. */
  heat: number;
}

export function maxPins(scoring: MapScoring): number {
  return scoring.weights.length;
}

export function defaultPerfectRadiusKm(scopeKm: number, scoring: MapScoring): number {
  return Math.max(scoring.minPerfectKm, scopeKm * scoring.perfect);
}

/** A round's geometry: its scope size and its perfect radius (the round's own, or the default). */
export function roundGeometry(
  scopeKm: number,
  scoring: MapScoring,
  perfectRadiusKm?: number,
): RoundGeometry {
  return { scopeKm, perfectRadiusKm: perfectRadiusKm ?? defaultPerfectRadiusKm(scopeKm, scoring) };
}

export function isPerfect(km: number, geometry: RoundGeometry): boolean {
  return km <= geometry.perfectRadiusKm;
}

/** 1 inside the perfect radius, then e^(−d / decay distance). */
export function heat(km: number, geometry: RoundGeometry, scoring: MapScoring): number {
  if (isPerfect(km, geometry)) return 1;
  return Math.exp(-km / (scoring.decay * geometry.scopeKm));
}

export function baseScore(km: number, geometry: RoundGeometry, scoring: MapScoring): number {
  if (isPerfect(km, geometry)) return scoring.maxPoints;
  // Only a perfect pin earns the maximum, however close a miss rounds.
  return Math.min(
    scoring.maxPoints - 1,
    Math.round(scoring.maxPoints * heat(km, geometry, scoring)),
  );
}

export function bandFor<Band extends string>(
  km: number,
  geometry: RoundGeometry,
  scoring: MapScoring<Band>,
): Band {
  const fraction = km / geometry.scopeKm;
  const band = scoring.bands.find((b) => fraction < b.maxFraction) ?? scoring.bands.at(-1);
  if (!band) throw new Error("MapScoring needs at least one band.");
  return band.id;
}

/** What a pin `km` from the nearest target is worth on attempt `attempt` (0-based). */
export function scorePin<Band extends string>(
  km: number,
  attempt: number,
  geometry: RoundGeometry,
  scoring: MapScoring<Band>,
): PinScore<Band> {
  const weight = scoring.weights[attempt] ?? 0;
  const base = baseScore(km, geometry, scoring);
  const perfect = isPerfect(km, geometry);
  return {
    base,
    weight,
    points: perfect && !scoring.weightPerfect ? scoring.maxPoints : Math.round(base * weight),
    perfect,
    band: bandFor(km, geometry, scoring),
    heat: heat(km, geometry, scoring),
  };
}

/** A round's score: its best pin (0 without pins). */
export function roundScore(pins: readonly Pick<PinScore, "points">[]): number {
  return pins.reduce((best, pin) => Math.max(best, pin.points), 0);
}
