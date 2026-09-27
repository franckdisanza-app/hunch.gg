import { META_KEY, gameKey } from "./storage-keys";
import {
  EMPTY_STATS,
  createPlayerStorage,
  effectiveStreak,
  memoryBackend,
  randomUuid,
  runMigrations,
  safeBackend,
  type KeyValueBackend,
} from "./storage";

/** A Map-backed Storage whose methods can be made to throw. */
class FakeStorage implements Storage {
  map = new Map<string, string>();
  failReads = false;
  failWrites = false;
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(key: string) {
    if (this.failReads) throw new Error("SecurityError");
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error("QuotaExceededError");
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

const UUID = "123e4567-e89b-42d3-a456-426614174000";

function setup(backend: KeyValueBackend = memoryBackend()) {
  return createPlayerStorage({
    backend,
    now: () => new Date("2026-03-10T12:00:00Z"),
    timeZone: () => "Europe/Zurich",
    randomUuid: () => UUID,
  });
}

describe("meta", () => {
  it("is created on first read with a device ID and first-visit date", () => {
    const store = setup();
    expect(store.getMeta()).toEqual({
      deviceId: UUID,
      firstVisit: "2026-03-10",
      theme: "system",
      sound: false,
      prefs: {},
      howToSeen: [],
      returnMilestones: [],
    });
  });

  it("keeps game preferences", () => {
    const store = setup();
    store.updateMeta((meta) => ({ prefs: { ...meta.prefs, currency: "CHF" } }));
    expect(store.getMeta().prefs).toEqual({ currency: "CHF" });
  });

  it("rejects invalid updates", () => {
    const store = setup();
    expect(() => store.updateMeta({ theme: "sepia" as never })).toThrow();
  });
});

describe("blocked storage", () => {
  it("works in memory when localStorage cannot be reached", () => {
    const backend = safeBackend(() => {
      throw new Error("SecurityError");
    });
    const store = setup(backend);
    store.recordDailyCompletion("demo", 1, { answers: ["a"], score: 3 });
    expect(store.getStats("demo").completed).toBe(1);
  });

  it("works in memory when every write throws", () => {
    const fake = new FakeStorage();
    fake.failWrites = true;
    const store = setup(safeBackend(() => fake));
    store.updateMeta({ sound: true });
    expect(store.getMeta().sound).toBe(true);
  });

  it("switches to memory mid-session and keeps what was saved", () => {
    const fake = new FakeStorage();
    const store = setup(safeBackend(() => fake));
    store.recordDailyCompletion("demo", 1, { answers: [], score: 2 });
    fake.failWrites = true;
    store.recordDailyCompletion("demo", 2, { answers: [], score: 4 });
    const stats = store.getStats("demo");
    expect(stats.completed).toBe(2);
    expect(stats.currentStreak).toBe(2);
  });
});

describe("corrupt data", () => {
  it("resets only the corrupt key", () => {
    const backend = memoryBackend();
    const store = setup(backend);
    store.recordDailyCompletion("demo", 1, { answers: [], score: 5 });
    store.recordUnlimitedRun("demo", 7);
    backend.setItem(gameKey("demo", "stats"), "{not json");
    expect(store.getStats("demo")).toEqual(EMPTY_STATS);
    expect(backend.getItem(gameKey("demo", "stats"))).toBeNull();
    expect(store.getUnlimited("demo").bestRun).toBe(7);
    expect(store.getHistory("demo")["1"]?.score).toBe(5);
  });

  it("resets a key that fails its schema", () => {
    const backend = memoryBackend();
    backend.setItem(META_KEY, JSON.stringify({ deviceId: "not-a-uuid" }));
    backend.setItem(gameKey("demo", "unlimited"), JSON.stringify({ bestRun: 3, runsPlayed: 4 }));
    const store = setup(backend);
    expect(store.getMeta().deviceId).toBe(UUID);
    expect(store.getUnlimited("demo")).toEqual({ bestRun: 3, runsPlayed: 4 });
  });

  it("returns the same object until the key changes", () => {
    const store = setup();
    store.recordDailyCompletion("demo", 1, { answers: [], score: 1 });
    const first = store.getStats("demo");
    expect(store.getStats("demo")).toBe(first);
    store.recordDailyCompletion("demo", 2, { answers: [], score: 1 });
    expect(store.getStats("demo")).not.toBe(first);
  });
});

describe("streaks", () => {
  it("counts consecutive puzzle numbers", () => {
    const store = setup();
    store.recordDailyCompletion("demo", 4, { answers: [], score: 1 });
    store.recordDailyCompletion("demo", 5, { answers: [], score: 2 });
    const stats = store.recordDailyCompletion("demo", 6, { answers: [], score: 2 });
    expect(stats).toMatchObject({
      completed: 3,
      currentStreak: 3,
      bestStreak: 3,
      lastCompleted: 6,
      histogram: { "1": 1, "2": 2 },
    });
  });

  it("restarts at 1 after a gap and keeps the best streak", () => {
    const store = setup();
    for (const n of [1, 2, 3]) store.recordDailyCompletion("demo", n, { answers: [], score: 1 });
    const stats = store.recordDailyCompletion("demo", 5, { answers: [], score: 1 });
    expect(stats.currentStreak).toBe(1);
    expect(stats.bestStreak).toBe(3);
  });

  it("ignores completing the same puzzle twice", () => {
    const store = setup();
    store.recordDailyCompletion("demo", 1, { answers: [], score: 1 });
    const stats = store.recordDailyCompletion("demo", 1, { answers: [], score: 9 });
    expect(stats.completed).toBe(1);
    expect(store.getHistory("demo")["1"]?.score).toBe(1);
  });

  it("counts a puzzle as played once, and completion after start does not double count", () => {
    const store = setup();
    store.recordDailyStart("demo", 1);
    store.recordDailyStart("demo", 1);
    store.saveDailyProgress("demo", 1, ["half"]);
    expect(store.getHistory("demo")["1"]?.answers).toEqual(["half"]);
    const stats = store.recordDailyCompletion("demo", 1, { answers: ["half", "done"], score: 2 });
    expect(stats.played).toBe(1);
    expect(store.hasCompleted("demo", 1)).toBe(true);
  });

  it("shows a streak only while it is unbroken", () => {
    const stats = { ...EMPTY_STATS, currentStreak: 4, lastCompleted: 10 };
    expect(effectiveStreak(stats, 10)).toBe(4);
    expect(effectiveStreak(stats, 11)).toBe(4);
    expect(effectiveStreak(stats, 12)).toBe(0);
    expect(effectiveStreak(EMPTY_STATS, 1)).toBe(0);
  });

  it("keeps unlimited play away from daily stats", () => {
    const store = setup();
    store.recordUnlimitedRun("demo", 12);
    store.recordUnlimitedRun("demo", 8);
    expect(store.getUnlimited("demo")).toEqual({ bestRun: 12, runsPlayed: 2 });
    expect(store.getStats("demo")).toEqual(EMPTY_STATS);
  });

  it("keeps each game's data separate", () => {
    const store = setup();
    store.recordDailyCompletion("one", 1, { answers: [], score: 1 });
    expect(store.getStats("two")).toEqual(EMPTY_STATS);
  });
});

describe("migrations", () => {
  it("runs matching migrations and survives failing ones", () => {
    const backend = memoryBackend();
    backend.setItem("plimp:v0:meta", "{}");
    const ran = runMigrations(backend, [
      {
        name: "v0-to-v1",
        applies: (b) => b.getItem("plimp:v0:meta") !== null,
        migrate: (b) => b.removeItem("plimp:v0:meta"),
      },
      {
        name: "broken",
        applies: () => true,
        migrate: () => {
          throw new Error("boom");
        },
      },
      { name: "not-needed", applies: () => false, migrate: () => undefined },
    ]);
    expect(ran).toEqual(["v0-to-v1"]);
    expect(backend.getItem("plimp:v0:meta")).toBeNull();
  });
});

describe("randomUuid", () => {
  it("falls back to getRandomValues outside secure contexts", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(0xab),
    });
    expect(randomUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe("subscribe", () => {
  it("notifies on writes", () => {
    const store = setup();
    store.getMeta(); // creating meta is itself a write
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.updateMeta({ sound: true });
    unsubscribe();
    store.updateMeta({ sound: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
