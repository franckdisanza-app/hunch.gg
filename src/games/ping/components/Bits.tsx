import { cx } from "@/frame/ui/cx";
import { CategoryIcon } from "../art/CategoryIcon";
import type { Question } from "../content.schema";
import { strings } from "../strings";
import styles from "./world.module.css";

/** Shown whenever the game serves draft questions (sample: true). */
export function DraftBanner() {
  return (
    <p role="note" className={styles.draftBanner}>
      {strings.draftBanner}
    </p>
  );
}

/** "HEAT · WORLD" or "REGIONAL · SWITZERLAND", with the category's icon. */
export function CategoryTag({ question }: { question: Pick<Question, "category" | "scope"> }) {
  const { category, scope } = question;
  return (
    <span className={cx(styles.chip, styles.mono)}>
      <CategoryIcon category={category} size={16} className={styles.radar} />
      <span>{strings.category[category]}</span>
      <span aria-hidden="true">·</span>
      <span>{scope.level === "world" ? strings.scope.world : scope.name}</span>
    </span>
  );
}

/** Pins left as three dots (filled = still to drop), with the count for screen readers. */
export function PinsLeft({ left, total }: { left: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cx(
              "size-2.5 rounded-full border-2 border-current",
              i < left ? "bg-current" : "opacity-40",
            )}
          />
        ))}
      </span>
      <span className={cx(styles.mono, "text-xs font-semibold")}>{strings.pins.left(left)}</span>
    </span>
  );
}
