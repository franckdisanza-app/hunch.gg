import * as z from "zod/mini";

// Shared building blocks for game content schemas. Truth by construction: every fact carries its
// source URL, the date it was checked and the licence it is used under, or validation fails.
// zod/mini, like every schema in Plimp: games may parse content in the browser.

export const isoDate = z.iso.date();

export const sourceSchema = z.strictObject({
  sourceTitle: z.string().check(z.minLength(1), z.maxLength(200)),
  sourceUrl: z.url({ protocol: /^https?$/ }),
  /** YYYY-MM-DD, when a person last checked the fact against the source. */
  checkedOn: isoDate,
  /** e.g. "CC BY 4.0", "Public domain", "Fact (not copyrightable), own wording". */
  licence: z.string().check(z.minLength(1), z.maxLength(120)),
});
export type Source = z.infer<typeof sourceSchema>;

/** Stable, URL-safe item IDs, used by reports and crowd guesses. */
export const itemIdSchema = z.string().check(z.regex(/^[a-z0-9][a-z0-9-]{0,63}$/));

/**
 * A fact: game-specific fields plus an id and its source. Mark placeholder content with
 * `sample: true`; `pnpm content:validate` rejects it when CONTENT_MODE=production.
 */
export function factSchema<Shape extends Record<string, z.core.$ZodType>>(shape: Shape) {
  return z.strictObject({
    id: itemIdSchema,
    ...shape,
    ...sourceSchema.shape,
    sample: z.optional(z.boolean()),
  });
}

export type Fact = z.infer<ReturnType<typeof factSchema<Record<never, never>>>>;

/** Anything carrying a source; what `pnpm content:validate` checks on every fact. */
export type Sourced = Partial<Source> & { id?: string };

export interface ContentFile<T> {
  schema: z.core.$ZodType<T>;
  /** Every sourced fact in the file, so the validator can check sources, dates and licences. */
  facts(data: T): readonly Sourced[];
}

/**
 * What each game exports from src/games/<slug>/content.schema.ts as `contentSpec`.
 * `daily` describes content/<slug>/daily/<nnnn>.json; `files` describes any other JSON files in
 * content/<slug>/ (for example an unlimited-mode pool), keyed by path relative to that folder.
 */
export interface ContentSpec<Daily = unknown> {
  daily: ContentFile<Daily>;
  files?: Record<string, ContentFile<unknown>>;
}

export function defineContentSpec<Daily>(spec: ContentSpec<Daily>): ContentSpec<Daily> {
  return spec;
}
