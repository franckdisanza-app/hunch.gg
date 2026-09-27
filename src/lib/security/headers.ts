// Security headers for every response. Imported by next.config.ts through Node's type stripping,
// so relative imports must keep their .ts extension and nothing here may use the @/ alias.
import { resolveAnalyticsConfig, type AnalyticsEnv } from "../analytics/config.ts";

export interface SecurityEnv extends AnalyticsEnv {
  /** Supabase project URL; its origin is allowed for images (Supabase Storage). */
  SUPABASE_URL?: string | undefined;
  /** Set to "1" by Vercel builds. */
  VERCEL?: string | undefined;
}

function supabaseOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

/**
 * Content-Security-Policy. Pages are statically prerendered, and Next.js inlines hydration data as
 * plain <script> tags that neither a nonce (needs per-request rendering) nor SRI hashes (external
 * files only) can cover. So script-src allows inline scripts; everything else is locked down.
 * See docs/ARCHITECTURE.md#security.
 */
export function buildCsp(env: SecurityEnv): string {
  const analytics = resolveAnalyticsConfig(env);
  const isDev = env.NODE_ENV === "development";
  const storage = supabaseOrigin(env.SUPABASE_URL);

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...analytics.scriptOrigins,
      // React uses eval in development only, for error stacks.
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...(storage ? [storage] : [])],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...analytics.connectOrigins],
    "media-src": ["'self'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  // Only on Vercel: local production builds are served over plain http://localhost.
  if (env.VERCEL === "1") parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

export function securityHeaders(env: SecurityEnv): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: buildCsp(env) },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      value: [
        "accelerometer=()",
        "browsing-topics=()",
        "camera=()",
        "display-capture=()",
        "geolocation=()",
        "gyroscope=()",
        "magnetometer=()",
        "microphone=()",
        "payment=()",
        "usb=()",
      ].join(", "),
    },
  ];
}
