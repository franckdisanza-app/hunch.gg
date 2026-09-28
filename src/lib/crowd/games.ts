import "server-only";
import { getGame, isGameReachable } from "@/games/registry";
import type { CrowdFeature, GameDefinition } from "@/games/types";
import { latestPuzzleNumber } from "../daily";
import { HttpError } from "./http";

/** The registered, reachable game for a crowd request, or a 404. */
export function requireCrowdGame(slug: string, feature?: CrowdFeature): GameDefinition {
  const game = getGame(slug);
  if (!game || !isGameReachable(game)) throw new HttpError(404, "Unknown game.");
  if (feature && !game.usesCrowdApi.includes(feature)) {
    throw new HttpError(404, `This game does not use ${feature}.`);
  }
  return game;
}

/** Poll IDs are "<game>:<id>"; returns the game part. */
export function pollGame(pollId: string): string {
  return pollId.slice(0, pollId.indexOf(":"));
}

/** Rejects puzzle numbers no player can have reached yet (the newest is the one in UTC+14). */
export function requireReleasedPuzzle(game: GameDefinition, puzzle: number, now = Date.now()) {
  if (game.launchDate && puzzle > latestPuzzleNumber(game.launchDate, now)) {
    throw new HttpError(404, "Puzzle not released yet.");
  }
}
