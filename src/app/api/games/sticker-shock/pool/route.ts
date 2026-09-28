import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as z from "zod/mini";
import { getGame, isGameReachable } from "@/games/registry";
import { buildPool } from "@/games/sticker-shock/catalog";
import {
  countriesFileSchema,
  dailyPuzzleSchema,
  fxFileSchema,
  itemsFileSchema,
  pricesFileSchema,
} from "@/games/sticker-shock/content.schema";
import { latestPuzzleNumber, puzzleFileName, puzzleNumber } from "@/lib/daily";

export const runtime = "nodejs";

/** Prices scheduled in the dailies of the next this-many days stay out of Endless. */
const POOL_LOOKAHEAD_DAYS = 7;

/** The last time zone on Earth: its "today" is the oldest daily anyone can still be playing. */
const LATEST_TIME_ZONE = "Etc/GMT+12";

// The pool changes when a new day starts somewhere, so the CDN keeps it for an hour.
const CACHE = "public, max-age=3600, s-maxage=3600";

function notFound(): Response {
  return Response.json(
    { error: "Not found." },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

async function readJson<T>(file: string, schema: z.ZodMiniType<T>): Promise<T> {
  return z.parse(schema, JSON.parse(await readFile(file, "utf8")));
}

/**
 * GET /api/games/sticker-shock/pool: every price for Endless, except those scheduled in the
 * dailies anyone can be playing now or in the next 7 days (from today's puzzle in UTC−12 to 7
 * days after today's in UTC+14), so Endless never spoils a daily. Read from disk at request time;
 * the files ship with this function via outputFileTracingIncludes in next.config.ts.
 */
export async function GET() {
  const game = getGame("sticker-shock");
  if (!game || !isGameReachable(game)) return notFound();

  const dir = join(process.cwd(), "content", game.slug);
  try {
    const [items, countries, prices, fx] = await Promise.all([
      readJson(join(dir, "items.json"), itemsFileSchema),
      readJson(join(dir, "countries.json"), countriesFileSchema),
      readJson(join(dir, "prices.json"), pricesFileSchema),
      readJson(join(dir, "fx.json"), fxFileSchema),
    ]);

    const exclude = new Set<string>();
    if (game.launchDate) {
      const now = Date.now();
      const first = Math.max(1, puzzleNumber(game.launchDate, now, LATEST_TIME_ZONE));
      const last = latestPuzzleNumber(game.launchDate, now) + POOL_LOOKAHEAD_DAYS;
      for (let n = first; n <= last; n++) {
        const file = join(dir, "daily", puzzleFileName(n));
        if (!existsSync(file)) continue;
        const day = await readJson(file, dailyPuzzleSchema);
        for (const pair of day.pairs) exclude.add(pair.a.id).add(pair.b.id);
      }
    }

    const pool = buildPool({ items, countries, prices, fx }, exclude);
    // Editor notes stay in the repository.
    const body = { ...pool, prices: pool.prices.map(({ notes: _notes, ...price }) => price) };
    return Response.json(body, { headers: { "Cache-Control": CACHE } });
  } catch {
    return Response.json(
      { error: "The pool is not available." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
