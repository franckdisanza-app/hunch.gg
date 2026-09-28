import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getGame } from "@/games/registry";
import { poolSchema } from "@/games/sticker-shock/content.schema";
import { latestPuzzleNumber, puzzleFileName, puzzleNumber } from "@/lib/daily";
import { GET } from "./route";

// Runs against the sample content in content/sticker-shock/.

describe("GET /api/games/sticker-shock/pool", () => {
  it("serves every price except those in dailies being played or due within 7 days", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=3600");
    const pool = poolSchema.parse(await res.json());
    expect(pool.sample).toBe(true);
    expect(pool.prices.every((p) => p.notes === undefined)).toBe(true);

    const launch = getGame("sticker-shock")!.launchDate!;
    const now = Date.now();
    const first = Math.max(1, puzzleNumber(launch, now, "Etc/GMT+12"));
    const last = latestPuzzleNumber(launch, now) + 7;
    const scheduled = new Set<string>();
    for (let n = first; n <= last; n++) {
      const day = JSON.parse(
        readFileSync(
          join(process.cwd(), "content", "sticker-shock", "daily", puzzleFileName(n)),
          "utf8",
        ),
      ) as { pairs: { a: { id: string }; b: { id: string } }[] };
      day.pairs.forEach((p) => scheduled.add(p.a.id).add(p.b.id));
    }
    expect(scheduled.size).toBeGreaterThan(0);
    expect(pool.prices.some((p) => scheduled.has(p.id))).toBe(false);
    const all = JSON.parse(
      readFileSync(join(process.cwd(), "content", "sticker-shock", "prices.json"), "utf8"),
    ) as unknown[];
    expect(pool.prices.length).toBe(all.length - scheduled.size);
  });

  it("answers 503 without caching when the content cannot be read", async () => {
    const empty = mkdtempSync(join(tmpdir(), "plimp-empty-"));
    vi.spyOn(process, "cwd").mockReturnValue(empty);
    try {
      const res = await GET();
      expect(res.status).toBe(503);
      expect(res.headers.get("cache-control")).toBe("no-store");
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
