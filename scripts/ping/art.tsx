// pnpm ping:art
//
// Exports Ping's static art to public/games/ping/:
//   mascot/<pose>.svg  Sonde on a dark mini-globe with one heat ring, for the shelf and the registry
//   wordmark.svg       "PING" in Unbounded as paths (no font download on the shelf)
// A unit test checks that the committed files match what this script would write.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { artFiles } from "./lib/art";

const root = process.cwd();
const out = join(root, "public", "games", "ping");
const files = artFiles(root);
for (const [path, content] of Object.entries(files)) {
  mkdirSync(dirname(join(out, path)), { recursive: true });
  writeFileSync(join(out, path), content);
}
console.log(`Wrote ${Object.keys(files).length} files to public/games/ping/`);
