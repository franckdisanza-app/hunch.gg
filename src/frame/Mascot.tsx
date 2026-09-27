import type { MascotDefinition, MascotPose } from "@/games/types";
import { PLACEHOLDER_MASCOT_SRC } from "./placeholders";

export interface MascotProps {
  mascot?: MascotDefinition | undefined;
  pose?: MascotPose;
  /** Square size in CSS pixels. */
  size?: number;
  /** Decorative by default (empty alt). Pass a label when the pose carries meaning. */
  label?: string;
  className?: string;
}

/** A game's mascot in a given pose, or a neutral placeholder while the game has no art. */
export function Mascot({ mascot, pose = "idle", size = 96, label, className }: MascotProps) {
  const src = mascot?.poses[pose] ?? PLACEHOLDER_MASCOT_SRC;
  return (
    // Mascots are small SVGs: next/image would add client JavaScript and optimise nothing.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label ?? ""}
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      className={className}
      data-pose={pose}
    />
  );
}
