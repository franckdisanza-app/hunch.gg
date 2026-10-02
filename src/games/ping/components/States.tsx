import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { FillScreen } from "@/frame/FillScreen";
import { cx } from "@/frame/ui/cx";
import type { MascotPose } from "@/games/types";
import { Sonde } from "../art/Sonde";
import { strings } from "../strings";
import { GlobeStage } from "./GlobeView";
import styles from "./world.module.css";

export const DAILY_HREF = "/ping" as Route;
export const PRACTICE_HREF = "/ping/unlimited" as Route;

/**
 * While the day loads (and in the server HTML): the play screen's layout with an empty question
 * and the globe picture, so nothing moves when the board takes over.
 */
export function LoadingRadar({ title }: { title: string }) {
  return (
    <FillScreen aria-busy="true">
      <div className={styles.play}>
        <header className={styles.status}>
          <Sonde pose="thinking" size={44} className="shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className={cx(styles.display, "text-xl")}>{title}</h1>
            {/* The board's question chips, unfilled: the same height. */}
            <p aria-hidden="true" className={cx(styles.mono, "flex gap-2 text-xs opacity-0")}>
              <span className="rounded-full border px-2 py-0.5">Q</span>
            </p>
          </div>
        </header>
        <p className="sr-only" role="status">
          {strings.loading}
        </p>
        <div aria-hidden="true" className={cx(styles.panel, styles.question, "h-24")} />
        <GlobeStage />
        <div aria-hidden="true" className={styles.hints}>
          <div className={styles.hintStrip} />
        </div>
        <div aria-hidden="true" className={styles.action}>
          <div className={cx(styles.bigButton, styles.placeholder)} />
        </div>
      </div>
    </FillScreen>
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
