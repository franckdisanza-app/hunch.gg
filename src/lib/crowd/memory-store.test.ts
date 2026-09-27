import { createMemoryStore } from "./memory-store";

// The memory store stands in for Supabase in tests and e2e runs, so it must behave like the SQL.
// These cases mirror tests/unit/sql/crowd-sql.test.ts.

const device = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

async function withGuesses(values: number[]) {
  const store = createMemoryStore();
  for (const [i, value] of values.entries()) {
    await store.insertGuess({
      game: "demo",
      puzzle: 1,
      itemId: "item",
      value,
      deviceId: device(i),
    });
  }
  return store;
}

describe("memory crowd store", () => {
  it("bins positive guesses on a log scale like crowd_histogram", async () => {
    const store = await withGuesses([2, 20, 200, 1000, 0, -5]);
    const bins = await store.crowdHistogram("demo", 1, "item", 3);
    expect(bins.map((b) => b.count)).toEqual([1, 1, 2]);
    expect(bins[0]?.from).toBeCloseTo(2);
    expect(bins[2]?.to).toBeCloseTo(1000);
  });

  it("puts identical guesses in the first bin and returns nothing without positive guesses", async () => {
    expect(
      (await (await withGuesses([7, 7, 7])).crowdHistogram("demo", 1, "item", 4)).map(
        (b) => b.count,
      ),
    ).toEqual([3, 0, 0, 0]);
    expect(await (await withGuesses([0, -1])).crowdHistogram("demo", 1, "item", 4)).toEqual([]);
  });

  it("computes the median like percentile_cont(0.5)", async () => {
    expect(await (await withGuesses([1, 2, 3, 4])).crowdMedian("demo", 1, "item")).toEqual({
      n: 4,
      median: 2.5,
    });
    expect(await (await withGuesses([5, 1, 3])).crowdMedian("demo", 1, "item")).toEqual({
      n: 3,
      median: 3,
    });
    expect(await createMemoryStore().crowdMedian("demo", 1, "item")).toEqual({
      n: 0,
      median: null,
    });
  });

  it("uses fixed rate-limit windows that expire", async () => {
    let now = Date.parse("2026-01-01T00:00:00Z");
    const store = createMemoryStore(() => now);
    expect(await store.hitRateLimit("k", 1, 60)).toBe(false);
    expect(await store.hitRateLimit("k", 1, 60)).toBe(true);
    now += 60_000;
    expect(await store.hitRateLimit("k", 1, 60)).toBe(false);
  });

  it("freezes only polls that are new or recently active", async () => {
    let now = Date.parse("2026-01-01T00:00:00Z");
    const store = createMemoryStore(() => now);
    await store.insertVote({ game: "demo", pollId: "demo:old", option: "a", deviceId: device(1) });
    expect(await store.freezePolls()).toBe(1);
    now += 3 * 86_400_000;
    await store.insertVote({ game: "demo", pollId: "demo:new", option: "a", deviceId: device(2) });
    expect(await store.freezePolls()).toBe(1);
  });
});
