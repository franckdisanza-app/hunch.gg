import * as z from "zod/mini";
import {
  CROWD_FEATURES,
  GAME_ENGINES,
  GAME_MODES,
  MASCOT_POSES,
  type GameDefinition,
} from "./types";

// Runtime checks for registry entries. Used by tests and `pnpm content:validate`; the app itself
// relies on the static types in types.ts.

export const slugSchema = z
  .string()
  .check(
    z.regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, "lowercase letters, digits and single dashes"),
    z.maxLength(40),
  );

export const isoDateSchema = z.iso.date();

/** #RGB or #RRGGBB. Theme colours end up in generated CSS, so nothing else is accepted. */
export const hexColorSchema = z.string().check(z.regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/));

const themeTokensSchema = z.strictObject({
  bg: hexColorSchema,
  ink: hexColorSchema,
  accent1: hexColorSchema,
  accent2: hexColorSchema,
  accent3: hexColorSchema,
  extras: z.optional(z.record(z.string().check(z.regex(/^[a-z][a-z0-9-]*$/)), hexColorSchema)),
});

const assetPathSchema = z.string().check(z.regex(/^\/[A-Za-z0-9/._-]+$/, "a path under /public"));

export const gameThemeSchema = z.strictObject({
  light: themeTokensSchema,
  dark: themeTokensSchema,
  wordmark: z.optional(assetPathSchema),
});

export const mascotSchema = z.strictObject({
  name: z.string().check(z.minLength(1)),
  poses: z.strictObject(
    Object.fromEntries(MASCOT_POSES.map((pose) => [pose, assetPathSchema])) as Record<
      (typeof MASCOT_POSES)[number],
      typeof assetPathSchema
    >,
  ),
});

const creditSchema = z.strictObject({
  what: z.string().check(z.minLength(1), z.maxLength(80)),
  work: z.string().check(z.minLength(1), z.maxLength(160)),
  licence: z.string().check(z.minLength(1), z.maxLength(80)),
  url: z.optional(z.url({ protocol: /^https$/ })),
});

const base = {
  slug: slugSchema,
  name: z.string().check(z.minLength(1), z.maxLength(40)),
  tagline: z.string().check(z.minLength(1), z.maxLength(120)),
  modes: z.array(z.enum(GAME_MODES)).check(z.minLength(1)),
  engine: z.enum(GAME_ENGINES),
  usesCrowdApi: z.array(z.enum(CROWD_FEATURES)),
  credits: z.optional(z.array(creditSchema)),
};

export const gameDefinitionSchema = z.discriminatedUnion("status", [
  z.strictObject({
    ...base,
    status: z.literal("live"),
    launchDate: isoDateSchema,
    theme: gameThemeSchema,
    mascot: mascotSchema,
  }),
  z.strictObject({
    ...base,
    status: z.enum(["hidden", "coming-soon"]),
    launchDate: z.optional(isoDateSchema),
    theme: z.optional(gameThemeSchema),
    mascot: z.optional(mascotSchema),
  }),
]);

/** Returns a list of problems with the registry; empty when everything is fine. */
export function validateRegistry(entries: readonly GameDefinition[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const result = gameDefinitionSchema.safeParse(entry);
    if (!result.success) {
      problems.push(`${entry.slug}: ${z.prettifyError(result.error)}`);
    }
    if (seen.has(entry.slug)) problems.push(`${entry.slug}: duplicate slug`);
    seen.add(entry.slug);
  }
  return problems;
}
