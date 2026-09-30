import { MAX_DISTANCE_KM } from "./geo";
import { roundGeometry, type MapScoring } from "./scoring";
import {
  dropPin,
  nextRound,
  saveMap,
  startMap,
  summarizeMap,
  type MapConfig,
  type MapRound,
} from "./state";

const SCORING: MapScoring<"near" | "far"> = {
  maxPoints: 1000,
  decay: 0.075,
  perfect: 0.0025,
  minPerfectKm: 5,
  weights: [1, 0.5, 0.25],
  weightPerfect: false,
  bands: [
    { id: "near", maxFraction: 0.05 },
    { id: "far", maxFraction: Infinity },
  ],
};

const world = roundGeometry(MAX_DISTANCE_KM, SCORING);
const ROUNDS: MapRound[] = [
  { id: "one", targets: [{ lat: 0, lon: 0 }], ...world },
  // Two contenders: pins score against the nearer one.
  {
    id: "two",
    targets: [
      { lat: 10, lon: 10 },
      { lat: -10, lon: -10 },
    ],
    ...world,
  },
];
const CONFIG: MapConfig<MapRound, "near" | "far"> = { rounds: ROUNDS, scoring: SCORING };

describe("a round", () => {
  it("waits for pins, then solves on a perfect one", () => {
    let state = startMap(CONFIG);
    expect(state).toMatchObject({
      phase: "aiming",
      index: 0,
      total: 2,
      pinsLeft: 3,
      isLast: false,
    });

    state = dropPin(state, CONFIG, { lat: 0, lon: 20 });
    expect(state.phase).toBe("aiming");
    expect(state.pinsLeft).toBe(2);
    expect(state.pins[0]).toMatchObject({ attempt: 0, perfect: false, targetIndex: 0 });
    expect(state.pins[0]!.km).toBeCloseTo(20 * 111.195, 0);

    state = dropPin(state, CONFIG, { lat: 0, lon: 0.1 });
    expect(state.phase).toBe("revealed");
    expect(state.answer).toMatchObject({ roundId: "one", solved: true, score: 1000 });
    expect(state.answers).toHaveLength(1);

    // No more pins once revealed.
    expect(dropPin(state, CONFIG, { lat: 1, lon: 1 })).toBe(state);
  });

  it("ends after three misses with the best weighted pin", () => {
    let state = nextRound(dropPin(startMap(CONFIG), CONFIG, { lat: 0, lon: 0 }), CONFIG);
    expect(state).toMatchObject({ phase: "aiming", index: 1, isLast: true });

    state = dropPin(state, CONFIG, { lat: -9, lon: -9 });
    expect(state.pins[0]!.targetIndex).toBe(1);
    state = dropPin(state, CONFIG, { lat: 40, lon: 40 });
    state = dropPin(state, CONFIG, { lat: -60, lon: 100 });
    expect(state.phase).toBe("revealed");
    expect(state.answer!.solved).toBe(false);
    expect(state.answer!.pins).toHaveLength(3);
    expect(state.answer!.score).toBe(Math.max(...state.answer!.pins.map((p) => p.points)));
    expect(state.answer!.score).toBe(state.pins[0]!.points);

    state = nextRound(state, CONFIG);
    expect(state.phase).toBe("finished");
    expect(state.round?.id).toBe("two");
    expect(nextRound(state, CONFIG)).toBe(state);
  });

  it("ignores points that are not on the globe", () => {
    const state = startMap(CONFIG);
    expect(dropPin(state, CONFIG, { lat: Number.NaN, lon: 0 })).toBe(state);
    expect(dropPin(state, CONFIG, { lat: 91, lon: 0 })).toBe(state);
  });

  it("finishes at once without rounds", () => {
    expect(startMap({ rounds: [], scoring: SCORING })).toMatchObject({
      phase: "finished",
      round: null,
    });
  });
});

describe("saving and resuming", () => {
  it("resumes finished rounds and the pins of the current one", () => {
    let state = startMap(CONFIG);
    state = dropPin(state, CONFIG, { lat: 0, lon: 0.01 });
    state = nextRound(state, CONFIG);
    state = dropPin(state, CONFIG, { lat: 50, lon: 50 });
    const saved = saveMap(state);
    expect(saved).toEqual([
      { roundId: "one", pins: [[0, 0.01]] },
      { roundId: "two", pins: [[50, 50]] },
    ]);

    const resumed = startMap(CONFIG, saved);
    expect(resumed).toMatchObject({ phase: "aiming", index: 1, pinsLeft: 2 });
    expect(resumed.pins[0]!.point).toEqual({ lat: 50, lon: 50 });
    expect(resumed.answers).toHaveLength(1);
  });

  it("stops replaying at the first round or pin that no longer fits", () => {
    expect(startMap(CONFIG, [{ roundId: "other", pins: [[0, 0]] }]).answers).toHaveLength(0);
    const broken = startMap(CONFIG, [
      {
        roundId: "one",
        pins: [
          [40, 40],
          [Number.NaN, 0],
          [0, 0],
        ],
      },
    ]);
    expect(broken).toMatchObject({ phase: "aiming", index: 0, pinsLeft: 2 });
  });

  it("resumes a finished game as finished", () => {
    const all = [
      { roundId: "one", pins: [[0, 0]] as [number, number][] },
      { roundId: "two", pins: [[10, 10]] as [number, number][] },
    ];
    const state = startMap(CONFIG, all);
    expect(state.phase).toBe("finished");
    expect(summarizeMap(state.answers, SCORING, 2)).toEqual({
      score: 2000,
      max: 2000,
      solved: 2,
      pins: 2,
    });
  });
});
