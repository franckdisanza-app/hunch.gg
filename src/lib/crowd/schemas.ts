import * as z from "zod/mini";
import { itemIdSchema } from "@/games/content";
import { slugSchema } from "@/games/registry.schema";

// The crowd API contract, shared by the route handlers and the browser client (zod/mini keeps the
// client's share of it small).

/** Poll IDs are namespaced by game: "<game>:<id>", e.g. "demo-game:puzzle-12". */
export const pollIdSchema = z
  .string()
  .check(z.maxLength(96), z.regex(/^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9:-]*$/));

export const pollOptionSchema = z.string().check(z.regex(/^[a-z0-9][a-z0-9-]{0,31}$/));

export const votePayloadSchema = z.strictObject({
  game: slugSchema,
  pollId: pollIdSchema,
  option: pollOptionSchema,
  deviceId: z.uuid(),
});
export type VotePayload = z.infer<typeof votePayloadSchema>;

export const guessPayloadSchema = z.strictObject({
  game: slugSchema,
  puzzle: z.int().check(z.minimum(1), z.maximum(100_000)),
  itemId: itemIdSchema,
  value: z.number().check(z.refine(Number.isFinite, "must be finite")),
  deviceId: z.uuid(),
});
export type GuessPayload = z.infer<typeof guessPayloadSchema>;

export const reportPayloadSchema = z.strictObject({
  game: slugSchema,
  itemId: itemIdSchema,
  message: z.string().check(z.trim(), z.minLength(1), z.maxLength(1000)),
});
export type ReportPayload = z.infer<typeof reportPayloadSchema>;

const count = z.int().check(z.nonnegative());

export const pollResultsSchema = z.discriminatedUnion("ready", [
  z.object({ ready: z.literal(false), n: count }),
  z.object({
    ready: z.literal(true),
    n: count,
    options: z.array(
      z.object({
        option: z.string(),
        votes: z.int(),
        share: z.number().check(z.minimum(0), z.maximum(1)),
      }),
    ),
    /** When the numbers were frozen; null for live counts. */
    frozenAt: z.nullable(z.string()),
  }),
]);
export type PollResults = z.infer<typeof pollResultsSchema>;

export const crowdStatsSchema = z.discriminatedUnion("ready", [
  z.object({ ready: z.literal(false), n: count }),
  z.object({
    ready: z.literal(true),
    n: count,
    median: z.number(),
    /** Log-scale bins over positive guesses. */
    histogram: z.array(z.object({ from: z.number(), to: z.number(), count: z.int() })),
  }),
]);
export type CrowdStats = z.infer<typeof crowdStatsSchema>;
