import { ImageResponse } from "next/og";

// The placeholder app icon: the wordmark's "p" on the frame ink. Swap for real artwork later.
// `padding` keeps the glyph inside the safe zone of maskable icons.
export function iconImage(size: number, { padding = 0.18, radius = 0.22 } = {}) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#111111",
        borderRadius: radius * size,
        color: "#FFFFFF",
        fontSize: size * (1 - padding * 2),
        fontWeight: 800,
        lineHeight: 1,
        paddingBottom: size * 0.12,
      }}
    >
      p
    </div>,
    { width: size, height: size },
  );
}
