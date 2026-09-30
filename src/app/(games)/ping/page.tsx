import type { Metadata } from "next";
import { gameMetadata, reachableGame } from "@/frame/game-route";
import { PingShell } from "@/games/ping/PingShell";
import { DailyGame } from "@/games/ping/components/Daily";
import { strings } from "@/games/ping/strings";
import { fontClassName } from "./fonts";

export function generateMetadata(): Metadata {
  return gameMetadata("ping", {
    title: strings.name,
    description: strings.tagline,
    path: "/ping",
  });
}

export default function PingPage() {
  reachableGame("ping");
  return (
    <PingShell mode="daily" fontClassName={fontClassName}>
      <DailyGame />
    </PingShell>
  );
}
