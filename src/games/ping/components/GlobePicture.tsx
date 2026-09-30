import { cx } from "@/frame/ui/cx";
import styles from "./world.module.css";

const LIGHT = "/games/ping/globe-light.svg";
const DARK = "/games/ping/globe-dark.svg";

/**
 * The globe as a world question first shows it (WORLD_VIEW, 1:110m land), as a picture in the
 * theme's colours (`pnpm ping:art`): there from the first paint, before any JavaScript, and under
 * the canvas globe, which leaves it showing (its `backdrop`) until the view changes or a pin lands.
 * Decorative: the globe itself is labelled.
 *
 * It is the page's largest paint, so only one file downloads: the one for the system's colour
 * scheme, preloaded from the head so it does not queue behind the scripts. A theme picked in the
 * settings that differs from the system's hides it, and the canvas draws at once instead.
 */
export function GlobePicture() {
  return (
    <>
      {/* React hoists these into <head>. Plain elements rather than preload(): React sends a
          high-priority image preload() as a Link header, which a prerendered page never has. */}
      <link
        rel="preload"
        as="image"
        href={LIGHT}
        media="not all and (prefers-color-scheme: dark)"
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        href={DARK}
        media="(prefers-color-scheme: dark)"
        fetchPriority="high"
      />
      {/* A plain image: next/image would add JavaScript and optimise nothing for an SVG. */}
      <picture>
        <source media="(prefers-color-scheme: dark)" srcSet={DARK} />
        <img
          src={LIGHT}
          alt=""
          width={400}
          height={400}
          fetchPriority="high"
          className={cx(styles.globePicture, styles.systemScheme)}
        />
      </picture>
    </>
  );
}

/** Whether the picture shows now: the page follows the system's colour scheme (see the CSS). */
export function globePictureVisible(): boolean {
  const theme = document.documentElement.getAttribute("data-theme");
  if (theme !== "light" && theme !== "dark") return true;
  return (theme === "dark") === window.matchMedia("(prefers-color-scheme: dark)").matches;
}
