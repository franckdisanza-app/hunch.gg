import type { Metadata } from "next";
import { gameMetadata, reachableGame } from "@/frame/game-route";
import { StickerShockShell } from "@/games/sticker-shock/StickerShockShell";
import { EndlessGame } from "@/games/sticker-shock/components/Endless";
import { strings } from "@/games/sticker-shock/strings";
import { fontClassName } from "../fonts";

export function generateMetadata(): Metadata {
  return gameMetadata("sticker-shock", {
    title: `${strings.name}: ${strings.endless}`,
    description: strings.tagline,
    path: "/sticker-shock/unlimited",
  });
}

export default function StickerShockEndlessPage() {
  reachableGame("sticker-shock");
  return (
    <StickerShockShell mode="unlimited" fontClassName={fontClassName}>
      <EndlessGame />
    </StickerShockShell>
  );
}
