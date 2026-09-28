import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { PALETTE } from "@/games/sticker-shock/palette";
import { strings } from "@/games/sticker-shock/strings";

export const alt = strings.tagline;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The share image: a till receipt on sale red, with Tag on its starburst. Prerendered at build.

const font = (pkg: string, file: string) =>
  readFile(join(process.cwd(), "node_modules", "@fontsource", pkg, "files", file));

function zigzag(width: number, color: string): string {
  const teeth = Math.round(width / 24);
  const step = width / teeth;
  const points = Array.from(
    { length: teeth + 1 },
    (_, i) => `${i * step},0 ${i * step + step / 2},14`,
  )
    .join(" ")
    .concat(` ${width},0`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="14"><polygon points="0,0 ${points}" fill="${color}"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export default async function OpengraphImage() {
  const [anton, mono, monoBold, mascot] = await Promise.all([
    font("anton", "anton-latin-400-normal.woff"),
    font("ibm-plex-mono", "ibm-plex-mono-latin-400-normal.woff"),
    font("ibm-plex-mono", "ibm-plex-mono-latin-700-normal.woff"),
    readFile(join(process.cwd(), "public", "games", "sticker-shock", "mascot", "celebrate.svg")),
  ]);
  const { paper, ink, red } = PALETTE;
  const receiptWidth = 640;
  const line = { display: "flex", justifyContent: "space-between", fontSize: 26 } as const;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 90px 0 110px",
        background: red,
        fontFamily: "Plex Mono",
        color: ink,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: receiptWidth,
          transform: "rotate(-2deg)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            background: paper,
            padding: "44px 48px 36px",
          }}
        >
          <div style={{ ...line, justifyContent: "center", fontWeight: 700 }}>
            {strings.receipt.store}
          </div>
          <div style={{ display: "flex", fontFamily: "Anton", fontSize: 118, lineHeight: 1.05 }}>
            {strings.name.toUpperCase()}
          </div>
          <div style={{ display: "flex", fontSize: 30, lineHeight: 1.3 }}>{strings.tagline}</div>
          <div style={{ display: "flex", borderTop: `3px dashed ${ink}`, margin: "12px 0 4px" }} />
          <div style={line}>
            <span>{strings.sign.toUpperCase()}</span>
            <span>A / B</span>
          </div>
          <div style={{ ...line, fontWeight: 700 }}>{strings.receipt.og}</div>
        </div>
        <img src={zigzag(receiptWidth, paper)} width={receiptWidth} height={14} alt="" />
      </div>
      <img
        src={`data:image/svg+xml;base64,${mascot.toString("base64")}`}
        width={340}
        height={340}
        alt=""
      />
    </div>,
    {
      ...size,
      fonts: [
        { name: "Anton", data: anton, weight: 400, style: "normal" },
        { name: "Plex Mono", data: mono, weight: 400, style: "normal" },
        { name: "Plex Mono", data: monoBold, weight: 700, style: "normal" },
      ],
    },
  );
}
