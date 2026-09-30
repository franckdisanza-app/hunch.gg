import { MAX_DISTANCE_KM } from "./geo";
import {
  bandFor,
  baseScore,
  defaultPerfectRadiusKm,
  heat,
  maxPins,
  roundGeometry,
  roundScore,
  scorePin,
  type MapScoring,
} from "./scoring";

// A test configuration, not any game's: world numbers of 1,500 km decay and a 50 km perfect radius.
const SCORING: MapScoring<"near" | "mid" | "far"> = {
  maxPoints: 1000,
  decay: 0.075,
  perfect: 0.0025,
  minPerfectKm: 5,
  weights: [1, 0.5, 0.25],
  weightPerfect: false,
  bands: [
    { id: "near", maxFraction: 0.05 },
    { id: "mid", maxFraction: 0.3 },
    { id: "far", maxFraction: Infinity },
  ],
};

const WORLD = roundGeometry(MAX_DISTANCE_KM, SCORING);
const DECAY_KM = SCORING.decay * MAX_DISTANCE_KM; // ≈ 1,501 km

describe("geometry", () => {
  it("derives the perfect radius from the scope, with a floor and an override", () => {
    expect(WORLD.perfectRadiusKm).toBeCloseTo(50.04, 2);
    expect(defaultPerfectRadiusKm(400, SCORING)).toBe(5);
    expect(roundGeometry(400, SCORING, 12).perfectRadiusKm).toBe(12);
    expect(maxPins(SCORING)).toBe(3);
  });
});

describe("baseScore", () => {
  it("gives the maximum inside the perfect radius", () => {
    expect(baseScore(0, WORLD, SCORING)).toBe(1000);
    expect(baseScore(50, WORLD, SCORING)).toBe(1000);
  });

  it("falls off exponentially outside it", () => {
    expect(baseScore(51, WORLD, SCORING)).toBe(Math.round(1000 * Math.exp(-51 / DECAY_KM)));
    expect(baseScore(DECAY_KM, WORLD, SCORING)).toBe(368);
    expect(baseScore(MAX_DISTANCE_KM, WORLD, SCORING)).toBe(0);
  });

  it("never gives a miss the maximum", () => {
    const tiny = { scopeKm: MAX_DISTANCE_KM, perfectRadiusKm: 0.001 };
    expect(baseScore(0.01, tiny, SCORING)).toBe(999);
  });

  it("measures misses against the scope", () => {
    const country = roundGeometry(400, SCORING);
    expect(baseScore(100, country, SCORING)).toBeLessThan(50);
    expect(baseScore(100, WORLD, SCORING)).toBeGreaterThan(900);
  });
});

describe("heat and bands", () => {
  it("heats up towards the target", () => {
    expect(heat(10, WORLD, SCORING)).toBe(1);
    expect(heat(500, WORLD, SCORING)).toBeGreaterThan(heat(5000, WORLD, SCORING));
  });

  it("bands by fraction of the scope", () => {
    expect(bandFor(0.049 * MAX_DISTANCE_KM, WORLD, SCORING)).toBe("near");
    expect(bandFor(0.051 * MAX_DISTANCE_KM, WORLD, SCORING)).toBe("mid");
    expect(bandFor(MAX_DISTANCE_KM, WORLD, SCORING)).toBe("far");
    // 100 km is near on the world and far in a 150 km scope.
    expect(bandFor(100, roundGeometry(150, SCORING), SCORING)).toBe("far");
  });
});

describe("scorePin", () => {
  it("weights misses by attempt", () => {
    const base = baseScore(1000, WORLD, SCORING);
    expect(scorePin(1000, 0, WORLD, SCORING).points).toBe(base);
    expect(scorePin(1000, 1, WORLD, SCORING).points).toBe(Math.round(base * 0.5));
    expect(scorePin(1000, 2, WORLD, SCORING).points).toBe(Math.round(base * 0.25));
    expect(scorePin(1000, 3, WORLD, SCORING).points).toBe(0);
  });

  it("gives a perfect pin the maximum on any attempt", () => {
    const pin = scorePin(20, 2, WORLD, SCORING);
    expect(pin).toMatchObject({ perfect: true, points: 1000, base: 1000, weight: 0.25, heat: 1 });
    expect(scorePin(20, 2, WORLD, { ...SCORING, weightPerfect: true }).points).toBe(250);
  });

  it("scores a round by its best pin", () => {
    expect(roundScore([])).toBe(0);
    expect(roundScore([{ points: 120 }, { points: 480 }, { points: 300 }])).toBe(480);
  });
});
