import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/frame/ui/cx";
import type { MascotPose } from "@/games/types";
import { Sonde } from "../art/Sonde";
import { strings } from "../strings";
import { Isobars } from "./Isobars";
import styles from "./world.module.css";

export const DAILY_HREF = "/ping" as Route;
export const PRACTICE_HREF = "/ping/unlimited" as Route;

/**
 * While the day loads (and in the server HTML): the header and an empty radar where the globe
 * goes, so the page is laid out from the first paint.
 */
export function LoadingRadar({ title }: { title: string }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <Sonde pose="thinking" size={48} className="shrink-0" />
        <h1 className={cx(styles.display, "text-2xl")}>{title}</h1>
      </header>
      <p className="sr-only" role="status">
        {strings.loading}
      </p>
      <div aria-hidden="true" className={cx(styles.panel, "h-24")} />
      <div aria-hidden="true" className={styles.globeWrap}>
        <Isobars className={styles.isobars} />
        <div className={styles.globePlaceholder} />
      </div>
    </div>
  );
}

/** A calm screen with Sonde: not launched, recalibrating, errors, empty practice. */
export function StateScreen({
  pose,
  title,
  body,
  children,
}: {
  pose: MascotPose;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col items-center gap-4 py-10 text-center">
      <Sonde pose={pose} size={112} />
      <h1 className={cx(styles.display, "text-2xl")}>{title}</h1>
      {body && <p className="max-w-sm">{body}</p>}
      <div className="flex w-full max-w-sm flex-col gap-3">{children}</div>
    </section>
  );
}

export function BigLink({
  href,
  children,
  variant = "secondary",
}: {
  href: Route;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link href={href} className={cx(styles.bigButton, styles[variant])}>
      {children}
    </Link>
  );
}
