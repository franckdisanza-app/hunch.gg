"use client";

import { formatNumber, formatPercent } from "@/lib/format";
import { effectiveStreak, type Stats, type Unlimited } from "@/lib/storage";
import { strings } from "./strings";
import { Sheet } from "./ui/Dialog";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <dd className="text-2xl font-bold tabular">{value}</dd>
      <dt className="text-xs text-frame-muted">{label}</dt>
    </div>
  );
}

export interface StatsSheetProps {
  open: boolean;
  onClose: () => void;
  stats: Stats;
  unlimited?: Unlimited | undefined;
  /** Today's puzzle number, to tell whether the streak is still alive. */
  todayPuzzle: number | null;
  /** Label a score for the distribution chart, e.g. (s) => `${s}/5`. */
  formatScore?: (score: number) => string;
}

export function StatsSheet({
  open,
  onClose,
  stats,
  unlimited,
  todayPuzzle,
  formatScore = (s) => formatNumber(s),
}: StatsSheetProps) {
  const completion = stats.played === 0 ? 0 : stats.completed / stats.played;
  const streak = todayPuzzle === null ? stats.currentStreak : effectiveStreak(stats, todayPuzzle);
  const scores = Object.entries(stats.histogram)
    .map(([score, count]) => [Number(score), count] as const)
    .sort(([a], [b]) => a - b);
  const maxCount = Math.max(1, ...scores.map(([, count]) => count));

  return (
    <Sheet open={open} onClose={onClose} title={strings.stats.title}>
      <dl className="grid grid-cols-4 gap-2">
        <Stat label={strings.stats.played} value={formatNumber(stats.played)} />
        <Stat label={strings.stats.completed} value={formatPercent(completion)} />
        <Stat label={strings.stats.currentStreak} value={formatNumber(streak)} />
        <Stat label={strings.stats.bestStreak} value={formatNumber(stats.bestStreak)} />
      </dl>

      <h3 className="mt-6 mb-2 text-sm font-semibold">{strings.stats.distribution}</h3>
      {scores.length === 0 ? (
        <p className="text-sm text-frame-muted">{strings.stats.noScores}</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {scores.map(([score, count]) => (
              <tr key={score}>
                <th scope="row" className="w-12 py-0.5 pr-2 text-right font-medium tabular">
                  {formatScore(score)}
                </th>
                <td className="py-0.5">
                  <div
                    className="min-w-7 rounded-[4px] bg-frame-ink px-2 text-right text-xs leading-6 font-semibold text-frame-bg tabular"
                    style={{ width: `${Math.max(8, (count / maxCount) * 100)}%` }}
                  >
                    {formatNumber(count)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {unlimited && (
        <>
          <h3 className="mt-6 mb-2 text-sm font-semibold">{strings.stats.unlimited}</h3>
          <dl className="grid grid-cols-2 gap-2">
            <Stat label={strings.stats.bestRun} value={formatNumber(unlimited.bestRun)} />
            <Stat label={strings.stats.runsPlayed} value={formatNumber(unlimited.runsPlayed)} />
          </dl>
        </>
      )}
    </Sheet>
  );
}
