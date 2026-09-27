// Resolves which cookieless analytics provider is active and which hosts it needs.
// Pure and import-free: next.config.ts imports it (through Node's type stripping) to build the CSP.

export const ANALYTICS_PROVIDERS = ["none", "plausible", "umami", "vercel"] as const;
export type AnalyticsProviderName = (typeof ANALYTICS_PROVIDERS)[number];

export interface AnalyticsEnv {
  NODE_ENV?: string | undefined;
  /** Set by Vercel: "production" | "preview" | "development". Unset elsewhere. */
  VERCEL_ENV?: string | undefined;
  NEXT_PUBLIC_ANALYTICS_PROVIDER?: string | undefined;
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN?: string | undefined;
  NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL?: string | undefined;
  NEXT_PUBLIC_UMAMI_WEBSITE_ID?: string | undefined;
  NEXT_PUBLIC_UMAMI_SCRIPT_URL?: string | undefined;
  NEXT_PUBLIC_UMAMI_HOST_URL?: string | undefined;
}

export interface AnalyticsScript {
  src: string;
  /** Extra attributes for the <script> tag, e.g. data-domain. */
  attributes: Record<string, string>;
}

export interface AnalyticsConfig {
  provider: AnalyticsProviderName;
  script: AnalyticsScript | null;
  /** Origins the CSP must allow in script-src. */
  scriptOrigins: string[];
  /** Origins the CSP must allow in connect-src. */
  connectOrigins: string[];
  /** Set when a provider was requested but could not be enabled. */
  warning?: string;
}

const DEFAULT_PLAUSIBLE_SCRIPT = "https://plausible.io/js/script.js";
const DEFAULT_UMAMI_SCRIPT = "https://cloud.umami.is/script.js";

const NONE: AnalyticsConfig = {
  provider: "none",
  script: null,
  scriptOrigins: [],
  connectOrigins: [],
};

function isProvider(value: string): value is AnalyticsProviderName {
  return (ANALYTICS_PROVIDERS as readonly string[]).includes(value);
}

function originOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

/** Analytics only runs in production builds, and never on Vercel preview deployments. */
export function analyticsAllowed(env: AnalyticsEnv): boolean {
  if (env.NODE_ENV !== "production") return false;
  return env.VERCEL_ENV === undefined || env.VERCEL_ENV === "" || env.VERCEL_ENV === "production";
}

export function resolveAnalyticsConfig(env: AnalyticsEnv): AnalyticsConfig {
  const requested = (env.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? "none").trim().toLowerCase() || "none";
  if (!isProvider(requested)) {
    return { ...NONE, warning: `Unknown NEXT_PUBLIC_ANALYTICS_PROVIDER "${requested}".` };
  }
  if (requested === "none" || !analyticsAllowed(env)) return NONE;

  switch (requested) {
    case "plausible": {
      const domain = env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
      const src = env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL?.trim() || DEFAULT_PLAUSIBLE_SCRIPT;
      const origin = originOf(src);
      if (!domain || !origin) {
        return {
          ...NONE,
          warning: "Plausible needs NEXT_PUBLIC_PLAUSIBLE_DOMAIN and an https script URL.",
        };
      }
      return {
        provider: "plausible",
        script: { src, attributes: { "data-domain": domain } },
        scriptOrigins: [origin],
        connectOrigins: [origin],
      };
    }
    case "umami": {
      const websiteId = env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();
      const src = env.NEXT_PUBLIC_UMAMI_SCRIPT_URL?.trim() || DEFAULT_UMAMI_SCRIPT;
      const origin = originOf(src);
      const hostUrl = env.NEXT_PUBLIC_UMAMI_HOST_URL?.trim();
      const hostOrigin = hostUrl ? originOf(hostUrl) : origin;
      if (!websiteId || !origin || !hostOrigin) {
        return { ...NONE, warning: "Umami needs NEXT_PUBLIC_UMAMI_WEBSITE_ID and https URLs." };
      }
      const attributes: Record<string, string> = {
        "data-website-id": websiteId,
        // Plimp sends its own typed events; no automatic pageview-only tracking of query strings.
        "data-exclude-search": "true",
      };
      if (hostUrl) attributes["data-host-url"] = hostOrigin;
      return {
        provider: "umami",
        script: { src, attributes },
        scriptOrigins: [origin],
        connectOrigins: [...new Set([origin, hostOrigin])],
      };
    }
    case "vercel":
      // Vercel Web Analytics is served from the site's own origin under /_vercel/insights.
      // Custom events need a Pro plan (see docs/DEPLOY.md).
      return {
        provider: "vercel",
        script: { src: "/_vercel/insights/script.js", attributes: {} },
        scriptOrigins: [],
        connectOrigins: [],
      };
  }
}
