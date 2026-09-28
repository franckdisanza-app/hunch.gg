import type { Route } from "next";
import type { ReactNode } from "react";
import { ButtonLink } from "@/frame/ui/Button";
import { cx } from "@/frame/ui/cx";
import type { MascotPose } from "@/games/types";
import { Tag } from "../art/Tag";
import { strings } from "../strings";
import { CutLine, Sign } from "./Bits";
import { Header } from "./Header";
import styles from "./world.module.css";

/**
 * While the shelf loads (and in the server HTML): the header, the sign and two blank shelf
 * labels in the places the real ones take, so the page is laid out from the first paint.
 */
export function LoadingShelf({ title, total }: { title: string; total?: number }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <Header title={title} pose="thinking" marks={[]} {...(total ? { total } : {})} />
      <Sign />
      <p className="sr-only" role="status">
        {strings.loading}
      </p>
      <div
        aria-hidden="true"
        className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-4"
      >
        <div className={styles.blankCard} />
        <CutLine />
        <div className={styles.blankCard} />
      </div>
    </div>
  );
}

/** A calm screen with Tag: loading, restocking, errors. */
export function StateScreen({
  pose,
  title,
  body,
  children,
  busy,
}: {
  pose: MascotPose;
  title: string;
  body?: string;
  children?: ReactNode;
  busy?: boolean;
}) {
  return (
    <section
      aria-busy={busy || undefined}
      className="flex flex-col items-center gap-4 py-12 text-center"
    >
      <Tag pose={pose} size={112} />
      <h1 className={cx(styles.display, "text-3xl")}>{title}</h1>
      {body && <p className="max-w-sm">{body}</p>}
      {children}
    </section>
  );
}

export function EndlessLink({ label = strings.results.playEndless }: { label?: string }) {
  return (
    <ButtonLink
      href={"/sticker-shock/unlimited" as Route}
      size="lg"
      className={cx(styles.bigButton, styles.display, "hover:opacity-100")}
    >
      {label}
    </ButtonLink>
  );
}
