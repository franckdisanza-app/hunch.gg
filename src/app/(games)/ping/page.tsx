import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { strings as frameStrings } from "@/frame/strings";
import { getGame, isGameReachable } from "@/games/registry";
import { DailyGame } from "@/games/ping/components/Daily";
import { PingShell } from "@/games/ping/PingShell";
import { strings } from "@/games/ping/strings";
import { fontClassName } from "./fonts";

const game = getGame("ping");

export function generateMetadata(): Metadata {
  if (!game || !isGameReachable(game)) return { title: frameStrings.notFound.title };
  return {
    title: strings.name,
    description: strings.tagline,
    alternates: { canonical: "/ping" },
  };
}

export default function PingPage() {
  if (!game || !isGameReachable(game)) notFound();
  return (
    <PingShell mode="daily" fontClassName={fontClassName}>
      <DailyGame />
    </PingShell>
  );
}
