import * as z from "zod/mini";
import { deviceTimeZone, localIsoDate } from "./daily";
import { META_KEY, STORAGE_PREFIX, gameKey } from "./storage-keys";

// Player state on the device. Versioned, namespaced localStorage keys (see storage-keys.ts):
//   plimp:v1:meta             device ID, first visit, theme, sound, preferences
//   plimp:v1:<game>:stats     daily stats and streaks
//   plimp:v1:<game>:history   per puzzle number: answers, score, finish time
//   plimp:v1:<game>:unlimited best run, runs played
//   plimp:v1:<game>:polls     the option this device picked in each one-tap poll
// Every read is validated with Zod; a corrupt key is reset on its own. When storage is blocked
// (private mode, disabled cookies, quota) everything keeps working in memory for the session.

// ---------------------------------------------------------------------------------------------
// Schemas

const isoDate = z.iso.date();
const count = z.int().check(z.nonnegative());
const puzzleNumber = z.int().check(z.positive());

export const themePreferenceSchema = z.enum(["system", "light", "dark"]);
export type ThemePreference = z.infer<typeof themePreferenceSchema>;

export const metaSchema = z.object({
  /** Random UUID, used only to dedupe crowd submissions. Never sent to analytics. */
  deviceId: z.uuid(),
  firstVisit: isoDate,
  theme: themePreferenceSchema,
  sound: z.boolean(),
  /** Preferences games can add, e.g. { currency: "CHF" }. */
  prefs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  /** Games whose how-to sheet has been shown. */
  howToSeen: z.array(z.string()),
  /** return_day milestones already reported (1, 7, 30). */
  returnMilestones: z.array(z.int()),
});
export type Meta = z.infer<typeof metaSchema>;

export const statsSchema = z.object({
  played: count,
  completed: count,
  currentStreak: count,
  bestStreak: count,
  lastCompleted: z.nullable(puzzleNumber),
  /** Last puzzle counted as played, so replays of the same puzzle do not add up. */
  lastPlayed: z.nullable(puzzleNumber),
  /** Score -> number of completed puzzles with that score. */
  histogram: z.record(z.string(), count),
});
export type Stats = z.infer<typeof statsSchema>;

export const historyEntrySchema = z.object({
  /** Game-specific answers, in order. */
  answers: z.array(z.unknown()),
  score: z.optional(z.number()),
  startedAt: z.iso.datetime(),
  finishedAt: z.optional(z.iso.datetime()),
});
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

/** Keyed by puzzle number. */
export const historySchema = z.record(z.string().check(z.regex(/^\d+$/)), historyEntrySchema);
export type History = z.infer<typeof historySchema>;

export const unlimitedSchema = z.object({
  bestRun: count,
  runsPlayed: count,
});
export type Unlimited = z.infer<typeof unlimitedSchema>;

/** Poll ID -> option picked on this device. */
export const pollVotesSchema = z.record(z.string(), z.string());
export type PollVotes = z.infer<typeof pollVotesSchema>;

export const EMPTY_STATS: Stats = Object.freeze({
  played: 0,
  completed: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastCompleted: null,
  lastPlayed: null,
  histogram: {},
}) as Stats;

export const EMPTY_HISTORY: History = Object.freeze({}) as History;
export const EMPTY_UNLIMITED: Unlimited = Object.freeze({ bestRun: 0, runsPlayed: 0 }) as Unlimited;
export const EMPTY_POLL_VOTES: PollVotes = Object.freeze({}) as PollVotes;

// ---------------------------------------------------------------------------------------------
// Backend: localStorage with an in-memory fallback

export interface KeyValueBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

export function memoryBackend(): KeyValueBackend {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    keys: () => [...map.keys()],
  };
}

/**
 * Wraps a Storage-like object so no call can throw. The first failure switches the whole session
 * to memory, seeded with whatever could still be read, so reads and writes stay consistent.
 */
export function safeBackend(getStorage: () => Storage | null | undefined): KeyValueBackend {
  const memory = memoryBackend();
  let storage: Storage | null = null;
  try {
    storage = getStorage() ?? null;
    if (storage) {
      const probe = `${STORAGE_PREFIX}:probe`;
      storage.setItem(probe, "1");
      storage.removeItem(probe);
    }
  } catch {
    storage = null;
  }

  function fallBackToMemory() {
    if (!storage) return;
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          const value = storage.getItem(key);
          if (value !== null) memory.setItem(key, value);
        }
      }
    } catch {
      // Nothing more can be rescued.
    }
    storage = null;
  }

  function attempt<T>(op: (s: Storage) => T, fallback: () => T): T {
    if (storage) {
      try {
        return op(storage);
      } catch {
        fallBackToMemory();
      }
    }
    return fallback();
  }

  return {
    getItem: (key) =>
      attempt(
        (s) => s.getItem(key),
        () => memory.getItem(key),
      ),
    setItem: (key, value) =>
      attempt(
        (s) => s.setItem(key, value),
        () => memory.setItem(key, value),
      ),
    removeItem: (key) =>
      attempt(
        (s) => s.removeItem(key),
        () => memory.removeItem(key),
      ),
    keys: () =>
      attempt(
        (s) => Array.from({ length: s.length }, (_, i) => s.key(i)).filter((k): k is string => !!k),
        () => memory.keys(),
      ),
  };
}

// ---------------------------------------------------------------------------------------------
// Migrations

/**
 * A migration moves data written by an older STORAGE_VERSION to the current one. It runs once, on
 * the first storage access of a session, when `applies` finds old keys. Add entries here when a
 * schema change cannot be read by the current schemas.
 */
export interface StorageMigration {
  name: string;
  applies(backend: KeyValueBackend): boolean;
  migrate(backend: KeyValueBackend): void;
}

export const MIGRATIONS: StorageMigration[] = [];

export function runMigrations(backend: KeyValueBackend, migrations = MIGRATIONS): string[] {
  const ran: string[] = [];
  for (const migration of migrations) {
    try {
      if (migration.applies(backend)) {
        migration.migrate(backend);
        ran.push(migration.name);
      }
    } catch {
      // A failed migration must never block play; the old keys stay where they are.
    }
  }
  return ran;
}

// ---------------------------------------------------------------------------------------------
// Player storage

export interface PlayerStorageOptions {
  backend: KeyValueBackend;
  now?: () => Date;
  timeZone?: () => string;
  randomUuid?: () => string;
  migrations?: StorageMigration[];
}

/** crypto.randomUUID needs a secure context; getRandomValues works everywhere. */
export function randomUuid(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") {
    try {
      return c.randomUUID();
    } catch {
      // Insecure context; fall through.
    }
  }
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createPlayerStorage(options: PlayerStorageOptions) {
  const { backend } = options;
  const now = options.now ?? (() => new Date());
  const timeZone = options.timeZone ?? deviceTimeZone;
  const newUuid = options.randomUuid ?? randomUuid;
  const listeners = new Set<() => void>();
  // Parsed values keyed by their raw JSON, so unchanged keys return the same object
  // (required by React's useSyncExternalStore).
  const cache = new Map<string, { raw: string; value: unknown }>();

  runMigrations(backend, options.migrations ?? MIGRATIONS);

  function notify() {
    for (const listener of listeners) listener();
  }

  function read<T, F = T>(key: string, schema: z.ZodMiniType<T>, fallback: F): T | F {
    const raw = backend.getItem(key);
    if (raw === null) return fallback;
    const cached = cache.get(key);
    if (cached && cached.raw === raw) return cached.value as T;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      backend.removeItem(key);
      return fallback;
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      backend.removeItem(key);
      return fallback;
    }
    cache.set(key, { raw, value: result.data });
    return result.data;
  }

  function write<T>(key: string, value: T): T {
    const raw = JSON.stringify(value);
    backend.setItem(key, raw);
    cache.set(key, { raw, value });
    notify();
    return value;
  }

  function freshMeta(): Meta {
    return {
      deviceId: newUuid(),
      firstVisit: localIsoDate(now(), timeZone()),
      theme: "system",
      sound: false,
      prefs: {},
      howToSeen: [],
      returnMilestones: [],
    };
  }

  /** Meta if it exists, without creating it (safe to call while React renders). */
  function peekMeta(): Meta | null {
    return read(META_KEY, metaSchema, null);
  }

  function getMeta(): Meta {
    return peekMeta() ?? write(META_KEY, freshMeta());
  }

  function updateMeta(patch: Partial<Meta> | ((meta: Meta) => Partial<Meta>)): Meta {
    const meta = getMeta();
    const changes = typeof patch === "function" ? patch(meta) : patch;
    return write(META_KEY, metaSchema.parse({ ...meta, ...changes }));
  }

  const getStats = (game: string) => read(gameKey(game, "stats"), statsSchema, EMPTY_STATS);
  const getHistory = (game: string) => read(gameKey(game, "history"), historySchema, EMPTY_HISTORY);
  const getUnlimited = (game: string) =>
    read(gameKey(game, "unlimited"), unlimitedSchema, EMPTY_UNLIMITED);
  const getPollVotes = (game: string) =>
    read(gameKey(game, "polls"), pollVotesSchema, EMPTY_POLL_VOTES);

  /** Remembers this device's pick in a one-tap poll. The first vote sticks, like on the server. */
  function recordPollVote(game: string, pollId: string, option: string): PollVotes {
    const votes = getPollVotes(game);
    if (votes[pollId] !== undefined) return votes;
    return write(gameKey(game, "polls"), { ...votes, [pollId]: option });
  }

  /** Counts a daily puzzle as played, once per puzzle. */
  function recordDailyStart(game: string, puzzle: number): Stats {
    const stats = getStats(game);
    const history = getHistory(game);
    if (!history[String(puzzle)]) {
      write(gameKey(game, "history"), {
        ...history,
        [String(puzzle)]: { answers: [], startedAt: now().toISOString() },
      });
    }
    if (stats.lastPlayed !== null && puzzle <= stats.lastPlayed) return stats;
    return write(gameKey(game, "stats"), {
      ...stats,
      played: stats.played + 1,
      lastPlayed: puzzle,
    });
  }

  /** Saves answers for an unfinished daily puzzle, so a reload can resume it. */
  function saveDailyProgress(game: string, puzzle: number, answers: unknown[]): void {
    const history = getHistory(game);
    const entry = history[String(puzzle)];
    if (entry?.finishedAt) return;
    write(gameKey(game, "history"), {
      ...history,
      [String(puzzle)]: { answers, startedAt: entry?.startedAt ?? now().toISOString() },
    });
  }

  /**
   * Records a finished daily puzzle. A streak counts consecutive puzzle numbers completed.
   * Completing the same puzzle twice changes nothing.
   */
  function recordDailyCompletion(
    game: string,
    puzzle: number,
    result: { answers: unknown[]; score: number },
  ): Stats {
    const history = getHistory(game);
    const existing = history[String(puzzle)];
    if (existing?.finishedAt) return getStats(game);

    const finishedAt = now().toISOString();
    write(gameKey(game, "history"), {
      ...history,
      [String(puzzle)]: {
        answers: result.answers,
        score: result.score,
        startedAt: existing?.startedAt ?? finishedAt,
        finishedAt,
      },
    });

    const stats = getStats(game);
    const scoreKey = String(result.score);
    const next: Stats = {
      ...stats,
      played:
        stats.lastPlayed !== null && puzzle <= stats.lastPlayed ? stats.played : stats.played + 1,
      lastPlayed: Math.max(stats.lastPlayed ?? 0, puzzle),
      completed: stats.completed + 1,
      histogram: { ...stats.histogram, [scoreKey]: (stats.histogram[scoreKey] ?? 0) + 1 },
    };
    if (stats.lastCompleted === null || puzzle > stats.lastCompleted) {
      next.currentStreak = stats.lastCompleted === puzzle - 1 ? stats.currentStreak + 1 : 1;
      next.bestStreak = Math.max(stats.bestStreak, next.currentStreak);
      next.lastCompleted = puzzle;
    }
    return write(gameKey(game, "stats"), next);
  }

  /** Unlimited play has its own record and never touches daily stats or streaks. */
  function recordUnlimitedRun(game: string, runScore: number): Unlimited {
    const unlimited = getUnlimited(game);
    return write(gameKey(game, "unlimited"), {
      bestRun: Math.max(unlimited.bestRun, Math.max(0, Math.floor(runScore))),
      runsPlayed: unlimited.runsPlayed + 1,
    });
  }

  function hasCompleted(game: string, puzzle: number): boolean {
    return Boolean(getHistory(game)[String(puzzle)]?.finishedAt);
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    backend,
    peekMeta,
    getMeta,
    updateMeta,
    getStats,
    getHistory,
    getUnlimited,
    getPollVotes,
    recordPollVote,
    recordDailyStart,
    saveDailyProgress,
    recordDailyCompletion,
    recordUnlimitedRun,
    hasCompleted,
    subscribe,
    /** Call when another tab changed storage (the `storage` event). */
    notifyExternalChange: notify,
  };
}

export type PlayerStorage = ReturnType<typeof createPlayerStorage>;

/**
 * The streak to show today: the stored streak still counts if the last completed puzzle is
 * today's or yesterday's, otherwise it has been broken.
 */
export function effectiveStreak(stats: Stats, todayPuzzle: number): number {
  if (stats.lastCompleted === null) return 0;
  return todayPuzzle - stats.lastCompleted <= 1 ? stats.currentStreak : 0;
}

let browserStorage: PlayerStorage | null = null;

/** The shared player storage for this browser tab. Server renders get a throwaway memory store. */
export function playerStorage(): PlayerStorage {
  if (typeof window === "undefined") return createPlayerStorage({ backend: memoryBackend() });
  if (!browserStorage) {
    const storage = createPlayerStorage({ backend: safeBackend(() => window.localStorage) });
    window.addEventListener("storage", (event) => {
      if (event.key === null || event.key.startsWith(STORAGE_PREFIX))
        storage.notifyExternalChange();
    });
    browserStorage = storage;
  }
  return browserStorage;
}
