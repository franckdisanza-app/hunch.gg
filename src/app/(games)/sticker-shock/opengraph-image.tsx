import { ImageResponse } from "next/og";
import { strings } from "@/games/sticker-shock/strings";
import { theme } from "@/games/sticker-shock/theme";

export const alt = strings.tagline;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// TODO: Sticker Shock's share image, in its own palette, display font and mascot.
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
