import { buildCsp, securityHeaders } from "./headers";

function directive(csp: string, name: string): string[] {
  const part = csp.split("; ").find((p) => p.startsWith(`${name} `));
  return part ? part.split(" ").slice(1) : [];
}

describe("buildCsp", () => {
  it("locks everything to self by default", () => {
    const csp = buildCsp({ NODE_ENV: "production" });
    expect(directive(csp, "default-src")).toEqual(["'self'"]);
    expect(directive(csp, "script-src")).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directive(csp, "connect-src")).toEqual(["'self'"]);
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
    expect(directive(csp, "frame-ancestors")).toEqual(["'none'"]);
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("allows eval only in development", () => {
    expect(directive(buildCsp({ NODE_ENV: "development" }), "script-src")).toContain(
      "'unsafe-eval'",
    );
  });

  it("allows the Supabase Storage origin for images", () => {
    const csp = buildCsp({
      NODE_ENV: "production",
      SUPABASE_URL: "https://example-project.supabase.co",
    });
    expect(directive(csp, "img-src")).toContain("https://example-project.supabase.co");
  });

  it("ignores a non-https Supabase URL", () => {
    const csp = buildCsp({ NODE_ENV: "production", SUPABASE_URL: "http://127.0.0.1:54321" });
    expect(directive(csp, "img-src")).toEqual(["'self'", "data:", "blob:"]);
  });

  it("adds the configured analytics host in production", () => {
    const csp = buildCsp({
      NODE_ENV: "production",
      NEXT_PUBLIC_ANALYTICS_PROVIDER: "plausible",
      NEXT_PUBLIC_PLAUSIBLE_DOMAIN: "example.test",
    });
    expect(directive(csp, "script-src")).toContain("https://plausible.io");
    expect(directive(csp, "connect-src")).toContain("https://plausible.io");
  });

  it("upgrades insecure requests on Vercel", () => {
    expect(buildCsp({ NODE_ENV: "production", VERCEL: "1" })).toContain(
      "upgrade-insecure-requests",
    );
  });
});

describe("securityHeaders", () => {
  it("sets the required headers", () => {
    const keys = securityHeaders({ NODE_ENV: "production" }).map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "Referrer-Policy",
        "X-Content-Type-Options",
        "Permissions-Policy",
      ]),
    );
  });
});
