import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { ImageResponse } from "next/og";
import { atlasFromTopology } from "@/engines/map/atlas";
import { distanceKm, geodesicCircle } from "@/engines/map/geo";
import { HEAT, NIGHT } from "@/games/ping/palette";
import { strings } from "@/games/ping/strings";

export const alt = strings.tagline;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The share image: a dark globe with three heat rings closing in on a spot, Sonde floating above,
// and the tagline. Prerendered at build; the globe is drawn with d3-geo from world-atlas shapes.

const font = (pkg: string, file: string) =>
  readFile(join(process.cwd(), "node_modules", "@fontsource", pkg, "files", file));

const dataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

async function globeSvg(): Promise<string> {
  const topology: unknown = JSON.parse(
    await readFile(
      join(process.cwd(), "node_modules", "world-atlas", "countries-110m.json"),
      "utf8",
    ),
  );
  const { land } = atlasFromTopology("110m", topology);
  const r = 250;
  const projection = geoOrthographic()
    .translate([r + 10, r + 10])
    .scale(r)
    .rotate([-20, -25]);
  const path = geoPath(projection);
  // Decorative rings around a made-up spot, cold → mild → hot as they close in.
  const spot = { lat: 18, lon: 32 };
  const rings = [
    { center: { lat: 48, lon: -5 }, color: HEAT.cold },
    { center: { lat: 42, lon: 58 }, color: HEAT.mild },
    { center: { lat: 10, lon: 22 }, color: HEAT.hot },
  ].map(({ center, color }) => {
    const ring = geodesicCircle(center, distanceKm(center, spot), 1);
    const line = path({ type: "LineString", coordinates: ring.coordinates[0]! }) ?? "";
    return `<path d="${line}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`;
  });
  const [x, y] = projection([spot.lon, spot.lat])!;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${2 * r + 20}" height="${2 * r + 20}" viewBox="0 0 ${2 * r + 20} ${2 * r + 20}">`,
    `<path d="${path({ type: "Sphere" })}" fill="${NIGHT.ocean}"/>`,
    `<path d="${path(geoGraticule10())}" fill="none" stroke="${NIGHT.grid}" stroke-width="1.2"/>`,
    `<path d="${path(land)}" fill="${NIGHT.land}" stroke="${NIGHT.radar}" stroke-width="1.4"/>`,
    ...rings,
    `<circle cx="${x}" cy="${y}" r="9" fill="${HEAT.hot}" stroke="${NIGHT.bg}" stroke-width="3"/>`,
    `<path d="${path({ type: "Sphere" })}" fill="none" stroke="${NIGHT.radar}" stroke-width="3"/>`,
    `</svg>`,
  ].join("");
}

export default async function OpengraphImage() {
  const [unbounded, mono, globe, sonde] = await Promise.all([
    font("unbounded", "unbounded-latin-800-normal.woff"),
    font("jetbrains-mono", "jetbrains-mono-latin-500-normal.woff"),
    globeSvg(),
    readFile(join(process.cwd(), "public", "games", "ping", "sonde.svg"), "utf8"),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 40px 0 90px",
        background: NIGHT.bg,
        color: NIGHT.ink,
        fontFamily: "JetBrains Mono",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24, width: 560 }}>
        <div
          style={{
            display: "flex",
            fontFamily: "Unbounded",
            fontSize: 150,
            lineHeight: 1,
            color: NIGHT.radar,
          }}
        >
          {strings.name.toUpperCase()}
        </div>
        <div style={{ display: "flex", fontSize: 38, lineHeight: 1.35 }}>{strings.tagline}</div>
      </div>
      <div style={{ display: "flex", position: "relative", width: 520, height: 560 }}>
        <img src={dataUri(globe)} width={520} height={520} alt="" style={{ marginTop: 40 }} />
        <img
          src={dataUri(sonde)}
          width={220}
          height={220}
          alt=""
          style={{ position: "absolute", top: -10, left: 150 }}
        />
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Unbounded", data: unbounded, weight: 800, style: "normal" },
        { name: "JetBrains Mono", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
}
