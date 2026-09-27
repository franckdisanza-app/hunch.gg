// pnpm content:validate: checks every game's content. Also runs first in `pnpm build`, so a
// failure stops the Vercel build. See src/lib/content/validate.ts for the rules.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ContentSpec } from "@/games/content";
import { games } from "@/games/registry";
import { contentMode, validateContent } from "@/lib/content/validate";

const root = process.cwd();
const mode = contentMode(process.env.CONTENT_MODE);

async function loadSpec(slug: string): Promise<ContentSpec | null> {
  const file = join(root, "src", "games", slug, "content.schema.ts");
  if (!existsSync(file)) return null;
  const mod = (await import(pathToFileURL(file).href)) as { contentSpec?: ContentSpec };
  if (!mod.contentSpec) throw new Error(`${file} does not export contentSpec`);
  return mod.contentSpec;
}

const report = await validateContent({ root, games, now: new Date(), mode, loadSpec });

for (const warning of report.warnings) console.warn(`warning  ${warning}`);
for (const error of report.errors) console.error(`error    ${error}`);

const live = games.filter((g) => g.status === "live").length;
console.log(
  `content:validate (${mode}): ${report.files.length} files, ${live} live games, ` +
    `${report.errors.length} errors, ${report.warnings.length} warnings`,
);
if (report.errors.length > 0) process.exit(1);
