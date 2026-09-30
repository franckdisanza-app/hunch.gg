import type { Metadata } from "next";
import { gameMetadata, reachableGame } from "@/frame/game-route";
import { StickerShockShell } from "@/games/sticker-shock/StickerShockShell";
import { DailyGame } from "@/games/sticker-shock/components/Daily";
import { strings } from "@/games/sticker-shock/strings";
import { fontClassName } from "./fonts";

export function generateMetadata(): Metadata {
  return gameMetadata("sticker-shock", {
    title: strings.name,
    description: strings.tagline,
    path: "/sticker-shock",
  });
}

export default function StickerShockPage() {
  reachableGame("sticker-shock");
  return (
    <StickerShockShell mode="daily" fontClassName={fontClassName}>
      <DailyGame />
    </StickerShockShell>
  );
}
