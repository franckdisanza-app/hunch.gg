import type { Route } from "next";
import type { ReactNode } from "react";
import { ButtonLink } from "@/frame/ui/Button";
import { cx } from "@/frame/ui/cx";
import type { MascotPose } from "@/games/types";
import { Tag } from "../art/Tag";
import { strings } from "../strings";
import styles from "./world.module.css";

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
      <h2 className={cx(styles.display, "text-3xl")}>{title}</h2>
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
