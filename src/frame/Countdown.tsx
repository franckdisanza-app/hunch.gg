"use client";

import { deviceTimeZone, msUntilNextPuzzle } from "@/lib/daily";
import { formatCountdown } from "@/lib/format";
import { useNow } from "./hooks";
import { strings } from "./strings";
import { cx } from "./ui/cx";

/** Time left until the next puzzle unlocks at the player's local midnight. */
export function Countdown({
  className,
  label = strings.results.nextPuzzle,
}: {
  className?: string;
  label?: string;
}) {
  const now = useNow(1000);
  const text =
    now === null ? "--:--:--" : formatCountdown(msUntilNextPuzzle(now, deviceTimeZone()));
  return (
    <p className={cx("flex flex-col items-center gap-1", className)}>
      <span className="text-sm text-frame-muted">{label}</span>
      {/* role="timer" is not announced on every tick, which is what we want. */}
      <span role="timer" className="text-2xl font-bold tabular">
        {text}
      </span>
    </p>
  );
}
