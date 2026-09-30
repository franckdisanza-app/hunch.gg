import type { Category, Question, Surface } from "@/games/ping/content.schema";
import { planDays, weeklyReport, type PlanInput } from "./build";

// Fake questions: example.test sources, no real places.
function fake(id: string, category: Category): Question {
  return {
    id,
    category,
    prompt: `Fake question ${id}?`,
    teaser: `Fake question ${id}?`,
    scope: { level: "world", name: "the world" },
    targets: [{ lat: 0, lon: 0, label: `Fake ${id}`, official: true, value: 1, unit: "u" }],
    authority: "Fake",
    turnsOut: "fake.",
    sourceTitle: "Fake",
    sourceUrl: `https://example.test/${id}`,
    checkedOn: "2026-09-01",
    licence: "Fake",
    sample: true,
  };
}

const CATS: Category[] = ["heat", "cold", "rain", "wind", "geography", "furthest-from", "regional"];
// 28 questions, 4 per category; two answers at sea and one in Antarctica.
const QUESTIONS = Array.from({ length: 28 }, (_, i) => fake(`q${i + 1}`, CATS[i % 7]!));
const SURFACES = new Map<string, Surface>(
  QUESTIONS.map((q) => [
    q.id,
    q.id === "q2" || q.id === "q9" ? "ocean" : q.id === "q16" ? "antarctica" : "land",
  ]),
);
const byId = new Map(QUESTIONS.map((q) => [q.id, q]));

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    questions: QUESTIONS,
    surfaces: SURFACES,
    existing: new Map(),
    frozenThrough: 0,
    lastDay: 7,
    ...overrides,
  };
}

function checkRules(days: ReadonlyMap<number, readonly string[]>) {
  for (const [n, ids] of days) {
    expect(ids).toHaveLength(3);
    const categories = ids.map((id) => byId.get(id)!.category);
    expect(new Set(categories).size, `day ${n}`).toBe(3);
  }
  for (const n of days.keys()) {
    let remote = 0;
    for (let k = n; k < n + 7; k++) {
      remote += (days.get(k) ?? []).filter((id) => SURFACES.get(id) !== "land").length;
    }
    expect(remote, `7 days from ${n}`).toBeLessThanOrEqual(1);
  }
}

describe("planDays", () => {
  it("follows the mix rules and is reproducible", () => {
    const plan = planDays(input());
    expect(plan.errors).toEqual([]);
    expect(plan.days.size).toBe(7);
    checkRules(plan.days);
    expect(planDays(input()).days).toEqual(plan.days);
    expect(planDays(input({ seed: "another" })).days).not.toEqual(plan.days);
  });

  it("stops when fresh questions run out, unless asked to repeat", () => {
    const short = planDays(input({ lastDay: 30 }));
    expect(short.stopped?.day).toBeLessThanOrEqual(10);
    expect(short.stopped?.reason).toMatch(/out of fresh questions/);

    const long = planDays(input({ lastDay: 60, repeat: true }));
    expect(long.stopped).toBeUndefined();
    expect(long.days.size).toBe(60);
    checkRules(long.days);
  });

  it("keeps released days and plans the rest around them", () => {
    const kept = new Map([
      [1, ["q1", "q2", "q3"]],
      [2, ["q4", "q5", "q6"]],
    ]);
    const plan = planDays(input({ existing: kept, frozenThrough: 3 }));
    expect(plan.days.get(1)).toEqual(["q1", "q2", "q3"]);
    expect(plan.days.get(2)).toEqual(["q4", "q5", "q6"]);
    // Day 3 was released without a file: it is planned, never with a kept question.
    const used = new Set(["q1", "q2", "q3", "q4", "q5", "q6"]);
    expect(plan.days.get(3)!.some((id) => used.has(id))).toBe(false);
    checkRules(plan.days);
  });

  it("reports released days whose questions are gone", () => {
    const plan = planDays(
      input({ existing: new Map([[1, ["gone", "q1", "q2"]]]), frozenThrough: 1 }),
    );
    expect(plan.errors[0]).toMatch(/gone/);
  });

  it("does not depend on the order of questions.json", () => {
    const reversed = planDays(input({ questions: [...QUESTIONS].reverse() }));
    expect(reversed.days).toEqual(planDays(input()).days);
  });
});

describe("weeklyReport", () => {
  it("counts categories and remote answers per week", () => {
    const plan = planDays(input({ lastDay: 14, repeat: true }));
    const weeks = weeklyReport(plan.days, byId, SURFACES);
    expect(weeks).toHaveLength(2);
    const total = Object.values(weeks[0]!.categories).reduce((a, b) => a + b, 0);
    expect(total).toBe(21);
    expect(weeks[0]!.remote).toBeLessThanOrEqual(1);
  });
});
