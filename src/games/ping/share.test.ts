import { dropPin, nextRound, startMap, type MapAnswer } from "@/engines/map/state";
import { buildShareText } from "@/lib/share";
import { SCORING, roundFor, type Band } from "./config";
import type { Question } from "./content.schema";
import { dailyShare, pinSquares, practiceShare } from "./share";

// Fake questions: example.test sources, made-up places at simple coordinates.
function fake(id: string, category: Question["category"], lat: number, lon: number): Question {
  return {
    id,
    category,
    prompt: `Where is fake ${id}?`,
    teaser: `Where is fake spot ${id}?`,
    scope: { level: "world", name: "the world" },
    targets: [{ lat, lon, label: `Nowhere ${id}`, official: true, value: 1, unit: "u" }],
    authority: "Fake",
    turnsOut: "fake.",
    sourceTitle: "Fake",
    sourceUrl: "https://example.test/fake",
    checkedOn: "2026-09-01",
    licence: "Fake",
  };
}

const QUESTIONS = [
  fake("a", "heat", 0, 0),
  fake("b", "rain", 0, 60),
  { ...fake("c", "furthest-from", 0, 120), shareEmoji: "🍔" },
];

/** Plays the three questions with the given pins (lat, lon). */
function play(pins: [number, number][][]): MapAnswer<Band>[] {
  const config = { rounds: QUESTIONS.map(roundFor), scoring: SCORING };
  let state = startMap(config);
  for (const round of pins) {
    for (const [lat, lon] of round) state = dropPin(state, config, { lat, lon });
    state = nextRound(state, config);
  }
  return [...state.answers];
}

describe("share", () => {
  const answers = play([
    // A bullseye first time.
    [[0, 0.1]],
    // 30° off (≈3,300 km: orange), then 8° (≈890 km: green), then a bullseye.
    [
      [0, 30],
      [0, 52],
      [0, 60.2],
    ],
    // Three misses: far, farther, closer.
    [
      [0, -60],
      [60, 120],
      [0, 110],
    ],
  ]);

  it("draws one square per pin, bullseyes as targets", () => {
    expect(pinSquares(answers[0]!)).toBe("🎯");
    expect(pinSquares(answers[1]!)).toBe("🟧🟩🎯");
    expect(pinSquares(answers[2]!)).toMatch(/^[🟥🟧🟨🟩]{3}$/u);
  });

  it("builds the daily text with category emoji, the score and a teaser", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test");
    const text = buildShareText(dailyShare({ puzzle: 12, questions: QUESTIONS }, answers));
    const lines = text.split("\n");
    const score = answers.reduce((s, a) => s + a.score, 0);
    expect(lines[0]).toBe(`Ping #12 · ${score.toLocaleString("en-GB")}/3,000`);
    expect(lines[1]).toBe("🌡️ 🎯");
    expect(lines[2]).toBe("🌧️ 🟧🟩🎯");
    expect(lines[3]).toMatch(/^🍔 /u);
    // Puzzle 12: 12 % 3 = 0, the first question's teaser.
    expect(lines[4]).toBe("Where is fake spot a?");
    expect(lines[5]).toBe("https://example.test/ping?ref=share");
    expect(text).not.toMatch(/Nowhere/);
  });

  it("scores a bullseye 1,000 whichever pin it was", () => {
    expect(answers[0]!.score).toBe(1000);
    expect(answers[1]!.score).toBe(1000);
    expect(answers[2]!.score).toBeLessThan(1000);
  });

  it("shares a practice round in one line", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test");
    expect(buildShareText(practiceShare("2,140/3,000")).split("\n")).toEqual([
      "Ping Practice · 2,140/3,000",
      "https://example.test/ping?ref=share",
    ]);
  });
});
