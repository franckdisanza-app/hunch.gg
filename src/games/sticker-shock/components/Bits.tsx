import { cx } from "@/frame/ui/cx";
import { Scissors } from "../art/Scissors";
import { strings } from "../strings";
import styles from "./world.module.css";

/** The hand-lettered yellow sign: "WHICH COSTS MORE?" */
export function Sign({ className }: { className?: string }) {
  return (
    <p className={cx("flex justify-center", className)}>
      <span className={cx(styles.sign, styles.marker, "text-2xl uppercase sm:text-3xl")}>
        {strings.sign}
      </span>
    </p>
  );
}

/** A dashed cut-here line with "or" between the two cards. */
export function CutLine({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cx(styles.cutLine, className)}>
      <Scissors size={18} color="currentColor" />
      <span className={cx(styles.or, styles.display)}>{strings.or}</span>
    </div>
  );
}

/** Shown whenever the game serves sample data. */
export function SampleBanner() {
  return (
    <p role="note" className={styles.sampleBanner}>
      {strings.sampleBanner}
    </p>
  );
}
