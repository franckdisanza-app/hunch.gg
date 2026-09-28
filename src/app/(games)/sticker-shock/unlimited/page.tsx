import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameShell } from "@/frame/GameShell";
import { strings as frameStrings } from "@/frame/strings";
import { getGame, isGameReachable } from "@/games/registry";
import { StickerShockGame } from "@/games/sticker-shock/StickerShockGame";
import { mascot } from "@/games/sticker-shock/mascot";
import { strings } from "@/games/sticker-shock/strings";
import { theme } from "@/games/sticker-shock/theme";

const game = getGame("sticker-shock");

export function generateMetadata(): Metadata {
  if (!game || !isGameReachable(game)) return { title: frameStrings.notFound.title };
  return {
    title: `${strings.name}: ${strings.unlimited}`,
    description: strings.tagline,
    alternates: { canonical: "/sticker-shock/unlimited" },
  };
}

export default function StickerShockUnlimitedPage() {
  if (!game || !isGameReachable(game)) notFound();
  // Until the game is live, its registry entry has no theme or mascot; use the local stubs.
  const definition = { ...game, theme: game.theme ?? theme, mascot: game.mascot ?? mascot };
  return (
    <GameShell game={definition} mode="unlimited" howTo={strings.howTo}>
      <StickerShockGame />
    </GameShell>
  );
}
