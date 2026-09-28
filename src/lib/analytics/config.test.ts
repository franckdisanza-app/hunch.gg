import { resolveAnalyticsConfig } from "./config";

describe("resolveAnalyticsConfig", () => {
  it("defaults to none", () => {
    expect(resolveAnalyticsConfig({ NODE_ENV: "production" }).provider).toBe("none");
  });

  it("is none outside production builds even when configured", () => {
    const env = { NEXT_PUBLIC_ANALYTICS_PROVIDER: "vercel" };
    expect(resolveAnalyticsConfig({ ...env, NODE_ENV: "development" }).provider).toBe("none");
    expect(resolveAnalyticsConfig({ ...env, NODE_ENV: "test" }).provider).toBe("none");
  });

  it("is none on Vercel preview deployments", () => {
    const config = resolveAnalyticsConfig({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_ANALYTICS_PROVIDER: "vercel",
    });
    expect(config.provider).toBe("none");
  });

  it("configures Plausible with its domain", () => {
    const config = resolveAnalyticsConfig({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      NEXT_PUBLIC_ANALYTICS_PROVIDER: "plausible",
      NEXT_PUBLIC_PLAUSIBLE_DOMAIN: "example.test",
    });
    expect(config.provider).toBe("plausible");
    expect(config.script?.attributes["data-domain"]).toBe("example.test");
    expect(config.scriptOrigins).toEqual(["https://plausible.io"]);
  });

  it("falls back to none with a warning when Plausible has no domain", () => {
    const config = resolveAnalyticsConfig({
      NODE_ENV: "production",
      NEXT_PUBLIC_ANALYTICS_PROVIDER: "plausible",
    });
    expect(config.provider).toBe("none");
    expect(config.warning).toMatch(/PLAUSIBLE_DOMAIN/);
  });

  it("configures Umami with a separate collection host", () => {
    const config = resolveAnalyticsConfig({
      NODE_ENV: "production",
      NEXT_PUBLIC_ANALYTICS_PROVIDER: "umami",
      NEXT_PUBLIC_UMAMI_WEBSITE_ID: "00000000-0000-4000-8000-000000000000",
      NEXT_PUBLIC_UMAMI_HOST_URL: "https://collect.example.test/",
    });
    expect(config.provider).toBe("umami");
    expect(config.connectOrigins).toEqual([
      "https://cloud.umami.is",
      "https://collect.example.test",
    ]);
    expect(config.script?.attributes["data-host-url"]).toBe("https://collect.example.test");
  });

  it("serves Vercel analytics from the site's own origin", () => {
    const config = resolveAnalyticsConfig({
      NODE_ENV: "production",
      NEXT_PUBLIC_ANALYTICS_PROVIDER: "vercel",
    });
    expect(config.script?.src).toBe("/_vercel/insights/script.js");
    expect(config.scriptOrigins).toEqual([]);
  });

  it("rejects unknown providers", () => {
    const config = resolveAnalyticsConfig({
      NODE_ENV: "production",
      NEXT_PUBLIC_ANALYTICS_PROVIDER: "google",
    });
    expect(config.provider).toBe("none");
    expect(config.warning).toBeDefined();
  });
});
