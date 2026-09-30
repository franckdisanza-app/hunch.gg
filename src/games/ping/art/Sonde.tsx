import { cx } from "@/frame/ui/cx";
import type { MascotPose } from "@/games/types";
import styles from "./Sonde.module.css";
import { SondeArt } from "./SondeArt";

export interface SondeProps {
  pose?: MascotPose;
  /** 48 px in the game header, 96–120 px on state and results screens. */
  size?: number;
  /** Accessible name when the pose carries meaning; decorative otherwise. */
  title?: string;
  className?: string;
}

/**
 * Sonde with motion: bobs when idle, turns while thinking, puffs up at a bullseye, sags at a
 * miss, rises in a burst of ping rings when celebrating, and swings its box towards the answer.
 * Each new pose restarts its animation. Still under reduced motion.
 */
export function Sonde({ pose = "idle", size = 48, title, className }: SondeProps) {
  return (
    <SondeArt
      key={pose}
      pose={pose}
      size={size}
      {...(title ? { title } : {})}
      className={cx(styles[pose], className)}
      classes={{
        float: styles.float,
        balloon: styles.balloon,
        swing: styles.swing,
        antenna: styles.antenna,
        led: styles.led,
        rings: styles.rings,
      }}
    />
  );
}
