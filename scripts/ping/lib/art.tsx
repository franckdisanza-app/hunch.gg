import { readFileSync } from "node:fs";
import { join } from "node:path";
import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { renderToStaticMarkup } from "react-dom/server";
import { atlasFromTopology } from "@/engines/map/atlas";
import { SondeArt } from "@/games/ping/art/SondeArt";
import { HEAT, NIGHT, PAPER } from "@/games/ping/palette";
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
  files["globe-dark.svg"] = globe(root, {
    ocean: NIGHT.ocean,
    land: NIGHT.land,
    coast: NIGHT.radar,
    border: NIGHT.border,
    grid: NIGHT.grid,
    rim: NIGHT.radar,
  });
  files["globe-light.svg"] = globe(root, {
    ocean: PAPER.ocean,
    land: PAPER.land,
    coast: PAPER.radarLine,
    border: PAPER.border,
    grid: PAPER.grid,
    rim: PAPER.ink,
  });
  return files;
}

/**
 * The globe as the game first shows it (centred on 20° N, 10° E at zoom 1, 1:110m land), as a
 * picture: the page shows it from the first paint, and the canvas globe takes over on top of it
 * once its shapes have loaded. Same geometry as the canvas (radius 92% of half the box).
 */
function globe(
  root: string,
  colors: { ocean: string; land: string; coast: string; border: string; grid: string; rim: string },
): string {
  const atlas = atlasFromTopology(
    "110m",
    JSON.parse(
      readFileSync(join(root, "node_modules", "world-atlas", "countries-110m.json"), "utf8"),
    ) as unknown,
  );
  const size = 400;
  const projection = geoOrthographic()
    .translate([size / 2, size / 2])
    .scale((size / 2) * 0.92)
    .rotate([-10, -20]);
  // Whole units: under half a pixel at phone size, and a smaller file.
  const path = geoPath(projection).digits(0);
  // Canvas line widths are in CSS pixels on a ~340 px globe; this box is 400 wide.
  const k = size / 340;
  const sphere = path({ type: "Sphere" });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`,
    `<path d="${sphere}" fill="${colors.ocean}"/>`,
    `<path d="${path(geoGraticule10())}" fill="none" stroke="${colors.grid}" stroke-width="${0.6 * k}"/>`,
    `<path d="${path(atlas.land)}" fill="${colors.land}" stroke="${colors.coast}" stroke-width="${0.8 * k}"/>`,
    `<path d="${path(atlas.borders)}" fill="none" stroke="${colors.border}" stroke-width="${0.5 * k}"/>`,
    `<path d="${sphere}" fill="none" stroke="${colors.rim}" stroke-width="${1.2 * k}"/>`,
    `</svg>`,
    "",
  ].join("\n");
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
