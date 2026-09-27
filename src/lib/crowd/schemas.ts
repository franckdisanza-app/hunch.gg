import { z } from "zod";
import { itemIdSchema } from "@/games/content";
import { slugSchema } from "@/games/registry.schema";

// The crowd API contract, shared by the route handlers and the browser client.

/** Poll IDs are namespaced by game: "<game>:<id>", e.g. "demo-game:puzzle-12". */
export const pollIdSchema = z
  .string()
  .max(96)
  .regex(/^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9:-]*$/);

export const pollOptionSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/);

export const votePayloadSchema = z.strictObject({
  game: slugSchema,
  pollId: pollIdSchema,
  option: pollOptionSchema,
  deviceId: z.uuid(),
});
export type VotePayload = z.infer<typeof votePayloadSchema>;

export const guessPayloadSchema = z.strictObject({
  game: slugSchema,
  puzzle: z.number().int().min(1).max(100_000),
  itemId: itemIdSchema,
  value: z.number().refine(Number.isFinite, "must be finite"),
  deviceId: z.uuid(),
});
export type GuessPayload = z.infer<typeof guessPayloadSchema>;

export const reportPayloadSchema = z.strictObject({
  game: slugSchema,
  itemId: itemIdSchema,
  message: z.string().trim().min(1).max(1000),
});
export type ReportPayload = z.infer<typeof reportPayloadSchema>;

export const pollResultsSchema = z.discriminatedUnion("ready", [
  z.object({ ready: z.literal(false), n: z.number().int().nonnegative() }),
  z.object({
    ready: z.literal(true),
    n: z.number().int().nonnegative(),
    options: z.array(
      z.object({ option: z.string(), votes: z.number().int(), share: z.number().min(0).max(1) }),
    ),
    /** When the numbers were frozen; null for live counts. */
    frozenAt: z.string().nullable(),
  }),
]);
export type PollResults = z.infer<typeof pollResultsSchema>;

export const crowdStatsSchema = z.discriminatedUnion("ready", [
  z.object({ ready: z.literal(false), n: z.number().int().nonnegative() }),
  z.object({
    ready: z.literal(true),
    n: z.number().int().nonnegative(),
    median: z.number(),
    /** Log-scale bins over positive guesses. */
    histogram: z.array(z.object({ from: z.number(), to: z.number(), count: z.number().int() })),
  }),
]);
export type CrowdStats = z.infer<typeof crowdStatsSchema>;
