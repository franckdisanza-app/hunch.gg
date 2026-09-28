"use client";

import { useState, type ReactNode } from "react";
import type { Source } from "@/games/content";
import { formatIsoDate } from "@/lib/format";
import { LazyReportDialog } from "./lazy";
import { strings } from "./strings";
import { cx } from "./ui/cx";
import { IconFlag } from "./ui/Icons";

export type RevealSource = Pick<Source, "sourceTitle" | "sourceUrl" | "checkedOn">;

export interface RevealCardProps {
  game: string;
  /** The fact's item ID, attached to reports. */
  itemId: string;
  /** Completes "Turns out…", e.g. "the fake widget costs more." */
  statement: ReactNode;
  /** The numbers: prices, percentages, dates. Styled by the game. */
  children?: ReactNode;
  /** Where the numbers come from: one source, or several when the reveal compares facts. */
  source: RevealSource | readonly RevealSource[];
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
  const sources: readonly RevealSource[] = Array.isArray(source)
    ? source
    : [source as RevealSource];
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
          {sources.length > 1 ? strings.reveal.sources : strings.reveal.source}:{" "}
          {sources.map((s, i) => (
            <span key={`${s.sourceUrl}-${i}`}>
              {i > 0 && "; "}
              <a
                href={s.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2"
              >
                {s.sourceTitle}
              </a>
              , {strings.reveal.checkedOn}{" "}
              <time dateTime={s.checkedOn}>{formatIsoDate(s.checkedOn)}</time>
            </span>
          ))}
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
      {reporting && (
        <LazyReportDialog open onClose={() => setReporting(false)} game={game} itemId={itemId} />
      )}
    </article>
  );
}
