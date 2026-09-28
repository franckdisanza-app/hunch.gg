// pnpm size: first-load JavaScript budget, checked in CI after `pnpm build`.
//
// Next.js 16 no longer prints per-route first-load sizes, so this reads the prerendered HTML of
// each route, collects every /_next/static script it loads, and sums their gzipped sizes.
// /dev/game-shell (an empty GameShell) only exists in builds with ENABLE_DEV_ROUTES=1.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

// Agreed budget: the framework alone (Next 16.3 + React 19.3) ships ~136 KB, see docs/ARCHITECTURE.md.
const BUDGET_KB = 185;
const ROUTES = [
  { route: "/", html: "index.html" },
  { route: "/dev/game-shell", html: "dev/game-shell.html" },
];

const root = process.cwd();
const appDir = join(root, ".next", "server", "app");
const cache = new Map<string, number>();

function gzippedSize(src: string): number {
  const cached = cache.get(src);
  if (cached !== undefined) return cached;
  const file = join(root, ".next", src.replace(/^\/_next\//, "").split("?")[0]!);
  const size = gzipSync(readFileSync(file)).byteLength;
  cache.set(src, size);
  return size;
}

let failed = false;
for (const { route, html } of ROUTES) {
  const file = join(appDir, html);
  if (!existsSync(file)) {
    console.error(`${route}: ${file} not found. Run \`pnpm build\` first.`);
    failed = true;
    continue;
  }
  const page = readFileSync(file, "utf8");
  if (route.startsWith("/dev") && !page.includes("data-game=")) {
    console.error(`${route}: built as a 404. Build with ENABLE_DEV_ROUTES=1 to measure it.`);
    failed = true;
    continue;
  }
  const scripts = [
    ...new Set(
      // noModule polyfills only load in browsers without ES modules, so they are not counted.
      [...page.matchAll(/<script(?![^>]*noModule)[^>]+src="(\/_next\/static\/[^"]+\.js)"/g)].map(
        (m) => m[1]!,
      ),
    ),
  ];
  const bytes = scripts.reduce((sum, src) => sum + gzippedSize(src), 0);
  const kb = bytes / 1024;
  const ok = kb <= BUDGET_KB;
  if (!ok) failed = true;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${route.padEnd(16)} ${kb.toFixed(1).padStart(6)} KB gzipped in ${scripts.length} scripts (budget ${BUDGET_KB} KB)`,
  );
}

if (failed) process.exit(1);
