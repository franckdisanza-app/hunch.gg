import { requireCrowdGame } from "@/lib/crowd/games";
import {
  enforceWriteLimit,
  noContent,
  parseWith,
  readJsonBody,
  withCrowdStore,
} from "@/lib/crowd/http";
import { MAX_BODY_BYTES } from "@/lib/crowd/limits";
import { reportPayloadSchema } from "@/lib/crowd/schemas";

export const runtime = "nodejs";

/** Stores a "Report a mistake" message (status 'new') for review. */
export async function POST(request: Request) {
  return withCrowdStore(async (store) => {
    const report = parseWith(
      reportPayloadSchema,
      await readJsonBody(request, MAX_BODY_BYTES.report),
    );
    requireCrowdGame(report.game);
    await enforceWriteLimit(request, store);
    await store.insertReport(report);
    return noContent();
  });
}
