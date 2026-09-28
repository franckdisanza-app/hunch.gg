import type { CrowdStore, HistogramBin, InsertOutcome, PollTally } from "./store";

// An in-process CrowdStore with the same semantics as the SQL in supabase/migrations: one vote per
// device and poll, one guess per device and item, fixed-window rate limits, frozen snapshots and
// log-scale histograms. Data lives until the process exits. Tests and e2e runs only.

interface Vote {
  game: string;
  pollId: string;
  option: string;
  deviceId: string;
  createdAt: number;
}
interface Guess {
  game: string;
  puzzle: number;
  itemId: string;
  value: number;
  deviceId: string;
}
interface Snapshot {
  pollId: string;
  options: { option: string; votes: number }[];
  total: number;
  frozenAt: number;
}

const DAY_MS = 86_400_000;

function createMemoryStore(now: () => number = Date.now): CrowdStore & { reset(): void } {
  let votes: Vote[] = [];
  let guesses: Guess[] = [];
  let reports: { game: string; itemId: string; message: string }[] = [];
  let snapshots: Snapshot[] = [];
  let rateLimits = new Map<string, number>();

  function liveTally(pollId: string): {
    options: { option: string; votes: number }[];
    total: number;
  } {
    const counts = new Map<string, number>();
    for (const v of votes)
      if (v.pollId === pollId) counts.set(v.option, (counts.get(v.option) ?? 0) + 1);
    const options = [...counts].map(([option, n]) => ({ option, votes: n }));
    return { options, total: options.reduce((sum, o) => sum + o.votes, 0) };
  }

  function guessesFor(game: string, puzzle: number, itemId: string) {
    return guesses.filter((g) => g.game === game && g.puzzle === puzzle && g.itemId === itemId);
  }

  return {
    kind: "memory",

    async insertVote(vote): Promise<InsertOutcome> {
      if (votes.some((v) => v.pollId === vote.pollId && v.deviceId === vote.deviceId))
        return "duplicate";
      votes.push({ ...vote, createdAt: now() });
      return "inserted";
    },

    async insertGuess(guess): Promise<InsertOutcome> {
      const exists = guesses.some(
        (g) =>
          g.game === guess.game &&
          g.puzzle === guess.puzzle &&
          g.itemId === guess.itemId &&
          g.deviceId === guess.deviceId,
      );
      if (exists) return "duplicate";
      guesses.push(guess);
      return "inserted";
    },

    async insertReport(report) {
      reports.push(report);
    },

    async hitRateLimit(key, max, windowSeconds) {
      const windowStart = Math.floor(now() / (windowSeconds * 1000));
      const id = `${key}|${windowSeconds}|${windowStart}`;
      const count = (rateLimits.get(id) ?? 0) + 1;
      rateLimits.set(id, count);
      return count > max;
    },

    async pollResults(pollId): Promise<PollTally> {
      const latest = snapshots
        .filter((s) => s.pollId === pollId)
        .sort((a, b) => b.frozenAt - a.frozenAt)[0];
      if (latest) {
        return {
          options: latest.options,
          total: latest.total,
          frozenAt: new Date(latest.frozenAt).toISOString(),
        };
      }
      return { ...liveTally(pollId), frozenAt: null };
    },

    async crowdMedian(game, puzzle, itemId) {
      const values = guessesFor(game, puzzle, itemId)
        .map((g) => g.value)
        .sort((a, b) => a - b);
      const n = values.length;
      if (n === 0) return { n, median: null };
      const mid = (n - 1) / 2;
      const median = (values[Math.floor(mid)]! + values[Math.ceil(mid)]!) / 2;
      return { n, median };
    },

    async crowdHistogram(game, puzzle, itemId, binCount): Promise<HistogramBin[]> {
      const logs = guessesFor(game, puzzle, itemId)
        .filter((g) => g.value > 0)
        .map((g) => Math.log(g.value));
      if (logs.length === 0) return [];
      const bins = Math.max(1, Math.min(binCount, 100));
      const lo = Math.min(...logs);
      const hi = Math.max(...logs);
      const width = (hi - lo) / bins;
      const counts = Array.from({ length: bins }, () => 0);
      for (const lv of logs) {
        const bin = hi === lo ? 0 : Math.min(Math.floor((lv - lo) / width), bins - 1);
        counts[bin]! += 1;
      }
      return counts.map((count, i) => ({
        from: Math.exp(lo + i * width),
        to: Math.exp(lo + (i + 1) * width),
        count,
      }));
    },

    async freezePolls() {
      const t = now();
      const active = new Set(
        votes
          .filter(
            (v) => v.createdAt > t - 2 * DAY_MS || !snapshots.some((s) => s.pollId === v.pollId),
          )
          .map((v) => v.pollId),
      );
      for (const pollId of active) snapshots.push({ pollId, ...liveTally(pollId), frozenAt: t });
      const cutoff = t - DAY_MS;
      rateLimits = new Map(
        [...rateLimits].filter(([id]) => {
          const [, windowSeconds, windowStart] = id.split("|");
          return Number(windowStart) * Number(windowSeconds) * 1000 >= cutoff;
        }),
      );
      return active.size;
    },

    async ping() {},

    reset() {
      votes = [];
      guesses = [];
      reports = [];
      snapshots = [];
      rateLimits = new Map();
    },
  };
}

// One store per server process, kept on globalThis so dev-server reloads do not drop it.
const globalStore = globalThis as unknown as {
  __plimpMemoryStore?: ReturnType<typeof createMemoryStore>;
};

export function memoryCrowdStore(): CrowdStore {
  globalStore.__plimpMemoryStore ??= createMemoryStore();
  return globalStore.__plimpMemoryStore;
}

/** Test helper: empties the shared memory store. */
export function resetMemoryCrowdStore(): void {
  globalStore.__plimpMemoryStore?.reset();
}

export { createMemoryStore };
