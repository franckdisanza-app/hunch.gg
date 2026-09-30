import { formatDistance, type DistanceUnit } from "@/engines/map/geo";
import type { MapAnswer } from "@/engines/map/state";
import { cx } from "@/frame/ui/cx";
import { formatNumber } from "@/lib/format";
import { CategoryIcon } from "../art/CategoryIcon";
import type { Band } from "../config";
import type { Question } from "../content.schema";
import { pinSquares } from "../share";
import { strings } from "../strings";
import styles from "./world.module.css";

/** One row per question on the results: the answer, the pins as squares, the points. */
export function Summary({
  questions,
  answers,
  unit,
}: {
  questions: readonly Question[];
  answers: readonly MapAnswer<Band>[];
  unit: DistanceUnit;
}) {
  return (
    <ol className="flex w-full flex-col gap-2">
      {questions.map((question, i) => {
        const answer = answers[i];
        if (!answer) return null;
        const official = question.targets.find((t) => t.official) ?? question.targets[0]!;
        const best = answer.pins.reduce((a, b) => (b.points > a.points ? b : a), answer.pins[0]!);
        return (
          <li key={question.id} className={cx(styles.panel, "flex items-center gap-3 p-3")}>
            <CategoryIcon
              category={question.category}
              size={22}
              className={cx(styles.radar, "shrink-0")}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="sr-only">{strings.results.question(i + 1)}: </span>
              <span className="truncate text-sm font-semibold">{official.label}</span>
              <span className={cx(styles.mono, styles.muted, "text-xs")}>
                <span aria-hidden="true">{pinSquares(answer)} </span>
                {best.perfect
                  ? strings.reveal.bullseye
                  : strings.reveal.away(formatDistance(best.km, unit))}
              </span>
            </div>
            <span className={cx(styles.display, "text-lg tabular")}>
              {strings.results.points(formatNumber(answer.score))}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
