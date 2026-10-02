// pnpm map:data
//
// Cities and roads for the map engine's globe, from Natural Earth (public domain): the 1:10m
// populated places (7,300 cities and towns, each with the zoom Natural Earth suggests showing it
// from) and the 1:10m roads. Downloads them once into .cache/map/ (gitignored, ~70 MB), then writes
// compact files to public/map/v1/ that the globe fetches only once the player zooms in:
//
//   places-1.json      the biggest places (shown from continent zoom)
//   places-2.json      every other place (country zoom and closer)
//   roads.json         major roads, simplified for continent-sized views
//   roads/<tile>.json  every road in a 15° tile, for country views and closer
//
// Coordinates are integers in thousandths of a degree (about 110 m, finer than the data), and
// lines are stored as deltas. See src/engines/map/overlays.ts for the reading side.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PLACE_TIERS } from "@/engines/map/overlays";
import { places, roads, type Feature } from "./lib/natural-earth";

const SOURCE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";
const FILES = { places: "ne_10m_populated_places", roads: "ne_10m_roads" } as const;

const root = process.cwd();
const cacheDir = join(root, ".cache", "map");
const outDir = join(root, "public", "map", "v1");

async function load(name: string): Promise<{ features: Feature[] }> {
  const file = join(cacheDir, `${name}.geojson`);
  if (!existsSync(file)) {
    mkdirSync(cacheDir, { recursive: true });
    console.log(`Downloading ${name}.geojson from Natural Earth…`);
    const response = await fetch(`${SOURCE}/${name}.geojson`);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  }
  return JSON.parse(readFileSync(file, "utf8")) as { features: Feature[] };
}

// ---------------------------------------------------------------------------------------------

const [placeData, roadData] = await Promise.all([load(FILES.places), load(FILES.roads)]);

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, "roads"), { recursive: true });
const write = (path: string, data: unknown) => {
  const text = JSON.stringify(data);
  writeFileSync(join(outDir, path), text);
  return text.length;
};

const allPlaces = places(placeData.features);
for (const [i, tier] of PLACE_TIERS.entries()) {
  const rows = allPlaces.filter(
    (p) => p[2] <= tier.maxZoom && p[2] > (PLACE_TIERS[i - 1]?.maxZoom ?? -Infinity),
  );
  const size = write(tier.file, rows);
  console.log(`${tier.file}: ${rows.length} places, ${(size / 1024).toFixed(0)} KB`);
}

const { major, tiles, lines: count, points } = roads(roadData.features);
console.log(
  `roads.json: ${major.length} lines, ${(write("roads.json", major) / 1024).toFixed(0)} KB`,
);
let total = 0;
for (const [key, records] of tiles) total += write(`roads/${key}.json`, records);
console.log(
  `roads/: ${tiles.size} tiles, ${count} lines, ${points} points, ${(total / 1024).toFixed(0)} KB`,
);
writeFileSync(join(outDir, "roads", "index.json"), JSON.stringify([...tiles.keys()].sort()));
