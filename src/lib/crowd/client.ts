import { playerStorage } from "../storage";
import {
  crowdStatsSchema,
  pollResultsSchema,
  type CrowdStats,
  type GuessPayload,
  type PollResults,
  type ReportPayload,
  type VotePayload,
} from "./schemas";

// Browser side of the crowd API. Votes and guesses are fire-and-forget: they never block play and
// never surface errors. Reports wait for an answer so the player knows it arrived.

function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  });
}

export function sendVote(vote: Omit<VotePayload, "deviceId">): void {
  const payload: VotePayload = { ...vote, deviceId: playerStorage().getMeta().deviceId };
  post("/api/vote", payload).catch(() => {});
}

export function sendGuess(guess: Omit<GuessPayload, "deviceId">): void {
  const payload: GuessPayload = { ...guess, deviceId: playerStorage().getMeta().deviceId };
  post("/api/guess", payload).catch(() => {});
}

export async function sendReport(report: ReportPayload): Promise<boolean> {
  try {
    const res = await post("/api/report", report);
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchPollResults(pollId: string): Promise<PollResults | null> {
  try {
    const res = await fetch(`/api/results?poll=${encodeURIComponent(pollId)}`);
    if (!res.ok) return null;
    return pollResultsSchema.parse(await res.json());
  } catch {
    return null;
  }
}

export async function fetchCrowdStats(
  game: string,
  puzzle: number,
  item: string,
): Promise<CrowdStats | null> {
  const query = new URLSearchParams({ game, puzzle: String(puzzle), item });
  try {
    const res = await fetch(`/api/crowd?${query}`);
    if (!res.ok) return null;
    return crowdStatsSchema.parse(await res.json());
  } catch {
    return null;
  }
}
