// pnpm ping:build [--days 60] [--repeat] [--reset] [--dry-run]
//
// questions.json → validation → daily files from a fixed seed, following the mix rules: never two
// questions of one category on a day, at most one ocean or Antarctica answer in any 7 days. Then a
// report: categories per week and how many days remain. Released days keep their questions;
// later days are planned again on every run. --repeat reuses questions once all are used (for the
// sample set); --reset plans released days again too (only before launch). With
// CONTENT_MODE=production, drafts (sample: true) are left out. See docs/games/ping/content-guide.md.
import { parseArgs } from "node:util";
import { getGame } from "@/games/registry";
import { contentMode } from "@/lib/content/validate";
import { buildPing, formatReport } from "./lib/build";
import { loadLand, surfaceOf } from "./lib/surface";

const { values } = parseArgs({
  options: {
    days: { type: "string", default: "60" },
    repeat: { type: "boolean", default: false },
    reset: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

const game = getGame("ping");
if (!game) throw new Error("ping is not in the registry");
const days = Number(values.days);
if (!Number.isInteger(days) || days < 1) {
  console.error("--days must be a positive whole number");
  process.exit(1);
}

const root = process.cwd();
const land = loadLand(root);
const result = await buildPing({
  root,
  game,
  now: new Date(),
  days,
  reset: values.reset,
  repeat: values.repeat,
  dryRun: values["dry-run"],
  mode: contentMode(process.env.CONTENT_MODE),
  surfaceOf: (question) => surfaceOf(land, question),
});

for (const warning of result.warnings) console.warn(`warning  ${warning}`);
for (const error of result.errors) console.error(`error    ${error}`);
if (!result.errors.length) {
  console.log(`\nPing build${values["dry-run"] ? " (dry run)" : ""}\n`);
  console.log(formatReport(result));
}
console.log(`\n${result.errors.length} errors, ${result.warnings.length} warnings`);
if (result.errors.length) process.exit(1);
