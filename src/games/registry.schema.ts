import { z } from "zod";
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
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, "lowercase letters, digits and single dashes")
  .max(40);

export const isoDateSchema = z.iso.date();

/** #RGB or #RRGGBB. Theme colours end up in generated CSS, so nothing else is accepted. */
export const hexColorSchema = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);

const themeTokensSchema = z.strictObject({
  bg: hexColorSchema,
  ink: hexColorSchema,
  accent1: hexColorSchema,
  accent2: hexColorSchema,
  accent3: hexColorSchema,
  extras: z.record(z.string().regex(/^[a-z][a-z0-9-]*$/), hexColorSchema).optional(),
});

const assetPathSchema = z.string().regex(/^\/[A-Za-z0-9/._-]+$/, "a path under /public");

export const gameThemeSchema = z.strictObject({
  light: themeTokensSchema,
  dark: themeTokensSchema,
  wordmark: assetPathSchema.optional(),
});

export const mascotSchema = z.strictObject({
  name: z.string().min(1),
  poses: z.strictObject(
    Object.fromEntries(MASCOT_POSES.map((pose) => [pose, assetPathSchema])) as Record<
      (typeof MASCOT_POSES)[number],
      typeof assetPathSchema
    >,
  ),
});

const base = {
  slug: slugSchema,
  name: z.string().min(1).max(40),
  tagline: z.string().min(1).max(120),
  modes: z.array(z.enum(GAME_MODES)).min(1),
  engine: z.enum(GAME_ENGINES),
  usesCrowdApi: z.array(z.enum(CROWD_FEATURES)),
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
    launchDate: isoDateSchema.optional(),
    theme: gameThemeSchema.optional(),
    mascot: mascotSchema.optional(),
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
