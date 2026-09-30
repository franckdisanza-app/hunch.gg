import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as z from "zod/mini";
import {
  CATEGORIES,
  QUESTIONS_PER_DAY,
  dailyPuzzleSchema,
  dayProblems,
  isRemote,
  questionProblems,
  questionsFileSchema,
  remoteClusters,
  type Category,
  type DailyPuzzle,
  type Question,
  type Surface,
} from "@/games/ping/content.schema";
import type { GameDefinition } from "@/games/types";
import type { ContentMode } from "@/lib/content/validate";
import { latestPuzzleNumber, puzzleFileName } from "@/lib/daily";
import { writeJson } from "./json";
import { seededRandom, shuffled } from "./random";

// The logic behind `pnpm ping:build`: questions.json → validation → daily files from a fixed
// seed, following the mix rules (never two questions of a category on a day; at most one ocean or
// Antarctica answer in any 7 days). Released days keep their questions; everything after them is
// planned again on every run, so the plan follows questions.json. Embedded copies are always
// refreshed, so a corrected question reaches every day that uses it.

export const SEED = "ping:daily:v1";
export const WINDOW_DAYS = 7;
/** With --repeat, a question comes back only after this many days (fewer for a small pool). */
export const REPEAT_GAP_DAYS = 14;

export interface PlanInput {
  questions: readonly Question[];
  surfaces: ReadonlyMap<string, Surface>;
  /** Question IDs of days already written, by puzzle number. */
  existing: ReadonlyMap<number, readonly string[]>;
  /** Days up to this puzzle number keep their questions (they are out). */
  frozenThrough: number;
  /** Plan up to and including this puzzle number. */
  lastDay: number;
  seed?: string;
  /** Reuse questions once every one has been used (development and samples). */
  repeat?: boolean;
}

export interface Plan {
  days: Map<number, string[]>;
  errors: string[];
  /** Why planning stopped before lastDay, if it did. */
  stopped?: { day: number; reason: string };
}

/** Plans daily question IDs. Pure: the same input always gives the same plan. */
export function planDays(input: PlanInput): Plan {
  const { questions, surfaces, existing, frozenThrough, lastDay } = input;
  const byId = new Map(questions.map((q) => [q.id, q]));
  const days = new Map<number, string[]>();
  const errors: string[] = [];
  const used = new Set<string>();
  const lastUsed = new Map<string, number>();
  const remote = (id: string) => isRemote(surfaces.get(id) ?? "land");

  for (let n = 1; n <= frozenThrough; n++) {
    const ids = existing.get(n);
    if (!ids) continue;
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length)
      errors.push(`released day ${n} uses questions that are gone: ${missing.join(", ")}`);
    days.set(n, [...ids]);
    for (const id of ids) {
      used.add(id);
      lastUsed.set(id, n);
    }
  }

  // One fixed order for every question (by sorted ID, so file order does not matter): the plan
  // for days still to come stays the same from one build to the next unless the questions change.
  const seed = input.seed ?? SEED;
  const allIds = questions.map((q) => q.id).sort();
  let pool = shuffled(allIds, seededRandom(seed)).filter((id) => !used.has(id));
  let cycle = 0;
  const gap = Math.max(
    1,
    Math.min(REPEAT_GAP_DAYS, Math.floor(allIds.length / QUESTIONS_PER_DAY) - 1),
  );

  // Remote answers within a week either side of day n (kept days may lie ahead of it).
  const remoteNear = (n: number) => {
    let count = 0;
    for (let k = n - WINDOW_DAYS + 1; k <= n + WINDOW_DAYS - 1; k++) {
      if (k !== n) count += (days.get(k) ?? []).filter(remote).length;
    }
    return count;
  };

  const pickDay = (n: number): string[] | null => {
    const pick: string[] = [];
    const categories = new Set<Category>();
    let remoteLeft = 1 - remoteNear(n);
    for (const id of pool) {
      const question = byId.get(id)!;
      if (categories.has(question.category)) continue;
      if (remote(id) && remoteLeft <= 0) continue;
      pick.push(id);
      categories.add(question.category);
      if (remote(id)) remoteLeft--;
      if (pick.length === QUESTIONS_PER_DAY) return pick;
    }
    return null;
  };

  for (let n = 1; n <= lastDay; n++) {
    // Released days keep their questions; a released day without a file yet is planned.
    if (days.has(n)) continue;
    let pick = pickDay(n);
    // With --repeat, questions come back: first those not used for `gap` days, then (when the
    // mix rules still leave no day) sooner.
    for (let g = gap; input.repeat && !pick && g >= 0; g--) {
      const recent = (id: string) => (lastUsed.get(id) ?? -Infinity) > n - g;
      const again = allIds.filter((id) => !pool.includes(id) && !recent(id));
      if (!again.length) continue;
      cycle++;
      pool = [...pool, ...shuffled(again, seededRandom(`${seed}:cycle:${cycle}`))];
      pick = pickDay(n);
    }
    if (!pick) {
      return {
        days,
        errors,
        stopped: {
          day: n,
          reason: input.repeat
            ? "the questions cannot make a day that follows the mix rules"
            : "out of fresh questions that fit the mix rules (add questions, or --repeat)",
        },
      };
    }
    days.set(n, pick);
    pool = pool.filter((id) => !pick.includes(id));
    for (const id of pick) lastUsed.set(id, n);
  }
  return { days, errors };
}

export interface WeekReport {
  week: number;
  from: number;
  to: number;
  categories: Record<Category, number>;
  remote: number;
}

/** Categories and remote answers per week of puzzles (1–7, 8–14, …). */
export function weeklyReport(
  days: ReadonlyMap<number, readonly string[]>,
  byId: ReadonlyMap<string, Question>,
  surfaces: ReadonlyMap<string, Surface>,
): WeekReport[] {
  const last = Math.max(0, ...days.keys());
  const weeks: WeekReport[] = [];
  for (let from = 1; from <= last; from += WINDOW_DAYS) {
    const to = from + WINDOW_DAYS - 1;
    const categories = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<
      Category,
      number
    >;
    let remote = 0;
    for (let n = from; n <= to; n++) {
      for (const id of days.get(n) ?? []) {
        const question = byId.get(id);
        if (!question) continue;
        categories[question.category]++;
        if (isRemote(surfaces.get(id) ?? "land")) remote++;
      }
    }
    weeks.push({ week: weeks.length + 1, from, to, categories, remote });
  }
  return weeks;
}

// ---------------------------------------------------------------------------------------------
// Files

export interface BuildOptions {
  root: string;
  game: GameDefinition;
  now: Date;
  /** Plan this many days past today's puzzle (in UTC+14). */
  days: number;
  reset: boolean;
  repeat: boolean;
  dryRun: boolean;
  mode: ContentMode;
  surfaceOf(question: Question): Surface;
}

export interface BuildResult {
  errors: string[];
  warnings: string[];
  written: number;
  removed: number;
  today: number;
  lastPlanned: number;
  /** Days after today's puzzle that are planned. */
  daysAhead: number;
  /** Questions never used so far and not planned: how many more days of fresh content. */
  freshLeft: number;
  weeks: WeekReport[];
  stopped?: Plan["stopped"];
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

export async function buildPing(options: BuildOptions): Promise<BuildResult> {
  const { root, game } = options;
  const dir = join(root, "content", game.slug);
  const dailyDir = join(dir, "daily");
  const result: BuildResult = {
    errors: [],
    warnings: [],
    written: 0,
    removed: 0,
    today: 0,
    lastPlanned: 0,
    daysAhead: 0,
    freshLeft: 0,
    weeks: [],
  };
  if (!game.launchDate) {
    result.errors.push(`${game.slug} has no launchDate in the registry`);
    return result;
  }

  const parsed = z.safeParse(questionsFileSchema, readJson(join(dir, "questions.json")));
  if (!parsed.success) {
    result.errors.push(`questions.json: ${z.prettifyError(parsed.error)}`);
    return result;
  }
  let questions = parsed.data;
  const ids = new Set<string>();
  for (const question of questions) {
    if (ids.has(question.id)) result.errors.push(`questions.json: duplicate id ${question.id}`);
    ids.add(question.id);
    for (const problem of questionProblems(question)) {
      result.errors.push(`questions.json: ${question.id}: ${problem}`);
    }
  }
  if (options.mode === "production") {
    const drafts = questions.filter((q) => q.sample).length;
    if (drafts) result.warnings.push(`left out ${drafts} draft questions (sample: true)`);
    questions = questions.filter((q) => !q.sample);
  }
  if (result.errors.length) return result;

  const surfaces = new Map(questions.map((q) => [q.id, options.surfaceOf(q)]));
  const byId = new Map(questions.map((q) => [q.id, q]));

  const existing = new Map<number, string[]>();
  if (existsSync(dailyDir)) {
    for (const name of readdirSync(dailyDir)) {
      if (!/^\d{4}\.json$/.test(name)) continue;
      const day = z.safeParse(dailyPuzzleSchema, readJson(join(dailyDir, name)));
      if (!day.success) {
        result.warnings.push(
          `daily/${name} does not parse; it will be planned again if not released`,
        );
        continue;
      }
      existing.set(
        Number(name.slice(0, 4)),
        day.data.questions.map((q) => q.id),
      );
    }
  }

  const today = Math.max(0, latestPuzzleNumber(game.launchDate, options.now));
  const frozenThrough = options.reset ? 0 : today;
  const lastDay = Math.max(1, today + options.days);
  const plan = planDays({
    questions,
    surfaces,
    existing,
    frozenThrough,
    lastDay,
    repeat: options.repeat,
  });
  result.errors.push(...plan.errors);

  for (const [n, dayIds] of plan.days) {
    const day = {
      questions: dayIds.map((id) => ({ ...byId.get(id)!, surface: surfaces.get(id)! })),
    };
    for (const problem of dayProblems(day)) result.errors.push(`day ${n}: ${problem}`);
  }
  const planned = new Map(
    [...plan.days].map(([n, dayIds]) => [
      n,
      { questions: dayIds.map((id) => ({ surface: surfaces.get(id) ?? "land" })) },
    ]),
  );
  for (const n of remoteClusters(planned)) {
    if (n > frozenThrough)
      result.errors.push(`day ${n}: more than one ocean or Antarctica answer in 7 days`);
    else
      result.warnings.push(`released day ${n}: more than one ocean or Antarctica answer in 7 days`);
  }
  if (result.errors.length) return result;

  const lastPlanned = Math.max(0, ...plan.days.keys());
  result.today = today;
  result.lastPlanned = lastPlanned;
  result.daysAhead = Math.max(0, lastPlanned - today);
  result.stopped = plan.stopped;
  result.weeks = weeklyReport(plan.days, byId, surfaces);
  const everUsed = new Set([...plan.days.values()].flat());
  result.freshLeft = Math.floor(
    questions.filter((q) => !everUsed.has(q.id)).length / QUESTIONS_PER_DAY,
  );

  if (!options.dryRun) {
    mkdirSync(dailyDir, { recursive: true });
    for (const [n, dayIds] of plan.days) {
      const embedded = dayIds.map((id) => ({ ...byId.get(id)!, surface: surfaces.get(id)! }));
      const daily: DailyPuzzle = {
        puzzle: n,
        questions: embedded,
        ...(embedded.some((q) => q.sample) ? { sample: true } : {}),
      };
      if (await writeJson(join(dailyDir, puzzleFileName(n)), daily)) result.written++;
    }
    // Unreleased days the plan no longer covers.
    for (const n of existing.keys()) {
      if (n > frozenThrough && !plan.days.has(n)) {
        rmSync(join(dailyDir, puzzleFileName(n)));
        result.removed++;
      }
    }
  }

  if (result.daysAhead < 14)
    result.warnings.push(`only ${result.daysAhead} days planned after today`);
  return result;
}

export function formatReport(result: BuildResult): string {
  const lines = [
    `Today's puzzle (UTC+14): #${result.today}. Planned through #${result.lastPlanned} (${result.daysAhead} days ahead).`,
    `Fresh questions left for about ${result.freshLeft} more days.`,
  ];
  if (result.stopped) lines.push(`Stopped at #${result.stopped.day}: ${result.stopped.reason}.`);
  lines.push(
    "",
    "Week  Puzzles     " + CATEGORIES.map((c) => c.slice(0, 5).padStart(6)).join("") + "  remote",
  );
  for (const week of result.weeks) {
    lines.push(
      `${String(week.week).padStart(4)}  ${`#${week.from}–${week.to}`.padEnd(10)}  ` +
        CATEGORIES.map((c) => String(week.categories[c]).padStart(6)).join("") +
        `  ${String(week.remote).padStart(6)}`,
    );
  }
  lines.push("", `${result.written} files written, ${result.removed} removed.`);
  return lines.join("\n");
}
