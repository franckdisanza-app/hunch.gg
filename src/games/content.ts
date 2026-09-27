import { z } from "zod";

// Shared building blocks for game content schemas. Truth by construction: every fact carries its
// source URL, the date it was checked and the licence it is used under, or validation fails.

export const isoDate = z.iso.date();

export const sourceSchema = z.strictObject({
  sourceTitle: z.string().min(1).max(200),
  sourceUrl: z.url({ protocol: /^https?$/ }),
  /** YYYY-MM-DD, when a person last checked the fact against the source. */
  checkedOn: isoDate,
  /** e.g. "CC BY 4.0", "Public domain", "Fact (not copyrightable), own wording". */
  licence: z.string().min(1).max(120),
});
export type Source = z.infer<typeof sourceSchema>;

/** Stable, URL-safe item IDs, used by reports and crowd guesses. */
export const itemIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);

/**
 * A fact: game-specific fields plus an id and its source. Mark placeholder content with
 * `sample: true`; `pnpm content:validate` rejects it when CONTENT_MODE=production.
 */
export function factSchema<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.strictObject({
    id: itemIdSchema,
    ...shape,
    ...sourceSchema.shape,
    sample: z.boolean().optional(),
  });
}

export type Fact = z.infer<ReturnType<typeof factSchema<Record<never, never>>>>;
