import { requireCrowdGame, requireReleasedPuzzle } from "@/lib/crowd/games";
import {
  enforceWriteLimit,
  noContent,
  parseWith,
  readJsonBody,
  withCrowdStore,
} from "@/lib/crowd/http";
import { MAX_BODY_BYTES } from "@/lib/crowd/limits";
import { guessPayloadSchema } from "@/lib/crowd/schemas";

export const runtime = "nodejs";

/** Records a numeric guess. One guess per device and item; repeats also return 204. */
export async function POST(request: Request) {
  return withCrowdStore(async (store) => {
    const guess = parseWith(guessPayloadSchema, await readJsonBody(request, MAX_BODY_BYTES.guess));
    const game = requireCrowdGame(guess.game, "guesses");
    requireReleasedPuzzle(game, guess.puzzle);
    await enforceWriteLimit(request, store);
    await store.insertGuess(guess);
    return noContent();
  });
}
