"use client";

import { distanceKm, formatDistance, type DistanceUnit } from "@/engines/map/geo";
import type { MapAnswer } from "@/engines/map/state";
import { RevealCard } from "@/frame/RevealCard";
import { cx } from "@/frame/ui/cx";
import { formatIsoDate, formatNumber } from "@/lib/format";
import type { Band } from "../config";
import { GAME_SLUG, isComputed, type Question, type Target } from "../content.schema";
import { strings } from "../strings";
import { formatRecordDate } from "../text";
import styles from "./world.module.css";

function value(target: Target): string {
  return `${formatNumber(target.value)} ${target.unit}`;
}

/**
 * The reveal: "Turns out…", then the record (value, date, place, authority), every contender with
 * the official one marked, the player's best pin, and for computed questions when they were
 * computed and the nearest features. The source line comes from RevealCard.
 */
export function Reveal({
  question,
  answer,
  unit,
}: {
  question: Question;
  answer: MapAnswer<Band>;
  unit: DistanceUnit;
}) {
  const official = question.targets.find((t) => t.official) ?? question.targets[0]!;
  const best = answer.pins.reduce((a, b) => (b.points > a.points ? b : a), answer.pins[0]!);
  const disputed = question.targets.length > 1;
  return (
    <RevealCard
      game={GAME_SLUG}
      itemId={question.id}
      statement={question.turnsOut}
      source={question}
      className={cx(styles.panel, styles.card, "border-0")}
    >
      <h3 className="sr-only">{strings.reveal.title}</h3>
      <dl className={styles.dataList}>
        <dt>{strings.reveal.place}</dt>
        <dd className="font-semibold">{official.label}</dd>
        <dt>{strings.reveal.value}</dt>
        <dd className={cx(styles.display, "text-2xl")}>{value(official)}</dd>
        {official.date && (
          <>
            <dt>{strings.reveal.date}</dt>
            <dd>{formatRecordDate(official.date)}</dd>
          </>
        )}
        <dt>{strings.reveal.authority}</dt>
        <dd>{question.authority}</dd>
        <dt>{strings.reveal.yourPin}</dt>
        <dd>
          {best.perfect
            ? strings.reveal.bullseye
            : strings.reveal.away(formatDistance(best.km, unit))}
          {" · "}
          {strings.reveal.points(formatNumber(best.points))}
        </dd>
        {isComputed(question) && question.computedOn && (
          <>
            <dt>{strings.reveal.computedOn}</dt>
            <dd>{formatIsoDate(question.computedOn)}</dd>
          </>
        )}
        {question.dataAsOf && (
          <>
            <dt>{strings.reveal.dataAsOf}</dt>
            <dd>{formatIsoDate(question.dataAsOf)}</dd>
          </>
        )}
      </dl>

      {question.nearest && (
        <section className="mt-4">
          <h4 className={cx(styles.mono, styles.muted, "mb-1 text-xs uppercase")}>
            {strings.reveal.nearest}
          </h4>
          <ol className="list-decimal pl-5 text-sm">
            {question.nearest.map((n) => (
              <li key={`${n.name}-${n.lat}-${n.lon}`}>
                {strings.reveal.nearestItem(
                  n.name,
                  n.town,
                  formatDistance(distanceKm(n, official), unit),
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {disputed && (
        <section className="mt-4">
          <h4 className={cx(styles.mono, styles.muted, "mb-1 text-xs uppercase")}>
            {strings.reveal.contenders}
          </h4>
          <ul className="flex flex-col gap-1 text-sm">
            {question.targets.map((t, i) => (
              <li key={`${t.label}-${i}`} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className={cx(
                    "mt-1 size-3 shrink-0 rounded-full border-[3px]",
                    t.official ? "border-game-accent-3 bg-game-accent-3" : "border-game-accent-2",
                  )}
                />
                <span>
                  <span className="font-semibold">{t.label}</span>: {value(t)}
                  {t.date ? `, ${formatRecordDate(t.date)}` : ""}.{" "}
                  <span className={cx(styles.mono, "text-xs uppercase")}>
                    {t.official ? strings.reveal.official : strings.reveal.contender}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </RevealCard>
  );
}
