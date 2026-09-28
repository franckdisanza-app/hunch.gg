import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { MIN_GUESSES, MIN_POLL_VOTES } from "@/lib/crowd/limits";

// Runs the real migrations in PGlite (Postgres compiled to WebAssembly), so the SQL functions and
// the access rules are tested on every CI run without Docker or a Supabase project.

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

// What a Supabase project provides before any migration runs: the API roles and default grants.
const SUPABASE_BASELINE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const DEVICE = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
];

let db: PGlite;

async function rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_BASELINE);
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(
    "truncate public.votes, public.guesses, public.reports, public.poll_snapshots, public.rate_limits",
  );
});

describe("tables", () => {
  it("allows one vote per device and poll", async () => {
    const insert =
      "insert into public.votes (game, poll_id, option, device_id) values ($1, $2, $3, $4)";
    await db.query(insert, ["demo", "demo:1", "a", DEVICE[0]]);
    await expect(db.query(insert, ["demo", "demo:1", "b", DEVICE[0]])).rejects.toThrow(
      /votes_one_per_device/,
    );
  });

  it("allows one guess per device and item", async () => {
    const insert =
      "insert into public.guesses (game, puzzle, item_id, value, device_id) values ($1, $2, $3, $4, $5)";
    await db.query(insert, ["demo", 1, "item", 5, DEVICE[0]]);
    await expect(db.query(insert, ["demo", 1, "item", 6, DEVICE[0]])).rejects.toThrow(
      /guesses_one_per_device/,
    );
  });

  it("rejects NaN guesses and over-long reports", async () => {
    await expect(
      db.query(
        "insert into public.guesses (game, puzzle, item_id, value, device_id) values ('demo', 1, 'x', 'NaN', $1)",
        [DEVICE[0]],
      ),
    ).rejects.toThrow(/check/);
    await expect(
      db.query("insert into public.reports (game, item_id, message) values ('demo', 'x', $1)", [
        "x".repeat(1001),
      ]),
    ).rejects.toThrow(/check/);
  });

  it("gives new reports the status 'new'", async () => {
    const [report] = await rows<{ status: string }>(
      "insert into public.reports (game, item_id, message) values ('demo', 'x', 'Fake report') returning status",
    );
    expect(report?.status).toBe("new");
  });
});

describe("pair_accuracy (Sticker Shock)", () => {
  it("gives the share of right answers and the count per pair", async () => {
    const insert =
      "insert into public.guesses (game, puzzle, item_id, value, device_id) values ($1, $2, $3, $4, $5)";
    await db.query(insert, ["sticker-shock", 3, "p0003-01", 1, DEVICE[0]]);
    await db.query(insert, ["sticker-shock", 3, "p0003-01", 0, DEVICE[1]]);
    await db.query(insert, ["sticker-shock", 3, "p0003-01", 1, DEVICE[2]]);
    await db.query(insert, ["sticker-shock", 3, "p0003-02", 0, DEVICE[0]]);
    await db.query(insert, ["fair-guess", 3, "p0003-01", 42, DEVICE[0]]);
    const result = await rows<{ pair_id: string; n: number; share_correct: number }>(
      "select pair_id, n, share_correct from public.pair_accuracy order by pair_id",
    );
    expect(result).toEqual([
      { pair_id: "p0003-01", n: 3, share_correct: 2 / 3 },
      { pair_id: "p0003-02", n: 1, share_correct: 0 },
    ]);
  });
});

describe("access", () => {
  it("turns on row-level security for every table", async () => {
    const tables = await rows<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname",
    );
    expect(tables).toEqual([
      { relname: "guesses", relrowsecurity: true },
      { relname: "poll_snapshots", relrowsecurity: true },
      { relname: "rate_limits", relrowsecurity: true },
      { relname: "reports", relrowsecurity: true },
      { relname: "votes", relrowsecurity: true },
    ]);
  });

  it("has no policies at all", async () => {
    expect(await rows("select * from pg_policies where schemaname = 'public'")).toEqual([]);
  });

  it.each(["anon", "authenticated"])("locks %s out of tables and functions", async (role) => {
    await db.exec(`set role ${role}`);
    try {
      await expect(db.query("select * from public.votes")).rejects.toThrow(/permission denied/);
      await expect(
        db.query("insert into public.reports (game, item_id, message) values ('demo', 'x', 'hi')"),
      ).rejects.toThrow(/permission denied/);
      await expect(db.query("select public.hit_rate_limit('k', 1, 60)")).rejects.toThrow(
        /permission denied/,
      );
      await expect(db.query("select public.freeze_polls()")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.pair_accuracy")).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });

  it("lets the server role use everything", async () => {
    await db.exec("set role service_role");
    try {
      await db.query(
        "insert into public.votes (game, poll_id, option, device_id) values ('demo', 'demo:1', 'a', $1)",
        [DEVICE[0]],
      );
      expect(await rows("select * from public.votes")).toHaveLength(1);
      await db.query("select public.freeze_polls()");
      expect(await rows("select * from public.pair_accuracy")).toEqual([]);
    } finally {
      await db.exec("reset role");
    }
  });
});

describe("hit_rate_limit", () => {
  it("reports true once a key goes over the limit in a window", async () => {
    const hit = async (key: string) =>
      (await rows<{ hit: boolean }>("select public.hit_rate_limit($1, 2, 60) as hit", [key]))[0]
        ?.hit;
    expect(await hit("ip-a")).toBe(false);
    expect(await hit("ip-a")).toBe(false);
    expect(await hit("ip-a")).toBe(true);
    expect(await hit("ip-b")).toBe(false);
  });
});

describe("crowd_median", () => {
  it("returns the count and median of one item's guesses", async () => {
    for (const [i, value] of [1, 2, 3, 4].entries()) {
      await db.query(
        "insert into public.guesses (game, puzzle, item_id, value, device_id) values ('demo', 1, 'item', $1, $2)",
        [value, DEVICE[i]],
      );
    }
    await db.query(
      "insert into public.guesses (game, puzzle, item_id, value, device_id) values ('demo', 2, 'item', 99, $1)",
      [DEVICE[0]],
    );
    expect(await rows("select * from public.crowd_median('demo', 1, 'item')")).toEqual([
      { n: 4, median: 2.5 },
    ]);
    expect(await rows("select * from public.crowd_median('demo', 3, 'item')")).toEqual([
      { n: 0, median: null },
    ]);
  });
});

describe("crowd_histogram", () => {
  async function guess(values: number[]) {
    for (const [i, value] of values.entries()) {
      await db.query(
        "insert into public.guesses (game, puzzle, item_id, value, device_id) values ('demo', 1, 'item', $1, $2)",
        [value, `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`],
      );
    }
  }

  type Bin = { bin: number; bin_from: number; bin_to: number; count: number };

  it("bins positive guesses on a log scale", async () => {
    await guess([2, 20, 200, 1000, 0, -5]);
    const bins = await rows<Bin>("select * from public.crowd_histogram('demo', 1, 'item', 3)");
    expect(bins.map((b) => b.count)).toEqual([1, 1, 2]);
    expect(bins[0]?.bin_from).toBeCloseTo(2);
    expect(bins[2]?.bin_to).toBeCloseTo(1000);
    // Equal width in log space: each bin spans the same ratio.
    const ratios = bins.map((b) => b.bin_to / b.bin_from);
    expect(ratios[0]).toBeCloseTo(ratios[1]!);
    expect(ratios[1]).toBeCloseTo(ratios[2]!);
  });

  it("puts identical guesses in the first bin", async () => {
    await guess([7, 7, 7]);
    const bins = await rows<Bin>("select * from public.crowd_histogram('demo', 1, 'item', 4)");
    expect(bins.map((b) => b.count)).toEqual([3, 0, 0, 0]);
  });

  it("returns nothing without positive guesses", async () => {
    await guess([0, -1]);
    expect(await rows("select * from public.crowd_histogram('demo', 1, 'item')")).toEqual([]);
  });
});

describe("freeze_polls and poll_results", () => {
  async function vote(option: string, device: string) {
    await db.query(
      "insert into public.votes (game, poll_id, option, device_id) values ('demo', 'demo:1', $1, $2)",
      [option, device],
    );
  }
  type Result = { option: string; votes: number; total: number; frozen_at: Date | null };
  const results = async () =>
    (await rows<Result>("select * from public.poll_results('demo:1')")).sort((a, b) =>
      a.option.localeCompare(b.option),
    );

  it("serves live counts until the first freeze, then the latest snapshot", async () => {
    await vote("a", DEVICE[0]!);
    await vote("a", DEVICE[1]!);
    await vote("b", DEVICE[2]!);

    const live = await results();
    expect(
      live.map(({ option, votes, total, frozen_at }) => [option, votes, total, frozen_at]),
    ).toEqual([
      ["a", 2, 3, null],
      ["b", 1, 3, null],
    ]);

    const [{ frozen } = { frozen: 0 }] = await rows<{ frozen: number }>(
      "select public.freeze_polls() as frozen",
    );
    expect(frozen).toBe(1);

    await vote("b", DEVICE[3]!);
    const frozenResults = await results();
    expect(frozenResults.map((r) => [r.option, r.votes, r.total])).toEqual([
      ["a", 2, 3],
      ["b", 1, 3],
    ]);
    expect(frozenResults[0]?.frozen_at).not.toBeNull();

    await db.query("select public.freeze_polls()");
    expect((await results()).map((r) => [r.option, r.votes, r.total])).toEqual([
      ["a", 2, 4],
      ["b", 2, 4],
    ]);
  });

  it("deletes rate-limit windows older than a day", async () => {
    await db.exec(`
      insert into public.rate_limits (key, window_start, count) values
        ('old', now() - interval '2 days', 5),
        ('recent', now() - interval '1 hour', 5);
    `);
    await db.query("select public.freeze_polls()");
    expect(await rows("select key from public.rate_limits")).toEqual([{ key: "recent" }]);
  });
});

describe("seed.sql", () => {
  it("loads into a fresh database and matches the minimum samples", async () => {
    const fresh = new PGlite();
    try {
      await fresh.exec(SUPABASE_BASELINE);
      for (const file of readdirSync(MIGRATIONS)
        .filter((f) => f.endsWith(".sql"))
        .sort()) {
        await fresh.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
      }
      await fresh.exec(readFileSync(join(process.cwd(), "supabase", "seed.sql"), "utf8"));
      const big = await fresh.query<{ total: number }>(
        "select max(total) as total from public.poll_results('example-game:fake-poll')",
      );
      const small = await fresh.query<{ total: number }>(
        "select max(total) as total from public.poll_results('example-game:small-poll')",
      );
      const guesses = await fresh.query<{ n: number }>(
        "select n from public.crowd_median('example-game', 1, 'fake-item')",
      );
      expect(big.rows[0]?.total).toBeGreaterThanOrEqual(MIN_POLL_VOTES);
      expect(small.rows[0]?.total).toBeLessThan(MIN_POLL_VOTES);
      expect(guesses.rows[0]?.n).toBeGreaterThanOrEqual(MIN_GUESSES);
    } finally {
      await fresh.close();
    }
  }, 60_000);
});
