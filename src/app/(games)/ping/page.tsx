import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameShell } from "@/frame/GameShell";
import { strings as frameStrings } from "@/frame/strings";
import { getGame, isGameReachable } from "@/games/registry";
import { PingGame } from "@/games/ping/PingGame";
import { mascot } from "@/games/ping/mascot";
import { strings } from "@/games/ping/strings";
import { theme } from "@/games/ping/theme";

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
  // Until the game is live, its registry entry has no theme or mascot; use the local stubs.
  const definition = { ...game, theme: game.theme ?? theme, mascot: game.mascot ?? mascot };
  return (
    <GameShell game={definition} mode="daily" howTo={strings.howTo}>
      <PingGame />
    </GameShell>
  );
}
