import { cx } from "@/frame/ui/cx";
import { strings } from "../strings";
import styles from "./demo.module.css";

/**
 * The how-to example: two made-up items, a pick, a stamp and a printed receipt line, looping.
 * `className` carries the game's font variables (the sheet renders outside the game world).
 */
export function HowToDemo({ className }: { className?: string }) {
  const { a, b, line, label } = strings.demo;
  return (
    <figure className={cx(styles.demo, className)} aria-label={label} role="img">
      <div className={styles.cards} aria-hidden="true">
        <div className={styles.card}>
          <div className={styles.strip}>{a.country}</div>
          <div className={styles.title}>{a.title}</div>
        </div>
        <div className={cx(styles.card, styles.picked)}>
          <div className={styles.strip}>{b.country}</div>
          <div className={styles.title}>{b.title}</div>
          <span className={styles.stamp}>✓ {strings.stamp.right}</span>
        </div>
      </div>
      <div className={styles.receipt} aria-hidden="true">
        <span className={styles.line}>{line}</span>
      </div>
    </figure>
  );
}
