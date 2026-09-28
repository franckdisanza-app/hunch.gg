import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { strings as frameStrings } from "@/frame/strings";
import { getGame, isGameReachable } from "@/games/registry";
import { DailyGame } from "@/games/sticker-shock/components/Daily";
import { StickerShockShell } from "@/games/sticker-shock/StickerShockShell";
import { strings } from "@/games/sticker-shock/strings";
import { fontClassName } from "./fonts";

const game = getGame("sticker-shock");

export function generateMetadata(): Metadata {
  if (!game || !isGameReachable(game)) return { title: frameStrings.notFound.title };
  return {
    title: strings.name,
    description: strings.tagline,
    alternates: { canonical: "/sticker-shock" },
  };
}

export default function StickerShockPage() {
  if (!game || !isGameReachable(game)) notFound();
  return (
    <StickerShockShell mode="daily" fontClassName={fontClassName}>
      <DailyGame />
    </StickerShockShell>
  );
}
