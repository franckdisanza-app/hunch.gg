import type { Metadata } from "next";
import { gameMetadata, reachableGame } from "@/frame/game-route";
import { PingShell } from "@/games/ping/PingShell";
import { PracticeGame } from "@/games/ping/components/Practice";
import { strings } from "@/games/ping/strings";
import { fontClassName } from "../fonts";

export function generateMetadata(): Metadata {
  return gameMetadata("ping", {
    title: `${strings.name}: ${strings.unlimited}`,
    description: strings.tagline,
    path: "/ping/unlimited",
  });
}

export default function PingPracticePage() {
  reachableGame("ping");
  return (
    <PingShell mode="unlimited" fontClassName={fontClassName}>
      <PracticeGame />
    </PingShell>
  );
}
