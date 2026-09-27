"use client";

import { useState, type ReactNode } from "react";
import type { Source } from "@/games/content";
import { formatIsoDate } from "@/lib/format";
import { ReportDialog } from "./ReportDialog";
import { strings } from "./strings";
import { cx } from "./ui/cx";
import { IconFlag } from "./ui/Icons";

export interface RevealCardProps {
  game: string;
  /** The fact's item ID, attached to reports. */
  itemId: string;
  /** Completes "Turns out…", e.g. "the fake widget costs more." */
  statement: ReactNode;
  /** The numbers: prices, percentages, dates. Styled by the game. */
  children?: ReactNode;
  source: Pick<Source, "sourceTitle" | "sourceUrl" | "checkedOn">;
  /** Card artwork and the signature reveal animation belong to the game. */
  className?: string;
}

/**
 * Every reveal in Plimp: "Turns out…", the numbers, and where they come from. The layout and the
 * source line are shared; the look of the card is each game's own.
 */
export function RevealCard({
  game,
  itemId,
  statement,
  children,
  source,
  className,
}: RevealCardProps) {
  const [reporting, setReporting] = useState(false);
  return (
    <article
      className={cx("flex flex-col gap-3 rounded-sheet border border-frame-line p-5", className)}
    >
      <p className="text-lg leading-snug">
        <span className="font-bold">{strings.reveal.turnsOut}</span> {statement}
      </p>
      {children && <div>{children}</div>}
      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-current/15 pt-3 text-xs opacity-80">
        <p>
          {strings.reveal.source}:{" "}
          <a
            href={source.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2"
          >
            {source.sourceTitle}
          </a>
          , {strings.reveal.checkedOn}{" "}
          <time dateTime={source.checkedOn}>{formatIsoDate(source.checkedOn)}</time>
        </p>
        <button
          type="button"
          onClick={() => setReporting(true)}
          className="inline-flex min-h-11 items-center gap-1 underline underline-offset-2"
        >
          <IconFlag width={14} height={14} />
          {strings.reveal.report}
        </button>
      </footer>
      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        game={game}
        itemId={itemId}
      />
    </article>
  );
}
