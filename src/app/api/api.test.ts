import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PLACEHOLDER_GAME } from "@/frame/placeholders";
import { requireReleasedPuzzle } from "@/lib/crowd/games";
import { hashIp } from "@/lib/crowd/http";
import { MIN_GUESSES, MIN_POLL_VOTES, WRITE_RATE_LIMIT } from "@/lib/crowd/limits";
import { memoryCrowdStore, resetMemoryCrowdStore } from "@/lib/crowd/memory-store";
import { GET as cronFreeze } from "./cron/freeze/route";
import { GET as crowd } from "./crowd/route";
import { POST as guess } from "./guess/route";
import { GET as health } from "./health/route";
import { POST as report } from "./report/route";
import { GET as results } from "./results/route";
import { POST as vote } from "./vote/route";

// sticker-shock uses polls, fair-guess uses guesses, handshoe uses neither. They are hidden, which
// is reachable here because tests do not run with NODE_ENV=production.

const DEVICE = "123e4567-e89b-42d3-a456-426614174000";
let ipCounter = 0;

function post(
  path: string,
  body: unknown,
  init: { ip?: string; headers?: Record<string, string> } = {},
) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": init.ip ?? `203.0.113.${++ipCounter % 250}`,
      ...init.headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const get = (path: string, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${path}`, { headers });

const device = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

beforeEach(() => {
  vi.stubEnv("CROWD_STORE", "memory");
  vi.stubEnv("IP_HASH_SALT", "test-salt");
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
  resetMemoryCrowdStore();
});

describe("POST /api/vote", () => {
  const body = { game: "sticker-shock", pollId: "sticker-shock:p1", option: "a", deviceId: DEVICE };

  it("stores a vote and answers 204", async () => {
    const res = await vote(post("/api/vote", body));
    expect(res.status).toBe(204);
    expect((await memoryCrowdStore().pollResults("sticker-shock:p1")).total).toBe(1);
  });

  it("is idempotent: a repeat from the same device also returns 204 and changes nothing", async () => {
    await vote(post("/api/vote", body));
    const res = await vote(post("/api/vote", { ...body, option: "b" }));
    expect(res.status).toBe(204);
    const tally = await memoryCrowdStore().pollResults("sticker-shock:p1");
    expect(tally.options).toEqual([{ option: "a", votes: 1 }]);
  });

  it.each([
    ["an unknown game", { ...body, game: "nope", pollId: "nope:p1" }, 404],
    ["a game without polls", { ...body, game: "handshoe", pollId: "handshoe:p1" }, 404],
    ["a poll of another game", { ...body, pollId: "handshoe:p1" }, 400],
    ["a bad device ID", { ...body, deviceId: "me" }, 400],
    ["extra fields", { ...body, email: "someone@example.test" }, 400],
  ])("rejects %s", async (_label, payload, status) => {
    expect((await vote(post("/api/vote", payload))).status).toBe(status);
  });

  it("rejects bodies that are not JSON or too large", async () => {
    expect((await vote(post("/api/vote", "{nope"))).status).toBe(400);
    expect(
      (await vote(post("/api/vote", body, { headers: { "content-type": "text/plain" } }))).status,
    ).toBe(415);
    const huge = { ...body, pad: "x".repeat(5000) };
    expect((await vote(post("/api/vote", huge))).status).toBe(413);
  });

  it("rate-limits writes per hashed IP", async () => {
    const ip = "198.51.100.7";
    for (let i = 0; i < WRITE_RATE_LIMIT.max; i++) {
      const res = await vote(post("/api/vote", { ...body, deviceId: device(i) }, { ip }));
      expect(res.status).toBe(204);
    }
    const limited = await vote(post("/api/vote", { ...body, deviceId: device(999) }, { ip }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe(String(WRITE_RATE_LIMIT.windowSeconds));
    // Another IP is unaffected.
    expect((await vote(post("/api/vote", { ...body, deviceId: device(1000) }))).status).toBe(204);
  });

  it("answers 503 without a configured store", async () => {
    vi.stubEnv("CROWD_STORE", "");
    vi.stubEnv("SUPABASE_URL", "");
    expect((await vote(post("/api/vote", body))).status).toBe(503);
  });
});

describe("POST /api/guess", () => {
  const body = { game: "fair-guess", puzzle: 1, itemId: "item-1", value: 42, deviceId: DEVICE };

  it("stores one guess per device and item", async () => {
    expect((await guess(post("/api/guess", body))).status).toBe(204);
    expect((await guess(post("/api/guess", { ...body, value: 7 }))).status).toBe(204);
    expect(await memoryCrowdStore().crowdMedian("fair-guess", 1, "item-1")).toEqual({
      n: 1,
      median: 42,
    });
  });

  it("rejects games without guesses and non-finite values", async () => {
    expect((await guess(post("/api/guess", { ...body, game: "handshoe" }))).status).toBe(404);
    // JSON has no Infinity, but 1e400 parses to it.
    const infinite = JSON.stringify({ ...body, value: 0 }).replace('"value":0', '"value":1e400');
    expect((await guess(post("/api/guess", infinite))).status).toBe(400);
  });

  it("rejects puzzles that are not released anywhere yet", () => {
    expect(() => requireReleasedPuzzle(PLACEHOLDER_GAME, 1)).not.toThrow();
    expect(() => requireReleasedPuzzle(PLACEHOLDER_GAME, 99_999)).toThrow(/not released/);
  });
});

describe("POST /api/report", () => {
  const body = { game: "handshoe", itemId: "item-1", message: "The source says something else." };

  it("accepts a report for any game", async () => {
    expect((await report(post("/api/report", body))).status).toBe(204);
  });

  it("limits messages to 1,000 characters and rejects empty ones", async () => {
    expect((await report(post("/api/report", { ...body, message: "x".repeat(1001) }))).status).toBe(
      400,
    );
    expect((await report(post("/api/report", { ...body, message: "   " }))).status).toBe(400);
  });
});

describe("GET /api/results", () => {
  const url = "/api/results?poll=sticker-shock:p1";

  async function seedVotes(a: number, b: number) {
    const store = memoryCrowdStore();
    for (let i = 0; i < a + b; i++) {
      await store.insertVote({
        game: "sticker-shock",
        pollId: "sticker-shock:p1",
        option: i < a ? "a" : "b",
        deviceId: device(i),
      });
    }
  }

  it("hides the split below the minimum sample", async () => {
    await seedVotes(150, MIN_POLL_VOTES - 151);
    const res = await results(get(url));
    expect(await res.json()).toEqual({ ready: false, n: MIN_POLL_VOTES - 1 });
  });

  it("returns the split once enough votes are in, from the snapshot after a freeze", async () => {
    await seedVotes(150, 50);
    const live = await (await results(get(url))).json();
    expect(live).toEqual({
      ready: true,
      n: 200,
      options: [
        { option: "a", votes: 150, share: 0.75 },
        { option: "b", votes: 50, share: 0.25 },
      ],
      frozenAt: null,
    });

    await memoryCrowdStore().freezePolls();
    await memoryCrowdStore().insertVote({
      game: "sticker-shock",
      pollId: "sticker-shock:p1",
      option: "b",
      deviceId: device(5000),
    });
    const res = await results(get(url));
    const frozen = await res.json();
    expect(frozen.n).toBe(200);
    expect(frozen.frozenAt).toEqual(expect.any(String));
    expect(res.headers.get("cache-control")).toContain("s-maxage=3600");
  });

  it("validates the poll ID", async () => {
    expect((await results(get("/api/results?poll=bad id"))).status).toBe(400);
    expect((await results(get("/api/results?poll=handshoe:p1"))).status).toBe(404);
  });
});

describe("GET /api/crowd", () => {
  const url = "/api/crowd?game=fair-guess&puzzle=1&item=item-1";

  async function seedGuesses(values: number[]) {
    for (const [i, value] of values.entries()) {
      await memoryCrowdStore().insertGuess({
        game: "fair-guess",
        puzzle: 1,
        itemId: "item-1",
        value,
        deviceId: device(i),
      });
    }
  }

  it("hides the median below the minimum sample", async () => {
    await seedGuesses(Array.from({ length: MIN_GUESSES - 1 }, (_, i) => i + 1));
    expect(await (await crowd(get(url))).json()).toEqual({ ready: false, n: MIN_GUESSES - 1 });
  });

  it("returns the median and a log histogram once enough guesses are in", async () => {
    await seedGuesses(Array.from({ length: MIN_GUESSES }, (_, i) => i + 1));
    const body = await (await crowd(get(url))).json();
    expect(body.ready).toBe(true);
    expect(body.n).toBe(MIN_GUESSES);
    expect(body.median).toBe(25.5);
    expect(body.histogram.reduce((sum: number, bin: { count: number }) => sum + bin.count, 0)).toBe(
      MIN_GUESSES,
    );
  });

  it("validates the query", async () => {
    expect((await crowd(get("/api/crowd?game=fair-guess&puzzle=x&item=item-1"))).status).toBe(400);
    expect((await crowd(get("/api/crowd?game=handshoe&puzzle=1&item=item-1"))).status).toBe(404);
  });
});

describe("GET /api/health", () => {
  it("reports the store", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, store: "memory" });
  });

  it("answers 503 when no store is configured", async () => {
    vi.stubEnv("CROWD_STORE", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await health()).status).toBe(503);
  });
});

describe("GET /api/cron/freeze", () => {
  it("rejects requests without the secret", async () => {
    expect((await cronFreeze(get("/api/cron/freeze"))).status).toBe(401);
    expect(
      (await cronFreeze(get("/api/cron/freeze", { authorization: "Bearer wrong" }))).status,
    ).toBe(401);
  });

  it("rejects everything when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await cronFreeze(get("/api/cron/freeze", { authorization: "Bearer " }))).status).toBe(
      401,
    );
  });

  it("freezes polls with the secret", async () => {
    await memoryCrowdStore().insertVote({
      game: "sticker-shock",
      pollId: "sticker-shock:p1",
      option: "a",
      deviceId: DEVICE,
    });
    const res = await cronFreeze(
      get("/api/cron/freeze", { authorization: "Bearer test-cron-secret" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ frozen: 1 });
  });
});

describe("hashIp", () => {
  it("depends on the IP, the salt and the UTC day, and hides the IP", () => {
    const day1 = new Date("2026-01-01T12:00:00Z");
    const day2 = new Date("2026-01-02T12:00:00Z");
    const a = hashIp("198.51.100.7", "salt", day1);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("198.51");
    expect(hashIp("198.51.100.7", "salt", day1)).toBe(a);
    expect(hashIp("198.51.100.7", "salt", day2)).not.toBe(a);
    expect(hashIp("198.51.100.7", "other", day1)).not.toBe(a);
    expect(hashIp("198.51.100.8", "salt", day1)).not.toBe(a);
  });
});

describe("GET /api/puzzle/[game]/[n]", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "plimp-content-"));
    mkdirSync(join(dir, "content", "fixture-game", "daily"), { recursive: true });
    writeFileSync(
      join(dir, "content", "fixture-game", "daily", "0001.json"),
      JSON.stringify({ puzzle: 1, sample: true }),
    );
    vi.spyOn(process, "cwd").mockReturnValue(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.doUnmock("@/games/registry");
    vi.resetModules();
  });

  async function loadRoute(launchDate: string) {
    vi.resetModules();
    vi.doMock("@/games/registry", () => ({
      getGame: (slug: string) =>
        slug === "fixture-game"
          ? { ...PLACEHOLDER_GAME, slug: "fixture-game", status: "live", launchDate }
          : undefined,
      isGameReachable: () => true,
    }));
    return (await import("./puzzle/[game]/[n]/route")).GET;
  }

  const call = (GET: Awaited<ReturnType<typeof loadRoute>>, game: string, n: string) =>
    GET(get(`/api/puzzle/${game}/${n}`), { params: Promise.resolve({ game, n }) });

  it("serves a released puzzle with a long, immutable cache", async () => {
    const GET = await loadRoute("2000-01-01");
    const res = await call(GET, "fixture-game", "1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ puzzle: 1, sample: true });
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(res.headers.get("cache-control")).toContain("s-maxage=31536000");
  });

  it("404s future puzzles, bad numbers, missing files and unknown games, without caching", async () => {
    const tomorrowLaunch = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const future = await call(await loadRoute(tomorrowLaunch), "fixture-game", "1");
    expect(future.status).toBe(404);
    expect(future.headers.get("cache-control")).toBe("no-store");

    const GET = await loadRoute("2000-01-01");
    for (const [game, n] of [
      ["fixture-game", "0"],
      ["fixture-game", "abc"],
      ["fixture-game", "2"],
      ["fixture-game", "../../secret"],
      ["unknown", "1"],
    ] as const) {
      expect((await call(GET, game, n)).status).toBe(404);
    }
  });
});
