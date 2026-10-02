import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security/headers.ts";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  // The puzzle API reads daily content from disk at request time; ship those files with it.
  outputFileTracingIncludes: {
    "/api/puzzle/\\[game\\]/\\[n\\]": ["./content/*/daily/*.json"],
    // Sticker Shock's Endless pool reads the price list and the upcoming dailies.
    "/api/games/sticker-shock/pool": [
      "./content/sticker-shock/*.json",
      "./content/sticker-shock/daily/*.json",
    ],
    // Ping's Practice serves the questions of past days.
    "/api/games/ping/practice": ["./content/ping/daily/*.json"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders(process.env) },
      // The globe's cities and roads (pnpm map:data): a new format gets a new /map/vN/ folder, a
      // data refresh within one shows up within a day.
      {
        source: "/map/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
    ];
  },
};

export default nextConfig;
