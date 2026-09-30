import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { SondeArt } from "@/games/ping/art/SondeArt";
import { HEAT, NIGHT } from "@/games/ping/palette";
import { MASCOT_POSES } from "@/games/types";
import { readWoff, textPath } from "../../lib/font-paths";

/** The static art files, by path under public/games/ping/. */
export function artFiles(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const pose of MASCOT_POSES) {
    const svg = renderToStaticMarkup(<SondeArt pose={pose} size={120} backdrop />);
    files[`mascot/${pose}.svg`] = `${svg}\n`;
  }
  // Sonde alone, celebrating, for the share image (next to its own big globe).
  files["sonde.svg"] = `${renderToStaticMarkup(<SondeArt pose="celebrate" size={220} />)}\n`;
  files["wordmark.svg"] = wordmark(root);
  return files;
}

/**
 * "PING" in Unbounded, radar green on night navy with a small heat ring for the dot, so it reads
 * on light and dark shelf tiles without downloading the font.
 */
function wordmark(root: string): string {
  const unbounded = readWoff(
    readFileSync(
      join(
        root,
        "node_modules",
        "@fontsource",
        "unbounded",
        "files",
        "unbounded-latin-800-normal.woff",
      ),
    ),
  );
  const size = 34;
  const pad = 12;
  const text = textPath(unbounded, "PING", size, pad + size * 0.86, 0.5);
  const ring = 12;
  const width = Math.ceil(text.width + pad * 3 + ring * 2);
  const height = Math.ceil(size + pad * 2);
  const cx = pad * 2 + text.width + ring;
  const cy = height / 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Ping">`,
    `<rect width="${width}" height="${height}" rx="${height / 2}" fill="${NIGHT.bg}"/>`,
    `<path transform="translate(${pad} 0)" fill="${NIGHT.radar}" d="${text.d}"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${ring - 2}" fill="none" stroke="${HEAT.hot}" stroke-width="3"/>`,
    `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${HEAT.hot}"/>`,
    `</svg>`,
    "",
  ].join("\n");
}
