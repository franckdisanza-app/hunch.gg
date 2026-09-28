import { bearerMatches, json, problem, withCrowdStore } from "@/lib/crowd/http";

export const runtime = "nodejs";

/**
 * Daily at 00:30 UTC (vercel.json). Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`;
 * anything else is rejected.
 */
export async function GET(request: Request) {
  if (!bearerMatches(request, process.env.CRON_SECRET)) return problem(401, "Unauthorized.");
  return withCrowdStore(async (store) => {
    const frozen = await store.freezePolls();
    return json({ frozen });
  });
}
