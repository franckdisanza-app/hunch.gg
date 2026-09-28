// pnpm sticker-shock:build [--days 365] [--reset] [--dry-run]
//
// prices.csv → prices.json → validation → daily files for the next 365 days from a fixed seed,
// then a report. Released puzzles are never rewritten. --reset regenerates them too: only before
// launch, while nobody has played them. See docs/games/sticker-shock/data-guide.md.
import { parseArgs } from "node:util";
import { getGame } from "@/games/registry";
import { contentMode } from "@/lib/content/validate";
import { buildStickerShock, formatReport } from "./lib/build";

const { values } = parseArgs({
  options: {
    days: { type: "string", default: "365" },
    reset: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

const game = getGame("sticker-shock");
if (!game) throw new Error("sticker-shock is not in the registry");
const days = Number(values.days);
if (!Number.isInteger(days) || days < 1) {
  console.error("--days must be a positive whole number");
  process.exit(1);
}

const started = Date.now();
const result = await buildStickerShock({
  root: process.cwd(),
  game,
  now: new Date(),
  days,
  reset: values.reset,
  dryRun: values["dry-run"],
  mode: contentMode(process.env.CONTENT_MODE),
});

for (const warning of result.warnings) console.warn(`warning  ${warning}`);
for (const error of result.errors) console.error(`error    ${error}`);
if (result.report) {
  console.log(`\nSticker Shock build${values["dry-run"] ? " (dry run)" : ""}\n`);
  console.log(formatReport(result.report));
}
console.log(
  `\n${result.errors.length} errors, ${result.warnings.length} warnings in ${((Date.now() - started) / 1000).toFixed(1)} s`,
);
if (result.errors.length) process.exit(1);
