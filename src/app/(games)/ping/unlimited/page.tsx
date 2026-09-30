import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { strings as frameStrings } from "@/frame/strings";
import { getGame, isGameReachable } from "@/games/registry";
import { PracticeGame } from "@/games/ping/components/Practice";
import { PingShell } from "@/games/ping/PingShell";
import { strings } from "@/games/ping/strings";
import { fontClassName } from "../fonts";

const game = getGame("ping");

export function generateMetadata(): Metadata {
  if (!game || !isGameReachable(game)) return { title: frameStrings.notFound.title };
  return {
    title: `${strings.name}: ${strings.unlimited}`,
    description: strings.tagline,
    alternates: { canonical: "/ping/unlimited" },
  };
}

export default function PingPracticePage() {
  if (!game || !isGameReachable(game)) notFound();
  return (
    <PingShell mode="unlimited" fontClassName={fontClassName}>
      <PracticeGame />
    </PingShell>
  );
}
