"use client";

import { useHistory, usePuzzleNumber } from "./hooks";
import { strings } from "./strings";

/**
 * "Played today" on a live shelf tile. It reads player storage, so it loads on its own after
 * hydration (see lazy.ts): the shelf's first-load JavaScript never carries storage validation.
 */
export function PlayedTodayBadge({ slug, launchDate }: { slug: string; launchDate: string }) {
  const puzzle = usePuzzleNumber(launchDate);
  const history = useHistory(slug);
  if (puzzle === null || !history[String(puzzle)]?.finishedAt) return null;
  return (
    <span className="absolute top-2 right-2 rounded-full bg-game-ink px-2 py-0.5 text-xs font-semibold text-game-bg">
      {strings.shelf.playedToday}
    </span>
  );
}
