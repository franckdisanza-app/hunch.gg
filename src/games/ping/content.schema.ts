import * as z from "zod/mini";
import { defineContentSpec, factSchema } from "@/games/content";

// The shape of content/ping/. Every item is a fact: its fields plus id, sourceTitle,
// sourceUrl, checkedOn and licence (added by factSchema). `pnpm content:validate` enforces it.
// zod/mini, so the game can also parse puzzles in the browser without a heavy bundle.

// TODO: replace `label` with Ping's real fields.
export const itemSchema = factSchema({
  label: z.string().check(z.minLength(1)),
});

export const dailyPuzzleSchema = z.strictObject({
  puzzle: z.int().check(z.positive()),
  items: z.array(itemSchema).check(z.minLength(1)),
  sample: z.optional(z.boolean()),
});
export type DailyPuzzle = z.infer<typeof dailyPuzzleSchema>;

export const contentSpec = defineContentSpec({
  daily: { schema: dailyPuzzleSchema, facts: (puzzle) => puzzle.items },
});
