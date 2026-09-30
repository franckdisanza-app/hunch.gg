// pnpm ping:sample [--force]
//
// Writes content/ping/questions.json: 20 FAKE questions, each answered by a random place (seeded,
// so the set is reproducible), to test the hints and the interface before real questions exist.
// No question is real: every prompt says "fake data", every place is "Fake place NN", sources are
// example.test. Each is flagged sample: true, so the game shows its draft banner and
// CONTENT_MODE=production rejects them. The set covers the edge cases: an ocean answer, one in
// Antarctica, one on the antimeridian, one in the far north, contenders, computed questions with
// nearest features, smaller scopes and a perfect-radius override.
//
// Refuses to overwrite questions that are not samples. Then run: pnpm ping:build --repeat
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { Atlas } from "@/engines/map/atlas";
import { distanceKm, normalizeLon, type GeoPoint } from "@/engines/map/geo";
import type { Category, Question, ScopeLevel, Target } from "@/games/ping/content.schema";
import { writeJson } from "./lib/json";
import { seededRandom } from "./lib/random";
import { loadLand, surfaceAt } from "./lib/surface";

const { values } = parseArgs({ options: { force: { type: "boolean", default: false } } });

const root = process.cwd();
const dir = join(root, "content", "ping");
const file = join(dir, "questions.json");

if (existsSync(file) && !values.force) {
  const existing = JSON.parse(readFileSync(file, "utf8")) as { sample?: boolean }[];
  if (existing.some((q) => q.sample !== true)) {
    console.error("questions.json holds questions that are not samples. Refusing to overwrite.");
    process.exit(1);
  }
}

type Where = "land" | "north" | "south" | "ocean" | "antarctica" | "antimeridian";

interface Slot {
  category: Category;
  where?: Where;
  scope?: Exclude<ScopeLevel, "world">;
  contenders?: number;
  perfectRadiusKm?: number;
  longPrompt?: boolean;
}

const SLOTS: Slot[] = [
  { category: "heat" },
  { category: "cold", where: "north" },
  { category: "rain", contenders: 2 },
  { category: "wind", where: "ocean" },
  { category: "geography", scope: "continent" },
  { category: "furthest-from" },
  { category: "regional", scope: "country" },
  { category: "heat", where: "antimeridian" },
  { category: "cold", where: "antarctica" },
  { category: "rain" },
  { category: "wind", contenders: 1 },
  { category: "geography", perfectRadiusKm: 150 },
  { category: "furthest-from", scope: "region" },
  { category: "regional", scope: "region" },
  { category: "heat", longPrompt: true },
  { category: "cold" },
  { category: "rain", scope: "country" },
  { category: "wind" },
  { category: "geography", where: "south" },
  { category: "furthest-from" },
];

/** Placeholder words, so prompts read like questions without claiming anything. */
const NOUN: Record<Category, string> = {
  heat: "hottest spot",
  cold: "coldest spot",
  rain: "wettest spot",
  wind: "windiest spot",
  geography: "landmark",
  "furthest-from": "most remote spot",
  regional: "local record",
};

const SAMPLE_DATE = "2026-09-30";
const random = seededRandom("ping:sample:v1");
const land = loadLand(root);
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

function randomPoint(lat: [number, number], lon: [number, number]): GeoPoint {
  // Uniform on the sphere within the latitude band.
  const [s, n] = lat.map((d) => Math.sin((d * Math.PI) / 180)) as [number, number];
  const la = (Math.asin(s + (n - s) * random()) * 180) / Math.PI;
  return { lat: round4(la), lon: round4(normalizeLon(lon[0] + (lon[1] - lon[0]) * random())) };
}

function pick(where: Where, atlas: Atlas): GeoPoint {
  for (let tries = 0; tries < 100_000; tries++) {
    const point =
      where === "north"
        ? randomPoint([66, 84], [-180, 180])
        : where === "south"
          ? randomPoint([-55, -1], [-180, 180])
          : where === "antarctica"
            ? randomPoint([-85, -65], [-180, 180])
            : where === "antimeridian"
              ? randomPoint([-60, 75], [172, 188])
              : randomPoint([-60, 75], [-180, 180]);
    const surface = surfaceAt(atlas, point);
    if (
      where === "ocean"
        ? surface === "ocean"
        : where === "antarctica"
          ? surface === "antarctica"
          : surface === "land"
    ) {
      return point;
    }
  }
  throw new Error(`No random ${where} point found`);
}

/** A contender: another place on land, 300–2,500 km away. */
function contender(official: GeoPoint, atlas: Atlas): GeoPoint {
  for (let tries = 0; tries < 100_000; tries++) {
    const point = randomPoint(
      [Math.max(-60, official.lat - 20), Math.min(80, official.lat + 20)],
      [official.lon - 25, official.lon + 25],
    );
    const km = distanceKm(point, official);
    if (km > 300 && km < 2500 && surfaceAt(atlas, point) === "land") return point;
  }
  throw new Error("No contender found");
}

/** A box of the scope's size, placed at random around the point (never centred on it). */
function bboxAround(point: GeoPoint, level: Exclude<ScopeLevel, "world">) {
  const sizes: Record<typeof level, [number, number]> = {
    continent: [36, 50],
    region: [16, 20],
    country: [6, 8],
  };
  const [dLat, dLon] = sizes[level];
  const south = Math.max(-89, point.lat - dLat * (0.15 + 0.7 * random()));
  const north = Math.min(89, south + dLat);
  const west = normalizeLon(point.lon - dLon * (0.15 + 0.7 * random()));
  const east = normalizeLon(west + dLon);
  return [round4(west), round4(south), round4(east), round4(Math.max(north, point.lat + 0.5))] as [
    number,
    number,
    number,
    number,
  ];
}

const SCOPE_NAME = { continent: "Fake Continent", region: "Fake Region", country: "Fake Country" };

const questions: Question[] = SLOTS.map((slot, i) => {
  const nn = String(i + 1).padStart(2, "0");
  const official = pick(slot.where ?? "land", land);
  const computed = slot.category === "furthest-from";
  const extra = Array.from({ length: slot.contenders ?? 0 }, () => contender(official, land));
  const targets: Target[] = [official, ...extra].map((point, k) => ({
    lat: point.lat,
    lon: point.lon,
    label: k === 0 ? `Fake place ${nn}` : `Fake contender ${nn}${String.fromCharCode(97 + k)}`,
    official: k === 0,
    value: Math.round(random() * 1000) / 10,
    unit: "fake units",
    date: "2026-09",
  }));
  const scopeName = slot.scope ? `${SCOPE_NAME[slot.scope]} ${nn}` : "the world";
  const where = slot.scope ? ` in ${scopeName}` : "";
  const asOf = computed ? ", as of September 2026" : "";
  const prompt =
    `Sample ${nn} (fake data): where${where} is the made-up ${NOUN[slot.category]}${asOf}? ` +
    (slot.longPrompt
      ? "A random spot, placed by a script to test how Ping lays out a long question on a small phone screen without scrolling."
      : "A random spot, placed to test Ping.");

  return {
    id: `sample-${nn}`,
    category: slot.category,
    prompt,
    teaser: `Where is the made-up ${NOUN[slot.category]} of sample ${nn}?`,
    scope: slot.scope
      ? { level: slot.scope, name: scopeName, bbox: bboxAround(official, slot.scope) }
      : { level: "world", name: "the world" },
    targets,
    ...(slot.perfectRadiusKm ? { perfectRadiusKm: slot.perfectRadiusKm } : {}),
    authority: computed ? "Fake computation (sample)" : "Fake Weather Office (sample)",
    turnsOut: computed
      ? "this sample was not computed from anything: the place and its nearest features are made up."
      : extra.length
        ? "this fake record has fake contenders too. The reveal shows every one, with the official one marked."
        : "this is a random sample point, placed by a script to test Ping. It is not a real record.",
    ...(computed
      ? {
          computedOn: SAMPLE_DATE,
          dataAsOf: SAMPLE_DATE,
          nearest: [1, 2, 3].map((k) => ({
            name: `Fake feature ${nn}-${k}`,
            town: "Fake Town",
            lat: round4(official.lat + (random() - 0.5) * 1.2),
            lon: round4(normalizeLon(official.lon + (random() - 0.5) * 1.6)),
          })),
        }
      : {}),
    sourceTitle: "Sample Source (fake)",
    sourceUrl: `https://example.test/ping/sample-${nn}`,
    checkedOn: SAMPLE_DATE,
    licence: "Sample data, not a real fact",
    sample: true,
  };
});

mkdirSync(dir, { recursive: true });
await writeJson(file, questions);
console.log(
  `Wrote ${questions.length} FAKE sample questions to content/ping/questions.json. Now run: pnpm ping:build --repeat`,
);
