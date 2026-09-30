// pnpm ping:difficulty [--min 20]
//
// Prints the median first-pin distance per question, from the crowd guesses in Supabase (every
// daily question posts the first pin's distance in km), hardest first. Use it to tune the scoring
// in src/games/ping/config.ts and to spot questions that are too easy or too hard. Needs
// SUPABASE_URL and SUPABASE_SECRET_KEY. Reads only distances: no device IDs.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { Question } from "@/games/ping/content.schema";
import { scriptSupabase } from "../lib/supabase";
import { difficulty, formatDifficulty, type GuessRow } from "./lib/difficulty";

const { values } = parseArgs({ options: { min: { type: "string", default: "20" } } });

const db = scriptSupabase();
const rows: GuessRow[] = [];
const PAGE = 1000;
for (let from = 0; ; from += PAGE) {
  const { data, error } = await db
    .from("guesses")
    .select("puzzle, item_id, value")
    .eq("game", "ping")
    .order("id")
    .range(from, from + PAGE - 1);
  if (error) throw new Error(`guesses: ${error.message}`);
  rows.push(...data);
  if (data.length < PAGE) break;
}

// Label each question with its teaser (never an answer).
const labels = new Map<string, string>();
const file = join(process.cwd(), "content", "ping", "questions.json");
if (existsSync(file)) {
  for (const q of JSON.parse(readFileSync(file, "utf8")) as Question[]) labels.set(q.id, q.teaser);
}

console.log(formatDifficulty(difficulty(rows, Number(values.min)), labels));
