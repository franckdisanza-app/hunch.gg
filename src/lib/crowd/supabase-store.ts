import "server-only";
import { supabaseServer } from "../supabase/server";
import type { CrowdStore, InsertOutcome } from "./store";

// CrowdStore backed by Supabase (Postgres). All logic that must be atomic lives in SQL
// functions (supabase/migrations); this file only maps names and errors.

const UNIQUE_VIOLATION = "23505";

function fail(what: string, error: { message: string; code?: string }): never {
  throw new Error(`Supabase ${what} failed: ${error.code ?? ""} ${error.message}`.trim());
}

function outcome(error: { message: string; code?: string } | null, what: string): InsertOutcome {
  if (!error) return "inserted";
  if (error.code === UNIQUE_VIOLATION) return "duplicate";
  fail(what, error);
}

export function supabaseCrowdStore(): CrowdStore {
  const db = supabaseServer();
  return {
    kind: "supabase",

    async insertVote(v) {
      const { error } = await db.from("votes").insert({
        game: v.game,
        poll_id: v.pollId,
        option: v.option,
        device_id: v.deviceId,
      });
      return outcome(error, "vote insert");
    },

    async insertGuess(g) {
      const { error } = await db.from("guesses").insert({
        game: g.game,
        puzzle: g.puzzle,
        item_id: g.itemId,
        value: g.value,
        device_id: g.deviceId,
      });
      return outcome(error, "guess insert");
    },

    async insertReport(r) {
      const { error } = await db
        .from("reports")
        .insert({ game: r.game, item_id: r.itemId, message: r.message });
      if (error) fail("report insert", error);
    },

    async hitRateLimit(key, max, windowSeconds) {
      const { data, error } = await db.rpc("hit_rate_limit", {
        p_key: key,
        p_max: max,
        p_window_seconds: windowSeconds,
      });
      if (error) fail("rate limit", error);
      return data;
    },

    async pollResults(pollId) {
      const { data, error } = await db.rpc("poll_results", { p_poll_id: pollId });
      if (error) fail("poll results", error);
      return {
        options: data.map((row) => ({ option: row.option, votes: row.votes })),
        total: data[0]?.total ?? 0,
        frozenAt: data[0]?.frozen_at ? new Date(data[0].frozen_at).toISOString() : null,
      };
    },

    async crowdMedian(game, puzzle, itemId) {
      const { data, error } = await db.rpc("crowd_median", {
        p_game: game,
        p_puzzle: puzzle,
        p_item: itemId,
      });
      if (error) fail("crowd median", error);
      return { n: data[0]?.n ?? 0, median: data[0]?.median ?? null };
    },

    async crowdHistogram(game, puzzle, itemId, bins) {
      const { data, error } = await db.rpc("crowd_histogram", {
        p_game: game,
        p_puzzle: puzzle,
        p_item: itemId,
        p_bins: bins,
      });
      if (error) fail("crowd histogram", error);
      return data.map((row) => ({ from: row.bin_from, to: row.bin_to, count: row.count }));
    },

    async freezePolls() {
      const { data, error } = await db.rpc("freeze_polls");
      if (error) fail("freeze", error);
      return data;
    },

    async ping() {
      const { error } = await db.from("poll_snapshots").select("poll_id", { head: true }).limit(1);
      if (error) fail("ping", error);
    },
  };
}
