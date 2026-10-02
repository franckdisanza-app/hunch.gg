import type { ComponentProps } from "react";
import { cx } from "./ui/cx";

/**
 * A game screen that fills the screen under the top bar and never scrolls the page: a globe, a
 * board. While one is mounted, the shell locks the page to the screen's height and hands the game
 * the full width (the "fill screens" rules in globals.css); the game lays itself out inside and
 * scrolls only inner panels that must. A game's other screens (results) stay ordinary pages.
 */
export function FillScreen({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-frame-fill="" className={cx("flex min-h-0 flex-1 flex-col", className)} {...props} />
  );
}
