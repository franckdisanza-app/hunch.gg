import { pollGame, requireCrowdGame } from "@/lib/crowd/games";
import { json, parseWith, withCrowdStore } from "@/lib/crowd/http";
import { MIN_POLL_VOTES } from "@/lib/crowd/limits";
import { pollIdSchema, type PollResults } from "@/lib/crowd/schemas";

export const runtime = "nodejs";

const LIVE_CACHE = "public, s-maxage=60, stale-while-revalidate=300";
const FROZEN_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

/**
 * GET /api/results?poll=<game>:<id>. The split from the latest frozen snapshot (or live counts
 * before the first freeze). Below MIN_POLL_VOTES only the count is returned.
 */
export async function GET(request: Request) {
  return withCrowdStore(async (store) => {
    const pollId = parseWith(pollIdSchema, new URL(request.url).searchParams.get("poll"));
    requireCrowdGame(pollGame(pollId), "polls");

    const tally = await store.pollResults(pollId);
    const n = tally.total;
    if (n < MIN_POLL_VOTES) {
      return json({ ready: false, n } satisfies PollResults, 200, LIVE_CACHE);
    }
    const body: PollResults = {
      ready: true,
      n,
      options: tally.options.map((o) => ({ option: o.option, votes: o.votes, share: o.votes / n })),
      frozenAt: tally.frozenAt,
    };
    return json(body, 200, tally.frozenAt ? FROZEN_CACHE : LIVE_CACHE);
  });
}
