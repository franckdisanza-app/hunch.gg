import type { MascotPose } from "@/games/types";
import { cx } from "@/frame/ui/cx";
import styles from "./Tag.module.css";
import { TagArt } from "./TagArt";

export interface TagProps {
  pose?: MascotPose;
  /** 48 px in the game header, 96–120 px on the results screen. */
  size?: number;
  /** Accessible name when the pose carries meaning; decorative otherwise. */
  title?: string;
  className?: string;
}

/**
 * Tag with motion: swings on its string when idle, jolts at a sticker shock, spins when it
 * celebrates. Each new pose restarts its animation. Static under reduced motion.
 */
export function Tag({ pose = "idle", size = 48, title, className }: TagProps) {
  return (
    <TagArt
      key={pose}
      pose={pose}
      size={size}
      {...(title ? { title } : {})}
      className={cx(styles[pose], className)}
      classes={{
        swing: styles.swing,
        body: styles.body,
        burst: styles.burst,
        sparkle: styles.sparkle,
      }}
    />
  );
}
