import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

// The e2e suite runs against a production build. CI builds in an earlier step and sets
// E2E_SKIP_BUILD=1; locally `pnpm test:e2e` builds first so the result is never stale.
const build = process.env.E2E_SKIP_BUILD ? "" : "pnpm build && ";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `${build}pnpm start --port ${PORT}`,
    url: baseURL,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: {
      // /dev must render in the e2e build; production deploys leave this unset.
      ENABLE_DEV_ROUTES: "1",
      // The documented in-memory crowd store (see docs/ARCHITECTURE.md). No database needed.
      CROWD_STORE: "memory",
      IP_HASH_SALT: "e2e-only-salt",
      CRON_SECRET: "e2e-only-cron-secret",
      NEXT_PUBLIC_SITE_URL: baseURL,
    },
  },
});
