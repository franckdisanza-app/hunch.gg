"use client";

import type { ReactNode } from "react";
import { strings } from "./strings";
import { Button } from "./ui/Button";
import { Sheet } from "./ui/Dialog";

export interface HowToPlayContent {
  /** Exactly three short lines. */
  lines: readonly [string, string, string];
  /** Optional illustration or mini-demo in the game's style. */
  example?: ReactNode;
}

export function HowToPlaySheet({
  open,
  onClose,
  content,
}: {
  open: boolean;
  onClose: () => void;
  content: HowToPlayContent;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={strings.howTo.title}>
      <ol className="flex flex-col gap-3">
        {content.lines.map((line, i) => (
          <li key={i} className="flex gap-3">
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-frame-ink text-xs font-bold text-frame-bg tabular"
            >
              {i + 1}
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ol>
      {content.example && (
        <section className="mt-5 rounded-control border border-frame-line p-4">
          <h3 className="mb-2 text-sm font-semibold text-frame-muted">{strings.howTo.example}</h3>
          {content.example}
        </section>
      )}
      <Button variant="primary" size="lg" className="mt-6 w-full" onClick={onClose}>
        {strings.howTo.start}
      </Button>
    </Sheet>
  );
}
