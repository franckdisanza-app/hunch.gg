import { cx } from "@/frame/ui/cx";
import styles from "./world.module.css";

/**
 * The globe as it first shows (world view, 1:110m land), as a picture in the theme's colours
 * (`pnpm ping:art`): there from the first paint, before any JavaScript, and under the canvas
 * globe, which draws over it once its shapes have loaded. Decorative: the globe itself is labelled.
 */
export function GlobePicture() {
  return (
    <>
      {/* Plain images: next/image would add JavaScript and optimise nothing for an SVG. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/games/ping/globe-light.svg"
        alt=""
        width={400}
        height={400}
        className={cx(styles.globePicture, styles.lightOnly)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/games/ping/globe-dark.svg"
        alt=""
        width={400}
        height={400}
        className={cx(styles.globePicture, styles.darkOnly)}
      />
    </>
  );
}
