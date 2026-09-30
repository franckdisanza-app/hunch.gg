import { readFileSync } from "node:fs";
import { join } from "node:path";
import { atlasFromTopology, isLand, type Atlas } from "@/engines/map/atlas";
import type { GeoPoint } from "@/engines/map/geo";
import type { Question, Surface } from "@/games/ping/content.schema";

// Where an answer lies, from Natural Earth's 1:50m land (world-atlas): the mix rules allow one
// ocean or Antarctica answer a week. Antarctica is land south of 60° S (the Antarctic Treaty area).

let atlas: Atlas | null = null;

export function loadLand(root: string): Atlas {
  atlas ??= atlasFromTopology(
    "50m",
    JSON.parse(
      readFileSync(join(root, "node_modules", "world-atlas", "countries-50m.json"), "utf8"),
    ) as unknown,
  );
  return atlas;
}

export function surfaceAt(land: Atlas, point: GeoPoint): Surface {
  if (!isLand(land, point)) return "ocean";
  return point.lat < -60 ? "antarctica" : "land";
}

/** A question's surface: where its (first) official target lies. */
export function surfaceOf(land: Atlas, question: Pick<Question, "targets">): Surface {
  const official = question.targets.find((t) => t.official) ?? question.targets[0]!;
  return surfaceAt(land, official);
}
