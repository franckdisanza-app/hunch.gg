import { ImageResponse } from "next/og";
import { strings } from "@/frame/strings";

export const alt = strings.site.description;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The site-wide share image. Each game has its own in src/app/(games)/<slug>/opengraph-image.tsx.
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
        background: "#FFFFFF",
        color: "#111111",
      }}
    >
      <div style={{ fontSize: 180, fontWeight: 900, letterSpacing: -6, lineHeight: 1 }}>plimp</div>
      <div style={{ marginTop: 32, fontSize: 48, color: "#6B6B6B", maxWidth: 900 }}>
        {strings.site.tagline}
      </div>
    </div>,
    size,
  );
}
