import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getGame, isGameReachable } from "@/games/registry";
import { latestPuzzleNumber, puzzleFileName } from "@/lib/daily";

export const runtime = "nodejs";

// Released puzzles never change, so the CDN may keep them for a year and browsers for a day.
// (A new deployment starts with an empty CDN cache, which is how a corrected puzzle goes out.)
const RELEASED = "public, max-age=86400, s-maxage=31536000, immutable";

function notFound(): Response {
  return Response.json(
    { error: "Not found." },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * GET /api/puzzle/<game>/<n>: content/<game>/daily/<nnnn>.json, but only once puzzle n has been
 * released somewhere on Earth (n <= today's puzzle number in UTC+14). Content is read from disk
 * at request time, so future answers never end up in client JavaScript. The files ship with this
 * function via outputFileTracingIncludes in next.config.ts.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/puzzle/[game]/[n]">) {
  const { game: slug, n: raw } = await params;
  const game = getGame(slug);
  if (!game || !isGameReachable(game) || !game.modes.includes("daily") || !game.launchDate) {
    return notFound();
  }
  if (!/^\d{1,5}$/.test(raw)) return notFound();
  const n = Number(raw);
  if (n < 1 || n > latestPuzzleNumber(game.launchDate, Date.now())) return notFound();

  // `slug` is a registered slug and `n` is numeric, so this path cannot escape content/.
  const file = join(process.cwd(), "content", game.slug, "daily", puzzleFileName(n));
  let body: string;
  try {
    body = await readFile(file, "utf8");
  } catch {
    return notFound();
  }
  return new Response(body, {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": RELEASED },
  });
}
