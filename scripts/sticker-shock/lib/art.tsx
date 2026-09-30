import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { TagArt } from "@/games/sticker-shock/art/TagArt";
import { PALETTE } from "@/games/sticker-shock/palette";
import { MASCOT_POSES } from "@/games/types";
import { readWoff, textPath } from "../../lib/font-paths";

/** The static art files, by path under public/games/sticker-shock/. */
export function artFiles(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const pose of MASCOT_POSES) {
    const svg = renderToStaticMarkup(<TagArt pose={pose} size={120} backdrop />);
    files[`mascot/${pose}.svg`] = `${svg}\n`;
  }
  files["wordmark.svg"] = wordmark(root);
  return files;
}

/** "STICKER SHOCK" in Anton, ink on a receipt-white label, so it reads on light and dark tiles. */
function wordmark(root: string): string {
  const anton = readWoff(
    readFileSync(
      join(root, "node_modules", "@fontsource", "anton", "files", "anton-latin-400-normal.woff"),
    ),
  );
  const size = 40;
  const pad = 10;
  const text = textPath(anton, "STICKER SHOCK", size, pad + size * 0.88, 1);
  const width = Math.ceil(text.width + pad * 2);
  const height = Math.ceil(size + pad * 2);
  const { paper, ink, red } = PALETTE;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Sticker Shock">`,
    `<rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}" rx="4" fill="${paper}" stroke="${ink}" stroke-width="3"/>`,
    `<rect x="3" y="3" width="${width - 6}" height="5" fill="${red}"/>`,
    `<path transform="translate(${pad} 2)" fill="${ink}" d="${text.d}"/>`,
    `</svg>`,
    "",
  ].join("\n");
}
