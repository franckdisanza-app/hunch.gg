import "server-only";
import { supabaseConfigured } from "../supabase/server";
import { memoryCrowdStore } from "./memory-store";
import { supabaseCrowdStore } from "./supabase-store";

// Crowd storage behind one interface. Production uses Supabase. CROWD_STORE=memory swaps in an
// in-process store with the same semantics, for tests, e2e runs and local development without
// Docker (see docs/ARCHITECTURE.md). It is refused on Vercel production deployments.

export type InsertOutcome = "inserted" | "duplicate";

export interface PollTally {
  options: { option: string; votes: number }[];
  total: number;
  /** ISO time of the snapshot, or null for live counts. */
  frozenAt: string | null;
}

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
}

export interface CrowdStore {
  readonly kind: "supabase" | "memory";
  insertVote(vote: {
    game: string;
    pollId: string;
    option: string;
    deviceId: string;
  }): Promise<InsertOutcome>;
  insertGuess(guess: {
    game: string;
    puzzle: number;
    itemId: string;
    value: number;
    deviceId: string;
  }): Promise<InsertOutcome>;
  insertReport(report: { game: string; itemId: string; message: string }): Promise<void>;
  /** Records a hit; true when `key` is now over `max` hits in the current window. */
  hitRateLimit(key: string, max: number, windowSeconds: number): Promise<boolean>;
  pollResults(pollId: string): Promise<PollTally>;
  crowdMedian(
    game: string,
    puzzle: number,
    itemId: string,
  ): Promise<{ n: number; median: number | null }>;
  crowdHistogram(
    game: string,
    puzzle: number,
    itemId: string,
    bins: number,
  ): Promise<HistogramBin[]>;
  /** Snapshots active polls; returns how many were frozen. */
  freezePolls(): Promise<number>;
  /** Throws when the store cannot be reached. */
  ping(): Promise<void>;
}

export class CrowdStoreUnavailableError extends Error {
  constructor(message = "The crowd store is not configured.") {
    super(message);
  }
}

export function getCrowdStore(): CrowdStore {
  if (process.env.CROWD_STORE === "memory") {
    if (process.env.VERCEL_ENV === "production") {
      throw new CrowdStoreUnavailableError("CROWD_STORE=memory is not allowed in production.");
    }
    return memoryCrowdStore();
  }
  if (supabaseConfigured()) return supabaseCrowdStore();
  throw new CrowdStoreUnavailableError();
}
