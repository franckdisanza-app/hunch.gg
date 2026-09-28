// pnpm new-game <slug> --name "<Name>" --engine <choice|estimate|clue|map> [--tagline "..."]
//
// Scaffolds a hidden game that typechecks and builds but is not playable. Then follow
// docs/ADDING_A_GAME.md to take it to status: 'live'.
import { parseArgs } from "node:util";
import { scaffoldGame } from "./lib/scaffold";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: "string" },
    engine: { type: "string" },
    tagline: { type: "string" },
  },
});

const [slug] = positionals;
if (!slug || !values.name || !values.engine) {
  console.error(
    'Usage: pnpm new-game <slug> --name "<Name>" --engine <choice|estimate|clue|map> [--tagline "..."]',
  );
  process.exit(1);
}

try {
  const result = await scaffoldGame({
    root: process.cwd(),
    slug,
    name: values.name,
    engine: values.engine,
    tagline: values.tagline,
  });
  console.log(
    result.registry === "inserted"
      ? `Added "${slug}" to src/games/registry.ts (status: hidden).`
      : `Kept the existing registry entry for "${slug}".`,
  );
  for (const file of result.created) console.log(`  created ${file}`);
  console.log(`
Next:
  1. pnpm dev, then open http://localhost:3000/${slug} (hidden games work in development)
  2. Fill in docs/games/${slug}.md and the TODOs in src/games/${slug}/
  3. Follow docs/ADDING_A_GAME.md to go live`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
