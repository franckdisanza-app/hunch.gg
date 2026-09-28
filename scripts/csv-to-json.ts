// pnpm csv-to-json <game> <input.csv> [--mapping <file>] [--out <path>] [--dry-run]
//
// Converts a spreadsheet export into game content using the game's column mapping
// (content/<game>/csv-mapping.json by default; see src/lib/content/csv.ts for the format).
// Run `pnpm content:validate` afterwards: this script converts, it does not fact-check.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { getGame } from "@/games/registry";
import { csvMappingSchema, groupDaily, parseCsv, rowsToObjects } from "@/lib/content/csv";
import { puzzleFileName } from "@/lib/daily";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    mapping: { type: "string" },
    out: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const [slug, input] = positionals;
if (!slug || !input) {
  console.error(
    "Usage: pnpm csv-to-json <game> <input.csv> [--mapping <file>] [--out <path>] [--dry-run]",
  );
  process.exit(1);
}
if (!getGame(slug)) {
  console.error(`Unknown game "${slug}". Add it with pnpm new-game first.`);
  process.exit(1);
}

const root = process.cwd();
const contentDir = join(root, "content", slug);
const mappingFile = values.mapping ?? join(contentDir, "csv-mapping.json");
if (!existsSync(mappingFile)) {
  console.error(`No mapping at ${mappingFile}. See docs/ADDING_A_GAME.md.`);
  process.exit(1);
}

try {
  const mapping = csvMappingSchema.parse(JSON.parse(readFileSync(mappingFile, "utf8")));
  const objects = rowsToObjects(parseCsv(readFileSync(input, "utf8")), mapping);

  const writes: [string, unknown][] =
    mapping.output === "daily"
      ? [...groupDaily(objects, mapping)].map(([n, file]) => [
          join(values.out ?? join(contentDir, "daily"), puzzleFileName(n)),
          file,
        ])
      : [[values.out ?? join(contentDir, mapping.file ?? "items.json"), objects]];

  for (const [file, data] of writes) {
    if (values["dry-run"]) {
      console.log(`would write ${file}`);
      continue;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
    console.log(`wrote ${file}`);
  }
  console.log(`${objects.length} rows -> ${writes.length} files. Now run: pnpm content:validate`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
