"use client";

import type { Route } from "next";
import { useId, type ReactNode } from "react";
import { liveGames } from "@/games/registry";
import { formatNumber } from "@/lib/format";
import type { ShareInput } from "@/lib/share";
import { Countdown } from "./Countdown";
import { ShelfTile } from "./ShelfTile";
import { ShareButton } from "./ShareButton";
import { strings } from "./strings";
import { ButtonLink } from "./ui/Button";
import { cx } from "./ui/cx";

export interface ResultsScreenProps {
  game: string;
  /** The score as shown, e.g. "4/5". Always numbers. */
  score: string;
  /** Per-item summary: one row per question, in the game's style. */
  summary?: ReactNode;
  streak: number;
  getShare: () => ShareInput;
  /** Link to the unlimited mode; omit to hide the button. */
  unlimitedHref?: Route;
  /** The game's name for its unlimited mode, e.g. "Endless". */
  unlimitedLabel?: string;
  /**
   * The summary already shows the score, the streak and the countdown in the game's style (a
   * receipt, a scorecard): the frame then leaves out its own score line and streak box.
   */
  summaryShowsStats?: boolean;
  /** After the share and unlimited buttons, e.g. the one-tap poll. */
  extras?: ReactNode;
}

/** The end of a daily round. Structure is shared; games fill the summary slot. */
export function ResultsScreen({
  game,
  score,
  summary,
  streak,
  getShare,
  unlimitedHref,
  unlimitedLabel,
  summaryShowsStats = false,
  extras,
}: ResultsScreenProps) {
  const others = liveGames().filter((g) => g.slug !== game);
  const titleId = useId();
  const moreId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-6">
      <header className="flex flex-col items-center gap-1 text-center">
        <h2
          id={titleId}
          className={cx("text-sm font-semibold text-frame-muted", summaryShowsStats && "sr-only")}
        >
          {strings.results.title}
        </h2>
        {!summaryShowsStats && <p className="text-5xl font-black tabular">{score}</p>}
      </header>

      {summary && <div>{summary}</div>}

      {!summaryShowsStats && (
        <div className="grid grid-cols-2 items-center gap-4 rounded-sheet border border-frame-line p-4">
          <p className="flex flex-col items-center gap-1">
            <span className="text-sm text-frame-muted">{strings.results.streak}</span>
            <span className="text-2xl font-bold tabular">{formatNumber(streak)}</span>
          </p>
          <Countdown />
        </div>
      )}

      <div className="flex flex-col gap-3">
        <ShareButton getShare={getShare} className="w-full" />
        {unlimitedHref && (
          <ButtonLink href={unlimitedHref} size="lg" className="w-full">
            {unlimitedLabel
              ? strings.results.playMode(unlimitedLabel)
              : strings.results.playUnlimited}
          </ButtonLink>
        )}
      </div>

      {extras}

      {others.length > 0 && (
        <nav aria-labelledby={moreId} className="flex flex-col gap-3">
          <h2 id={moreId} className="text-sm font-semibold">
            {strings.results.moreFrom}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {others.map((g) => (
              <li key={g.slug}>
                <ShelfTile game={g} compact />
              </li>
            ))}
          </ul>
        </nav>
      )}
    </section>
  );
}
