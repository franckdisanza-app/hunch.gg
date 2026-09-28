import { keyToAction } from "./keyboard";
import {
  nextRound,
  pickOption,
  startChoice,
  type ChoiceConfig,
  type ChoiceRound,
  type ChoiceState,
} from "./state";
import { summarize } from "./summary";

// A fake game: each option is a number and the biggest one wins.
interface NumberRound extends ChoiceRound<number> {
  options: readonly number[];
}

const round = (id: string, ...options: number[]): NumberRound => ({ id, options });
const biggest = (r: NumberRound) => r.options.indexOf(Math.max(...r.options));

function listConfig(...rounds: NumberRound[]): ChoiceConfig<NumberRound> {
  return { source: { kind: "list", rounds }, correctIndex: biggest };
}

function play(config: ChoiceConfig<NumberRound>, picks: number[]): ChoiceState<NumberRound> {
  let state = startChoice(config);
  for (const pick of picks) {
    state = pickOption(state, config, pick);
    state = nextRound(state, config);
  }
  return state;
}

describe("choice engine: daily list", () => {
  const config = listConfig(round("r1", 1, 2), round("r2", 5, 3), round("r3", 7, 8, 9));

  it("starts on the first round", () => {
    const state = startChoice(config);
    expect(state).toMatchObject({ phase: "choosing", index: 0, total: 3, answers: [] });
    expect(state.round?.id).toBe("r1");
  });

  it("decides the right answer and reveals it", () => {
    const wrong = pickOption(startChoice(config), config, 0);
    expect(wrong.phase).toBe("revealed");
    expect(wrong.answer).toEqual({ roundId: "r1", picked: 0, right: 1, correct: false });
    const right = pickOption(startChoice(config), config, 1);
    expect(right.answer?.correct).toBe(true);
  });

  it("ignores a second pick, out-of-range picks and next() before a pick", () => {
    const start = startChoice(config);
    expect(pickOption(start, config, 5)).toBe(start);
    expect(pickOption(start, config, -1)).toBe(start);
    expect(nextRound(start, config)).toBe(start);
    const revealed = pickOption(start, config, 1);
    expect(pickOption(revealed, config, 0)).toBe(revealed);
  });

  it("plays every round in order and finishes after the last one", () => {
    const state = play(config, [1, 1, 2]);
    expect(state.phase).toBe("finished");
    expect(state.answers.map((a) => a.correct)).toEqual([true, false, true]);
    expect(state.round?.id).toBe("r3");
  });

  it("marks the last round so the game can label its Next button", () => {
    let state = play(config, [1, 1]);
    expect(state.isLast).toBe(false);
    state = pickOption(state, config, 0);
    expect(state.isLast).toBe(true);
  });

  it("supports three options", () => {
    const state = pickOption(play(config, [1, 1]), config, 0);
    expect(state.answer).toMatchObject({ picked: 0, right: 2, correct: false });
  });

  it("resumes from saved answers and recomputes correctness", () => {
    const state = startChoice(config, [
      { roundId: "r1", picked: 1 },
      { roundId: "r2", picked: 1 },
    ]);
    expect(state).toMatchObject({ phase: "choosing", index: 2 });
    expect(state.answers.map((a) => a.correct)).toEqual([true, false]);
  });

  it("drops saved answers from the first one that no longer matches", () => {
    const state = startChoice(config, [
      { roundId: "r1", picked: 0 },
      { roundId: "other", picked: 0 },
      { roundId: "r3", picked: 0 },
    ]);
    expect(state.answers).toHaveLength(1);
    expect(state.index).toBe(1);
    expect(startChoice(config, [{ roundId: "r1", picked: 7 }]).answers).toEqual([]);
  });

  it("starts finished when every round was already answered", () => {
    const state = startChoice(config, [
      { roundId: "r1", picked: 1 },
      { roundId: "r2", picked: 0 },
      { roundId: "r3", picked: 2 },
    ]);
    expect(state.phase).toBe("finished");
    expect(state.round?.id).toBe("r3");
    expect(summarize(state.answers).score).toBe(3);
  });

  it("rejects rounds with fewer than 2 or more than 3 options", () => {
    expect(() => startChoice(listConfig(round("one", 1)))).toThrow(/2 or 3/);
    expect(() => startChoice(listConfig(round("four", 1, 2, 3, 4)))).toThrow(/2 or 3/);
  });

  it("rejects a correctIndex outside the options", () => {
    const bad: ChoiceConfig<NumberRound> = {
      source: { kind: "list", rounds: [round("r", 1, 2)] },
      correctIndex: () => 2,
    };
    expect(() => startChoice(bad)).toThrow(/out of range/);
  });
});

describe("choice engine: unlimited generator", () => {
  function generator(endOnMiss: boolean, limit = Infinity): ChoiceConfig<NumberRound> {
    return {
      source: {
        kind: "generator",
        endOnMiss,
        // Round n offers [n, n + 1]: the second option is always right.
        next: (played) =>
          played.length >= limit
            ? null
            : round(`g${played.length}`, played.length, played.length + 1),
      },
      correctIndex: biggest,
    };
  }

  it("keeps going while the player is right", () => {
    const config = generator(true);
    const state = play(config, [1, 1, 1, 1, 1]);
    expect(state.phase).toBe("choosing");
    expect(state.total).toBeNull();
    expect(state.round?.id).toBe("g5");
    expect(summarize(state.answers).streak).toBe(5);
  });

  it("ends on the first miss", () => {
    const config = generator(true);
    let state = play(config, [1, 1]);
    state = pickOption(state, config, 0);
    expect(state.isLast).toBe(true);
    state = nextRound(state, config);
    expect(state.phase).toBe("finished");
    expect(summarize(state.answers)).toMatchObject({ score: 2, streak: 0, bestStreak: 2 });
  });

  it("can keep going after a miss", () => {
    const state = play(generator(false), [0, 1]);
    expect(state.phase).toBe("choosing");
    expect(state.answers).toHaveLength(2);
  });

  it("finishes when the generator runs dry", () => {
    expect(play(generator(true, 2), [1, 1]).phase).toBe("finished");
    expect(startChoice(generator(true, 0)).phase).toBe("finished");
  });

  it("never replays saved answers for a generator", () => {
    const state = startChoice(generator(true), [{ roundId: "g0", picked: 1 }]);
    expect(state.answers).toEqual([]);
  });
});

describe("summarize", () => {
  it("counts score, streaks and builds the grid", () => {
    const answers = [true, true, false, true, true, true, false, true].map((correct) => ({
      correct,
    }));
    expect(summarize(answers)).toEqual({
      score: 6,
      played: 8,
      streak: 1,
      bestStreak: 3,
      grid: "🟩🟩🟥🟩🟩🟩🟥🟩",
    });
  });

  it("takes other symbols", () => {
    expect(
      summarize([{ correct: true }, { correct: false }], { right: "✓", wrong: "✗" }).grid,
    ).toBe("✓✗");
  });

  it("handles no answers", () => {
    expect(summarize([])).toEqual({ score: 0, played: 0, streak: 0, bestStreak: 0, grid: "" });
  });
});

describe("keyToAction", () => {
  it("maps A/← and B/→ to the first and second option", () => {
    expect(keyToAction({ key: "a" }, "choosing", 2)).toEqual({ type: "pick", index: 0 });
    expect(keyToAction({ key: "A" }, "choosing", 2)).toEqual({ type: "pick", index: 0 });
    expect(keyToAction({ key: "ArrowLeft" }, "choosing", 2)).toEqual({ type: "pick", index: 0 });
    expect(keyToAction({ key: "b" }, "choosing", 2)).toEqual({ type: "pick", index: 1 });
    expect(keyToAction({ key: "ArrowRight" }, "choosing", 2)).toEqual({ type: "pick", index: 1 });
  });

  it("maps C only when there is a third option", () => {
    expect(keyToAction({ key: "c" }, "choosing", 2)).toBeNull();
    expect(keyToAction({ key: "c" }, "choosing", 3)).toEqual({ type: "pick", index: 2 });
  });

  it("maps Enter to next only after a reveal", () => {
    expect(keyToAction({ key: "Enter" }, "choosing", 2)).toBeNull();
    expect(keyToAction({ key: "Enter" }, "revealed", 2)).toEqual({ type: "next" });
    expect(keyToAction({ key: "a" }, "revealed", 2)).toBeNull();
    expect(keyToAction({ key: "Enter" }, "finished", 2)).toBeNull();
  });

  it("leaves shortcuts with modifiers to the browser", () => {
    expect(keyToAction({ key: "a", ctrlKey: true }, "choosing", 2)).toBeNull();
    expect(keyToAction({ key: "b", metaKey: true }, "choosing", 2)).toBeNull();
    expect(keyToAction({ key: "ArrowLeft", altKey: true }, "choosing", 2)).toBeNull();
  });
});
