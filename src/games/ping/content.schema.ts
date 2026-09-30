import * as z from "zod/mini";
import { inBBox } from "@/engines/map/geo";
import {
  defineContentSpec,
  factSchema,
  isoDate,
  type ContentCheckContext,
  type ContentCheckResult,
} from "@/games/content";

// The shape of content/ping/. zod/mini, so the browser can parse a day's questions cheaply.
//
//   questions.json   every question: prompt, scope, targets (all serious contenders), source
//   daily/NNNN.json  three questions per day, embedded in full, plus where each answer lies
//                    (land, ocean, Antarctica) for the mix rules; written by `pnpm ping:build`
//
// Every question is a fact: sourceTitle, sourceUrl, checkedOn and licence (from factSchema) plus
// the authority behind the record. Drafts carry `sample: true` until a person has verified them.

export const GAME_SLUG = "ping";

export const CATEGORIES = [
  "heat",
  "cold",
  "rain",
  "wind",
  "geography",
  "furthest-from",
  "regional",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Questions computed by our own scripts (OpenStreetMap): dated, with the nearest features. */
export const COMPUTED_CATEGORIES: readonly Category[] = ["furthest-from"];

export const SCOPE_LEVELS = ["world", "continent", "region", "country"] as const;
export type ScopeLevel = (typeof SCOPE_LEVELS)[number];

/** Where an answer lies. The mix rules allow one ocean or Antarctica answer a week. */
export const SURFACES = ["land", "ocean", "antarctica"] as const;
export type Surface = (typeof SURFACES)[number];

/** Questions per day. */
export const QUESTIONS_PER_DAY = 3;

const shortText = (max: number) => z.string().check(z.minLength(1), z.maxLength(max));
const latitude = z.number().check(z.gte(-90), z.lte(90));
const longitude = z.number().check(z.gte(-180), z.lte(180));

/** YYYY, YYYY-MM or YYYY-MM-DD, or a period of those joined by "/" (ISO 8601), e.g. 1991/2020. */
export const recordDateSchema = z
  .string()
  .check(z.regex(/^\d{4}(-\d{2}(-\d{2})?)?(\/\d{4}(-\d{2}(-\d{2})?)?)?$/, "a date or a period"));

export const targetSchema = z.strictObject({
  lat: latitude,
  lon: longitude,
  /** The place, as the reveal names it. Never in a prompt or a teaser. */
  label: shortText(120),
  /** The record as the authority lists it (true), or a serious contender (false). */
  official: z.boolean(),
  value: z.number(),
  /** e.g. "°C", "mm a year", "km". */
  unit: shortText(40),
  /** When the value was measured: a day, a month, a year or a period. */
  date: z.optional(recordDateSchema),
});
export type Target = z.infer<typeof targetSchema>;

/** One of the features nearest to a computed answer (e.g. the three nearest restaurants). */
export const nearestSchema = z.strictObject({
  name: shortText(120),
  town: z.optional(shortText(80)),
  lat: latitude,
  lon: longitude,
});
export type Nearest = z.infer<typeof nearestSchema>;

export const bboxSchema = z.tuple([longitude, latitude, longitude, latitude]);

/** The area a question is about. Misses are scored relative to its size. */
export const scopeSchema = z.strictObject({
  level: z.enum(SCOPE_LEVELS),
  /** As the prompt names it: "the world", "Europe", "Switzerland". */
  name: shortText(60),
  /** [west, south, east, north] in degrees; required for every level except the world. */
  bbox: z.optional(bboxSchema),
});
export type Scope = z.infer<typeof scopeSchema>;

export const questionSchema = factSchema({
  category: z.enum(CATEGORIES),
  /** Names the measure and the authority; computed questions also their scope and "as of" date. */
  prompt: shortText(240),
  /** A short, spoiler-free version for the share text. */
  teaser: shortText(120),
  scope: scopeSchema,
  /** Every serious contender; pins score against the nearest. At least one is official. */
  targets: z.array(targetSchema).check(z.minLength(1), z.maxLength(6)),
  /** Overrides the default perfect radius, which follows the scope's size. */
  perfectRadiusKm: z.optional(z.number().check(z.positive())),
  /** Who keeps the record, e.g. "World Meteorological Organization". */
  authority: shortText(120),
  /** Completes "Turns out…", in our own words. */
  turnsOut: shortText(280),
  /** Computed questions: when we ran the computation. */
  computedOn: z.optional(isoDate),
  /** Computed questions: the date of the data it ran on (e.g. the OpenStreetMap extract). */
  dataAsOf: z.optional(isoDate),
  /** Computed questions: the features nearest to the answer. */
  nearest: z.optional(z.array(nearestSchema).check(z.minLength(1), z.maxLength(3))),
  /** Overrides the category's emoji in the share text. */
  shareEmoji: z.optional(z.string().check(z.minLength(1), z.maxLength(8))),
});
export type Question = z.infer<typeof questionSchema>;
export const questionsFileSchema = z.array(questionSchema);

/** A question as a daily file embeds it: plus where its official answer lies. */
export const dailyQuestionSchema = z.strictObject({
  ...questionSchema.shape,
  surface: z.enum(SURFACES),
});
export type DailyQuestion = z.infer<typeof dailyQuestionSchema>;

export const dailyPuzzleSchema = z.strictObject({
  puzzle: z.int().check(z.positive()),
  questions: z
    .array(dailyQuestionSchema)
    .check(z.minLength(QUESTIONS_PER_DAY), z.maxLength(QUESTIONS_PER_DAY)),
  sample: z.optional(z.boolean()),
});
export type DailyPuzzle = z.infer<typeof dailyPuzzleSchema>;

/** Practice mode: questions from days that are over everywhere on Earth. */
export const practicePoolSchema = z.strictObject({
  questions: z.array(dailyQuestionSchema),
  sample: z.optional(z.boolean()),
});
export type PracticePool = z.infer<typeof practicePoolSchema>;

// -------------------------------------------------------------------------------------------
// Rules

export function isComputed(question: Pick<Question, "category">): boolean {
  return COMPUTED_CATEGORIES.includes(question.category);
}

export function isRemote(surface: Surface): boolean {
  return surface !== "land";
}

/** Problems with one question on its own (the schema has already passed). */
export function questionProblems(question: Question): string[] {
  const problems: string[] = [];
  const { scope } = question;
  if (scope.level === "world" && scope.bbox) problems.push("a world scope takes no bbox");
  if (scope.level !== "world" && !scope.bbox) problems.push(`a ${scope.level} scope needs a bbox`);
  if (scope.bbox) {
    const [, south, , north] = scope.bbox;
    if (south >= north) problems.push("bbox south must be below north");
    question.targets.forEach((t, i) => {
      if (!inBBox(t, scope.bbox!)) problems.push(`target ${i + 1} is outside the bbox`);
    });
  }
  if (!question.targets.some((t) => t.official)) problems.push("no target is marked official");

  const computed = isComputed(question);
  if (computed) {
    if (!question.computedOn) problems.push("computed questions need computedOn");
    if (!question.nearest?.length) problems.push("computed questions need nearest[]");
    if (!/\bas of\b/i.test(question.prompt)) {
      problems.push('computed questions say "as of <month year>" in the prompt');
    }
  } else if (question.computedOn || question.dataAsOf || question.nearest) {
    problems.push("only computed questions carry computedOn, dataAsOf or nearest[]");
  }

  // The prompt and the teaser never give the answer away.
  const answers = [
    ...question.targets.map((t) => t.label),
    ...(question.nearest ?? []).map((n) => n.name),
  ];
  for (const field of ["prompt", "teaser"] as const) {
    const text = question[field].toLocaleLowerCase();
    const hit = answers.find((a) => a.length >= 3 && text.includes(a.toLocaleLowerCase()));
    if (hit) problems.push(`the ${field} names an answer ("${hit}")`);
  }
  return problems;
}

/** Problems with one day on its own: distinct questions, and never two of a category. */
export function dayProblems(day: Pick<DailyPuzzle, "questions">): string[] {
  const problems: string[] = [];
  const ids = day.questions.map((q) => q.id);
  if (new Set(ids).size !== ids.length) problems.push("the same question twice");
  const categories = day.questions.map((q) => q.category);
  const repeated = categories.find((c, i) => categories.indexOf(c) !== i);
  if (repeated) problems.push(`two ${repeated} questions`);
  return problems;
}

/** Days (1-based puzzle numbers) where a 7-day window holds more than one remote answer. */
export function remoteClusters(
  days: ReadonlyMap<number, { questions: readonly { surface: Surface }[] }>,
  windowDays = 7,
): number[] {
  const remote = new Map<number, number>();
  for (const [n, day] of days) {
    remote.set(n, day.questions.filter((q) => isRemote(q.surface)).length);
  }
  const bad: number[] = [];
  for (const n of [...remote.keys()].sort((a, b) => a - b)) {
    let count = 0;
    for (let k = n - windowDays + 1; k <= n; k++) count += remote.get(k) ?? 0;
    if (count > 1) bad.push(n);
  }
  return bad;
}

/** Everything but the build's own annotation, for comparing a daily copy with questions.json. */
function withoutSurface(question: DailyQuestion): Question {
  const { surface: _surface, ...rest } = question;
  return rest;
}

/** Rules that span files; see ContentSpec.check. */
export function checkPing(context: ContentCheckContext): ContentCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const questions = (context.files["questions.json"] as Question[] | undefined) ?? [];
  const byId = new Map<string, Question>();
  for (const question of questions) {
    if (byId.has(question.id)) errors.push(`questions.json: duplicate id ${question.id}`);
    byId.set(question.id, question);
    for (const problem of questionProblems(question)) {
      errors.push(`questions.json: ${question.id}: ${problem}`);
    }
  }

  const days = context.daily as ReadonlyMap<number, DailyPuzzle>;
  for (const [n, day] of days) {
    const name = `daily/${String(n).padStart(4, "0")}.json`;
    if (day.puzzle !== n) errors.push(`${name}: says puzzle ${day.puzzle}`);
    for (const problem of dayProblems(day)) errors.push(`${name}: ${problem}`);
    for (const question of day.questions) {
      const current = byId.get(question.id);
      if (!current) {
        errors.push(`${name}: ${question.id} is not in questions.json`);
      } else if (JSON.stringify(withoutSurface(question)) !== JSON.stringify(current)) {
        warnings.push(`${name}: ${question.id} differs from questions.json (run pnpm ping:build)`);
      }
    }
    const sample = day.questions.some((q) => q.sample);
    if (sample && !day.sample) errors.push(`${name}: holds drafts but is not marked sample`);
  }
  for (const n of remoteClusters(days)) {
    errors.push(
      `daily/${String(n).padStart(4, "0")}.json: more than one ocean or Antarctica answer in 7 days`,
    );
  }
  return { errors, warnings };
}

export const contentSpec = defineContentSpec({
  daily: { schema: dailyPuzzleSchema, facts: (puzzle) => puzzle.questions },
  files: {
    "questions.json": {
      schema: questionsFileSchema,
      facts: (questions) => questions as Question[],
    },
  },
  check: checkPing,
});
