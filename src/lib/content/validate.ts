import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { z } from "zod";
import { sourceSchema, type ContentFile, type ContentSpec } from "@/games/content";
import { validateRegistry } from "@/games/registry.schema";
import type { GameDefinition } from "@/games/types";
import { dayIndex, latestPuzzleNumber, localIsoDate, parseIsoDate, puzzleFileName } from "../daily";

// `pnpm content:validate`: truth by construction. Runs in CI and before every build.
//   - the registry is valid, and live games carry no TODO placeholders
//   - every JSON file in content/<slug>/ passes its game's schema
//   - every fact has sourceUrl, checkedOn (not in the future) and licence
//   - live games have daily files for the next 14 days (error) and 30 days (warning)
//   - nothing is flagged `sample: true` when CONTENT_MODE=production

export const DAYS_REQUIRED = 14;
export const DAYS_WARNED = 30;

export type ContentMode = "production" | "sample";

export interface ValidateOptions {
  root: string;
  games: readonly GameDefinition[];
  now: Date;
  mode: ContentMode;
  /** Loads src/games/<slug>/content.schema.ts; null when the game has none. */
  loadSpec(slug: string): Promise<ContentSpec | null>;
}

export interface ValidationReport {
  errors: string[];
  warnings: string[];
  /** Files that were checked, relative to root. */
  files: string[];
}

/** Finds every `sample: true` in a JSON value; returns their paths. */
export function findSamples(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => findSamples(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, v]) =>
      key === "sample" && v === true ? [path] : findSamples(v, `${path}.${key}`),
    );
  }
  return [];
}

function readJson(file: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, data: JSON.parse(readFileSync(file, "utf8")) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function validateContent(options: ValidateOptions): Promise<ValidationReport> {
  const { root, games, now, mode } = options;
  const report: ValidationReport = { errors: [], warnings: [], files: [] };
  const error = (msg: string) => report.errors.push(msg);
  const warn = (msg: string) => report.warnings.push(msg);
  const today = dayIndex(parseIsoDate(localIsoDate(now, "Etc/GMT-14")));

  for (const problem of validateRegistry(games)) error(`registry: ${problem}`);

  for (const game of games) {
    const live = game.status === "live";
    if (live && /\bTODO\b/i.test(`${game.name} ${game.tagline}`)) {
      error(`${game.slug}: live game still has a TODO in its name or tagline`);
    }

    const dir = join(root, "content", game.slug);
    const hasContent = existsSync(dir);
    if (!live && !hasContent) continue;

    const spec = await options.loadSpec(game.slug);
    if (!spec) {
      if (live || hasContent) {
        error(
          `${game.slug}: missing src/games/${game.slug}/content.schema.ts (export contentSpec)`,
        );
      }
      continue;
    }

    const checkFile = (file: string, contentFile: ContentFile<unknown>, expectPuzzle?: number) => {
      const rel = relative(root, file).replaceAll("\\", "/");
      report.files.push(rel);
      const parsed = readJson(file);
      if (!parsed.ok) return error(`${rel}: invalid JSON (${parsed.error})`);

      for (const path of findSamples(parsed.data)) {
        if (mode === "production") error(`${rel}: ${path} is flagged sample: true`);
      }

      const result = contentFile.schema.safeParse(parsed.data);
      if (!result.success) return error(`${rel}: ${z.prettifyError(result.error)}`);

      const data = result.data as { puzzle?: unknown };
      if (
        expectPuzzle !== undefined &&
        typeof data.puzzle === "number" &&
        data.puzzle !== expectPuzzle
      ) {
        error(`${rel}: "puzzle" is ${data.puzzle}, but the file name says ${expectPuzzle}`);
      }

      const facts = contentFile.facts(result.data);
      if (facts.length === 0) error(`${rel}: contains no sourced facts`);
      facts.forEach((fact, i) => {
        const label = `${rel}: fact ${fact.id ?? `#${i + 1}`}`;
        const source = sourceSchema.safeParse({
          sourceTitle: fact.sourceTitle,
          sourceUrl: fact.sourceUrl,
          checkedOn: fact.checkedOn,
          licence: fact.licence,
        });
        if (!source.success) {
          return error(
            `${label} needs sourceTitle, sourceUrl, checkedOn and licence (${z.prettifyError(source.error)})`,
          );
        }
        if (dayIndex(parseIsoDate(source.data.checkedOn)) > today) {
          error(`${label}: checkedOn ${source.data.checkedOn} is in the future`);
        }
        if (source.data.sourceUrl.startsWith("http:")) warn(`${label}: source is not https`);
      });
    };

    // Daily files.
    const dailyDir = join(dir, "daily");
    const dailyFiles = existsSync(dailyDir)
      ? readdirSync(dailyDir).filter((f) => f.endsWith(".json"))
      : [];
    const numbers = new Set<number>();
    for (const name of dailyFiles) {
      if (!/^\d{4}\.json$/.test(name)) {
        error(`content/${game.slug}/daily/${name}: name must be four digits, e.g. 0001.json`);
        continue;
      }
      const n = Number(name.slice(0, 4));
      if (n < 1) error(`content/${game.slug}/daily/${name}: puzzles start at 0001`);
      numbers.add(n);
      checkFile(join(dailyDir, name), spec.daily, n);
    }

    // Other declared files.
    for (const [path, contentFile] of Object.entries(spec.files ?? {})) {
      const file = join(dir, path);
      if (existsSync(file)) checkFile(file, contentFile);
      else if (live) error(`content/${game.slug}/${path}: missing`);
    }

    // Lookahead for live games: today's puzzle (in UTC+14) and the days after it.
    if (live) {
      const latest = latestPuzzleNumber(game.launchDate, now);
      const missing = (from: number, to: number) => {
        const out: string[] = [];
        for (let n = Math.max(1, from); n <= to; n++)
          if (!numbers.has(n)) out.push(puzzleFileName(n));
        return out;
      };
      const required = missing(latest, latest + DAYS_REQUIRED - 1);
      const soon = missing(latest + DAYS_REQUIRED, latest + DAYS_WARNED - 1);
      if (required.length) {
        error(
          `${game.slug}: missing daily files for the next ${DAYS_REQUIRED} days: ${required.join(", ")}`,
        );
      }
      if (soon.length) {
        warn(`${game.slug}: missing daily files within ${DAYS_WARNED} days: ${soon.join(", ")}`);
      }
    }
  }

  return report;
}

export function contentMode(value: string | undefined): ContentMode {
  return value === "production" ? "production" : "sample";
}
