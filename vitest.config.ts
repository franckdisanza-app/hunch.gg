import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src/", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: `${src}$1` },
      // `server-only` throws outside a React Server Components bundle; tests import server modules directly.
      {
        find: /^server-only$/,
        replacement: fileURLToPath(new URL("./tests/unit/server-only-stub.ts", import.meta.url)),
      },
    ],
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts", "tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/unit/setup.ts"],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
