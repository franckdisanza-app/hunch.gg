import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as z from "zod/mini";
import { MAX_DISTANCE_KM } from "@/engines/map/geo";
import { HEAT, heatColor, roundFor } from "./config";
import {
  checkPing,
  dailyPuzzleSchema,
  dayProblems,
  questionProblems,
  questionsFileSchema,
  remoteClusters,
  type DailyPuzzle,
  type DailyQuestion,
  type Question,
} from "./content.schema";

// Fake questions only: example.test sources, made-up places.
function fakeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "fake-1",
    category: "heat",
    prompt: "Where is the fake hot spot?",
    teaser: "Where is the fake hot spot?",
    scope: { level: "world", name: "the world" },
    targets: [
      {
        lat: 10,
        lon: 20,
        label: "Fake Place",
        official: true,
        value: 1,
        unit: "fake units",
      },
    ],
    authority: "Fake Authority",
    turnsOut: "it is fake.",
    sourceTitle: "Fake Source",
    sourceUrl: "https://example.test/fake",
    checkedOn: "2026-09-01",
    licence: "Fake licence",
    sample: true,
    ...overrides,
  };
}

const onLand = (q: Question): DailyQuestion => ({ ...q, surface: "land" });

describe("questionProblems", () => {
  it("accepts a well-formed question", () => {
    expect(questionProblems(fakeQuestion())).toEqual([]);
  });

  it("checks the scope against the targets", () => {
    expect(
      questionProblems(fakeQuestion({ scope: { level: "world", name: "x", bbox: [0, 0, 1, 1] } })),
    ).toContain("a world scope takes no bbox");
    expect(questionProblems(fakeQuestion({ scope: { level: "country", name: "Fake" } }))).toContain(
      "a country scope needs a bbox",
    );
    expect(
      questionProblems(
        fakeQuestion({ scope: { level: "country", name: "Fake", bbox: [0, 0, 5, 5] } }),
      ),
    ).toContain("target 1 is outside the bbox");
    // A box across the antimeridian.
    expect(
      questionProblems(
        fakeQuestion({
          scope: { level: "region", name: "Fake", bbox: [170, 0, -170, 20] },
          targets: [
            { lat: 10, lon: -175, label: "Fake Place", official: true, value: 1, unit: "u" },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("needs an official target", () => {
    const [target] = fakeQuestion().targets;
    expect(
      questionProblems(fakeQuestion({ targets: [{ ...target!, official: false }] })),
    ).toContain("no target is marked official");
  });

  it("dates computed questions and keeps the others undated", () => {
    const computed = questionProblems(fakeQuestion({ category: "furthest-from" }));
    expect(computed).toContain("computed questions need computedOn");
    expect(computed).toContain("computed questions need nearest[]");
    expect(computed).toContain('computed questions say "as of <month year>" in the prompt');
    expect(questionProblems(fakeQuestion({ computedOn: "2026-09-01" }))).toContain(
      "only computed questions carry computedOn, dataAsOf or nearest[]",
    );
  });

  it("never lets a prompt or teaser give the answer away", () => {
    expect(questionProblems(fakeQuestion({ teaser: "Is it in fake place?" }))).toContain(
      'the teaser names an answer ("Fake Place")',
    );
  });
});

describe("mix rules", () => {
  it("allows one question of a category per day", () => {
    const day = {
      questions: [
        onLand(fakeQuestion({ id: "a" })),
        onLand(fakeQuestion({ id: "b" })),
        onLand(fakeQuestion({ id: "c", category: "rain" })),
      ],
    };
    expect(dayProblems(day)).toEqual(["two heat questions"]);
    expect(dayProblems({ questions: [day.questions[0]!, day.questions[0]!] })).toContain(
      "the same question twice",
    );
  });

  it("allows one ocean or Antarctica answer in any 7 days", () => {
    const day = (surface: "land" | "ocean" | "antarctica") => ({ questions: [{ surface }] });
    const spaced = new Map([
      [1, day("ocean")],
      [8, day("antarctica")],
      [9, day("land")],
    ]);
    expect(remoteClusters(spaced)).toEqual([]);
    const close = new Map([
      [1, day("ocean")],
      [7, day("antarctica")],
    ]);
    expect(remoteClusters(close)).toEqual([7]);
  });
});

describe("scoring geometry", () => {
  it("scores world questions on the whole globe", () => {
    const round = roundFor(fakeQuestion());
    expect(round.scopeKm).toBeCloseTo(MAX_DISTANCE_KM, 6);
    expect(round.perfectRadiusKm).toBeCloseTo(50, 0);
    expect(roundFor(fakeQuestion({ perfectRadiusKm: 12 })).perfectRadiusKm).toBe(12);
  });

  it("shrinks everything for a small scope", () => {
    const round = roundFor(
      fakeQuestion({ scope: { level: "country", name: "Fake", bbox: [18, 8, 22, 12] } }),
    );
    expect(round.scopeKm).toBeLessThan(700);
    expect(round.perfectRadiusKm).toBe(5);
  });

  it("colours rings from hot to cold", () => {
    expect(heatColor(0)).toBe(HEAT.hot);
    expect(heatColor(0.5)).toBe(HEAT.cold);
    expect(heatColor(2)).toBe(HEAT.cold);
  });
});

describe("the committed content", () => {
  const dir = join(process.cwd(), "content", "ping");
  const questions = z.parse(
    questionsFileSchema,
    JSON.parse(readFileSync(join(dir, "questions.json"), "utf8")),
  );
  const daily = new Map<number, DailyPuzzle>();
  for (const name of readdirSync(join(dir, "daily"))) {
    const day = z.parse(
      dailyPuzzleSchema,
      JSON.parse(readFileSync(join(dir, "daily", name), "utf8")),
    );
    daily.set(day.puzzle, day);
  }

  it("parses and follows every rule", () => {
    expect(questions.length).toBeGreaterThan(0);
    expect(daily.size).toBeGreaterThan(0);
    const result = checkPing({
      mode: "sample",
      files: { "questions.json": questions },
      daily,
      fileExists: () => true,
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("is still the fake sample set, with example.test sources", () => {
    for (const question of questions) {
      if (!question.sample) continue;
      expect(question.sourceUrl).toMatch(/^https:\/\/example\.test\//);
      expect(question.prompt).toMatch(/fake data/);
    }
  });
});
