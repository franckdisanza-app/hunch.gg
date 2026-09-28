import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as prettier from "prettier";
import { slugSchema } from "@/games/registry.schema";
import { GAME_ENGINES, MASCOT_POSES, type GameEngine } from "@/games/types";

// The logic behind `pnpm new-game`. Creates a hidden, non-playable game that typechecks and
// builds. See docs/ADDING_A_GAME.md for everything that comes after.

export interface ScaffoldOptions {
  root: string;
  slug: string;
  name: string;
  engine: string;
  tagline?: string | undefined;
}

export interface ScaffoldResult {
  created: string[];
  registry: "inserted" | "kept";
}

export const REGISTRY_MARKER = "// @new-game:entries";

export function pascalCase(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function registryEntry(o: { slug: string; name: string; tagline: string; engine: GameEngine }) {
  return [
    "  {",
    `    slug: ${JSON.stringify(o.slug)},`,
    `    name: ${JSON.stringify(o.name)},`,
    `    tagline: ${JSON.stringify(o.tagline)},`,
    `    status: "hidden",`,
    `    modes: ["daily", "unlimited"],`,
    `    engine: ${JSON.stringify(o.engine)},`,
    `    usesCrowdApi: [],`,
    "  },",
  ].join("\n");
}

function templates(slug: string, name: string, tagline: string, engine: GameEngine) {
  const Pascal = pascalCase(slug);
  const q = JSON.stringify;
  const poses = MASCOT_POSES.map((p) => `    ${p}: "/games/${slug}/mascot/${p}.svg",`).join("\n");

  const pageFor = (mode: "daily" | "unlimited") => {
    const path = mode === "daily" ? `/${slug}` : `/${slug}/unlimited`;
    return `import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameShell } from "@/frame/GameShell";
import { strings as frameStrings } from "@/frame/strings";
import { getGame, isGameReachable } from "@/games/registry";
import { ${Pascal}Game } from "@/games/${slug}/${Pascal}Game";
import { mascot } from "@/games/${slug}/mascot";
import { strings } from "@/games/${slug}/strings";
import { theme } from "@/games/${slug}/theme";

const game = getGame(${q(slug)});

export function generateMetadata(): Metadata {
  if (!game || !isGameReachable(game)) return { title: frameStrings.notFound.title };
  return {
    title: ${mode === "daily" ? "strings.name" : "`${strings.name}: ${strings.unlimited}`"},
    description: strings.tagline,
    alternates: { canonical: ${q(path)} },
  };
}

export default function ${Pascal}${mode === "daily" ? "" : "Unlimited"}Page() {
  if (!game || !isGameReachable(game)) notFound();
  // Until the game is live, its registry entry has no theme or mascot; use the local stubs.
  const definition = { ...game, theme: game.theme ?? theme, mascot: game.mascot ?? mascot };
  return (
    <GameShell game={definition} mode=${q(mode)} howTo={strings.howTo}>
      <${Pascal}Game />
    </GameShell>
  );
}
`;
  };

  return {
    [`src/games/${slug}/strings.ts`]: `// Every user-facing string of ${name}. English for now; German, French and Italian later.

export const strings = {
  name: ${q(name)},
  tagline: ${q(tagline)},
  unlimited: "Unlimited",
  howTo: {
    lines: ["TODO: first short line.", "TODO: second short line.", "TODO: third short line."],
  },
  placeholder: "This game is not playable yet.",
} as const;
`,
    [`src/games/${slug}/theme.ts`]: `import type { GameTheme } from "@/games/types";

// TODO: ${name}'s own palette (4–5 colours) plus a dark variant, and a wordmark image of the name
// in the display font (theme.wordmark). Ink on bg must reach 4.5:1 in both modes (unit-tested
// once the game is coming-soon or live).
export const theme: GameTheme = {
  light: { bg: "#FFFFFF", ink: "#111111", accent1: "#444444", accent2: "#666666", accent3: "#888888" },
  dark: { bg: "#111111", ink: "#F2F2F2", accent1: "#BBBBBB", accent2: "#999999", accent3: "#777777" },
};
`,
    [`src/games/${slug}/mascot.ts`]: `import type { MascotDefinition } from "@/games/types";

// TODO: name the mascot and draw all six poses in public/games/${slug}/mascot/.
// Until the files exist, <Mascot> shows the neutral placeholder.
export const mascot: MascotDefinition = {
  name: "TODO",
  poses: {
${poses}
  },
};
`,
    [`src/games/${slug}/content.schema.ts`]: `import * as z from "zod/mini";
import { defineContentSpec, factSchema } from "@/games/content";

// The shape of content/${slug}/. Every item is a fact: its fields plus id, sourceTitle,
// sourceUrl, checkedOn and licence (added by factSchema). \`pnpm content:validate\` enforces it.
// zod/mini, so the game can also parse puzzles in the browser without a heavy bundle.

// TODO: replace \`label\` with ${name}'s real fields.
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
`,
    [`src/games/${slug}/${Pascal}Game.tsx`]: `"use client";

import { useGame } from "@/frame/GameContext";
import { strings } from "./strings";

// Placeholder: the real game, built on the ${engine} engine (src/engines/${engine}), replaces it.
export function ${Pascal}Game() {
  const { mode, puzzle } = useGame();
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h1 className="font-display text-3xl font-black">{strings.name}</h1>
      <p className="opacity-80">{strings.placeholder}</p>
      <p className="text-sm opacity-60 tabular">
        {mode}
        {puzzle !== null ? \` #\${puzzle}\` : ""}
      </p>
    </div>
  );
}
`,
    [`src/app/(games)/${slug}/page.tsx`]: pageFor("daily"),
    [`src/app/(games)/${slug}/unlimited/page.tsx`]: pageFor("unlimited"),
    [`src/app/(games)/${slug}/opengraph-image.tsx`]: `import { ImageResponse } from "next/og";
import { strings } from "@/games/${slug}/strings";
import { theme } from "@/games/${slug}/theme";

export const alt = strings.tagline;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// TODO: ${name}'s share image, in its own palette, display font and mascot.
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 96,
        background: theme.light.bg,
        color: theme.light.ink,
      }}
    >
      <div style={{ fontSize: 120, fontWeight: 900, lineHeight: 1 }}>{strings.name}</div>
      <div style={{ marginTop: 32, fontSize: 44, maxWidth: 1000 }}>{strings.tagline}</div>
    </div>,
    size,
  );
}
`,
    [`content/${slug}/daily/.gitkeep`]: "",
    [`docs/games/${slug}.md`]: `# ${name}

${tagline}

- Slug: \`${slug}\`
- Engine: \`${engine}\`
- Status: hidden (see \`src/games/registry.ts\`)

## Concept

TODO: how a round works, what a gut guess is here, what the reveal shows.

## Content and sources

TODO: where the facts come from, their licences, how often they are checked, and who checks them.
Every fact needs sourceTitle, sourceUrl, checkedOn and licence (\`src/games/${slug}/content.schema.ts\`).

## World

- Palette (light and dark): TODO
- Display fonts: TODO (loaded in \`src/app/(games)/${slug}/layout.tsx\` only)
- Mascot: TODO, six poses in \`public/games/${slug}/mascot/\`
- Signature sounds (2–3): TODO
- Signature reveal animation: TODO

## Launch checklist

See [ADDING_A_GAME.md](../ADDING_A_GAME.md).
`,
  };
}

async function formatted(file: string, content: string): Promise<string> {
  if (!/.(ts|tsx|md)$/.test(file)) return content;
  const config = (await prettier.resolveConfig(file)) ?? {};
  return prettier.format(content, { ...config, filepath: file });
}

export async function scaffoldGame(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const slug = slugSchema.parse(options.slug);
  const name = options.name.trim();
  if (!name) throw new Error("--name is required");
  if (!(GAME_ENGINES as readonly string[]).includes(options.engine)) {
    throw new Error(`--engine must be one of ${GAME_ENGINES.join(", ")}`);
  }
  const engine = options.engine as GameEngine;
  const tagline = options.tagline?.trim() || "TODO: one sentence.";

  const files = templates(slug, name, tagline, engine);
  const clashes = Object.keys(files).filter((file) => existsSync(join(options.root, file)));
  if (clashes.length) {
    throw new Error(`Refusing to overwrite existing files:\n  ${clashes.join("\n  ")}`);
  }

  const registryPath = join(options.root, "src", "games", "registry.ts");
  const registry = readFileSync(registryPath, "utf8");
  let registryOutcome: ScaffoldResult["registry"] = "kept";
  if (!registry.includes(`slug: ${JSON.stringify(slug)},`)) {
    const markerLine = registry.split("\n").find((line) => line.includes(REGISTRY_MARKER));
    if (!markerLine)
      throw new Error(`Could not find "${REGISTRY_MARKER}" in src/games/registry.ts`);
    const entry = registryEntry({ slug, name, tagline, engine });
    writeFileSync(registryPath, registry.replace(markerLine, `${entry}\n${markerLine}`));
    registryOutcome = "inserted";
  }

  for (const [file, content] of Object.entries(files)) {
    const target = join(options.root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, await formatted(target, content));
  }

  return { created: Object.keys(files), registry: registryOutcome };
}
