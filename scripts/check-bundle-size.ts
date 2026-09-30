// pnpm size: first-load JavaScript budget, checked in CI after `pnpm build`.
//
// Next.js 16 no longer prints per-route first-load sizes, so this reads the prerendered HTML of
// each route, collects every /_next/static script it loads, and sums their gzipped sizes.
// /dev/game-shell (an empty GameShell) only exists in builds with ENABLE_DEV_ROUTES=1.
//
// Every game route under src/app/(games)/ is found on its own and held to the game-page budget,
// so a new game (or a change that makes every game heavier) cannot slip past CI. Hidden games
// build as 404s without ENABLE_DEV_ROUTES=1 and are skipped then.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

// Agreed budget: the framework alone (Next 16.3 + React 19.3) ships ~136 KB, see docs/ARCHITECTURE.md.
const BUDGET_KB = 185;
// A game page adds its own world (art, engine, content schema) to the shell: about 25 KB today.
const GAME_BUDGET_KB = 215;

const root = process.cwd();

interface Target {
  route: string;
  html: string;
  budget: number;
  /** Game routes of hidden games are 404s in production builds: skip them there. */
  optional?: boolean;
}

function gameRoutes(): Target[] {
  const dir = join(root, "src", "app", "(games)");
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const pages = [{ route: `/${entry.name}`, html: `${entry.name}.html` }];
      if (existsSync(join(dir, entry.name, "unlimited", "page.tsx"))) {
        pages.push({ route: `/${entry.name}/unlimited`, html: `${entry.name}/unlimited.html` });
      }
      return pages.map((page) => ({ ...page, budget: GAME_BUDGET_KB, optional: true }));
    });
}

const ROUTES: Target[] = [
  { route: "/", html: "index.html", budget: BUDGET_KB },
  { route: "/dev/game-shell", html: "dev/game-shell.html", budget: BUDGET_KB },
  ...gameRoutes(),
];
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
for (const { route, html, budget, optional } of ROUTES) {
  const file = join(appDir, html);
  if (!existsSync(file)) {
    console.error(`${route}: ${file} not found. Run \`pnpm build\` first.`);
    failed = true;
    continue;
  }
  const page = readFileSync(file, "utf8");
  if (optional && !page.includes("data-game=")) {
    console.log(`skip ${route.padEnd(24)} not built (hidden game without ENABLE_DEV_ROUTES=1)`);
    continue;
  }
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
  const ok = kb <= budget;
  if (!ok) failed = true;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${route.padEnd(24)} ${kb.toFixed(1).padStart(6)} KB gzipped in ${scripts.length} scripts (budget ${budget} KB)`,
  );
}

if (failed) process.exit(1);
