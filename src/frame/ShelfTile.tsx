"use client";

import type { Route } from "next";
import Link from "next/link";
import type { GameDefinition } from "@/games/types";
import { GameThemeStyle } from "./GameThemeStyle";
import { useHistory, usePuzzleNumber } from "./hooks";
import { Mascot } from "./Mascot";
import { strings } from "./strings";
import { cx } from "./ui/cx";

/**
 * A game on the shelf, in the game's own palette, with its mascot and wordmark image (so the shelf
 * never loads game fonts). Coming-soon games are greyed out and not links.
 */
export function ShelfTile({ game, compact = false }: { game: GameDefinition; compact?: boolean }) {
  const live = game.status === "live";
  const puzzle = usePuzzleNumber(live ? game.launchDate : undefined);
  const history = useHistory(game.slug);
  const playedToday = puzzle !== null && Boolean(history[String(puzzle)]?.finishedAt);

  const body = (
    <>
      <Mascot mascot={game.mascot} size={compact ? 48 : 88} />
      <span className="flex min-w-0 flex-col items-center gap-1">
        {game.theme?.wordmark ? (
          // The wordmark is an SVG of the name in the game's display font.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.theme.wordmark}
            alt={game.name}
            width={compact ? 120 : 180}
            height={compact ? 28 : 40}
            decoding="async"
            className="h-auto max-w-full"
          />
        ) : (
          <span className={cx("font-black", compact ? "text-base" : "text-xl")}>{game.name}</span>
        )}
        {!compact && <span className="text-sm opacity-80">{game.tagline}</span>}
      </span>
      {live && playedToday && (
        <span className="absolute top-2 right-2 rounded-full bg-game-ink px-2 py-0.5 text-xs font-semibold text-game-bg">
          {strings.shelf.playedToday}
        </span>
      )}
      {!live && (
        <span className="absolute top-2 right-2 rounded-full border border-current px-2 py-0.5 text-xs font-semibold">
          {strings.shelf.comingSoon}
        </span>
      )}
    </>
  );

  const tileClass = cx(
    "relative flex flex-col items-center justify-center gap-3 rounded-sheet text-center",
    compact ? "min-h-32 p-4" : "min-h-56 p-6",
  );

  if (!live) {
    return (
      <div
        aria-disabled="true"
        className={cx(
          tileClass,
          "border border-dashed border-frame-line text-frame-muted grayscale",
        )}
      >
        {body}
      </div>
    );
  }

  return (
    <>
      <GameThemeStyle slug={game.slug} theme={game.theme} />
      <Link
        href={`/${game.slug}` as Route}
        data-game={game.slug}
        className={cx(
          tileClass,
          "bg-game-bg text-game-ink transition-transform duration-fast ease-out hover:-translate-y-0.5 active:scale-[0.98]",
        )}
      >
        {body}
      </Link>
    </>
  );
}
