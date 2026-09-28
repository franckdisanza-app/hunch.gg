import { requireCrowdGame, pollGame } from "@/lib/crowd/games";
import {
  HttpError,
  enforceWriteLimit,
  noContent,
  parseWith,
  readJsonBody,
  withCrowdStore,
} from "@/lib/crowd/http";
import { MAX_BODY_BYTES } from "@/lib/crowd/limits";
import { votePayloadSchema } from "@/lib/crowd/schemas";

export const runtime = "nodejs";

/** Records a one-tap poll vote. One vote per device and poll; repeats also return 204. */
export async function POST(request: Request) {
  return withCrowdStore(async (store) => {
    const vote = parseWith(votePayloadSchema, await readJsonBody(request, MAX_BODY_BYTES.vote));
    requireCrowdGame(vote.game, "polls");
    if (pollGame(vote.pollId) !== vote.game) {
      throw new HttpError(400, "Poll IDs must start with the game slug.");
    }
    await enforceWriteLimit(request, store);
    await store.insertVote(vote);
    return noContent();
  });
}
