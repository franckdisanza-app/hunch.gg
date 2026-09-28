// pnpm sticker-shock:art
//
// Exports Sticker Shock's static art to public/games/sticker-shock/:
//   mascot/<pose>.svg  Tag on a yellow starburst, for the shelf and the registry (from TagArt)
//   wordmark.svg       "STICKER SHOCK" in Anton as paths, on receipt paper (no font download)
//   flags/<cc>.svg     the flags of countries.json, from flag-icons (MIT), plus its licence
// A unit test checks that the committed files match what this script would write.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Country } from "@/games/sticker-shock/content.schema";
import { artFiles } from "./lib/art";

const root = process.cwd();
const out = join(root, "public", "games", "sticker-shock");

const files = artFiles(root);
for (const [path, content] of Object.entries(files)) {
  mkdirSync(join(out, path, ".."), { recursive: true });
  writeFileSync(join(out, path), content);
}

const countries = JSON.parse(
  readFileSync(join(root, "content", "sticker-shock", "countries.json"), "utf8"),
) as Country[];
const flagSource = join(root, "node_modules", "flag-icons");
mkdirSync(join(out, "flags"), { recursive: true });
for (const { code } of countries) {
  const name = `${code.toLowerCase()}.svg`;
  copyFileSync(join(flagSource, "flags", "4x3", name), join(out, "flags", name));
}
copyFileSync(join(flagSource, "LICENSE"), join(out, "flags", "LICENSE.txt"));

console.log(
  `Wrote ${Object.keys(files).length} files and ${countries.length} flags to public/games/sticker-shock/`,
);
