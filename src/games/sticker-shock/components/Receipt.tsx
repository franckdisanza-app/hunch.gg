"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useNow } from "@/frame/hooks";
import { cx } from "@/frame/ui/cx";
import { deviceTimeZone, msUntilNextPuzzle } from "@/lib/daily";
import { formatCountdown } from "@/lib/format";
import { Barcode } from "../art/Barcode";
import { strings } from "../strings";
import styles from "./world.module.css";

export interface ReceiptLineData {
  key: string;
  text: string;
  correct: boolean;
}

const TYPE_MS = 16;

/** Types `text` out one character at a time; all at once when motion is reduced. */
function useTypewriter(text: string, animate: boolean): string {
  const [shown, setShown] = useState(animate ? 0 : text.length);
  useEffect(() => {
    if (!animate) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= text.length) window.clearInterval(id);
    }, TYPE_MS);
    return () => window.clearInterval(id);
  }, [text, animate]);
  return animate ? text.slice(0, shown) : text;
}

function Mark({ correct }: { correct: boolean }) {
  return (
    <span className={styles.receiptMark}>
      <span aria-hidden="true">{correct ? "✓" : "✗"}</span>
      <span className="sr-only">{correct ? strings.receipt.right : strings.receipt.wrong}</span>
    </span>
  );
}

function Line({ line, typing }: { line: ReceiptLineData; typing: boolean }) {
  const typed = useTypewriter(line.text, typing);
  const done = typed.length === line.text.length;
  return (
    <li className={cx(styles.receiptLine, typing && styles.newLine)}>
      <span>
        <span aria-hidden="true">{typed}</span>
        <span className="sr-only">{line.text}</span>
      </span>
      {done ? <Mark correct={line.correct} /> : <span aria-hidden="true"> </span>}
    </li>
  );
}

/**
 * The receipt printer under the cards: each reveal feeds a line out of the slot and types it.
 * Hidden from the live region: the reveal is announced on its own.
 */
export function ReceiptPrinter({
  lines,
  animate,
  className,
}: {
  lines: readonly ReceiptLineData[];
  /** Type the newest line (false under reduced motion and when restoring a saved game). */
  animate: boolean;
  className?: string;
}) {
  return (
    <section aria-label={strings.receipt.printer} className={cx(styles.printer, className)}>
      <div className={styles.slot} aria-hidden="true" />
      {lines.length > 0 && (
        <div className={cx(styles.feed, styles.receipt, styles.receiptPaper, styles.mono)}>
          <ol className={styles.receiptLines}>
            {lines.map((line, i) => (
              <Line key={line.key} line={line} typing={animate && i === lines.length - 1} />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function Countdown() {
  const now = useNow(1000);
  return (
    <span role="timer" className="tabular">
      {now === null ? "--:--:--" : formatCountdown(msUntilNextPuzzle(now, deviceTimeZone()))}
    </span>
  );
}

export interface ReceiptProps {
  /** Header lines under the store name. */
  header: string;
  lines: readonly ReceiptLineData[];
  /** Label and value rows under the dashed rule: SCORE 8/10, STREAK 3, BEST 5. */
  totals: readonly [string, string][];
  /** Decorative barcode seed (the puzzle number). */
  code: string;
  /** Show "NEXT SHELF IN hh:mm:ss" (daily). */
  countdown?: boolean;
  /** A closing line instead of the countdown (Endless). */
  footer?: string;
  /** Slide up (daily results) or tear off (Endless). */
  motion?: "slide-up" | "torn" | "none";
  children?: ReactNode;
  className?: string;
}

/** The whole receipt: the results screen of a daily, or the torn-off strip of an Endless run. */
export function Receipt({
  header,
  lines,
  totals,
  code,
  countdown,
  footer,
  motion = "none",
  className,
}: ReceiptProps) {
  return (
    <div
      className={cx(
        styles.receipt,
        styles.receiptPaper,
        styles.mono,
        motion === "slide-up" && styles.slideUp,
        motion === "torn" && styles.torn,
        "mx-auto w-full max-w-sm",
        className,
      )}
    >
      <p className="text-center text-base font-bold">{strings.receipt.store}</p>
      <p className="text-center text-xs">{header}</p>
      <hr className={styles.dashedRule} />
      <ol className={styles.receiptLines}>
        {lines.map((line) => (
          <Line key={line.key} line={line} typing={false} />
        ))}
      </ol>
      <hr className={styles.dashedRule} />
      <dl className="flex flex-col gap-0.5 text-sm">
        {totals.map(([label, value], i) => (
          <div key={label} className={cx("flex justify-between", i === 0 && "text-lg font-bold")}>
            <dt>{label}</dt>
            <dd className="tabular">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-col items-center gap-1">
        <Barcode code={code} width={200} height={36} />
        <p className="text-xs tracking-[0.3em]" aria-hidden="true">
          {code}
        </p>
      </div>
      <p className="mt-2 text-center text-xs font-bold">{strings.receipt.thanks}</p>
      {countdown && (
        <p className="text-center text-xs">
          {strings.receipt.nextShelf} <Countdown />
        </p>
      )}
      {footer && <p className="text-center text-xs">{footer}</p>}
    </div>
  );
}
