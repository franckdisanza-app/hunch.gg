import type { ReactNode } from "react";
import { cx } from "@/frame/ui/cx";
import type { MascotPose } from "@/games/types";
import { Tag } from "../art/Tag";
import styles from "./world.module.css";

/**
 * The top of the game: Tag (48 px), the puzzle heading, and under it a strip of receipt marks for
 * the pairs played so far (✓ or ✗, never colour alone).
 */
export function Header({
  title,
  pose,
  marks,
  total,
  children,
}: {
  title: string;
  pose: MascotPose;
  marks: readonly boolean[];
  /** Pairs in the day; unset for Endless. */
  total?: number;
  /** A line under the title instead of the marks (Endless: the run). */
  children?: ReactNode;
}) {
  const slots = total ?? 0;
  return (
    <header className="flex items-center gap-3">
      <Tag pose={pose} size={48} className="shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className={cx(styles.display, "text-2xl")}>{title}</h1>
        {slots > 0 && (
          <ol aria-hidden="true" className={cx(styles.mono, "flex gap-1 text-xs")}>
            {Array.from({ length: slots }, (_, i) => (
              <li
                key={i}
                className={cx(
                  "grid size-[18px] place-items-center rounded-[3px] border-2 border-current font-bold",
                  marks[i] === true && "bg-game-accent-2 text-[#1b1b1b]",
                  marks[i] === false && "bg-game-accent-1 text-white",
                )}
              >
                {marks[i] === undefined ? "" : marks[i] ? "✓" : "✗"}
              </li>
            ))}
          </ol>
        )}
        {children}
      </div>
    </header>
  );
}
