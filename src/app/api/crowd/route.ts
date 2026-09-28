import * as z from "zod/mini";
import { itemIdSchema } from "@/games/content";
import { slugSchema } from "@/games/registry.schema";
import { requireCrowdGame, requireReleasedPuzzle } from "@/lib/crowd/games";
import { json, parseWith, withCrowdStore } from "@/lib/crowd/http";
import { CROWD_HISTOGRAM_BINS, MIN_GUESSES } from "@/lib/crowd/limits";
import type { CrowdStats } from "@/lib/crowd/schemas";

export const runtime = "nodejs";

const CACHE = "public, s-maxage=60, stale-while-revalidate=300";

const querySchema = z.object({
  game: slugSchema,
  puzzle: z.pipe(z.coerce.number(), z.int().check(z.minimum(1), z.maximum(100_000))),
  item: itemIdSchema,
});

/**
 * GET /api/crowd?game=&puzzle=&item=. The crowd's median guess and a log-scale histogram, once at
 * least MIN_GUESSES guesses are in; before that only the count.
 */
export async function GET(request: Request) {
  return withCrowdStore(async (store) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = parseWith(querySchema, params);
    const game = requireCrowdGame(query.game, "guesses");
    requireReleasedPuzzle(game, query.puzzle);

    const { n, median } = await store.crowdMedian(query.game, query.puzzle, query.item);
    if (n < MIN_GUESSES || median === null) {
      return json({ ready: false, n } satisfies CrowdStats, 200, CACHE);
    }
    const histogram = await store.crowdHistogram(
      query.game,
      query.puzzle,
      query.item,
      CROWD_HISTOGRAM_BINS,
    );
    return json({ ready: true, n, median, histogram } satisfies CrowdStats, 200, CACHE);
  });
}
