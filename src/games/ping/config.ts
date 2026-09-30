import { roundGeometry, type MapScoring } from "@/engines/map/scoring";
import { scopeSizeKm } from "@/engines/map/geo";
import type { MapRound } from "@/engines/map/state";
import type { Category, Question } from "./content.schema";
import { HEAT } from "./palette";

export { HEAT };

// Ping's tuning, in one place: change these after playtesting.
//
// Every distance is measured against the size of the question's scope (the widest distance across
// it; the whole world is 20,015 km). On a world question the numbers below mean: a 50 km perfect
// radius, and a score that falls to 37% at 1,500 km. On a question about a country 400 km across,
// the same miss ratios apply: a perfect radius of 5 km (the floor) and 37% at 30 km.

export const BANDS = ["burning", "hot", "warm", "cold", "freezing"] as const;
export type Band = (typeof BANDS)[number];

export const SCORING: MapScoring<Band> = {
  maxPoints: 1000,
  // 1,500 km on a world question.
  decay: 0.075,
  // 50 km on a world question.
  perfect: 0.0025,
  minPerfectKm: 5,
  // The first pin, the hunch, counts most.
  weights: [1, 0.5, 0.25],
  // A perfect pin scores 1,000 on any attempt.
  weightPerfect: false,
  // On a world question: under ~1,000 km, ~3,000 km, ~6,000 km, ~10,000 km, farther.
  bands: [
    { id: "burning", maxFraction: 0.05 },
    { id: "hot", maxFraction: 0.15 },
    { id: "warm", maxFraction: 0.3 },
    { id: "cold", maxFraction: 0.5 },
    { id: "freezing", maxFraction: Infinity },
  ],
};

export const PINS_PER_QUESTION = SCORING.weights.length;
export const DAILY_MAX = 3 * SCORING.maxPoints;

/** Share squares: a target for a perfect pin, then green to red by band. */
export const SQUARES: Record<Band | "perfect", string> = {
  perfect: "🎯",
  burning: "🟩",
  hot: "🟨",
  warm: "🟧",
  cold: "🟥",
  freezing: "🟥",
};

/** The emoji that starts a question's line in the share text (a question may override it). */
export const CATEGORY_EMOJI: Record<Category, string> = {
  heat: "🌡️",
  cold: "🧊",
  rain: "🌧️",
  wind: "🌬️",
  geography: "⛰️",
  "furthest-from": "📍",
  regional: "🚩",
};

function mix(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t));
  return `#${out
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

/**
 * A ring's colour for a miss of `fraction` of the scope: hot up close, cold far away, on a log
 * scale so near misses still tell apart (5% of the scope is already past mild).
 */
export function heatColor(fraction: number): string {
  const t = 1 - Math.min(1, Math.log1p(Math.max(0, fraction) / 0.01) / Math.log1p(0.5 / 0.01));
  return t < 0.5 ? mix(HEAT.cold, HEAT.mild, t * 2) : mix(HEAT.mild, HEAT.hot, (t - 0.5) * 2);
}

/** Timing of the ping and the reveal (ms); all 0 under reduced motion. */
export const TIMING = {
  /** From the drop to the ring freezing (the engine's ring growth). */
  ring: 1100,
  /** After a solved or final pin, before the reveal starts. */
  beforeReveal: 700,
} as const;

/** The preference key for the distance unit (km or mi) in plimp:v1:meta prefs. */
export const UNIT_PREF = "distanceUnit";

/** A question as a map-engine round: its targets, scope size and perfect radius. */
export function roundFor(
  question: Pick<Question, "id" | "targets" | "scope" | "perfectRadiusKm">,
): MapRound {
  return {
    id: question.id,
    targets: question.targets.map(({ lat, lon }) => ({ lat, lon })),
    ...roundGeometry(scopeSizeKm(question.scope.bbox), SCORING, question.perfectRadiusKm),
  };
}
