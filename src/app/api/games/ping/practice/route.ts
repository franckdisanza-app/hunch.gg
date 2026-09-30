import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as z from "zod/mini";
import { getGame, isGameReachable } from "@/games/registry";
import { dailyPuzzleSchema, type DailyQuestion } from "@/games/ping/content.schema";
import { puzzleFileName, puzzleNumber } from "@/lib/daily";

export const runtime = "nodejs";

/** The last time zone on Earth: its "today" is the oldest daily anyone can still be playing. */
const LATEST_TIME_ZONE = "Etc/GMT+12";

// The pool grows when a day ends everywhere, so the CDN keeps it for an hour.
const CACHE = "public, max-age=3600, s-maxage=3600";

function notFound(): Response {
  return Response.json(
    { error: "Not found." },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * GET /api/games/ping/practice: every question of the days that are over everywhere on Earth
 * (before today's puzzle in UTC−12), once each. Never today's or a future question, so Practice
 * cannot spoil a daily. Read from disk at request time; the files ship with this function via
 * outputFileTracingIncludes in next.config.ts.
 */
export async function GET() {
  const game = getGame("ping");
  if (!game || !isGameReachable(game) || !game.launchDate) return notFound();

  const dir = join(process.cwd(), "content", game.slug, "daily");
  const last = puzzleNumber(game.launchDate, Date.now(), LATEST_TIME_ZONE) - 1;
  const questions = new Map<string, DailyQuestion>();
  let sample = false;
  try {
    for (let n = 1; n <= last; n++) {
      const file = join(dir, puzzleFileName(n));
      if (!existsSync(file)) continue;
      const day = z.parse(dailyPuzzleSchema, JSON.parse(await readFile(file, "utf8")));
      for (const question of day.questions) {
        questions.set(question.id, question);
        sample ||= question.sample === true;
      }
    }
  } catch {
    return Response.json(
      { error: "Practice is not available." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { questions: [...questions.values()], ...(sample ? { sample } : {}) },
    { headers: { "Cache-Control": CACHE } },
  );
}
