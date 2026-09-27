import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { defineContentSpec, factSchema, type ContentSpec } from "@/games/content";
import { PLACEHOLDER_GAME, PLACEHOLDER_MASCOT, PLACEHOLDER_THEME } from "@/frame/placeholders";
import type { GameDefinition } from "@/games/types";
import { findSamples, validateContent } from "./validate";

// A fake live game launched 2026-03-01. At NOW it is already 2026-03-11 in UTC+14, so the newest
// puzzle is #11: files 11-24 are required, 25-40 only warned about.
const NOW = new Date("2026-03-10T12:00:00Z");

const LIVE: GameDefinition = {
  ...PLACEHOLDER_GAME,
  slug: "fixture-game",
  name: "Fixture Game",
  tagline: "A fake game for validator tests.",
  status: "live",
  launchDate: "2026-03-01",
  theme: PLACEHOLDER_THEME,
  mascot: PLACEHOLDER_MASCOT,
};

const itemSchema = factSchema({ label: z.string() });
const strictSpec = defineContentSpec({
  daily: {
    schema: z.strictObject({
      puzzle: z.number().int(),
      items: z.array(itemSchema).min(1),
      sample: z.boolean().optional(),
    }),
    facts: (p) => p.items,
  },
});

// A careless schema that does not require sources: the generic fact check must still catch it.
const looseSpec: ContentSpec = defineContentSpec({
  daily: {
    schema: z.object({ puzzle: z.number(), items: z.array(z.record(z.string(), z.unknown())) }),
    facts: (p) => p.items,
  },
});

const fact = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  label: "Fake label",
  sourceTitle: "Example source",
  sourceUrl: "https://example.test/source",
  checkedOn: "2026-03-01",
  licence: "Placeholder licence",
  ...extra,
});

let root: string;

function writeDaily(slug: string, n: number, data: unknown) {
  const dir = join(root, "content", slug, "daily");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${String(n).padStart(4, "0")}.json`), JSON.stringify(data));
}

function writeRange(from: number, to: number) {
  for (let n = from; n <= to; n++)
    writeDaily("fixture-game", n, { puzzle: n, items: [fact(`item-${n}`)] });
}

function run(
  games: GameDefinition[] = [LIVE],
  spec: ContentSpec | null = strictSpec as ContentSpec,
  mode: "production" | "sample" = "production",
) {
  return validateContent({ root, games, now: NOW, mode, loadSpec: async () => spec });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "plimp-validate-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("validateContent", () => {
  it("passes with 30 days of valid content", async () => {
    writeRange(1, 40);
    const report = await run();
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.files).toHaveLength(40);
  });

  it("errors on missing files in the next 14 days and warns up to 30", async () => {
    writeRange(1, 24);
    let report = await run();
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([expect.stringContaining("0025.json")]);

    writeRange(1, 14);
    rmSync(join(root, "content", "fixture-game", "daily", "0015.json"));
    report = await run();
    expect(report.errors).toEqual([expect.stringContaining("0015.json")]);
  });

  it("does not require files before launch day", async () => {
    const future = { ...LIVE, launchDate: "2026-06-01" } as GameDefinition;
    expect((await run([future])).errors).toEqual([]);
  });

  it("rejects facts without source, date or licence, even with a loose schema", async () => {
    writeRange(1, 24);
    writeDaily("fixture-game", 12, { puzzle: 12, items: [{ id: "x", label: "No source" }] });
    const report = await run([LIVE], looseSpec);
    expect(report.errors).toEqual([expect.stringMatching(/0012\.json: fact x needs sourceTitle/)]);
  });

  it("rejects checkedOn dates in the future and warns about http sources", async () => {
    writeRange(1, 40);
    writeDaily("fixture-game", 12, {
      puzzle: 12,
      items: [
        fact("a", { checkedOn: "2030-01-01" }),
        fact("b", { sourceUrl: "http://example.test" }),
      ],
    });
    const report = await run();
    expect(report.errors).toEqual([
      expect.stringContaining("checkedOn 2030-01-01 is in the future"),
    ]);
    expect(report.warnings).toEqual([expect.stringContaining("not https")]);
  });

  it("rejects sample content only in production mode", async () => {
    writeRange(1, 24);
    writeDaily("fixture-game", 12, { puzzle: 12, sample: true, items: [fact("a")] });
    expect((await run()).errors).toEqual([expect.stringContaining("sample: true")]);
    expect((await run([LIVE], strictSpec as ContentSpec, "sample")).errors).toEqual([]);
  });

  it("rejects invalid JSON, bad file names, schema errors and mismatched puzzle numbers", async () => {
    writeRange(1, 24);
    const dir = join(root, "content", "fixture-game", "daily");
    writeFileSync(join(dir, "0012.json"), "{ nope");
    writeFileSync(join(dir, "13.json"), "{}");
    writeDaily("fixture-game", 14, { puzzle: 14, items: [] });
    writeDaily("fixture-game", 15, { puzzle: 99, items: [fact("a")] });
    const errors = (await run()).errors.join("\n");
    expect(errors).toMatch(/0012\.json: invalid JSON/);
    expect(errors).toMatch(/13\.json: name must be four digits/);
    expect(errors).toMatch(/0014\.json:/);
    expect(errors).toMatch(/0015\.json: "puzzle" is 99/);
  });

  it("requires a content schema for live games and games with content", async () => {
    expect((await run([LIVE], null)).errors).toEqual([
      expect.stringContaining("content.schema.ts"),
    ]);
    const hidden = { ...PLACEHOLDER_GAME, slug: "hidden-game" } as GameDefinition;
    expect((await run([hidden], null)).errors).toEqual([]);
    writeDaily("hidden-game", 1, { puzzle: 1 });
    expect((await run([hidden], null)).errors).toEqual([
      expect.stringContaining("content.schema.ts"),
    ]);
  });

  it("rejects live games that still have TODO placeholders", async () => {
    writeRange(1, 40);
    const todo = { ...LIVE, tagline: "TODO: one sentence." } as GameDefinition;
    expect((await run([todo])).errors).toEqual([expect.stringContaining("TODO")]);
  });
});

describe("findSamples", () => {
  it("finds sample flags anywhere", () => {
    expect(findSamples({ a: [{ sample: true }, { sample: false }], sample: true })).toEqual([
      "$.a[0]",
      "$",
    ]);
  });
});
