// pnpm sticker-shock:accuracy [--min 30]
//
// Prints the share of players who answered each daily pair correctly (from the pair_accuracy view
// in Supabase) and flags pairs above 85% (too easy) or below 15% (probably a data error). Needs
// SUPABASE_URL and SUPABASE_SECRET_KEY. Reads only aggregates: no device IDs.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { DailyPuzzle } from "@/games/sticker-shock/content.schema";
import { receiptLine } from "@/games/sticker-shock/text";
import { DEFAULT_ACCURACY, accuracyReport, type AccuracyRow } from "./lib/accuracy";
import { scriptSupabase } from "./lib/supabase";

const { values } = parseArgs({ options: { min: { type: "string", default: "30" } } });
const minAnswers = Number(values.min);

const db = scriptSupabase();
const rows: AccuracyRow[] = [];
const PAGE = 1000;
for (let from = 0; ; from += PAGE) {
  const { data, error } = await db
    .from("pair_accuracy")
    .select("puzzle, pair_id, n, share_correct")
    .order("puzzle")
    .order("pair_id")
    .range(from, from + PAGE - 1);
  if (error) throw new Error(`pair_accuracy: ${error.message}`);
  for (const r of data) {
    if (r.puzzle !== null && r.pair_id && r.n !== null && r.share_correct !== null) {
      rows.push({ puzzle: r.puzzle, pair_id: r.pair_id, n: r.n, share_correct: r.share_correct });
    }
  }
  if (data.length < PAGE) break;
}

// Label each pair with its receipt line from the daily files.
const labels = new Map<string, string>();
const dailyDir = join(process.cwd(), "content", "sticker-shock", "daily");
if (existsSync(dailyDir)) {
  for (const file of readdirSync(dailyDir).filter((f) => f.endsWith(".json"))) {
    const day = JSON.parse(readFileSync(join(dailyDir, file), "utf8")) as DailyPuzzle;
    day.pairs.forEach((pair, i) => labels.set(pair.id, receiptLine(i, pair.a, pair.b).slice(4)));
  }
}

console.log(accuracyReport(rows, labels, { ...DEFAULT_ACCURACY, minAnswers }));
